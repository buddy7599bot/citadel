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
    const creator = args.creatorId ? await ctx.db.get(args.creatorId) : null;
    const creatorName = creator?.name ?? "System";
    await ctx.db.insert("activities", {
      agentId: args.creatorId,
      action: "create",
      targetType: "task",
      targetId: taskId,
      description: `created task: ${args.title}`,
      createdAt: now,
    });

    // Notify and subscribe all assignees
    for (const assigneeId of args.assigneeIds) {
      // Subscribe assignee
      const existingSub = await ctx.db
        .query("subscriptions")
        .withIndex("by_agent_task", (q: any) =>
          q.eq("agentId", assigneeId).eq("taskId", taskId)
        )
        .first();
      if (!existingSub) {
        await ctx.db.insert("subscriptions", {
          agentId: assigneeId,
          taskId,
          createdAt: now,
        });
      }
      await ctx.db.insert("notifications", {
        agentId: assigneeId,
        authorAgentId: args.creatorId,
        authorName: creatorName,
        type: "mention",
        message: `You were assigned to: ${args.title}`,
        sourceTaskId: taskId,
        read: false,
        delivered: false,
        createdAt: now,
      });
    }

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

export const getTasksForAgent = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db.query("tasks").collect();
    const assigned = tasks.filter((task) =>
      task.assigneeIds.some((id) => id === args.agentId)
    );
    const agents = await ctx.db.query("agents").collect();
    const agentById = new Map(agents.map((agent) => [agent._id, agent.name]));
    return assigned.map((task) => ({
      _id: task._id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      tags: task.tags,
      assignees: task.assigneeIds
        .map((id) => agentById.get(id))
        .filter((name): name is string => Boolean(name)),
      createdAt: task.createdAt,
    }));
  },
});

export const getUnreadNotifications = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notifications")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .filter((q) => q.eq(q.field("read"), false))
      .collect();
  },
});

export const getRecentMentions = internalQuery({
  args: { agentName: v.string() },
  handler: async (ctx, args) => {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const needle = `@${args.agentName}`;
    const messages = await ctx.db.query("messages").collect();
    const recent = messages
      .filter(
        (message) =>
          message.createdAt >= since && message.content.includes(needle)
      )
      .sort((a, b) => b.createdAt - a.createdAt);

    const agentIds = Array.from(new Set(recent.map((message) => message.agentId)));
    const taskIds = Array.from(new Set(recent.map((message) => message.taskId)));
    const agents = await Promise.all(agentIds.map((id) => ctx.db.get(id)));
    const tasks = await Promise.all(taskIds.map((id) => ctx.db.get(id)));
    const agentById = new Map(
      agents.filter(Boolean).map((agent) => [agent!._id, agent!.name])
    );
    const taskById = new Map(
      tasks.filter(Boolean).map((task) => [task!._id, task!])
    );

    return recent.map((message) => {
      const task = taskById.get(message.taskId);
      return {
        taskId: message.taskId,
        taskTitle: task?.title ?? "Untitled",
        from: agentById.get(message.agentId) ?? "Unknown",
        content: message.content,
        createdAt: message.createdAt,
      };
    });
  },
});

export const markNotificationsRead = internalMutation({
  args: { agentId: v.id("agents"), notificationIds: v.array(v.id("notifications")) },
  handler: async (ctx, args) => {
    for (const id of args.notificationIds) {
      const notification = await ctx.db.get(id);
      if (!notification || notification.agentId !== args.agentId) continue;
      await ctx.db.patch(id, { delivered: true, read: true });
    }
  },
});

export const fixSessionKeys = internalMutation({
  args: {},
  handler: async (ctx) => {
    const mapping: Record<string, string> = {
      Buddy: "main",
      Katy: "kt",
      Burry: "trader",
      Mike: "guard",
      Jerry: "jobs",
      Elon: "builder",
    };
    const agents = await ctx.db.query("agents").collect();
    for (const agent of agents) {
      const newKey = mapping[agent.name];
      if (newKey && agent.sessionKey !== newKey) {
        await ctx.db.patch(agent._id, { sessionKey: newKey });
      }
    }
    return { updated: Object.keys(mapping).length };
  },
});

export const createDocumentInternal = internalMutation({
  args: {
    agentId: v.id("agents"),
    title: v.string(),
    content: v.string(),
    type: v.union(
      v.literal("deliverable"),
      v.literal("research"),
      v.literal("protocol"),
      v.literal("report")
    ),
    taskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const docId = await ctx.db.insert("documents", {
      title: args.title,
      content: args.content,
      type: args.type,
      taskId: args.taskId,
      authorId: args.agentId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("activities", {
      agentId: args.agentId,
      action: "document_created",
      targetType: "document",
      targetId: docId,
      description: `created document: ${args.title}`,
      createdAt: now,
    });
    return docId;
  },
});

export const getDocumentsByAgent = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_author", (q) => q.eq("authorId", args.agentId))
      .order("desc")
      .take(20);
  },
});
