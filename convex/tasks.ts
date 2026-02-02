import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
  },
});
