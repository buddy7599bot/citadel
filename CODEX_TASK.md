# Mission Control - Phase 1 Build

## Project Setup
This is a Next.js + Convex + Tailwind project at `/home/ubuntu/clawd/projects/mission-control`.
Dependencies already installed: next, react, react-dom, typescript, tailwindcss, convex.

## What to Build

### 1. Next.js App Structure
Create the standard Next.js app directory structure:
- `src/app/layout.tsx` - root layout with dark theme, Tailwind, ConvexProvider
- `src/app/page.tsx` - main dashboard page
- `src/app/globals.css` - Tailwind imports + dark theme styles
- `tsconfig.json` - standard Next.js TypeScript config
- `next.config.ts` - basic Next.js config
- `tailwind.config.ts` - Tailwind config with dark mode

### 2. Convex Schema (`convex/schema.ts`)
Define these tables:

**agents** - id, name, role (coordinator/builder/growth/trading/security/jobs), status (idle/active/blocked), current_task (optional ref to tasks), session_key, level (intern/specialist/lead), last_active (number timestamp), avatar_emoji
- Index: by_name on name
- Index: by_status on status

**tasks** - title, description, status (inbox/assigned/in_progress/review/done/blocked), priority (low/medium/high/urgent), assignee_ids (array of agent ids), creator_id (agent id), due_date (optional number), tags (array of strings), created_at (number), updated_at (number)  
- Index: by_status on status
- Index: by_assignee on assignee_ids (won't work as array - skip this index)
- Index: by_created on created_at

**messages** - task_id (ref to tasks), agent_id (ref to agents), content (string), created_at (number)
- Index: by_task on task_id

**activities** - agent_id (ref to agents), action (string like "created_task", "completed_task", "posted_comment", "status_change"), target_type (string - "task"/"agent"/"system"), target_id (optional string), description (string), created_at (number)
- Index: by_created on created_at

**notifications** - agent_id (ref to agents), type (string - "mention"/"assignment"/"comment"), message (string), source_task_id (optional ref to tasks), read (boolean), delivered (boolean), created_at (number)
- Index: by_agent on agent_id
- Index: by_undelivered on [delivered, created_at]

### 3. Convex Functions

**convex/agents.ts:**
- `list` query: return all agents sorted by name
- `updateStatus` mutation: update agent status + last_active
- `seed` mutation: insert the 6 Alliance agents if table is empty (Buddy/coordinator/lead, Katy/growth/specialist, Burry/trading/specialist, Elon/builder/specialist, Mike/security/specialist, Jerry/jobs/specialist). Emojis: Buddy=🤖, Katy=📣, Burry=📈, Elon=🚀, Mike=🛡️, Jerry=💼

**convex/tasks.ts:**
- `list` query: return all tasks sorted by created_at desc
- `listByStatus` query: takes status arg, returns filtered tasks
- `create` mutation: create task with title, description, status, priority, creator_id
- `updateStatus` mutation: update task status + updated_at, log activity
- `assign` mutation: add agent to assignee_ids

**convex/activities.ts:**
- `list` query: return latest 50 activities sorted by created_at desc, with agent info
- `log` mutation: create activity entry

**convex/messages.ts:**
- `listByTask` query: return messages for a task sorted by created_at
- `create` mutation: create message, log activity

**convex/notifications.ts:**
- `listForAgent` query: return notifications for an agent
- `markRead` mutation: mark notification as read
- `markDelivered` mutation: mark as delivered

### 4. Dashboard UI (`src/app/page.tsx`)

Dark theme dashboard with 3-column layout:

**Left column (Activity Feed):**
- Real-time activity stream using `useQuery` 
- Each activity shows: agent emoji + agent name + action description + relative timestamp
- Auto-updates in real-time (Convex handles this)

**Center column (Kanban Board):**
- 5 columns: Inbox, Assigned, In Progress, Review, Done
- Each task card shows: title, priority badge (color coded), assignee emojis, created time
- Click to expand (just show detail, no modal needed for v1)
- "New Task" button at top

**Right column (Agent Cards):**
- 6 agent cards in a grid
- Each card: emoji, name, role, status badge (green=active, yellow=idle, red=blocked), current task if any, last active time
- Real-time status updates

**Top bar:**
- "Mission Control" title with rocket emoji
- Subtitle: "Alliance Command Center"

### 5. Styling
- Pure dark theme: bg-[#0A0A0A] main background
- Cards: bg-[#141414] with border-[#1F1F1F]
- Accent: lime-500 (#84CC16) for active states
- Status colors: green for active/done, yellow for idle/in_progress, red for blocked, blue for assigned
- Priority: urgent=red, high=orange, medium=yellow, low=gray
- Font: system font stack
- No gradients, no purple. Clean and minimal.

### 6. ConvexProvider Setup
- `src/app/ConvexClientProvider.tsx` - client component wrapping ConvexProvider
- Use environment variable `NEXT_PUBLIC_CONVEX_URL`

## DO NOT
- Do not add auth for v1
- Do not add drag-and-drop
- Do not add animations beyond basic transitions
- Do not use any purple colors
- Do not over-engineer - this is an MVP
