import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    messages.sort((a, b) => a.createdAt - b.createdAt);

    const agentsById = new Map();
    for (const message of messages) {
      if (!agentsById.has(message.agentId)) {
        const agent = await ctx.db.get(message.agentId);
        if (agent) {
          agentsById.set(message.agentId, {
            _id: agent._id,
            name: agent.name,
            avatarEmoji: agent.avatarEmoji,
          });
        }
      }
    }

    return messages.map((message) => ({
      ...message,
      agent: agentsById.get(message.agentId),
    }));
  },
});

export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    agentId: v.id("agents"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("messages", {
      taskId: args.taskId,
      agentId: args.agentId,
      content: args.content,
      createdAt: now,
    });

    const task = await ctx.db.get(args.taskId);
    await ctx.db.insert("activities", {
      agentId: args.agentId,
      action: "comment",
      targetType: "comment",
      targetId: args.taskId,
      description: `commented on: ${task?.title ?? "Untitled"}`,
      createdAt: now,
    });
  },
});
