import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const extractMentionNames = (content: string) => {
  const matches = content.matchAll(/@([A-Za-z0-9_-]+)/g);
  const names = new Set<string>();
  for (const match of matches) {
    if (match[1]) {
      names.add(match[1]);
    }
  }
  return [...names];
};

const ensureSubscription = async (
  ctx: { db: { query: any; insert: any } },
  agentId: string,
  taskId: string,
  createdAt: number,
) => {
  const existing = await ctx.db
    .query("subscriptions")
    .withIndex("by_agent_task", (q: any) => q.eq("agentId", agentId).eq("taskId", taskId))
    .first();
  if (existing) return existing._id;
  return await ctx.db.insert("subscriptions", { agentId, taskId, createdAt });
};

export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    messages.sort((a, b) => a.createdAt - b.createdAt);

    const agentsById = new Map();
    for (const message of messages) {
      if (!agentsById.has(message.agentId)) {
        const agent = await ctx.db.get(message.agentId);
        if (agent) {
          agentsById.set(message.agentId, {
            _id: agent._id,
            name: agent.name,
            avatarEmoji: agent.avatarEmoji,
          });
        }
      }
    }

    return messages.map((message) => ({
      ...message,
      agent: agentsById.get(message.agentId),
    }));
  },
});

export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    agentId: v.id("agents"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("messages", {
      taskId: args.taskId,
      agentId: args.agentId,
      content: args.content,
      createdAt: now,
    });

    const [task, author, agents] = await Promise.all([
      ctx.db.get(args.taskId),
      ctx.db.get(args.agentId),
      ctx.db.query("agents").collect(),
    ]);
    const taskTitle = task?.title ?? "Untitled";
    const authorName = author?.name ?? "Someone";

    await ensureSubscription(ctx, args.agentId, args.taskId, now);

    const agentsByName = new Map<string, (typeof agents)[number]>();
    for (const agent of agents) {
      agentsByName.set(agent.name.toLowerCase(), agent);
    }

    const mentionNames = extractMentionNames(args.content);
    const mentionedAgents = mentionNames
      .map((name) => agentsByName.get(name.toLowerCase()))
      .filter((agent) => agent && agent._id !== args.agentId);

    const mentionedIds = new Set<string>();
    for (const agent of mentionedAgents) {
      if (!agent) continue;
      mentionedIds.add(agent._id);
      await ensureSubscription(ctx, agent._id, args.taskId, now);
      await ctx.db.insert("notifications", {
        agentId: agent._id,
        authorAgentId: args.agentId,
        authorName,
        type: "mention",
        message: `${authorName} mentioned you in: ${taskTitle}`,
        sourceTaskId: args.taskId,
        read: false,
        delivered: false,
        createdAt: now,
      });
    }

    const subscribers = await ctx.db
      .query("subscriptions")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    for (const subscriber of subscribers) {
      if (subscriber.agentId === args.agentId) continue;
      if (mentionedIds.has(subscriber.agentId)) continue;
      await ctx.db.insert("notifications", {
        agentId: subscriber.agentId,
        authorAgentId: args.agentId,
        authorName,
        type: "comment",
        message: `${authorName} commented on: ${taskTitle}`,
        sourceTaskId: args.taskId,
        read: false,
        delivered: false,
        createdAt: now,
      });
    }

    await ctx.db.insert("activities", {
      agentId: args.agentId,
      action: "comment",
      targetType: "comment",
      targetId: args.taskId,
      description: `commented on: ${taskTitle}`,
      createdAt: now,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
