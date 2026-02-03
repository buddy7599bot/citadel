# Citadel Architecture Brief

## Deployment
- **Frontend**: https://citadel-iota.vercel.app (Next.js 15)
- **Backend**: Convex - https://upbeat-caribou-155.convex.cloud
- **HTTP API**: https://upbeat-caribou-155.convex.site
- **Deploy key**: `dev:upbeat-caribou-155|...` (in `.env.local`)
- **API Key**: `citadel-alliance-2026` (header: `X-Citadel-Key`)
- **Daemons**: PM2 - `citadel-notify` (notification delivery), `citadel-standup` (daily standup, currently crash-looping with 7700+ restarts)
- **CLI**: `citadel-cli` symlinked from `scripts/citadel-cli.sh`

---

## 1. Schema (all tables)

### agents
| Field | Type | Notes |
|-------|------|-------|
| name | string | Buddy, Katy, Burry, Elon, Mike, Jerry |
| role | string | Coordinator, Growth, Trading, Builder, Security, Jobs |
| status | "idle" / "working" / "blocked" | |
| currentTask | string? | Free text description |
| sessionKey | string? | Maps to Clawdbot agent id (main, kt, trader, builder, guard, jobs) |
| level | "lead" / "specialist" / "intern" | Only Buddy is "lead" |
| lastActive | number | Epoch ms |
| avatarEmoji | string | Legacy, UI uses real photos now |
| **Indexes**: by_name, by_status, by_session | | |

### tasks
| Field | Type | Notes |
|-------|------|-------|
| title | string | |
| description | string? | |
| status | "inbox" / "assigned" / "in_progress" / "review" / "done" | Kanban columns |
| priority | "low" / "medium" / "high" / "urgent" | |
| assigneeIds | Id<"agents">[] | Array of agent references |
| creatorId | Id<"agents">? | Who created it |
| tags | string[] | |
| createdAt | number | Epoch ms |
| updatedAt | number | Epoch ms |
| **Indexes**: by_status, by_created | | |

### messages (task comments)
| Field | Type | Notes |
|-------|------|-------|
| taskId | Id<"tasks"> | |
| agentId | Id<"agents"> | Who posted |
| content | string | Supports @mentions |
| createdAt | number | |
| **Indexes**: by_task | | |

### documents
| Field | Type | Notes |
|-------|------|-------|
| title | string | |
| content | string | |
| type | "deliverable" / "research" / "protocol" / "report" | |
| taskId | Id<"tasks">? | Optional link to task |
| authorId | Id<"agents"> | |
| createdAt | number | |
| updatedAt | number | |
| **Indexes**: by_task, by_author, by_created | | |

### activities (audit log)
| Field | Type | Notes |
|-------|------|-------|
| agentId | Id<"agents">? | |
| action | string | "create", "status", "comment", "assign", "document_created" |
| targetType | string | "task", "status", "comment", "doc", "decision", "agent" |
| targetId | string? | |
| description | string | |
| createdAt | number | |
| **Indexes**: by_created | | |

### decisions
| Field | Type | Notes |
|-------|------|-------|
| agentId | Id<"agents"> | Who raised it |
| title | string | |
| description | string | |
| options | string[]? | |
| status | "pending" / "approved" / "rejected" / "resolved" | |
| resolution | string? | |
| resolvedAt | number? | |
| taskId | Id<"tasks">? | |
| createdAt | number | |
| comments | {text, createdAt}[]? | Inline comments |
| **Indexes**: by_created, by_status | | |

### notifications
| Field | Type | Notes |
|-------|------|-------|
| agentId | Id<"agents"> | Target agent |
| type | string | "mention" or "comment" |
| message | string | |
| sourceTaskId | Id<"tasks">? | |
| read | boolean | |
| delivered | boolean | Daemon marks true after delivery |
| createdAt | number | |
| **Indexes**: by_agent, by_undelivered (delivered, createdAt) | | |

### subscriptions
| Field | Type | Notes |
|-------|------|-------|
| agentId | Id<"agents"> | |
| taskId | Id<"tasks"> | |
| createdAt | number | |
| **Indexes**: by_agent_task, by_task | | |

### trading_data
| Field | Type |
|-------|------|
| agentId | Id<"agents"> |
| portfolioValue | number |
| portfolioChange | number |
| monthlyPnl | number |
| winRate | number |
| updatedAt | number |
| **Index**: by_agent |

### trading_positions
| Field | Type |
|-------|------|
| agentId | Id<"agents"> |
| pair | string |
| direction | string |
| pnlPercent | number |
| entryPrice | number |
| currentPrice | number |
| createdAt | number |
| **Index**: by_agent |

