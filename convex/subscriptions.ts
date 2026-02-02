import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const subscribe = mutation({
  args: {
    agentId: v.id("agents"),
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_agent_task", (q) =>
        q.eq("agentId", args.agentId).eq("taskId", args.taskId),
      )
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("subscriptions", {
      agentId: args.agentId,
      taskId: args.taskId,
      createdAt: Date.now(),
    });
  },
});

export const unsubscribe = mutation({
  args: {
    agentId: v.id("agents"),
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_agent_task", (q) =>
        q.eq("agentId", args.agentId).eq("taskId", args.taskId),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
  },
});

export const listByAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_agent_task", (q) => q.eq("agentId", args.agentId))
      .collect();
  },
});
