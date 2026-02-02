# Task: Build Convex HTTP Actions for Agent Data Push

## Context
Citadel is an Alliance dashboard. We need HTTP endpoints so external scripts can push real data to Convex without needing the npm client. The Convex URL is `https://upbeat-caribou-155.convex.cloud`.

## What to Build

### 1. Create `convex/http.ts` - HTTP Action Router

Create HTTP actions that accept POST requests with JSON bodies and call the existing mutations. Use a simple shared secret for auth (check `X-Citadel-Key` header against an env var `CITADEL_API_KEY`).

Endpoints needed:
- `POST /api/heartbeat` - calls `agents.heartbeat` mutation
  Body: `{ sessionKey, status, currentTask }`
- `POST /api/trading` - calls `domain.updateTradingData` mutation  
  Body: `{ agentName, portfolioValue, portfolioChange, monthlyPnl, winRate, positions[] }`
- `POST /api/social` - calls `domain.updateSocialMetrics` mutation
  Body: `{ agentName, followers, followersWeekChange, viewsToday, engagementRate, scheduledPosts }`
- `POST /api/security` - calls `domain.updateSecurityScans` mutation
  Body: `{ agentName, openPorts, lastScanAt, criticalVulns, mediumVulns, lowVulns, firewallRules, failedSshAttempts }`
- `POST /api/jobs` - calls `domain.updateJobPipeline` mutation
  Body: `{ agentName, activeApplications, applied, interviewing, offers, newListingsToday }`
- `POST /api/build` - calls `domain.updateBuildStatus` mutation
  Body: `{ agentName, activeProjects, commitsToday, allGreen }`
- `POST /api/task` - calls `tasks.create` mutation
  Body: `{ title, description, priority, tags[], assigneeNames[] }`
- `POST /api/task/status` - calls `tasks.updateStatus` mutation
  Body: `{ taskId, status, agentName }`
- `POST /api/activity` - calls `activities.log` mutation
  Body: `{ agentName, action, targetType, targetId, description }`

For endpoints that take `agentName` instead of `agentId`: look up the agent by name from the agents table first.

Important: Each HTTP action should:
1. Check `X-Citadel-Key` header matches the `CITADEL_API_KEY` env var (use `process.env.CITADEL_API_KEY`)
2. Parse JSON body
3. Look up agent by name if needed
4. Call the appropriate internal mutation
5. Return proper JSON responses with status codes

Use `httpRouter` from `convex/server` and `httpAction` pattern.

### 2. Create `convex/http_helpers.ts` - Shared utilities

Helper to look up agent by name (query the agents table by name index).

### 3. Update `convex/agents.ts` - Add `getByName` query

Add an internal query that finds an agent by name for use in HTTP actions.

### 4. Update session keys for real agents

Create a mutation `agents.updateSessionKeys` that updates all 6 agents with their real Clawdbot session keys:
- Buddy: session key "alpha" (keep as placeholder, will update later)
- Katy: session key "delta" (keep as placeholder)
- Burry: session key "bravo" (keep as placeholder)
- Elon: session key "gamma" (keep as placeholder)
- Mike: session key "omega" (keep as placeholder)
- Jerry: session key "sigma" (keep as placeholder)

### 5. Set CITADEL_API_KEY env var

The env var should be set in Convex. For now, use a hardcoded check against `citadel-alliance-2026` as fallback if env var is not set.

## File locations
- All Convex files are in `convex/` directory
- Schema is in `convex/schema.ts` (do NOT modify)
- Existing mutations are in `convex/domain.ts`, `convex/agents.ts`, `convex/tasks.ts`, `convex/activities.ts`

## IMPORTANT
- Do NOT modify `convex/schema.ts`
- Use `internalMutation` and `internalQuery` from `convex/server` for helpers called by HTTP actions
- Use the `httpRouter` pattern from Convex docs
- TypeScript strict mode - no `any` types
- After creating files, run: `cd /home/ubuntu/clawd/projects/citadel && CONVEX_DEPLOY_KEY="dev:upbeat-caribou-155|eyJ2MiI6IjYxZGY3NWFjZmU4OTQ5OTQ5NDE2ZjY1YTczNDNhNDQwIn0=" npx convex deploy --cmd 'echo ok'`
- Then git add, commit, push
