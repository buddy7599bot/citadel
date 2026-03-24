import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agents").withIndex("by_name").collect();
  },
});

export const getById = query({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getBySessionKey = query({
  args: { sessionKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_session", (q) => q.eq("sessionKey", args.sessionKey))
      .first();
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("agents"),
    status: v.union(v.literal("idle"), v.literal("working"), v.literal("blocked")),
    currentTask: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      currentTask: args.currentTask,
      lastActive: Date.now(),
    });
  },
});

export const heartbeat = mutation({
  args: {
    sessionKey: v.string(),
    status: v.union(v.literal("idle"), v.literal("working"), v.literal("blocked")),
    currentTask: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_session", (q) => q.eq("sessionKey", args.sessionKey))
      .first();
    if (!agent) return null;

    const now = Date.now();
    await ctx.db.patch(agent._id, {
      status: args.status,
      currentTask: args.currentTask,
      lastActive: now,
    });

    if (agent.status !== args.status) {
      await ctx.db.insert("activities", {
        agentId: agent._id,
        action: "status",
        targetType: "agent",
        targetId: agent._id,
        description: `updated status: ${agent.status} → ${args.status}`,
        createdAt: now,
      });
    }

    return agent._id;
  },
});

export const updateProfile = mutation({
  args: {
    id: v.id("agents"),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    avatarEmoji: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    level: v.optional(v.union(v.literal("lead"), v.literal("specialist"), v.literal("intern"))),
    workspace: v.optional(v.union(v.literal("main"), v.literal("dashpane"), v.literal("both"))),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    const filtered = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    await ctx.db.patch(id, filtered);
    return { ok: true };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    status: v.union(v.literal("idle"), v.literal("working"), v.literal("blocked")),
    level: v.union(v.literal("lead"), v.literal("specialist"), v.literal("intern")),
    lastActive: v.number(),
    avatarEmoji: v.string(),
    workspace: v.optional(v.union(v.literal("main"), v.literal("dashpane"), v.literal("both"))),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agents", args);
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("agents").first();
    if (existing) return;

    const now = Date.now();
    const agents = [
      {
        name: "Buddy",
        role: "Coordinator",
        status: "working" as const,
        currentTask: "Aligning mission queue",
        sessionKey: "alpha",
        level: "lead" as const,
        lastActive: now - 2 * 60 * 1000,
        avatarEmoji: "🤖",
      },
      {
        name: "Katy",
        role: "Growth",
        status: "working" as const,
        currentTask: "Signal amplification",
        sessionKey: "delta",
        level: "specialist" as const,
        lastActive: now - 7 * 60 * 1000,
        avatarEmoji: "📣",
      },
      {
        name: "Burry",
        role: "Trading",
        status: "idle" as const,
        currentTask: "Market scan",
        sessionKey: "bravo",
        level: "specialist" as const,
        lastActive: now - 22 * 60 * 1000,
        avatarEmoji: "📈",
      },
      {
        name: "Elon",
        role: "Builder",
        status: "working" as const,
        currentTask: "Prototype refactor",
        sessionKey: "gamma",
        level: "specialist" as const,
        lastActive: now - 4 * 60 * 1000,
        avatarEmoji: "🚀",
      },
      {
        name: "Mike",
        role: "Security",
        status: "blocked" as const,
        currentTask: "Access review",
        sessionKey: "omega",
        level: "specialist" as const,
        lastActive: now - 45 * 60 * 1000,
        avatarEmoji: "🛡️",
      },
      {
        name: "Jerry",
        role: "Jobs",
        status: "idle" as const,
        currentTask: "Candidate pipeline",
        sessionKey: "sigma",
        level: "specialist" as const,
        lastActive: now - 95 * 60 * 1000,
        avatarEmoji: "💼",
      },
    ];

    for (const agent of agents) {
      await ctx.db.insert("agents", agent);
    }
  },
});
