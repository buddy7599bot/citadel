# Citadel - Phase 1 Build

## Project Setup
This is a Next.js + Convex + Tailwind project at `/home/ubuntu/clawd/projects/mission-control`.
Dependencies already installed: next, react, react-dom, typescript, tailwindcss, convex.

## Design Reference
Warm editorial aesthetic inspired by a real Citadel dashboard. Three-column layout. Clean, professional, high information density. Think "startup command center."

## What to Build

### 1. Project Config Files

**tsconfig.json** - standard Next.js with paths: `@/*` -> `./src/*`

**next.config.ts** - basic Next.js config

**tailwind.config.ts** - content paths for src/, dark mode class

**postcss.config.mjs** - standard with tailwindcss plugin

**src/app/globals.css** - Tailwind directives + custom styles for the warm editorial theme

### 2. Convex Schema (`convex/schema.ts`)

```typescript
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
  }).index("by_name", ["name"]).index("by_status", ["status"]),

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
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    assigneeIds: v.array(v.id("agents")),
    creatorId: v.optional(v.id("agents")),
    tags: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_status", ["status"]).index("by_created", ["createdAt"]),

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
  }).index("by_agent", ["agentId"]).index("by_undelivered", ["delivered", "createdAt"]),
});
```

### 3. Convex Functions

**convex/agents.ts:**
- `list` query: return all agents sorted by name
- `getById` query: return single agent by id
- `updateStatus` mutation: update agent status + lastActive timestamp
- `seed` mutation: insert the 6 Alliance agents if agents table is empty:
  - Buddy, Coordinator, lead, 🤖
  - Katy, Growth, specialist, 📣
  - Burry, Trading, specialist, 📈
  - Elon, Builder, specialist, 🚀
  - Mike, Security, specialist, 🛡️
  - Jerry, Jobs, specialist, 💼

**convex/tasks.ts:**
- `list` query: return all tasks with assignee agent data resolved (join agents), sorted by createdAt desc
- `create` mutation: create task, also log an activity "created task: {title}"
- `updateStatus` mutation: update task status + updatedAt, log activity
- `assign` mutation: add agent id to assigneeIds array, log activity

**convex/activities.ts:**
- `list` query: return latest 50 activities sorted by createdAt desc. For each activity, resolve the agent info (name, emoji). Accept optional filter arg for targetType.
- `log` mutation: create activity entry with createdAt = Date.now()

**convex/messages.ts:**
- `listByTask` query: return messages for a task sorted by createdAt, resolve agent info
- `create` mutation: create message, log activity "commented on: {task title}"

**convex/notifications.ts:**
- `listForAgent` query: return unread notifications for agent
- `markRead` mutation
- `markDelivered` mutation

### 4. Dashboard UI

**src/app/ConvexClientProvider.tsx** - "use client" component wrapping ConvexReactClient + ConvexProvider using `NEXT_PUBLIC_CONVEX_URL`

**src/app/layout.tsx** - html with light/warm theme, wrap children in ConvexClientProvider. Use Inter font from next/font.

**src/app/page.tsx** - Main dashboard. Three-column responsive layout.

#### Top Bar
- Left: "CITADEL" title in caps, small serif/mono feel. Subtitle pill showing "Alliance"
- Center: Two stat cards - "X AGENTS ACTIVE" and "X TASKS IN QUEUE" 
- Right: Clock showing current time (updates every second), date, and green "ONLINE" badge

#### Left Column - Agent Sidebar (narrow, ~250px)
- Header: "AGENTS" with count badge
- List of 6 agent cards, each showing:
  - Avatar emoji in a colored circle
  - Agent name (bold) with level badge (LEAD = amber, SPC = blue, INT = gray) as small colored pill
  - Role text below name (muted)
  - Status: green "WORKING" or gray "IDLE" or red "BLOCKED" badge
  - Current task name if working (truncated)
  - "X ago" last active timestamp
- Real-time via useQuery

#### Center Column - Mission Queue (Kanban)
- Header: "MISSION QUEUE"
- 5 status columns side by side, each scrollable: INBOX, ASSIGNED, IN PROGRESS, REVIEW, DONE
- Each column header shows count badge
- Task cards in each column showing:
  - Priority indicator (colored left border: urgent=red, high=orange, medium=amber, low=gray)
  - Title (bold, wrapping)
  - Description preview (2 lines, muted)
  - Assignee emoji chips at bottom
  - Tags as small rounded pills (muted background)
  - "X ago" timestamp
- "New Task" button that opens a simple inline form (title + description + priority + tags)

#### Right Column - Live Feed (~300px)
- Header: "LIVE FEED"
- Filter tabs: All, Tasks, Comments, Docs, Status - as small rounded pills, active one highlighted
- Agent filter: "All Agents" pill + individual agent pills with emoji + count
- Feed items, each showing:
  - Green dot indicator
  - Description text with bold highlights (agent name, task name)
  - Agent name + "about X ago" timestamp below
- Real-time via useQuery

### 5. Styling - Warm Editorial Theme

**COLOR PALETTE (LIGHT/WARM theme, NOT dark):**
- Background: #FAFAF8 (warm off-white)
- Cards/panels: #FFFFFF with subtle border #E8E5E0
- Text primary: #1A1A1A
- Text secondary: #6B6B6B
- Accent/active: #D97706 (warm amber) for active states
- Success/online: #16A34A (green)
- Borders: #E8E5E0 (warm gray)
- Column backgrounds: #F5F3EF

**LEVEL BADGES:**
- LEAD: amber bg (#FEF3C7) + amber text (#92400E)
- SPC: blue bg (#DBEAFE) + blue text (#1E40AF)
- INT: gray bg (#F3F4F6) + gray text (#374151)

**STATUS BADGES:**
- WORKING: green bg (#DCFCE7) + green text (#166534)
- IDLE: gray bg (#F3F4F6) + gray text (#6B7280)
- BLOCKED: red bg (#FEE2E2) + red text (#991B1B)

**PRIORITY LEFT BORDERS:**
- urgent: #EF4444 (red)
- high: #F97316 (orange)
- medium: #EAB308 (amber)
- low: #D1D5DB (gray)

**GENERAL:**
- Font: Inter (next/font/google)
- Cards have subtle shadow-sm
- Rounded corners (rounded-lg)
- No gradients, no purple
- Clean whitespace, professional spacing
- Serif or small-caps for section headers to give editorial feel

### 6. Helper: Relative Time
Create a small utility `src/lib/utils.ts` with a `timeAgo(timestamp: number): string` function that returns "just now", "5 min ago", "2 hours ago", "1 day ago" etc.

## DO NOT
- Do not add authentication
- Do not add drag-and-drop  
- Do not use dark theme (this is warm/light editorial)
- Do not use any purple colors
- Do not add animations beyond basic hover transitions
- Do not over-engineer
