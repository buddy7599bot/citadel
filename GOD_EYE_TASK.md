# God's Eye View — Build Task

## Goal
Add a "God's Eye" top-level view to Citadel alongside the existing "Holocron" kanban.

The page (src/app/page.tsx) already has a "Holocron" section label at ~line 2062. We need to add a toggle at the top of that section to switch between Holocron and God's Eye views.

## What NOT to change
- Holocron kanban: leave completely intact
- Convex schema: no new tables needed (activities, decisions, agents tables are sufficient)
- The left sidebar (agents panel), top header, workspace switcher: leave intact

## File to edit
Only: `src/app/page.tsx`

---

## Implementation Plan

### 1. Add state variable near other state declarations (around line 340):
```tsx
const [mainView, setMainView] = useState<"holocron" | "gods_eye">(() => {
  if (typeof window !== "undefined") {
    return (localStorage.getItem("citadel_main_view") as "holocron" | "gods_eye") ?? "holocron";
  }
  return "holocron";
});
```

When mainView changes, persist: `localStorage.setItem("citadel_main_view", mainView)`

Add these extra state vars for God's Eye:
```tsx
const [geCalendarView, setGeCalendarView] = useState<"day" | "week" | "month">("week");
const [geAgentFilter, setGeAgentFilter] = useState<string>("all"); // "all" or agent name
const [geNeedsJayOnly, setGeNeedsJayOnly] = useState(false);
```

### 2. Add a Convex query for cron-style "next fire" data
The `/api/crons` endpoint is already fetched and stored in `cronState`. Use that.

Also add a new query for pending decisions per agent:
```tsx
const pendingDecisions = useQuery(api.decisions.listByStatus, { status: "pending" });
```
(This query already exists as `api.decisions.list` which returns all decisions — filter client-side for status==="pending")

### 3. Toggle UI
Find the section header that contains `<span className="section-title">Holocron</span>` (around line 2062).

