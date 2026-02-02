import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  agents: defineTable({
    name: v.string(),
    role: v.string(),
    status: v.union(v.literal("idle"), v.literal("working"), v.literal("blocked")),
    currentTask: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    level: v.union(v.literal("lead"), v.literal("specialist"), v.literal("intern")),
    lastActive: v.number(),
    avatarEmoji: v.string(),
  })
    .index("by_name", ["name"])
    .index("by_status", ["status"]),

  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("inbox"),
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done")
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    assigneeIds: v.array(v.id("agents")),
    creatorId: v.optional(v.id("agents")),
    tags: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  messages: defineTable({
    taskId: v.id("tasks"),
    agentId: v.id("agents"),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_task", ["taskId"]),

  activities: defineTable({
    agentId: v.optional(v.id("agents")),
    action: v.string(),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    description: v.string(),
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),

  notifications: defineTable({
    agentId: v.id("agents"),
    type: v.string(),
    message: v.string(),
    sourceTaskId: v.optional(v.id("tasks")),
    read: v.boolean(),
    delivered: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_undelivered", ["delivered", "createdAt"]),
});