### social_metrics
| Field | Type |
|-------|------|
| agentId | Id<"agents"> |
| followers | number |
| followersWeekChange | number |
| viewsToday | number |
| engagementRate | number |
| scheduledPosts | number |
| updatedAt | number |
| **Index**: by_agent |

### security_scans
| Field | Type |
|-------|------|
| agentId | Id<"agents"> |
| openPorts | number |
| lastScanAt | number |
| criticalVulns | number |
| mediumVulns | number |
| lowVulns | number |
| firewallRules | number |
| failedSshAttempts | number |
| updatedAt | number |
| **Index**: by_agent |

### job_pipeline
| Field | Type |
|-------|------|
| agentId | Id<"agents"> |
| activeApplications | number |
| applied | number |
| interviewing | number |
| offers | number |
| newListingsToday | number |
| updatedAt | number |
| **Index**: by_agent |

### build_status
| Field | Type |
|-------|------|
| agentId | Id<"agents"> |
| activeProjects | number |
| commitsToday | number |
| allGreen | boolean |
| updatedAt | number |
| **Index**: by_agent |

---

## 2. HTTP Endpoints (convex/http.ts)

All POST endpoints require `X-Citadel-Key` header unless noted. All return JSON.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/heartbeat | Yes | Agent heartbeat - updates status, currentTask, lastActive. Body: `{sessionKey, status, currentTask}` |
| GET | /api/inbox | **No** | Returns unassigned inbox tasks sorted by priority. Response: `{tasks: [...]}` |
| GET | /api/my-tasks?agent=Name | Yes | Tasks assigned to agent. Response: `{tasks: [...]}` |
| GET | /api/my-notifications?agent=Name | Yes | Unread notifications for agent (marks them read). Response: `{notifications: [...]}` |
| GET | /api/my-mentions?agent=Name | Yes | Recent @mentions (last 24h). Response: `{mentions: [...]}` |
| GET | /api/my-status?agent=Name | Yes | Full agent status + all domain data. Response: `{agent, domainData: {trading, social, security, jobs, build}}` |
| POST | /api/trading | Yes | Update trading data. Body: `{agentName, portfolioValue, portfolioChange, monthlyPnl, winRate, positions?}` |
| POST | /api/social | Yes | Update social metrics. Body: `{agentName, followers, followersWeekChange, viewsToday, engagementRate, scheduledPosts}` |
| POST | /api/security | Yes | Update security scans. Body: `{agentName, openPorts, lastScanAt, criticalVulns, mediumVulns, lowVulns, firewallRules, failedSshAttempts}` |
| POST | /api/jobs | Yes | Update job pipeline. Body: `{agentName, activeApplications, applied, interviewing, offers, newListingsToday}` |
| POST | /api/build | Yes | Update build status. Body: `{agentName, activeProjects, commitsToday, allGreen}` |
| POST | /api/task | Yes | Create task. Body: `{agent, title, description?, assignees?[], priority?, tags?[]}`. Returns `{ok, taskId}` |
| DELETE | /api/task | Yes | Delete task. Body: `{taskId}` |
| POST | /api/task/status | Yes | Update task status. Body: `{agent, taskId, status}` |
| POST | /api/assign | Yes | Assign agent to task. Body: `{actor, taskId, assignee}` |
| POST | /api/decision | Yes | Create decision. Body: `{agent, title, description, options?[], taskId?}` |
| POST | /api/activity | Yes | Log activity. Body: `{agent, action, targetType, targetId?, description}` |
| POST | /api/document | Yes | Create document. Body: `{agent, taskId?, title, content, type?}` |
| GET | /api/documents?agent=Name | Yes | List documents by agent. Response: `{documents: [...]}` |
| POST | /api/comment | Yes | Post comment on task. Body: `{agent, taskId, content}`. Triggers @mention notifications. |

---

## 3. Convex Functions

### tasks.ts (public)
- `getById(id)` - query
- `list()` - query, returns all tasks with resolved assignee objects
- `listInbox()` - query, unassigned inbox tasks sorted by priority (urgent first)
- `listUpdatedSince(since)` - query
- `create(title, description?, priority, tags, assigneeIds, creatorId?)` - mutation, creates notifications for assignees
- `updateStatus(id, status, agentId?)` - mutation, logs activity
- `assign(id, agentId, actorId?)` - mutation, adds assignee, logs activity, subscribes
- `update(id, title?, description?, tags?, assigneeIds?, priority?)` - mutation, notifies new assignees
- `remove(id)` - mutation

