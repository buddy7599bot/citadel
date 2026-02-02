import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
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

function getAgentName(request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get("agent");
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
    const STATUS_MAP: Record<string, string> = {
      online: "working",
      offline: "idle",
      active: "working",
    };
    const mappedStatus = STATUS_MAP[body.status] || body.status;
    const result = await ctx.runMutation(internal.internals.heartbeatInternal, {
      sessionKey: body.sessionKey,
      status: mappedStatus,
      currentTask: body.currentTask,
    });
    return json({ ok: true, agentId: result });
  }),
});

// GET /api/my-tasks?agent=Name
http.route({
  path: "/api/my-tasks",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!checkAuth(request)) return unauthorized();
    const agentName = getAgentName(request);
    if (!agentName) return json({ error: "Missing agent parameter" }, 400);
    const agent = await resolveAgent(ctx, agentName);
    if (!agent) return json({ error: `Agent not found: ${agentName}` }, 404);
    const tasks = await ctx.runQuery(internal.internals.getTasksForAgent, {
      agentId: agent._id as Id<"agents">,
    });
    return json({ tasks });
  }),
});

// GET /api/my-notifications?agent=Name
http.route({
  path: "/api/my-notifications",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!checkAuth(request)) return unauthorized();
    const agentName = getAgentName(request);
    if (!agentName) return json({ error: "Missing agent parameter" }, 400);
    const agent = await resolveAgent(ctx, agentName);
    if (!agent) return json({ error: `Agent not found: ${agentName}` }, 404);
    const notifications = await ctx.runQuery(
      internal.internals.getUnreadNotifications,
      { agentId: agent._id as Id<"agents"> }
    );
    if (notifications.length > 0) {
      await ctx.runMutation(internal.internals.markNotificationsRead, {
        agentId: agent._id as Id<"agents">,
        notificationIds: notifications.map((notification) => notification._id),
      });
    }
    return json({ notifications });
  }),
});

// GET /api/my-mentions?agent=Name
http.route({
  path: "/api/my-mentions",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!checkAuth(request)) return unauthorized();
    const agentName = getAgentName(request);
    if (!agentName) return json({ error: "Missing agent parameter" }, 400);
    const mentions = await ctx.runQuery(internal.internals.getRecentMentions, {
      agentName,
    });
    return json({ mentions });
  }),
});

// GET /api/my-status?agent=Name
http.route({
  path: "/api/my-status",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!checkAuth(request)) return unauthorized();
    const agentName = getAgentName(request);
    if (!agentName) return json({ error: "Missing agent parameter" }, 400);
    const agent = await resolveAgent(ctx, agentName);
    if (!agent) return json({ error: `Agent not found: ${agentName}` }, 404);
    const [trading, social, security, jobs, build] = await Promise.all([
      ctx.runQuery(api.domain.getTradingData, { agentId: agent._id }),
      ctx.runQuery(api.domain.getSocialMetrics, { agentId: agent._id }),
      ctx.runQuery(api.domain.getSecurityScans, { agentId: agent._id }),
      ctx.runQuery(api.domain.getJobPipeline, { agentId: agent._id }),
      ctx.runQuery(api.domain.getBuildStatus, { agentId: agent._id }),
    ]);
    return json({
      agent,
      domainData: {
        trading,
        social,
        security,
        jobs,
        build,
      },
    });
  }),
});

