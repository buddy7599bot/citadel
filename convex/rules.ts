import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const SCOPE_BY_AGENT: Record<string, string> = {
  Buddy: "coordination",
  Katy: "social",
  Burry: "trading",
  Mike: "security",
  Jerry: "jobs",
  Elon: "building",
};

export const list = query({
  args: {
    scope: v.optional(
      v.union(
        v.literal("global"),
        v.literal("social"),
        v.literal("trading"),
        v.literal("security"),
        v.literal("jobs"),
        v.literal("building"),
        v.literal("coordination")
      )
    ),
    tier: v.optional(v.union(v.literal("critical"), v.literal("standard"))),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const scope = args.scope;
    const tier = args.tier;
    const active = args.active;
    
    let rules;
    if (scope !== undefined && active !== undefined) {
      rules = await ctx.db.query("rules")
        .withIndex("by_scope", (q) => q.eq("scope", scope).eq("active", active))
        .collect();
    } else if (tier !== undefined && active !== undefined) {
      rules = await ctx.db.query("rules")
        .withIndex("by_tier", (q) => q.eq("tier", tier).eq("active", active))
        .collect();
    } else {
      rules = await ctx.db.query("rules").collect();
    }
    return rules
      .filter((rule) => (scope ? rule.scope === scope : true))
      .filter((rule) => (tier ? rule.tier === tier : true))
      .filter((rule) => (active !== undefined ? rule.active === active : true))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const listForAgent = query({
  args: { agentName: v.string() },
  handler: async (ctx, args) => {
    const scope = SCOPE_BY_AGENT[args.agentName];
    const rules = await ctx.db.query("rules").collect();
    return rules
      .filter((rule) => rule.active)
      .filter((rule) => rule.scope === "global" || (scope && rule.scope === scope))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getById = query({
  args: { id: v.id("rules") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    text: v.string(),
    why: v.string(),
    scope: v.union(
      v.literal("global"),
      v.literal("social"),
      v.literal("trading"),
      v.literal("security"),
      v.literal("jobs"),
      v.literal("building"),
      v.literal("coordination")
    ),
    tier: v.union(v.literal("critical"), v.literal("standard")),
    checkable: v.boolean(),
    checkPattern: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("rules", {
      text: args.text,
      why: args.why,
      scope: args.scope,
      tier: args.tier,
      checkable: args.checkable,
      checkPattern: args.checkPattern,
      active: args.active ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("rules"),
    text: v.optional(v.string()),
    why: v.optional(v.string()),
    scope: v.optional(
      v.union(
        v.literal("global"),
        v.literal("social"),
        v.literal("trading"),
        v.literal("security"),
        v.literal("jobs"),
        v.literal("building"),
        v.literal("coordination")
      )
    ),
    tier: v.optional(v.union(v.literal("critical"), v.literal("standard"))),
    checkable: v.optional(v.boolean()),
    checkPattern: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (fields.text !== undefined) patch.text = fields.text;
    if (fields.why !== undefined) patch.why = fields.why;
    if (fields.scope !== undefined) patch.scope = fields.scope;
    if (fields.tier !== undefined) patch.tier = fields.tier;
    if (fields.checkable !== undefined) patch.checkable = fields.checkable;
    if (fields.checkPattern !== undefined) patch.checkPattern = fields.checkPattern;
    if (fields.active !== undefined) patch.active = fields.active;
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("rules") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