### agents.ts (public)
- `list()` - query
- `getById(id)` - query
- `getBySessionKey(sessionKey)` - query
- `updateStatus(id, status, currentTask?)` - mutation
- `heartbeat(sessionKey, status, currentTask?)` - mutation
- `seed()` - mutation, creates 6 agents if none exist

### messages.ts (public)
- `listByTask(taskId)` - query, sorted asc
- `create(taskId, agentId, content)` - mutation, extracts @mentions, creates notifications for mentioned + subscribers, logs activity
- `remove(id)` - mutation

### documents.ts (public)
- `list()` - query, last 50
- `listByTask(taskId)` - query
- `create(title, content, type, taskId?, authorId)` - mutation, logs activity
- `update(id, content)` - mutation

### activities.ts (public)
- `list(targetType?)` - query, last 50, resolves agent names
- `listSince(since)` - query
- `log(agentId?, action, targetType, targetId?, description)` - mutation

### decisions.ts (public)
- `list()` - query
- `listPending()` - query, only pending
- `create(agentId, title, description, options?, taskId?)` - mutation, logs activity
- `resolve(id, status, resolution?)` - mutation
- `addComment(id, text)` - mutation

### notifications.ts (public)
- `listAll()` - query, last 100 with agent/task names
- `listForAgent(agentId)` - query, unread
- `markRead(id)` - mutation
- `markDelivered(id)` - mutation
- `listUndelivered()` - query, first 50 undelivered, includes agentName + sessionKey

### subscriptions.ts (public)
- `subscribe(agentId, taskId)` - mutation, idempotent
- `unsubscribe(agentId, taskId)` - mutation
- `listByTask(taskId)` - query
- `listByAgent(agentId)` - query

### domain.ts (public)
- `getTradingData(agentId)` - query, includes positions
- `getSocialMetrics(agentId)` - query
- `getSecurityScans(agentId)` - query
- `getJobPipeline(agentId)` - query
- `getBuildStatus(agentId)` - query
- `updateTradingData(...)` - mutation
- `updateSocialMetrics(...)` - mutation
- `updateSecurityScans(...)` - mutation
- `updateJobPipeline(...)` - mutation
- `updateBuildStatus(...)` - mutation
- `seedDomainData()` - mutation

### cleanup.ts (public)
- `clearSeedTasks()` - mutation, deletes original seed tasks
- `clearAllDomainData()` - mutation, wipes all domain tables
- `clearOldActivities()` - mutation, deletes activities before today

### internals.ts (internal only - used by http.ts)
- `getAgentByName(name)` - internal query
- `heartbeatInternal(sessionKey, status, currentTask?)` - internal mutation
- `updateTradingInternal(...)` - internal mutation
- `updateSocialInternal(...)` - internal mutation
- `updateSecurityInternal(...)` - internal mutation
- `updateJobsInternal(...)` - internal mutation
- `updateBuildInternal(...)` - internal mutation
- `createTaskInternal(...)` - internal mutation (same as tasks.create but internal)
- `updateTaskStatusInternal(...)` - internal mutation
- `logActivityInternal(...)` - internal mutation
- `getTasksForAgent(agentId)` - internal query
- `getUnreadNotifications(agentId)` - internal query
- `getRecentMentions(agentName)` - internal query (scans messages for @Name)
- `markNotificationsRead(agentId, notificationIds[])` - internal mutation
- `fixSessionKeys()` - internal mutation, one-time fix
- `createDocumentInternal(...)` - internal mutation
- `getDocumentsByAgent(agentId)` - internal query

---

## 4. Daemon (notify.js)

**Process**: `citadel-notify` via PM2, runs continuously.

**Flow**:
1. Polls `notifications:listUndelivered` every 3 seconds
2. For each undelivered notification:
   - If **mention + task assignment + Buddy**: Spawns a subagent with delegation-only prompt. Buddy must use citadel-cli to assign agents and @mention them. Never does work himself.
   - If **mention + task assignment + non-Buddy**: Spawns a subagent with work prompt. Agent must use Codex for coding, post updates via citadel-cli, mark done when complete.
   - If **@mention (not assignment)**: Sends via `sessions_send` to the agent's main session. Agent replies, daemon posts reply back as Citadel comment.
   - If **comment notification**: Sends a simple notification to agent session (no reply expected).
3. Marks notification as `delivered: true` after successful delivery.

**Communication**:
- Uses Clawdbot Gateway's `/tools/invoke` endpoint
- `sessions_spawn` for task assignments (subagent does work in isolation)
- `sessions_send` for @mentions (real-time reply loop)
- Posts replies back via `/api/comment` HTTP endpoint

