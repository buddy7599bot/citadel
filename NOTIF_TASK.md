# Notification Bell Feature

## Task
Add a notification bell icon to the Holocron section header, to the LEFT of the "New Task" button. Clicking it opens a notification panel/dropdown.

## Requirements

1. **Bell icon** - SVG bell icon with a red badge showing unread count (if > 0). Place it LEFT of the "New Task" button in the Holocron header bar.

2. **Notification panel** - clicking the bell toggles a dropdown/panel showing notifications:
   - Each notification shows: agent avatar (use `<AgentAvatar name={n.agentName} size={24} />`), message text, and relative time
   - Notifications ordered newest first
   - Click a notification to mark it as read (use `api.notifications.markRead`)
   - If notification has a `sourceTaskId`, clicking it should also open the task detail (`setSelectedTaskId`)

3. **Agent filter** - at the top of the notification panel, show clickable avatar images of all agents (use `<AgentAvatar>` component, size 28). Clicking an agent filters notifications to only that agent. Clicking again deselects (shows all). Highlight selected agent with a ring.

4. **Data** - use `useQuery(api.notifications.listAll)` to fetch all notifications. The query returns `{ _id, agentId, agentName, type, message, sourceTaskId, taskTitle, read, delivered, createdAt }`.

5. **Mark all read** - add a small "Mark all read" button at the top right of the panel. Use `api.notifications.markRead` for each unread notification.

## Existing code patterns
- `AgentAvatar` component already exists for rendering agent photos
- `timeAgo()` function exists for relative times
- All agents available via `agents` variable (from `useQuery(api.agents.list)`)
- Task detail opens via `setSelectedTaskId(id.toString())`
- Bell should use inline SVG, no external icon library

## Files to edit
- `src/app/page.tsx` - add state, query, and UI

## Style
- Match the existing warm/amber design system
- Panel should be absolute positioned below the bell, z-30, with border-warm-200, bg-white, shadow-card
- Max height 400px with overflow-y-auto

## When done
Run this exact command:
npx next build 2>&1 | tail -5

Then run:
npx vercel --prod --yes 2>&1 | tail -5
