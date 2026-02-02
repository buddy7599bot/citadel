# Task: Add HTTP GET endpoints for agents to READ their data from Citadel

## Context
Citadel already has POST endpoints in `convex/http.ts` for agents to PUSH data. But agents also need to READ their assigned tasks, notifications, and mentions on each heartbeat. The reference architecture says agents check for urgent items on every 15-min heartbeat.

## What to Build

### 1. Add these GET endpoints to `convex/http.ts`:

- `GET /api/agent/:name/tasks` - returns all tasks assigned to this agent
  Response: `{ tasks: [{ _id, title, description, status, priority, tags, assignees, createdAt }] }`

- `GET /api/agent/:name/notifications` - returns unread notifications for this agent  
  Response: `{ notifications: [{ _id, type, message, sourceTaskId, createdAt }] }`

- `GET /api/agent/:name/mentions` - returns recent @mentions (from messages table)
  Response: `{ mentions: [{ taskId, taskTitle, from, content, createdAt }] }`

- `GET /api/agent/:name/status` - returns agent's current status + domain data
  Response: `{ agent: {...}, domainData: {...} }`

Since Convex httpRouter doesn't support path params natively, use query string instead:
- `GET /api/my-tasks?agent=Elon`
- `GET /api/my-notifications?agent=Elon`  
- `GET /api/my-mentions?agent=Elon`
- `GET /api/my-status?agent=Elon`

All endpoints check `X-Citadel-Key` header for auth (same as POST endpoints).

### 2. Add internal queries in `convex/internals.ts`:

- `getTasksForAgent` - query tasks where assigneeIds contains the agent's ID
- `getUnreadNotifications` - query notifications where agentId matches and read=false and delivered=false
- `getRecentMentions` - query messages containing @agentName in last 24h
- `markNotificationsRead` - mutation to mark notifications as delivered after agent reads them

### 3. Important
- DO NOT modify `convex/schema.ts`
- Auth check same as existing POST endpoints (X-Citadel-Key header)
- After building, deploy: `cd /home/ubuntu/clawd/projects/citadel && CONVEX_DEPLOY_KEY="dev:upbeat-caribou-155|eyJ2MiI6IjYxZGY3NWFjZmU4OTQ5OTQ5NDE2ZjY1YTczNDNhNDQwIn0=" npx convex deploy --cmd 'echo ok'`
- Then git add, commit "feat: add GET endpoints for agent task/notification reads", push
- Then run: `clawdbot gateway wake --text "Done: Citadel GET endpoints live - agents can now read tasks and notifications" --mode now`