Replace just the span label with a two-button toggle:
```tsx
<div className="flex items-center gap-1">
  <button
    type="button"
    onClick={() => { setMainView("holocron"); localStorage.setItem("citadel_main_view", "holocron"); }}
    className={`px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] rounded-full border transition ${mainView === "holocron" ? "bg-[#D97706] text-white border-[#D97706]" : "bg-white text-warm-600 border-warm-200 hover:border-[#D97706] hover:text-[#D97706]"}`}
  >
    Holocron
  </button>
  <button
    type="button"
    onClick={() => { setMainView("gods_eye"); localStorage.setItem("citadel_main_view", "gods_eye"); }}
    className={`px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] rounded-full border transition ${mainView === "gods_eye" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-warm-600 border-warm-200 hover:border-indigo-500 hover:text-indigo-600"}`}
  >
    God&apos;s Eye
  </button>
</div>
```

### 4. Conditional render
After the section header div, wrap the existing Holocron content in:
```tsx
{mainView === "holocron" && (
  // ... existing kanban JSX ...
)}
{mainView === "gods_eye" && (
  <GodsEyeView ... />
)}
```

### 5. Build the GodsEyeView component (inline in page.tsx, before the Home component)

```tsx
// ---- GOD'S EYE HELPERS ----

function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// CRON SCHEDULE -> next fire time parser
// Parses "cron M H D M W" or "every Nm" or "at YYYY-MM-DDTHH:mmZ" from openclaw cron data
// Returns next fire timestamp in ms (approximate, for display)
function getNextFire(cronName: string, cronList: { id: string; name: string; label: string; enabled: boolean; status: string }[]): number | null {
  // The crons API doesn't return next fire time — we compute from known schedules
  // Known schedules (hardcoded from openclaw cron list):
  const SCHEDULES: Record<string, string> = {
    "dp-citadel-katy": "2,17,32,47 * * * *",
    "dp-citadel-elon": "4,19,34,49 * * * *",
    "dp-citadel-ryan": "6,21,36,51 * * * *",
    "dp-citadel-harvey": "8,23,38,53 * * * *",
    "dp-citadel-rand": "10,25,40,55 * * * *",
    "dp-citadel-buddy": "0,15,30,45 * * * *",
    "katy-dashpane": "30 0,3,6,9,12,15,18,21 * * *",
    "security-scan": "0 8,16,0 * * *",
    "harvey-proactive": "0 */6 * * *",
    "ryan-proactive": "0 */4 * * *",
    "rand-proactive": "0 */8 * * *",
    "elon-dashpane": "30 2 * * *",
    "morning-package": "0 9 * * *",
    "daily-standup": "0 18 * * *",
  };
  const expr = SCHEDULES[cronName];
  if (!expr) return null;
  // Simple next-fire calculator for "M H * * *" and "M,M,M,M * * * *" patterns
  const now = Date.now();
  const nowDate = new Date(now);
  const parts = expr.split(" ");
  const minPart = parts[0];
  const hourPart = parts[1];
  // Parse minute candidates
  let minutes: number[] = [];
  if (minPart.startsWith("*/")) {
    const step = parseInt(minPart.slice(2));
    for (let i = 0; i < 60; i += step) minutes.push(i);
  } else if (minPart.includes(",")) {
    minutes = minPart.split(",").map(Number);
  } else {
    minutes = [parseInt(minPart)];
  }
  // Parse hour candidates
  let hours: number[] = [];
  if (hourPart === "*") {
    for (let i = 0; i < 24; i++) hours.push(i);
  } else if (hourPart.startsWith("*/")) {
    const step = parseInt(hourPart.slice(2));
    for (let i = 0; i < 24; i += step) hours.push(i);
  } else if (hourPart.includes(",")) {
    hours = hourPart.split(",").map(Number);
  } else {
    hours = [parseInt(hourPart)];
  }
  // Find next occurrence
  const curH = nowDate.getUTCHours();
  const curM = nowDate.getUTCMinutes();
  const curS = nowDate.getUTCSeconds();
  // Try within current day first
  for (const h of hours.sort((a,b) => a-b)) {
    for (const m of minutes.sort((a,b) => a-b)) {
      if (h > curH || (h === curH && m > curM) || (h === curH && m === curM && curS === 0)) {
        const next = new Date(nowDate);
        next.setUTCHours(h, m, 0, 0);
        return next.getTime();
      }
    }
  }
  // Next day
  const next = new Date(nowDate);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(hours[0], minutes[0], 0, 0);
  return next.getTime();
}

// Agent -> crons mapping
const AGENT_CRONS: Record<string, string[]> = {
  Buddy: ["dp-citadel-buddy", "daily-standup"],
  Katy: ["dp-citadel-katy", "katy-dashpane"],
  Elon: ["dp-citadel-elon", "elon-dashpane"],
  Ryan: ["dp-citadel-ryan", "ryan-proactive"],
  Harvey: ["dp-citadel-harvey", "harvey-proactive"],
  Rand: ["dp-citadel-rand", "rand-proactive"],
  Mike: ["security-scan"],
  Jerry: [],
  Burry: [],
};

const GE_STATUS_COLORS: Record<string, string> = {
  working: "bg-green-500",
  idle: "bg-gray-400",
  blocked: "bg-indigo-500",
};

const GE_STATUS_LABELS: Record<string, string> = {
  working: "Active",
  idle: "Idle",
  blocked: "Waiting for Jay",
};
```

### 6. GodsEyeView component structure

```tsx
type GodsEyeProps = {
  agents: Array<{_id: string; name: string; role: string; status: string; avatarEmoji: string; currentTask?: string; lastActive: number}>;
  tasks: Array<{_id: string; title: string; status: string; priority: string; tags?: string[]; workspace?: string; createdAt: number; updatedAt: number; assigneeIds: string[]}>;
  activities: Array<{_id: string; agentId?: string; action: string; targetType: string; targetId?: string; description: string; createdAt: number; agent?: {_id: string; name: string; avatarEmoji: string} | null}>;
  decisions: Array<{_id: string; agentId: string; title: string; status: string; taskId?: string; createdAt: number}>;
  cronState: {crons: Array<{id: string; name: string; label: string; enabled: boolean; status: string}>} | null;
  now: Date;
  calendarView: "day" | "week" | "month";
  setCalendarView: (v: "day" | "week" | "month") => void;
  agentFilter: string;
  setAgentFilter: (v: string) => void;
  needsJayOnly: boolean;
  setNeedsJayOnly: (v: boolean) => void;
  onSelectTask: (taskId: string) => void;
  visibleAgentNames: string[];
};

function GodsEyeView(props) {
  // ... render agent cards row + calendar grid
}
```

---

## Agent Cards (Section 1)

For each agent in visibleAgentNames:
- Find agent object from agents array
- Find pending decisions for this agent: `decisions.filter(d => d.agentId === agent._id && d.status === "pending")`
- Find last activity: `activities.filter(a => a.agentId === agent._id)[0]`
- Find current task: tasks.find by title match from agent.currentTask
- Compute cron countdowns from AGENT_CRONS[agent.name] + getNextFire()

Card layout (responsive grid, 3 cols on desktop, 2 on tablet, 1 on mobile):
```
[emoji] [Name]                    [status dot] Active
Task: "Build God's Eye in Citadel"
Last: Harvey posted a comment · 12m ago
Crons: Heartbeat in 4m | Proactive in 2h 15m
[INDIGO badge: "1 Decision Pending"] if any
```

Use amber/warm palette consistent with existing Citadel style.
Status colors: green dot for working, gray for idle, indigo for blocked.
Indigo badge for pending decisions.

---

## Calendar Grid (Section 2)

Show a week calendar (7 columns for week view, 1 column for day, 5-week grid for month).

Events to show:
- Activities from last 7 days (task status changes, comments, decisions created)
- Color by type:
  - task completed = green block
  - decision created = indigo block  
  - comment posted = amber block
  - status change = gray block

For week view:
- 7 columns, each column = a day
- Show date header (Mon 24, Tue 25, etc.)
- Events stacked vertically in their day column
- Each event = small colored pill with agent emoji + description truncated

For day view:
- Show only today's events in a list
- More detail per event

For month view:
- 5-row x 7-col grid
- Dots/counts per day

Each event pill is clickable -> calls onSelectTask(taskId) if it has one.

Indigo items (decisions) always rendered with indigo background.

---

## Filters (above agent cards)

```tsx
<div className="flex items-center gap-3 px-4 py-2 border-b border-warm-100">
  {/* Agent filter */}
  <select value={agentFilter} onChange={...} className="...">
    <option value="all">All agents</option>
    {visibleAgentNames.map(name => <option key={name}>{name}</option>)}
  </select>
  
  {/* Needs Jay toggle */}
  <button 
    onClick={() => setNeedsJayOnly(!needsJayOnly)}
    className={`... ${needsJayOnly ? "bg-indigo-600 text-white" : "bg-white text-warm-600"}`}
  >
    Needs Jay {needsJayCount > 0 && `(${needsJayCount})`}
  </button>
  
  {/* Calendar view toggle */}
  <div className="ml-auto flex items-center gap-1">
    {["day","week","month"].map(v => (
      <button key={v} onClick={() => setCalendarView(v)} className={calendarView===v ? "active" : ""}>
        {v.charAt(0).toUpperCase() + v.slice(1)}
      </button>
    ))}
  </div>
</div>
```

---

## Integration into Home component

In the Home component:
1. Pass the required props to GodsEyeView
2. The `onSelectTask` callback should call `setSelectedTaskId`

The section that renders God's Eye replaces the Holocron content area when `mainView === "gods_eye"`.

---

## Key design constraints
- No new npm packages. Use plain React + Tailwind only.
- Keep all existing Citadel amber/warm color palette.
- Indigo = needs Jay. Use `indigo-500/600` consistently.
- The calendar does NOT need real calendar library — a CSS grid with flex items is fine.
- Mobile: agent cards use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Calendar on mobile: default to day view

---

## After building, run:
```bash
cd /home/ubuntu/clawd/projects/citadel && npm run build 2>&1 | tail -30
```

Fix any TypeScript errors. Then:
```bash
cd /home/ubuntu/clawd/projects/citadel && git add -A && git commit -m "feat: add God's Eye view with agent cards, calendar grid, and decision badges"
git push origin master
```

Then notify:
```bash
openclaw system event --text "Done: God's Eye view built in Citadel — agent cards, calendar, indigo decisions, filters. Pushed to GitHub." --mode now
```
