import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { targetType: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let queryBuilder = ctx.db.query("activities").withIndex("by_created");
    if (args.targetType) {
      queryBuilder = queryBuilder.filter((q) => q.eq(q.field("targetType"), args.targetType));
    }
    const activities = await queryBuilder.order("desc").take(50);

    const agentsById = new Map();
    for (const activity of activities) {
      if (activity.agentId && !agentsById.has(activity.agentId)) {
        const agent = await ctx.db.get(activity.agentId);
        if (agent) {
          agentsById.set(activity.agentId, {
            _id: agent._id,
            name: agent.name,
            avatarEmoji: agent.avatarEmoji,
          });
        }
      }
    }

    return activities.map((activity) => ({
      ...activity,
      agent: activity.agentId ? agentsById.get(activity.agentId) : null,
    }));
  },
});

export const log = mutation({
  args: {
    agentId: v.optional(v.id("agents")),
    action: v.string(),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("activities", {
      agentId: args.agentId,
      action: args.action,
      targetType: args.targetType,
      targetId: args.targetId,
      description: args.description,
      createdAt: Date.now(),
    });
  },
});
