import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getById = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

const ensureSubscription = async (
  ctx: { db: { query: any; insert: any } },
  agentId: string,
  taskId: string,
  createdAt: number,
) => {
  const existing = await ctx.db
    .query("subscriptions")
    .withIndex("by_agent_task", (q: any) => q.eq("agentId", agentId).eq("taskId", taskId))
    .first();
  if (existing) return existing._id;
  return await ctx.db.insert("subscriptions", { agentId, taskId, createdAt });
};

export const list = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").withIndex("by_created").order("desc").collect();
    const agentsById = new Map();

    for (const task of tasks) {
      for (const assigneeId of task.assigneeIds) {
        if (!agentsById.has(assigneeId)) {
          const agent = await ctx.db.get(assigneeId);
          if (agent) {
            agentsById.set(assigneeId, {
              _id: agent._id,
              name: agent.name,
              avatarEmoji: agent.avatarEmoji,
              level: agent.level,
            });
          }
        }
      }
    }

    return tasks.map((task) => ({
      ...task,
      assignees: task.assigneeIds
        .map((id) => agentsById.get(id))
        .filter((assignee) => assignee),
    }));
  },
});

export const listUpdatedSince = query({
  args: { since: v.number() },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_created")
      .filter((q) => q.gte(q.field("updatedAt"), args.since))
      .order("desc")
      .collect();
    const agentsById = new Map();

    for (const task of tasks) {
      for (const assigneeId of task.assigneeIds) {
        if (!agentsById.has(assigneeId)) {
          const agent = await ctx.db.get(assigneeId);
          if (agent) {
            agentsById.set(assigneeId, {
              _id: agent._id,
              name: agent.name,
              avatarEmoji: agent.avatarEmoji,
              level: agent.level,
            });
          }
        }
      }
    }

    return tasks.map((task) => ({
      ...task,
      assignees: task.assigneeIds
        .map((id) => agentsById.get(id))
        .filter((assignee) => assignee),
    }));
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    tags: v.array(v.string()),
    assigneeIds: v.array(v.id("agents")),
    creatorId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const taskId = await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      status: "inbox",
      priority: args.priority,
      tags: args.tags,
      assigneeIds: args.assigneeIds,
      creatorId: args.creatorId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("activities", {
      agentId: args.creatorId,
      action: "create",
      targetType: "task",
      targetId: taskId,
      description: `created task: ${args.title}`,
      createdAt: now,
    });

    if (args.creatorId) {
      await ensureSubscription(ctx, args.creatorId, taskId, now);
    }

    // Notify and subscribe all assignees
    for (const assigneeId of args.assigneeIds) {
      await ensureSubscription(ctx, assigneeId, taskId, now);
      await ctx.db.insert("notifications", {
        agentId: assigneeId,
        type: "mention" as const,
        message: `You were assigned to: ${args.title}`,
        sourceTaskId: taskId,
        read: false,
        delivered: false,
        createdAt: now,
      });
    }

    return taskId;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: v.union(
      v.literal("inbox"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done")
    ),
    agentId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.id, { status: args.status, updatedAt: now });
    const task = await ctx.db.get(args.id);

    await ctx.db.insert("activities", {
      agentId: args.agentId,
      action: "status",
      targetType: "status",
      targetId: args.id,
      description: `moved task: ${task?.title ?? "Untitled"} → ${args.status}`,
      createdAt: now,
    });
  },
});

export const assign = mutation({
  args: {
    id: v.id("tasks"),
    agentId: v.id("agents"),
    actorId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) return;

    const assigneeIds = task.assigneeIds.includes(args.agentId)
      ? task.assigneeIds
      : [...task.assigneeIds, args.agentId];

    await ctx.db.patch(args.id, { assigneeIds, updatedAt: Date.now() });

    await ctx.db.insert("activities", {
      agentId: args.actorId,
      action: "assign",
      targetType: "task",
      targetId: args.id,
      description: `assigned agent to: ${task.title}`,
      createdAt: Date.now(),
    });

    await ensureSubscription(ctx, args.agentId, args.id, Date.now());
  },
});
