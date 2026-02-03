# Citadel - Decision Workflow + Inbox Fix

## Task 1: Decision Workflow

Add a "Decision" workflow to Citadel. This is for when AI agents need Jay's (the human boss) input before proceeding.

### Schema (convex/schema.ts)
Add a `decisions` table:
- agentId: v.id("agents")
- title: v.string()
- description: v.string()
- options: v.optional(v.array(v.string()))  // e.g. ["Approve", "Reject", "Option C"]
- status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.literal("resolved"))
- resolution: v.optional(v.string())  // Jay's response text
- resolvedAt: v.optional(v.number())
- taskId: v.optional(v.id("tasks"))  // optional link to a task
- createdAt: v.number()
- comments: v.optional(v.array(v.object({ text: v.string(), createdAt: v.number() })))

### Convex Functions (convex/decisions.ts - NEW FILE)
- `list` query: return all decisions with agent info, newest first
- `listPending` query: return only status="pending"
- `create` mutation: create a new decision, also create an activity with targetType "decision"
- `resolve` mutation: update status + resolution + resolvedAt
- `addComment` mutation: push a comment to the comments array

### HTTP Endpoint (convex/http.ts)
Add `POST /api/decision`:
```json
{
  "agentName": "Elon",
  "title": "Should we add Stripe to ScreenSnap?",
  "description": "MVP is ready. Adding payments would take 2-3 hours.",
  "options": ["Add Stripe now", "Launch without payments", "Add after 50 users"]
}
```

### Frontend (src/app/page.tsx)
In the Activity feed right panel, when "Decisions" tab is active:
- Show pending decisions with amber/yellow highlight
- Each decision shows: title, description, who requested it, when
- Options shown as numbered buttons (1, 2, 3)
- A text input + "Comment" button so Jay can comment without resolving
- Comments show inline below the decision
- Resolved decisions show greyed out with the resolution text
- Add a pending count badge next to "Decisions" tab label

## Task 2: Inbox Logic Fix
In src/app/page.tsx, in the `tasksByStatus` useMemo:
- If a task has status "inbox" BUT has assignees (assignees array length > 0), put it in "assigned" column instead
- Only truly unassigned tasks should appear in Inbox

## Rules
- Keep it simple, MVP
- Use existing patterns from tasks.ts and activities.ts
- Use existing API key auth (X-Citadel-Key header)
- Don't break existing functionality
- Tailwind, warm color scheme
- Pending decisions = amber/yellow accent (urgent feel)
