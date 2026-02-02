import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const API_KEY_FALLBACK = "citadel-alliance-2026";

function checkAuth(request: Request): boolean {
  const key = request.headers.get("X-Citadel-Key");
  const expected = process.env.CITADEL_API_KEY || API_KEY_FALLBACK;
  return key === expected;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function unauthorized() {
  return json({ error: "Unauthorized" }, 401);
}

async function resolveAgent(ctx: { runQuery: Function }, name: string) {
  return await ctx.runQuery(internal.internals.getAgentByName, { name });
}

const http = httpRouter();

// POST /api/heartbeat
http.route({
  path: "/api/heartbeat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!checkAuth(request)) return unauthorized();
    const body = await request.json();
    const result = await ctx.runMutation(internal.internals.heartbeatInternal, {
      sessionKey: body.sessionKey,
      status: body.status,
      currentTask: body.currentTask,
    });
    return json({ ok: true, agentId: result });
  }),
});

// POST /api/trading
http.route({
  path: "/api/trading",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!checkAuth(request)) return unauthorized();
    const body = await request.json();
    const agent = await resolveAgent(ctx, body.agentName);
    if (!agent) return json({ error: `Agent not found: ${body.agentName}` }, 404);
    await ctx.runMutation(internal.internals.updateTradingInternal, {
      agentId: agent._id as Id<"agents">,
      portfolioValue: body.portfolioValue,
      portfolioChange: body.portfolioChange,
      monthlyPnl: body.monthlyPnl,
      winRate: body.winRate,
      positions: body.positions,
    });
    return json({ ok: true });
  }),
});

// POST /api/social
http.route({
  path: "/api/social",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!checkAuth(request)) return unauthorized();
    const body = await request.json();
    const agent = await resolveAgent(ctx, body.agentName);
    if (!agent) return json({ error: `Agent not found: ${body.agentName}` }, 404);
    await ctx.runMutation(internal.internals.updateSocialInternal, {
      agentId: agent._id as Id<"agents">,
      followers: body.followers,
      followersWeekChange: body.followersWeekChange,
      viewsToday: body.viewsToday,
      engagementRate: body.engagementRate,
      scheduledPosts: body.scheduledPosts,
    });
    return json({ ok: true });
  }),
});

// POST /api/security
http.route({
  path: "/api/security",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!checkAuth(request)) return unauthorized();
    const body = await request.json();
    const agent = await resolveAgent(ctx, body.agentName);
    if (!agent) return json({ error: `Agent not found: ${body.agentName}` }, 404);
    await ctx.runMutation(internal.internals.updateSecurityInternal, {
      agentId: agent._id as Id<"agents">,
      openPorts: body.openPorts,
      lastScanAt: body.lastScanAt,
      criticalVulns: body.criticalVulns,
      mediumVulns: body.mediumVulns,
      lowVulns: body.lowVulns,
      firewallRules: body.firewallRules,
      failedSshAttempts: body.failedSshAttempts,
    });
    return json({ ok: true });
  }),
});

// POST /api/jobs
http.route({
  path: "/api/jobs",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!checkAuth(request)) return unauthorized();
    const body = await request.json();
    const agent = await resolveAgent(ctx, body.agentName);
    if (!agent) return json({ error: `Agent not found: ${body.agentName}` }, 404);
    await ctx.runMutation(internal.internals.updateJobsInternal, {
      agentId: agent._id as Id<"agents">,
      activeApplications: body.activeApplications,
      applied: body.applied,
      interviewing: body.interviewing,
      offers: body.offers,
      newListingsToday: body.newListingsToday,
    });
    return json({ ok: true });
  }),
});

// POST /api/build
http.route({
  path: "/api/build",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!checkAuth(request)) return unauthorized();
    const body = await request.json();
    const agent = await resolveAgent(ctx, body.agentName);
    if (!agent) return json({ error: `Agent not found: ${body.agentName}` }, 404);
    await ctx.runMutation(internal.internals.updateBuildInternal, {
      agentId: agent._id as Id<"agents">,
      activeProjects: body.activeProjects,
      commitsToday: body.commitsToday,
      allGreen: body.allGreen,
    });
    return json({ ok: true });
  }),
});

// POST /api/task
http.route({
  path: "/api/task",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!checkAuth(request)) return unauthorized();
    const body = await request.json();
    const assigneeIds: Id<"agents">[] = [];
    for (const name of body.assigneeNames ?? []) {
      const agent = await resolveAgent(ctx, name);
      if (agent) assigneeIds.push(agent._id as Id<"agents">);
    }
    let creatorId: Id<"agents"> | undefined;
    if (body.creatorName) {
      const creator = await resolveAgent(ctx, body.creatorName);
      if (creator) creatorId = creator._id as Id<"agents">;
    }
    const taskId = await ctx.runMutation(internal.internals.createTaskInternal, {
      title: body.title,
      description: body.description,
      priority: body.priority ?? "medium",
      tags: body.tags ?? [],
      assigneeIds,
      creatorId,
    });
    return json({ ok: true, taskId });
  }),
});

// POST /api/task/status
http.route({
  path: "/api/task/status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!checkAuth(request)) return unauthorized();
    const body = await request.json();
    let agentId: Id<"agents"> | undefined;
    if (body.agentName) {
      const agent = await resolveAgent(ctx, body.agentName);
      if (agent) agentId = agent._id as Id<"agents">;
    }
    await ctx.runMutation(internal.internals.updateTaskStatusInternal, {
      id: body.taskId as Id<"tasks">,
      status: body.status,
      agentId,
    });
    return json({ ok: true });
  }),
});

// POST /api/activity
http.route({
  path: "/api/activity",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!checkAuth(request)) return unauthorized();
    const body = await request.json();
    let agentId: Id<"agents"> | undefined;
    if (body.agentName) {
      const agent = await resolveAgent(ctx, body.agentName);
      if (agent) agentId = agent._id as Id<"agents">;
    }
    await ctx.runMutation(internal.internals.logActivityInternal, {
      agentId,
      action: body.action,
      targetType: body.targetType,
      targetId: body.targetId,
      description: body.description,
    });
    return json({ ok: true });
  }),
});

export default http;