// POST /api/trading
http.route({
  path: "/api/trading",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!checkAuth(request)) return unauthorized();
    const body = await request.json();
    const agentName = body.agentName || body.name || body.agent;
    if (!agentName) {
      return json({ error: "Missing agentName, name, or agent field" }, 400);
    }
    const agent = await resolveAgent(ctx, agentName);
    if (!agent) return json({ error: `Agent not found: ${agentName}` }, 404);
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
    const agentName = body.agentName || body.name || body.agent;
    if (!agentName) {
      return json({ error: "Missing agentName, name, or agent field" }, 400);
    }
    const agent = await resolveAgent(ctx, agentName);
    if (!agent) return json({ error: `Agent not found: ${agentName}` }, 404);
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
    const agentName = body.agentName || body.name || body.agent;
    if (!agentName) {
      return json({ error: "Missing agentName, name, or agent field" }, 400);
    }
    const agent = await resolveAgent(ctx, agentName);
    if (!agent) return json({ error: `Agent not found: ${agentName}` }, 404);
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
    const agentName = body.agentName || body.name || body.agent;
    if (!agentName) {
      return json({ error: "Missing agentName, name, or agent field" }, 400);
    }
    const agent = await resolveAgent(ctx, agentName);
    if (!agent) return json({ error: `Agent not found: ${agentName}` }, 404);
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
    const agentName = body.agentName || body.name || body.agent;
    if (!agentName) {
      return json({ error: "Missing agentName, name, or agent field" }, 400);
    }
    const agent = await resolveAgent(ctx, agentName);
    if (!agent) return json({ error: `Agent not found: ${agentName}` }, 404);
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
    const assigneeNames = body.assigneeNames ?? body.assignees ?? body.agents ?? [];
    for (const name of assigneeNames) {
      const agent = await resolveAgent(ctx, name);
      if (agent) assigneeIds.push(agent._id as Id<"agents">);
    }
    let creatorId: Id<"agents"> | undefined;
    const creatorName = body.creatorName || body.name || body.agent;
    if (!creatorName) {
      return json({ error: "Missing agentName, name, or agent field" }, 400);
    }
    const creator = await resolveAgent(ctx, creatorName);
    if (creator) creatorId = creator._id as Id<"agents">;
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
    const agentName = body.agentName || body.name || body.agent;
    if (!agentName) {
      return json({ error: "Missing agentName, name, or agent field" }, 400);
    }
    let agentId: Id<"agents"> | undefined;
    const agent = await resolveAgent(ctx, agentName);
    if (agent) agentId = agent._id as Id<"agents">;
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
    const agentName = body.agentName || body.name || body.agent;
    if (!agentName) {
      return json({ error: "Missing agentName, name, or agent field" }, 400);
    }
    let agentId: Id<"agents"> | undefined;
    const agent = await resolveAgent(ctx, agentName);
    if (agent) agentId = agent._id as Id<"agents">;
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

// POST /api/document
http.route({
  path: "/api/document",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!checkAuth(request)) return unauthorized();
    const body = await request.json();
    const agentName = body.agentName || body.agent;
    if (!agentName) return json({ error: "Missing agentName" }, 400);
    const agent = await resolveAgent(ctx, agentName);
    if (!agent) return json({ error: `Agent not found: ${agentName}` }, 404);
    const docId = await ctx.runMutation(
      internal.internals.createDocumentInternal,
      {
        agentId: agent._id as Id<"agents">,
        title: body.title || "Untitled",
        content: body.content || "",
        type: body.type || "deliverable",
        taskId: body.taskId as Id<"tasks"> | undefined,
      }
    );
    return json({ ok: true, documentId: docId });
  }),
});

// GET /api/documents?agent=Name
http.route({
  path: "/api/documents",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!checkAuth(request)) return unauthorized();
    const agentName = getAgentName(request);
    if (!agentName) return json({ error: "Missing agent parameter" }, 400);
    const agent = await resolveAgent(ctx, agentName);
    if (!agent) return json({ error: `Agent not found: ${agentName}` }, 404);
    const docs = await ctx.runQuery(internal.internals.getDocumentsByAgent, {
      agentId: agent._id as Id<"agents">,
    });
    return json({ documents: docs });
  }),
});

// POST /api/comment
http.route({
  path: "/api/comment",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!checkAuth(request)) return unauthorized();
    const body = await request.json();
    const agentName = body.agentName || body.agent;
    if (!agentName) return json({ error: "Missing agentName or agent field" }, 400);
    if (!body.taskId) return json({ error: "Missing taskId" }, 400);
    if (!body.content) return json({ error: "Missing content" }, 400);
    const agent = await resolveAgent(ctx, agentName);
    if (!agent) return json({ error: `Agent not found: ${agentName}` }, 404);
    await ctx.runMutation(api.messages.create, {
      taskId: body.taskId as Id<"tasks">,
      agentId: agent._id as Id<"agents">,
      content: body.content,
    });
    return json({ ok: true });
  }),
});

export default http;
