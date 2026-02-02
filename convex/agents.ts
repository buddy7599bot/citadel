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
