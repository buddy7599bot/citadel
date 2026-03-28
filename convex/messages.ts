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

    // Subscriber broadcast notifications removed — agents only wake on direct @mention.
    // This prevents cascade wake-ups when unrelated agents are subscribed to a task.

    await ctx.db.insert("activities", {
      agentId: args.agentId,
      action: "comment",
      targetType: "comment",
      targetId: args.taskId,
      description: `commented on: ${taskTitle}`,
      createdAt: now,
    });

    // @Jay detection — if comment mentions @Jay, create a decision record and
    // a special jay_mention notification so notify.js can ping Jay on Telegram
    const lowerContent = args.content.toLowerCase();
    if (lowerContent.includes("@jay")) {
      // Look up the task's workspace so the decision is scoped correctly
      const task = await ctx.db.get(args.taskId);
      const taskWorkspace = task?.workspace;

      // Create a decision record so it surfaces in Jay's decisions tab
      await ctx.db.insert("decisions", {
        agentId: args.agentId,
        title: `@Jay mentioned in: ${taskTitle}`,
        description: args.content.slice(0, 500),
        options: [],
        status: "pending" as const,
        createdAt: now,
        taskId: args.taskId,
        workspace: taskWorkspace,
      });

      // Create a special notification that notify.js will route to Jay's Telegram
      await ctx.db.insert("notifications", {
        agentId: args.agentId, // use author's agent as the sender context
        authorAgentId: args.agentId,
        authorName,
        type: "jay_mention",
        message: `${authorName} mentioned @Jay in task "${taskTitle}": ${args.content.slice(0, 300)}`,
        sourceTaskId: args.taskId,
        read: false,
        delivered: false,
        createdAt: now,
      });
    }

    // Notify assignees of in_progress tasks about new comments
    // This ensures agents see new requirements before marking done
    if (task?.status === "in_progress" && task.assigneeIds && task.assigneeIds.length > 0) {
      for (const assigneeId of task.assigneeIds) {
        // Skip if assignee is the comment author (they already know)
        if (assigneeId === args.agentId) continue;
        // Skip if assignee was already mentioned (avoid duplicate notifications)
        if (mentionedIds.has(assigneeId)) continue;

        await ctx.db.insert("notifications", {
          agentId: assigneeId,
          authorAgentId: args.agentId,
          authorName,
          type: "task_comment",
          message: `New comment on your in-progress task "${taskTitle}": ${args.content.slice(0, 200)}`,
          sourceTaskId: args.taskId,
          read: false,
          delivered: false,
          createdAt: now,
        });
      }
    }

    // Auto-revert: if task is 'done' and the comment assigns new work
    // (contains an @mention OR action language), revert status to in_progress
    // and notify all assignees.
    // NOT triggered by status-only comments like 'done', 'acknowledged', 'looks good', etc.
    const isStatusOnlyComment = /^(done|acknowledged|ack|looks good|lgtm|confirmed|seen|noted|ok|👍|✅)\s*\.?$/i.test(
      args.content.trim()
    );

    const hasActionLanguage =
      mentionNames.length > 0 ||
      /\b(please|fix|add|also|update|check|implement|deploy|build|review|change|remove|create|investigate|look into|handle|do this|take care|can you|could you|make sure|need|needs|require|requires|should|must)\b/i.test(
        args.content
      );

    if (
      task?.status === "done" &&
      !isStatusOnlyComment &&
      hasActionLanguage &&
      task.assigneeIds &&
      task.assigneeIds.length > 0
    ) {
      // Revert task status to in_progress
      await ctx.db.patch(args.taskId, {
        status: "in_progress",
        updatedAt: now,
      });

      // Notify all assignees (skip comment author and already-mentioned agents)
      for (const assigneeId of task.assigneeIds) {
        if (assigneeId === args.agentId) continue;
        if (mentionedIds.has(assigneeId)) continue; // already notified via @mention

        await ctx.db.insert("notifications", {
          agentId: assigneeId,
          authorAgentId: args.agentId,
          authorName,
          type: "task_reopened",
          message: `⚠️ REOPENED — "${taskTitle}" was marked done but has new work from ${authorName}: ${args.content.slice(0, 200)}`,
          sourceTaskId: args.taskId,
          read: false,
          delivered: false,
          createdAt: now,
        });
      }
    }
  },
});

export const countByAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .collect();
    return messages.filter((m) => m.agentId === args.agentId).length;
  },
});

export const remove = mutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
