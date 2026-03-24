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

    // Resolve tasks to derive workspace for decisions without an explicit workspace field
    const tasksById = new Map();
    for (const decision of decisions) {
      if (decision.taskId && !tasksById.has(decision.taskId)) {
        const task = await ctx.db.get(decision.taskId);
        if (task) tasksById.set(decision.taskId, task);
      }
    }

    return decisions.map((decision) => {
      let workspace = decision.workspace;
      if (!workspace && decision.taskId) {
        const task = tasksById.get(decision.taskId);
        if (task) {
          const isDp = task.workspace === "dashpane" || (task.tags?.includes("dashpane-launch") ?? false);
          workspace = isDp ? "dashpane" : "main";
        }
      }
      return {
        ...decision,
        workspace,
        agent: decision.agentId ? agentsById.get(decision.agentId) : null,
      };
    });
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

    // Auto-resolve: when Jay adds a comment the decision is answered — mark resolved
    await ctx.db.patch(args.id, {
      comments,
      status: "resolved",
      resolution: args.text,
      resolvedAt: now,
    });

    // Notify the agent who created the decision so they can act on Jay's response
    if (decision.agentId) {
      const agent = await ctx.db.get(decision.agentId);
      await ctx.db.insert("notifications", {
        agentId: decision.agentId,
        authorAgentId: undefined,
        authorName: "Jay",
        type: "mention",
        message: `Jay responded to your decision "${decision.title}": ${args.text.slice(0, 200)}`,
        sourceTaskId: decision.taskId,
        read: false,
        delivered: false,
        createdAt: now,
      });
    }
  },
});

export const resolveWithNotify = mutation({
  args: {
    id: v.id("decisions"),
    status: v.union(v.literal("approved"), v.literal("rejected"), v.literal("resolved")),
    resolution: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const decision = await ctx.db.get(args.id);
    if (!decision) return;
    const now = Date.now();

    await ctx.db.patch(args.id, {
      status: args.status,
      resolution: args.resolution,
      resolvedAt: now,
    });

    // Notify the agent who created the decision
    if (decision.agentId) {
      await ctx.db.insert("notifications", {
        agentId: decision.agentId,
        authorAgentId: undefined,
        authorName: "Jay",
        type: "mention",
        message: `Jay ${args.status} your decision "${decision.title}"${args.resolution ? `: ${args.resolution.slice(0, 200)}` : ""}`,
        sourceTaskId: decision.taskId,
        read: false,
        delivered: false,
        createdAt: now,
      });
    }
  },
});

export const backfillWorkspace = mutation({
  args: {
    id: v.id("decisions"),
    workspace: v.union(v.literal("main"), v.literal("dashpane")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { workspace: args.workspace });
  },
});
