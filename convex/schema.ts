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
    .index("by_status", ["status"])
    .index("by_session", ["sessionKey"]),

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

  documents: defineTable({
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_task", ["taskId"])
    .index("by_author", ["authorId"])
    .index("by_created", ["createdAt"]),

  activities: defineTable({
    agentId: v.optional(v.id("agents")),
    action: v.string(),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    description: v.string(),
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),

  decisions: defineTable({
    agentId: v.id("agents"),
    title: v.string(),
    description: v.string(),
    options: v.optional(v.array(v.string())),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("resolved")
    ),
    resolution: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    taskId: v.optional(v.id("tasks")),
    createdAt: v.number(),
    comments: v.optional(
      v.array(v.object({ text: v.string(), createdAt: v.number() }))
    ),
  })
    .index("by_created", ["createdAt"])
    .index("by_status", ["status"]),

  notifications: defineTable({
    agentId: v.id("agents"),
    authorAgentId: v.optional(v.id("agents")),
    authorName: v.optional(v.string()),
    type: v.string(),
    message: v.string(),
    sourceTaskId: v.optional(v.id("tasks")),
    read: v.boolean(),
    delivered: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_undelivered", ["delivered", "createdAt"]),

  subscriptions: defineTable({
    agentId: v.id("agents"),
    taskId: v.id("tasks"),
    createdAt: v.number(),
  })
    .index("by_agent_task", ["agentId", "taskId"])
    .index("by_task", ["taskId"]),

  trading_data: defineTable({
    agentId: v.id("agents"),
    portfolioValue: v.number(),
    portfolioChange: v.number(),
    monthlyPnl: v.number(),
    winRate: v.number(),
    updatedAt: v.number(),
  }).index("by_agent", ["agentId"]),

  trading_positions: defineTable({
    agentId: v.id("agents"),
    pair: v.string(),
    direction: v.string(),
    pnlPercent: v.number(),
    entryPrice: v.number(),
    currentPrice: v.number(),
    createdAt: v.number(),
  }).index("by_agent", ["agentId"]),

  social_metrics: defineTable({
    agentId: v.id("agents"),
    followers: v.number(),
    followersWeekChange: v.number(),
    viewsToday: v.number(),
    engagementRate: v.number(),
    scheduledPosts: v.number(),
    updatedAt: v.number(),
  }).index("by_agent", ["agentId"]),

  security_scans: defineTable({
    agentId: v.id("agents"),
    openPorts: v.number(),
    lastScanAt: v.number(),
    criticalVulns: v.number(),
    mediumVulns: v.number(),
    lowVulns: v.number(),
    firewallRules: v.number(),
    failedSshAttempts: v.number(),
    updatedAt: v.number(),
  }).index("by_agent", ["agentId"]),

  job_pipeline: defineTable({
    agentId: v.id("agents"),
    activeApplications: v.number(),
    applied: v.number(),
    interviewing: v.number(),
    offers: v.number(),
    newListingsToday: v.number(),
    updatedAt: v.number(),
  }).index("by_agent", ["agentId"]),

  build_status: defineTable({
    agentId: v.id("agents"),
    activeProjects: v.number(),
    commitsToday: v.number(),
    allGreen: v.boolean(),
    updatedAt: v.number(),
  }).index("by_agent", ["agentId"]),

  standing_orders: defineTable({
    agentId: v.id("agents"),
    goal: v.string(),
    metrics: v.optional(v.string()),
    priority: v.union(v.literal("primary"), v.literal("secondary")),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_active", ["active", "agentId"]),

  rules: defineTable({
    text: v.string(),
    why: v.string(),
    scope: v.union(
      v.literal("global"),
      v.literal("social"),
      v.literal("trading"),
      v.literal("security"),
      v.literal("jobs"),
      v.literal("building"),
      v.literal("coordination")
    ),
    tier: v.union(v.literal("critical"), v.literal("standard")),
    checkable: v.boolean(),
    checkPattern: v.optional(v.string()),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_scope", ["scope", "active"])
    .index("by_tier", ["tier", "active"]),

  preflight_logs: defineTable({
    agentId: v.id("agents"),
    taskId: v.optional(v.id("tasks")),
    checkType: v.string(),
    passed: v.boolean(),
    details: v.optional(v.string()),
    content: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_agent", ["agentId", "createdAt"])
    .index("by_passed", ["passed", "createdAt"]),
});
