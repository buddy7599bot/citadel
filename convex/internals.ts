import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getAgentByName = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

export const heartbeatInternal = internalMutation({
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
        description: `updated status: ${agent.status} \u2192 ${args.status}`,
        createdAt: now,
      });
    }
    return agent._id;
  },
});

export const updateTradingInternal = internalMutation({
  args: {
    agentId: v.id("agents"),
    portfolioValue: v.number(),
    portfolioChange: v.number(),
    monthlyPnl: v.number(),
    winRate: v.number(),
    positions: v.optional(
      v.array(
        v.object({
          pair: v.string(),
          direction: v.string(),
          pnlPercent: v.number(),
          entryPrice: v.number(),
          currentPrice: v.number(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("trading_data")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        portfolioValue: args.portfolioValue,
        portfolioChange: args.portfolioChange,
        monthlyPnl: args.monthlyPnl,
        winRate: args.winRate,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("trading_data", {
        agentId: args.agentId,
        portfolioValue: args.portfolioValue,
        portfolioChange: args.portfolioChange,
        monthlyPnl: args.monthlyPnl,
        winRate: args.winRate,
        updatedAt: now,
      });
    }
    if (args.positions) {
      const old = await ctx.db.query("trading_positions").withIndex("by_agent", (q) => q.eq("agentId", args.agentId)).collect();
      for (const p of old) await ctx.db.delete(p._id);
      for (const p of args.positions) {
        await ctx.db.insert("trading_positions", { agentId: args.agentId, ...p, createdAt: now });
      }
    }
  },
});

export const updateSocialInternal = internalMutation({
  args: {
    agentId: v.id("agents"),
    followers: v.number(),
    followersWeekChange: v.number(),
    viewsToday: v.number(),
    engagementRate: v.number(),
    scheduledPosts: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db.query("social_metrics").withIndex("by_agent", (q) => q.eq("agentId", args.agentId)).first();
    const payload = { ...args, updatedAt: now };
    if (existing) await ctx.db.patch(existing._id, payload);
    else await ctx.db.insert("social_metrics", payload);
  },
});

export const updateSecurityInternal = internalMutation({
  args: {
    agentId: v.id("agents"),
    openPorts: v.number(),
    lastScanAt: v.number(),
    criticalVulns: v.number(),
    mediumVulns: v.number(),
    lowVulns: v.number(),
    firewallRules: v.number(),
    failedSshAttempts: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db.query("security_scans").withIndex("by_agent", (q) => q.eq("agentId", args.agentId)).first();
    const payload = { ...args, updatedAt: now };
    if (existing) await ctx.db.patch(existing._id, payload);
    else await ctx.db.insert("security_scans", payload);
  },
});

export const updateJobsInternal = internalMutation({
  args: {
    agentId: v.id("agents"),
    activeApplications: v.number(),
    applied: v.number(),
    interviewing: v.number(),
    offers: v.number(),
    newListingsToday: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db.query("job_pipeline").withIndex("by_agent", (q) => q.eq("agentId", args.agentId)).first();
    const payload = { ...args, updatedAt: now };
    if (existing) await ctx.db.patch(existing._id, payload);
    else await ctx.db.insert("job_pipeline", payload);
  },
});

export const updateBuildInternal = internalMutation({
  args: {
    agentId: v.id("agents"),
    activeProjects: v.number(),
    commitsToday: v.number(),
    allGreen: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db.query("build_status").withIndex("by_agent", (q) => q.eq("agentId", args.agentId)).first();
    const payload = { ...args, updatedAt: now };
    if (existing) await ctx.db.patch(existing._id, payload);
    else await ctx.db.insert("build_status", payload);
  },
});

export const createTaskInternal = internalMutation({
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

export const updateTaskStatusInternal = internalMutation({
  args: {
    id: v.id("tasks"),
    status: v.union(v.literal("inbox"), v.literal("assigned"), v.literal("in_progress"), v.literal("review"), v.literal("done")),
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
      description: `moved task: ${task?.title ?? "Untitled"} \u2192 ${args.status}`,
      createdAt: now,
    });
  },
});

export const logActivityInternal = internalMutation({
  args: {
    agentId: v.optional(v.id("agents")),
    action: v.string(),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("activities", { ...args, createdAt: Date.now() });
  },
});
