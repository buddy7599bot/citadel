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

export const listInbox = query({
  args: {},
  handler: async (ctx) => {
    const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "inbox"))
      .collect();
    return tasks
      .filter((task) => task.assigneeIds.length === 0)
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
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
    const creator = args.creatorId ? await ctx.db.get(args.creatorId) : null;
    const creatorName = creator?.name ?? "System";

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
        authorAgentId: args.creatorId,
        authorName: creatorName,
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

export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    assigneeIds: v.optional(v.array(v.id("agents"))),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const now = Date.now();
    const task = await ctx.db.get(id);
    if (!task) return;
    const creator = task.creatorId ? await ctx.db.get(task.creatorId) : null;
    const creatorName = creator?.name ?? "System";

    const patch: Record<string, unknown> = { updatedAt: now };
    if (fields.title !== undefined) patch.title = fields.title;
    if (fields.description !== undefined) patch.description = fields.description;
    if (fields.tags !== undefined) patch.tags = fields.tags;
    if (fields.assigneeIds !== undefined) patch.assigneeIds = fields.assigneeIds;
    if (fields.priority !== undefined) patch.priority = fields.priority;
    await ctx.db.patch(id, patch);

    // Detect newly added assignees and notify them
    if (fields.assigneeIds !== undefined) {
      const oldIds = new Set(task.assigneeIds.map((id: any) => id.toString()));
      for (const newId of fields.assigneeIds) {
        if (!oldIds.has(newId.toString())) {
          // New assignee - create notification, activity, and subscription
          await ctx.db.insert("notifications", {
            agentId: newId,
            authorAgentId: task.creatorId,
            authorName: creatorName,
            type: "mention" as const,
            message: `You were assigned to: ${task.title}`,
            sourceTaskId: id,
            read: false,
            delivered: false,
            createdAt: now,
          });
          await ctx.db.insert("activities", {
            agentId: newId,
            action: "assign" as const,
            targetType: "task" as const,
            targetId: id,
            description: `assigned to: ${task.title}`,
            createdAt: now,
          });
          await ensureSubscription(ctx, newId, id, now);
        }
      }
    }
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
