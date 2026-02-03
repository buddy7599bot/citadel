# Citadel Phase 2: Rules Engine + Standing Orders + Pre-flight Checks

## Context
Citadel is a multi-agent coordination platform built with Convex + Next.js. It currently has agents, tasks, notifications, comments, and domain data tables. We need to add a rules engine, standing orders, and pre-flight logging system.

## Existing Schema Location
`convex/schema.ts` - read this first to understand existing tables.

## What to Build

### 1. New Tables (add to convex/schema.ts)

```typescript
// Standing orders - persistent goals for each agent
standing_orders: defineTable({
  agentId: v.id("agents"),
  goal: v.string(),           // e.g. "Grow Jay's X to 50K followers"
  metrics: v.optional(v.string()), // how to measure progress
  priority: v.union(v.literal("primary"), v.literal("secondary")),
  active: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_agent", ["agentId"])
  .index("by_active", ["active", "agentId"]),

// Rules - scoped per role, checkable flag for programmatic enforcement
rules: defineTable({
  text: v.string(),            // the rule text
  why: v.string(),             // one-line explanation
  scope: v.union(
    v.literal("global"),       // applies to all agents
    v.literal("social"),       // Katy
    v.literal("trading"),      // Burry
    v.literal("security"),     // Mike
    v.literal("jobs"),         // Jerry
    v.literal("building"),     // Elon
    v.literal("coordination"), // Buddy
  ),
  tier: v.union(v.literal("critical"), v.literal("standard")),
  checkable: v.boolean(),      // can be verified programmatically
  checkPattern: v.optional(v.string()), // regex or keyword to check for violations
  active: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_scope", ["scope", "active"])
  .index("by_tier", ["tier", "active"]),

// Pre-flight logs - track every check before output is sent
preflight_logs: defineTable({
  agentId: v.id("agents"),
  taskId: v.optional(v.id("tasks")),
  checkType: v.string(),       // e.g. "no_double_dashes", "all_sections_present", "links_included"
  passed: v.boolean(),
  details: v.optional(v.string()), // what failed and why
  content: v.optional(v.string()), // the content that was checked (truncated)
  createdAt: v.number(),
})
  .index("by_agent", ["agentId", "createdAt"])
  .index("by_passed", ["passed", "createdAt"]),
```

### 2. New Convex Functions (create convex/standing_orders.ts)

```typescript
// Queries
- list: list all standing orders
- listForAgent: get active standing orders for a specific agent
- getById: get single standing order

// Mutations
- create: create a new standing order
- update: update goal/metrics/priority/active
- remove: delete a standing order
```

### 3. New Convex Functions (create convex/rules.ts)

```typescript
// Queries
- list: list all rules (optionally filter by scope, tier, active)
- listForAgent: given an agent name, return global rules + role-scoped rules. Map agent names to scopes: Buddy=coordination, Katy=social, Burry=trading, Mike=security, Jerry=jobs, Elon=building
- getById: get single rule

// Mutations
- create: create a new rule
- update: update text/why/scope/tier/checkable/checkPattern/active
- remove: delete a rule
```

### 4. New Convex Functions (create convex/preflight.ts)

```typescript
// Queries
- listRecent: get recent preflight logs (last 100), optionally filter by agent or passed status
- getFailures: get recent failures for an agent

// Mutations
- log: create a preflight log entry
- runChecks: given agentId and content string, run all checkable rules for that agent's scope. For each checkable rule with a checkPattern, test the content. Return array of {ruleId, passed, details}. Log each check to preflight_logs.
```

### 5. New HTTP Endpoints (add to convex/http.ts)

```
GET  /api/standing-orders?agent=Name     - get active standing orders for agent
POST /api/standing-orders                - create standing order {agentName, goal, metrics, priority}
PUT  /api/standing-orders                - update {id, goal?, metrics?, priority?, active?}

GET  /api/rules?agent=Name               - get rules for agent (global + scoped)
GET  /api/rules/all                      - get all rules
POST /api/rules                          - create rule {text, why, scope, tier, checkable, checkPattern?}
PUT  /api/rules                          - update rule {id, ...fields}

POST /api/preflight                      - run preflight checks {agentName, content, taskId?}
GET  /api/preflight/failures?agent=Name  - get recent failures
```

All endpoints require X-Citadel-Key header for auth (use existing checkAuth function).

### 6. Update citadel-cli.sh

Add new commands to `scripts/citadel-cli.sh`:
```bash
# Standing orders
citadel-cli standing-order <agentName> <goal> [priority]
citadel-cli standing-orders <agentName>

# Rules
citadel-cli rule <scope> <tier> <text> <why> [checkable] [checkPattern]
citadel-cli rules [agentName]

# Pre-flight
citadel-cli preflight <agentName> <content>
```

### 7. Seed Data (create scripts/seed-rules.sh)

Create a script that seeds initial rules and standing orders:

**Critical Global Rules:**
1. "Never use em dashes (double dashes) in any output" | why: "Jay's #1 formatting rule" | checkable: true | checkPattern: "--|—|–"
2. "Never call agents 'bots'" | why: "They are employees with names" | checkable: true | checkPattern: "\\bbot\\b|\\bbots\\b"
3. "All times in IST, no timezone labels" | why: "Jay is in Bangalore" | checkable: false
4. "Write to file BEFORE responding" | why: "Memory doesn't survive sessions" | checkable: false
5. "Confirm before acting on ambiguous messages" | why: "Learned from Katy cron disable incident" | checkable: false

**Role-scoped rules (examples):**
- social: "Every comment draft must include a clickable link" | checkable: true | checkPattern: (absence of https://)
- social: "Never post more than 2 comments on same author per shift" | checkable: false
- trading: "Never execute live trades without Jay's approval" | checkable: false
- building: "All coding through Codex, never hand-write code" | checkable: false
- building: "Dev servers bind to 127.0.0.1 only, never 0.0.0.0" | checkable: true | checkPattern: "0\\.0\\.0\\.0"

**Standing Orders:**
- Katy: "Grow Jay's X to 50K followers" (primary)
- Katy: "Build Jay's reputation as a tech builder and AI-first founder" (secondary)
- Burry: "Generate $500-1K/month from crypto trading" (primary)
- Jerry: "Find Jay a PM role at a well-funded startup with great product" (primary)
- Elon: "Ship products that generate $1-2K MRR" (primary)
- Mike: "Keep all infrastructure secure with zero breaches" (primary)
- Buddy: "Coordinate the team to maximize Jay's business growth" (primary)

## Important Notes
- DO NOT modify existing tables or endpoints, only ADD new ones
- Use the same auth pattern (checkAuth, X-Citadel-Key header)
- Use the same resolveAgent helper for agent name lookups
- Follow existing code style (internalMutation/internalQuery pattern for http handlers)
- All new files should use TypeScript
- Run `npx convex deploy` after making changes to push to production
