# Task: Fix POST endpoint agent name handling

## Problem
Agents are sending `{"name":"Burry"}` but the POST endpoints expect `{"agentName":"Burry"}`. This causes resolveAgent to receive undefined and Convex throws "missing field name".

## Fix
In `convex/http.ts`, update ALL POST handlers that call `resolveAgent` to accept BOTH `agentName` and `name`:

Replace every instance of:
```
const agent = await resolveAgent(ctx, body.agentName);
```
with:
```
const agentName = body.agentName || body.name || body.agent;
if (!agentName) return json({ error: "Missing agentName, name, or agent field" }, 400);
const agent = await resolveAgent(ctx, agentName);
```

This applies to the POST handlers for: /api/trading, /api/social, /api/security, /api/jobs, /api/build, /api/task (for creatorName), /api/task/status (for agentName), /api/activity (for agentName).

For /api/task, also accept assigneeNames OR assignees OR agents for the assignee list.

## After
1. Deploy: `cd /home/ubuntu/clawd/projects/citadel && CONVEX_DEPLOY_KEY="dev:upbeat-caribou-155|eyJ2MiI6IjYxZGY3NWFjZmU4OTQ5OTQ5NDE2ZjY1YTczNDNhNDQwIn0=" npx convex deploy --cmd 'echo ok'`
2. Git commit "fix: accept multiple agent name field formats in POST endpoints" and push
3. Run: `clawdbot gateway wake --text "Done: POST endpoints fixed - accept agentName/name/agent" --mode now`
