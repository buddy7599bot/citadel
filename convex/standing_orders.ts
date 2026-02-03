import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("standing_orders").collect();
  },
});

export const listForAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("standing_orders")
      .withIndex("by_active", (q) => q.eq("active", true).eq("agentId", args.agentId))
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("standing_orders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    agentId: v.id("agents"),
    goal: v.string(),
    metrics: v.optional(v.string()),
    priority: v.union(v.literal("primary"), v.literal("secondary")),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("standing_orders", {
      agentId: args.agentId,
      goal: args.goal,
      metrics: args.metrics,
      priority: args.priority,
      active: args.active ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("standing_orders"),
    goal: v.optional(v.string()),
    metrics: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("primary"), v.literal("secondary"))),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (fields.goal !== undefined) patch.goal = fields.goal;
    if (fields.metrics !== undefined) patch.metrics = fields.metrics;
    if (fields.priority !== undefined) patch.priority = fields.priority;
    if (fields.active !== undefined) patch.active = fields.active;
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("standing_orders") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
