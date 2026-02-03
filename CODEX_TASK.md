# Citadel - Decision Workflow

## Task
Add a "Decision" workflow to Citadel. This is for when AI agents need Jay's (the human boss) input on something before proceeding.

## What to Build

### 1. Schema (convex/schema.ts)
Add a `decisions` table:
```
decisions: defineTable({
  agentId: v.id("agents"),
  title: v.string(),
  description: v.string(),
  options: v.optional(v.array(v.string())),  // e.g. ["Approve", "Reject", "Option C"]
  status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.literal("resolved")),
  resolution: v.optional(v.string()),  // Jay's response text
  resolvedAt: v.optional(v.number()),
  taskId: v.optional(v.id("tasks")),  // optional link to a task
  createdAt: v.number(),
})
```

### 2. Convex Functions (convex/decisions.ts - NEW FILE)
- `list` query: return all decisions, newest first
- `listPending` query: return only status="pending" decisions
- `create` mutation: create a new decision request
- `resolve` mutation: update status + resolution + resolvedAt

### 3. HTTP Endpoint (convex/http.ts)
Add `POST /api/decision` so agents can create decisions via citadel-cli:
```json
{
  "agentName": "Elon",
  "title": "Should we add Stripe to ScreenSnap?",
  "description": "ScreenSnap MVP is ready. Adding payments would take 2-3 hours but delays launch.",
  "options": ["Add Stripe now", "Launch without payments", "Add after 50 users"]
}
```

### 4. Activity Integration
When a decision is created, also create an activity with `targetType: "decision"` so it shows in the Activity feed under the Decisions tab.

### 5. Frontend (src/app/page.tsx)
In the Activity feed's right panel, when the "Decisions" tab is active:
- Show pending decisions with a yellow/amber highlight
- Each decision shows: title, description, who requested it, options as buttons
- Jay can click an option (1, 2, 3 etc.) OR type a custom comment/response in a text input
- Each decision has a small text input + "Comment" button so Jay can add context or ask follow-up questions without resolving
- Resolved decisions show greyed out with the resolution
- Comments on decisions show inline below the decision

Add a pending decisions count badge next to the "Decisions" tab label.

## Rules
- Keep it simple - this is MVP
- Use existing patterns from tasks.ts and activities.ts
- Use the existing API key auth pattern (X-Citadel-Key header)
- Don't break any existing functionality
- Use Tailwind, match existing warm color scheme
- Pending decisions should feel urgent (amber/yellow accent)