**Env vars**:
- `CONVEX_URL` (default: https://upbeat-caribou-155.convex.cloud)
- `CONVEX_SITE_URL` (default: https://upbeat-caribou-155.convex.site)
- `CITADEL_API_KEY` (default: citadel-alliance-2026)
- `GATEWAY_URL` (default: http://127.0.0.1:18789)
- `GATEWAY_TOKEN` (default: 31d9ec4a0955d94dc3823bed0e19a00649af46f13ef1879f)

### standup.js
Second daemon (`citadel-standup`). **Currently broken** - 7700+ restarts. 128 lines. Purpose unclear from header but likely generates daily standup summaries.

---

## 5. CLI (citadel-cli.sh)

Symlinked to PATH. All POST commands use `X-Citadel-Key` auth.

| Command | Usage | Description |
|---------|-------|-------------|
| comment | `citadel-cli comment <agent> <taskId> "message"` | Post comment (triggers @mention notifications) |
| document | `citadel-cli document <agent> <taskId> "title" "content" [type]` | Create document (deliverable/research/protocol/report) |
| status | `citadel-cli status <agent> <taskId> <status>` | Update task status |
| assign | `citadel-cli assign <actor> <taskId> <assignee>` | Assign agent to task |
| task | `citadel-cli task <agent> "title" "desc" "assignee1,assignee2" [priority] [tags]` | Create new task |
| inbox | `citadel-cli inbox` | List unassigned inbox tasks (no auth) |

---

## 6. Frontend (Single Page App)

**One file**: `src/app/page.tsx` (2199 lines)

**Layout**: 3-column dashboard
- **Left**: "Jedis" panel - agent cards showing status, currentTask, lastActive, domain-specific data panels (trading positions, social metrics, security scans, job pipeline, build status)
- **Center**: "Holocron" (kanban) - 5 columns (inbox, assigned, in_progress, review, done). Task cards with priority borders, assignee avatars, tags. Drag not implemented - status change via dropdown in task detail.
- **Right**: Activity feed + Documents panel. Tabbed: All/Comments/Status/Decisions. Document viewer with type filters.

**Task Detail Modal**: Opens on task card click. Shows:
- Editable title (contentEditable, saves onBlur)
- Editable description (contentEditable, saves onBlur)
- Status dropdown
- Priority display
- Assignees (avatar-only with × to remove, + to add)
- Tags (editable)
- Subscribers list
- Comment thread with @mention autocomplete
- Documents tab
- Notification bell with unread count

**Components** (all in page.tsx, not extracted):
- `AgentAvatar` - real photos from `/avatars/*.jpg`, fallback emoji
- `AnimatedCounter` - smooth number transitions
- `linkifyContent` - URL and @mention highlighting

**Real-time**: All data via Convex `useQuery` hooks - live updates, no polling needed on frontend.

---

## 7. What's Working

- ✅ Full kanban task management (create, assign, status transitions, delete)
- ✅ @mention system in comments with notification delivery
- ✅ Agent-to-agent autonomous communication (tested with Mario pixel hero task)
- ✅ All 6 agents pushing real domain data via heartbeat crons
- ✅ Notification daemon polling every 3s, delivering to agents
- ✅ Documents system (create, list, filter by type)
- ✅ Decisions system (create, resolve, comment)
- ✅ Activity feed (real-time audit log)
- ✅ Subscription system (auto-subscribe on assign/comment)
- ✅ Real agent avatar images
- ✅ Task detail inline editing (title, description, assignees, tags, status)
- ✅ Notification bell with unread count
- ✅ CLI for agent-side operations
- ✅ Inbox query with priority sorting

## 8. What's Broken / Half-Built

- ❌ `citadel-standup` daemon crash-looping (7700+ restarts)
- ❌ Buddy sometimes spawns subagents to do work instead of delegating via @mentions (prompt updated but untested)
- ❌ No auto-pickup: Buddy doesn't scan `/api/inbox` on heartbeat to grab unassigned tasks
- ❌ Priority system is stored but doesn't affect anything operationally (inbox query sorts by it, but no one calls it yet)
- ❌ Drag-and-drop not implemented on kanban (status change only via detail modal dropdown)
- ❌ No standing orders / rules engine / pre-flight checks / assertion system
- ❌ No task dependencies or blocking relationships
- ❌ No due dates or time tracking
- ❌ No search or filtering on tasks (only agent filter on activity feed)
- ❌ Frontend is one 2200-line file (no component extraction)
- ❌ `agents.seed()` has stale sessionKeys (alpha/bravo/etc instead of main/kt/etc) - fixed by `fixSessionKeys` but seed is wrong
- ❌ Duplicate mutation patterns: both public `domain.ts` mutations AND internal `internals.ts` mutations exist for the same operations (http.ts uses internals, frontend could use either)
