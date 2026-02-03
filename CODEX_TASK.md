# Codex Task: Auto-pickup inbox + priority sorting

## Context
Citadel is our kanban task management system. We need Buddy (the coordinator agent) to automatically pick up unassigned tasks from the inbox on his heartbeat cycle. Priority must determine pickup order.

## Task 1: New query `listInbox` in `convex/tasks.ts`

Add a new query that returns tasks where:
- `status === "inbox"`
- `assigneeIds` is empty (length 0)

Sort results by priority: urgent first, then high, medium, low.

Priority sort order (use a map): `{ urgent: 0, high: 1, medium: 2, low: 3 }`

Return full task objects (no joins needed).

## Task 2: New HTTP endpoint `GET /api/inbox` in `convex/http.ts`

Add a new GET route `/api/inbox` that:
1. Calls the `listInbox` query from Task 1
2. Returns `{ tasks: [...] }` as JSON

No auth needed (matches existing pattern).

Import the query properly - look at how existing routes import from `api.tasks` or `internal.internals`.

## Task 3: Update CLI script `scripts/citadel-cli.sh`

Add a new command `inbox` that:
```
curl -s "$BASE_URL/api/inbox" | jq .
```

Add it to the help text too.

## Files to modify
- `convex/tasks.ts` - add `listInbox` query
- `convex/http.ts` - add GET `/api/inbox` route
- `scripts/citadel-cli.sh` - add `inbox` command

## DO NOT
- Modify any existing queries or mutations
- Change the schema
- Touch any frontend files
