import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getTradingData = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const data = await ctx.db
      .query("trading_data")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();
    if (!data) return null;

    const positions = await ctx.db
      .query("trading_positions")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    return { ...data, positions };
  },
});

export const getSocialMetrics = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("social_metrics")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();
  },
});

export const getSecurityScans = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("security_scans")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();
  },
});

export const getJobPipeline = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("job_pipeline")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();
  },
});

export const getBuildStatus = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("build_status")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();
  },
});

export const updateTradingData = mutation({
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
      const existingPositions = await ctx.db
        .query("trading_positions")
        .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
        .collect();
      await Promise.all(existingPositions.map((position) => ctx.db.delete(position._id)));
      for (const position of args.positions) {
        await ctx.db.insert("trading_positions", {
          agentId: args.agentId,
          pair: position.pair,
          direction: position.direction,
          pnlPercent: position.pnlPercent,
          entryPrice: position.entryPrice,
          currentPrice: position.currentPrice,
          createdAt: now,
        });
      }
    }
  },
});

export const updateSocialMetrics = mutation({
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
    const existing = await ctx.db
      .query("social_metrics")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();

    const payload = {
      agentId: args.agentId,
      followers: args.followers,
      followersWeekChange: args.followersWeekChange,
      viewsToday: args.viewsToday,
      engagementRate: args.engagementRate,
      scheduledPosts: args.scheduledPosts,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("social_metrics", payload);
    }
  },
});

export const updateSecurityScans = mutation({
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
    const existing = await ctx.db
      .query("security_scans")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();

    const payload = {
      agentId: args.agentId,
      openPorts: args.openPorts,
      lastScanAt: args.lastScanAt,
      criticalVulns: args.criticalVulns,
      mediumVulns: args.mediumVulns,
      lowVulns: args.lowVulns,
      firewallRules: args.firewallRules,
      failedSshAttempts: args.failedSshAttempts,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("security_scans", payload);
    }
  },
});

export const updateJobPipeline = mutation({
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
    const existing = await ctx.db
      .query("job_pipeline")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();

    const payload = {
      agentId: args.agentId,
      activeApplications: args.activeApplications,
      applied: args.applied,
      interviewing: args.interviewing,
      offers: args.offers,
      newListingsToday: args.newListingsToday,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("job_pipeline", payload);
    }
  },
});

export const updateBuildStatus = mutation({
  args: {
    agentId: v.id("agents"),
    activeProjects: v.number(),
    commitsToday: v.number(),
    allGreen: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("build_status")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();

    const payload = {
      agentId: args.agentId,
      activeProjects: args.activeProjects,
      commitsToday: args.commitsToday,
      allGreen: args.allGreen,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("build_status", payload);
    }
  },
});

export const seedDomainData = mutation({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();
    if (agents.length === 0) return;

    const now = Date.now();

    for (const [index, agent] of agents.entries()) {
      const seed = index + 1;

      const tradingExisting = await ctx.db
        .query("trading_data")
        .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
        .first();
      if (!tradingExisting) {
        await ctx.db.insert("trading_data", {
          agentId: agent._id,
          portfolioValue: 32000 + seed * 1450.5,
          portfolioChange: 1.8 + seed * 0.6,
          monthlyPnl: 620 + seed * 45.25,
          winRate: 52 + seed * 3.1,
          updatedAt: now - seed * 12 * 60 * 1000,
        });
      }

      const positionsExisting = await ctx.db
        .query("trading_positions")
        .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
        .collect();
      if (positionsExisting.length === 0) {
        const pairs = ["BTC/USDT", "ETH/USDT", "SOL/USDT"];
        for (const [posIndex, pair] of pairs.entries()) {
          await ctx.db.insert("trading_positions", {
            agentId: agent._id,
            pair,
            direction: posIndex % 2 === 0 ? "Long" : "Short",
            pnlPercent: (posIndex % 2 === 0 ? 1 : -1) * (1.2 + seed * 0.4 + posIndex * 0.8),
            entryPrice: 120 + seed * 12 + posIndex * 5.5,
            currentPrice: 120 + seed * 12 + posIndex * 5.5 + (posIndex % 2 === 0 ? 8 : -6),
            createdAt: now - (posIndex + 1) * 60 * 60 * 1000,
          });
        }
      }

      const socialExisting = await ctx.db
        .query("social_metrics")
        .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
        .first();
      if (!socialExisting) {
        await ctx.db.insert("social_metrics", {
          agentId: agent._id,
          followers: 980 + seed * 85,
          followersWeekChange: 12 + seed * 3,
          viewsToday: 2100 + seed * 320,
          engagementRate: 2.6 + seed * 0.35,
          scheduledPosts: 1 + (seed % 4),
          updatedAt: now - seed * 9 * 60 * 1000,
        });
      }

      const securityExisting = await ctx.db
        .query("security_scans")
        .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
        .first();
      if (!securityExisting) {
        await ctx.db.insert("security_scans", {
          agentId: agent._id,
          openPorts: 2 + (seed % 2),
          lastScanAt: now - (seed * 55 + 20) * 60 * 1000,
          criticalVulns: seed % 2 === 0 ? 1 : 0,
          mediumVulns: 1 + (seed % 3),
          lowVulns: 2 + (seed % 4),
          firewallRules: 10 + seed * 2,
          failedSshAttempts: 18 + seed * 5,
          updatedAt: now - seed * 14 * 60 * 1000,
        });
      }

      const jobExisting = await ctx.db
        .query("job_pipeline")
        .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
        .first();
      if (!jobExisting) {
        await ctx.db.insert("job_pipeline", {
          agentId: agent._id,
          activeApplications: 3 + (seed % 4),
          applied: 2 + seed,
          interviewing: 1 + (seed % 2),
          offers: seed % 3 === 0 ? 1 : 0,
          newListingsToday: 4 + seed,
          updatedAt: now - seed * 7 * 60 * 1000,
        });
      }

      const buildExisting = await ctx.db
        .query("build_status")
        .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
        .first();
      if (!buildExisting) {
        await ctx.db.insert("build_status", {
          agentId: agent._id,
          activeProjects: 4 + seed,
          commitsToday: 3 + seed * 2,
          allGreen: seed % 3 !== 0,
          updatedAt: now - seed * 11 * 60 * 1000,
        });
      }
    }
  },
});
