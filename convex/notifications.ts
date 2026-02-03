import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const notifications = await ctx.db
      .query("notifications")
      .order("desc")
      .take(100);
    return await Promise.all(
      notifications.map(async (n) => {
        const agent = await ctx.db.get(n.agentId);
        const task = n.sourceTaskId ? await ctx.db.get(n.sourceTaskId) : null;
        const author = n.authorAgentId ? await ctx.db.get(n.authorAgentId) : null;
        return {
          ...n,
          agentName: agent?.name ?? "Unknown",
          authorName: n.authorName ?? author?.name ?? "Unknown",
          taskTitle: task?.title ?? null,
        };
      })
    );
  },
});

export const listForAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notifications")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .filter((q) => q.eq(q.field("read"), false))
      .collect();
  },
});

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { read: true });
  },
});

export const markDelivered = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { delivered: true });
  },
});

export const listUndelivered = query({
  args: {},
  handler: async (ctx) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_undelivered", (q) => q.eq("delivered", false))
      .order("asc")
      .take(50);

    return await Promise.all(
      notifications.map(async (notification) => {
        const agent = await ctx.db.get(notification.agentId);
        return {
          ...notification,
          agentName: agent?.name ?? "Unknown",
          agentSessionKey: agent?.sessionKey ?? null,
        };
      })
    );
  },
});
