import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_created")
      .order("desc")
      .take(50);

    const authorsById = new Map();
    for (const document of documents) {
      if (!authorsById.has(document.authorId)) {
        const author = await ctx.db.get(document.authorId);
        if (author) {
          authorsById.set(document.authorId, {
            _id: author._id,
            name: author.name,
            avatarEmoji: author.avatarEmoji,
          });
        }
      }
    }

    return documents.map((document) => ({
      ...document,
      author: authorsById.get(document.authorId) ?? null,
    }));
  },
});

export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    documents.sort((a, b) => b.createdAt - a.createdAt);

    const authorsById = new Map();
    for (const document of documents) {
      if (!authorsById.has(document.authorId)) {
        const author = await ctx.db.get(document.authorId);
        if (author) {
          authorsById.set(document.authorId, {
            _id: author._id,
            name: author.name,
            avatarEmoji: author.avatarEmoji,
          });
        }
      }
    }

    return documents.map((document) => ({
      ...document,
      author: authorsById.get(document.authorId) ?? null,
    }));
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    type: v.union(
      v.literal("deliverable"),
      v.literal("research"),
      v.literal("protocol"),
      v.literal("report")
    ),
    taskId: v.optional(v.id("tasks")),
    authorId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const documentId = await ctx.db.insert("documents", {
      title: args.title,
      content: args.content,
      type: args.type,
      taskId: args.taskId,
      authorId: args.authorId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("activities", {
      agentId: args.authorId,
      action: "create",
      targetType: "doc",
      targetId: documentId,
      description: `created document: ${args.title}`,
      createdAt: now,
    });

    return documentId;
  },
});

export const update = mutation({
  args: {
    id: v.id("documents"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      content: args.content,
      updatedAt: Date.now(),
    });
  },
});
