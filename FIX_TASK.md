# Fix Task: Notification Avatar + Decision CLI

## Bug 1: Notification Avatar Shows Wrong Agent

### Problem
When Elon posts a comment and Katy gets notified, the notification shows Katy's avatar next to "Elon commented on..." because `agentId` is the recipient, not the author.

### Fix Required

**1. Update schema (convex/schema.ts)**
Add to notifications table:
- `authorAgentId`: v.optional(v.id("agents"))
- `authorName`: v.optional(v.string())

**2. Update notification inserts (convex/messages.ts, convex/tasks.ts, convex/internals.ts)**
When inserting notifications, add:
```ts
authorAgentId: args.agentId,  // the agent making the comment
authorName: authorName,        // their name
```

Find all `ctx.db.insert("notifications"` calls and add these fields.

**3. Update notifications query (convex/notifications.ts)**
In `listAll`, return `authorName` from the notification record (or look up from authorAgentId):
```ts
return { 
  ...n, 
  agentName: agent?.name ?? "Unknown",  // keep for recipient
  authorName: n.authorName ?? agent?.name ?? "Unknown",  // add for display
  taskTitle: task?.title ?? null 
};
```

**4. Update frontend (src/app/page.tsx)**
Change the notification avatar from:
```tsx
<AgentAvatar name={notification.agentName} size={24} />
```
To:
```tsx
<AgentAvatar name={notification.authorName ?? notification.agentName} size={24} />
```

## Bug 2: Decision CLI Command Missing

### Problem
Agents can't create decision requests - the API exists but no CLI command.

### Fix Required

**1. Add HTTP endpoint (convex/http.ts)**
Add POST /api/decision endpoint that calls decisions.create mutation.

**2. Add CLI command (scripts/citadel-cli.sh)**
Add after the "assign" case:
```bash
decision)
  agent="$2"; taskId="$3"; title="$4"; options="$5"
  IFS=',' read -ra OPTS <<< "$options"
  opts_json=$(printf '%s\n' "${OPTS[@]}" | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin.read().strip().split("\n") if l.strip()]))')
  post "decision" "{\"agent\":\"$agent\",\"taskId\":\"$taskId\",\"title\":$(echo "$title" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'),\"options\":$opts_json}"
  ;;
```

**3. Check/create decisions.create mutation (convex/decisions.ts)**
Make sure the create mutation exists and accepts: agentId (or agent name to look up), taskId, title, description (optional), options array.

## Files to Modify
1. convex/schema.ts - add authorAgentId, authorName to notifications
2. convex/messages.ts - add author fields to notification inserts
3. convex/tasks.ts - add author fields to notification inserts  
4. convex/internals.ts - add author fields to notification inserts
5. convex/notifications.ts - return authorName in queries
6. src/app/page.tsx - use authorName for avatar
7. convex/http.ts - add /api/decision endpoint
8. scripts/citadel-cli.sh - add decision command
9. convex/decisions.ts - ensure create mutation works with HTTP
