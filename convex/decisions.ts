import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_created")
      .order("desc")
      .collect();

    const agentsById = new Map();
    for (const decision of decisions) {
      if (decision.agentId && !agentsById.has(decision.agentId)) {
        const agent = await ctx.db.get(decision.agentId);
        if (agent) {
          agentsById.set(decision.agentId, {
            _id: agent._id,
            name: agent.name,
            avatarEmoji: agent.avatarEmoji,
            level: agent.level,
          });
        }
      }
    }

    return decisions.map((decision) => ({
      ...decision,
      agent: decision.agentId ? agentsById.get(decision.agentId) : null,
    }));
  },
});

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();

    const agentsById = new Map();
    for (const decision of decisions) {
      if (decision.agentId && !agentsById.has(decision.agentId)) {
        const agent = await ctx.db.get(decision.agentId);
        if (agent) {
          agentsById.set(decision.agentId, {
            _id: agent._id,
            name: agent.name,
            avatarEmoji: agent.avatarEmoji,
            level: agent.level,
          });
        }
      }
    }

    return decisions.map((decision) => ({
      ...decision,
      agent: decision.agentId ? agentsById.get(decision.agentId) : null,
    }));
  },
});

export const create = mutation({
  args: {
    agentId: v.optional(v.id("agents")),
    agentName: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    taskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    let agentId = args.agentId;
    if (!agentId && args.agentName) {
      const agentName = args.agentName;
      const agent = await ctx.db
        .query("agents")
        .withIndex("by_name", (q) => q.eq("name", agentName))
        .first();
      if (agent) agentId = agent._id;
    }
    if (!agentId) {
      throw new Error("Missing or invalid agentId/agentName");
    }
    const now = Date.now();
    const decisionId = await ctx.db.insert("decisions", {
      agentId,
      title: args.title,
      description: args.description ?? "",
      options: args.options,
      status: "pending",
      resolution: undefined,
      resolvedAt: undefined,
      taskId: args.taskId,
      createdAt: now,
      comments: [],
    });

    await ctx.db.insert("activities", {
      agentId,
      action: "create",
      targetType: "decision",
      targetId: decisionId,
      description: `requested decision: ${args.title}`,
      createdAt: now,
    });

    return decisionId;
  },
});

export const resolve = mutation({
  args: {
    id: v.id("decisions"),
    status: v.union(v.literal("approved"), v.literal("rejected"), v.literal("resolved")),
    resolution: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      resolution: args.resolution,
      resolvedAt: Date.now(),
    });
  },
});

export const addComment = mutation({
  args: {
    id: v.id("decisions"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const decision = await ctx.db.get(args.id);
    if (!decision) return;
    const now = Date.now();
    const comments = [...(decision.comments ?? []), { text: args.text, createdAt: now }];
    await ctx.db.patch(args.id, { comments });
  },
});
