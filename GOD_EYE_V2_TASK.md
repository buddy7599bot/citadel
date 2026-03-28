# God's Eye V2 — Schedule View Build Task

## Context
God's Eye v1 has agent cards + a calendar. That's fine but Jay needs something different.
Jay's real need: **see what agents are DOING right now and what they did recently.**
The primary view should be a **chronological schedule/timeline**, not a calendar grid.

## Files to edit
1. `src/app/api/crons/route.ts` — enhance to return rich cron data (runs history, live state)
2. `src/app/page.tsx` — replace the calendar section in GodsEyeView with Schedule view

---

## Step 1: Update /api/crons endpoint

The existing GET /api/crons returns `{ crons, allEnabled, allDisabled }`.

We need it to also return:
- Per-cron: `nextRunAtMs`, `lastRunAtMs`, `lastRunStatus`, `lastDurationMs`, `runningAtMs` (null if not running)
- Recent run history with summaries

### How to get this data

`openclaw cron list --json` gives us rich data. Run:
```bash
execSync(`${OPENCLAW_BIN} cron list --json --all`, ...)
```

The JSON output is `{ jobs: [...] }` where each job has:
```json
{
  "id": "uuid",
  "name": "dp-citadel-elon",
  "agentId": "builder",
  "enabled": true,
  "schedule": { "kind": "cron", "expr": "4,19,34,49 * * * *", "tz": "UTC" },
  "state": {
    "nextRunAtMs": 1774731840000,
    "lastRunAtMs": 1774730940026,
    "lastRunStatus": "ok",
    "lastDurationMs": 8594,
    "runningAtMs": 1774732320377  // present only when actively running
  }
}
```

Also, `openclaw cron runs --id <uuid> --limit 5` gives us run history per cron:
```json
{
  "entries": [
    {
      "ts": 1774730948625,
      "jobId": "uuid",
      "action": "finished",
      "status": "ok",
      "summary": "HEARTBEAT_OK\n\nAll tasks done...",
      "runAtMs": 1774730940026,
      "durationMs": 8594,
      "nextRunAtMs": 1774731840000,
      "usage": { "input_tokens": 4, "output_tokens": 363, "total_tokens": 26809 }
    }
  ]
}
```

### New GET /api/crons response shape

Add a new top-level key `scheduleData` to the existing response:
```json
{
  "crons": [...existing...],
  "allEnabled": true,
  "allDisabled": false,
  "scheduleData": {
    "jobs": [
      {
        "id": "uuid",
        "name": "dp-citadel-elon",
        "agentId": "builder",
        "agentLabel": "Elon",
        "enabled": true,
        "scheduleExpr": "4,19,34,49 * * * *",
        "nextRunAtMs": 1774731840000,
        "lastRunAtMs": 1774730940026,
        "lastRunStatus": "ok",
        "lastDurationMs": 8594,
        "isRunning": true,
        "runningAtMs": 1774732320377,
        "recentRuns": [
          {
            "ts": 1774730948625,
            "status": "ok",
            "summary": "HEARTBEAT_OK\n\nAll tasks done.",
            "runAtMs": 1774730940026,
            "durationMs": 8594,
            "inputTokens": 4,
            "outputTokens": 363,
            "totalTokens": 26809
          }
        ]
      }
    ],
    "fetchedAt": 1774732400000
  }
}
```

### agentId -> agentLabel mapping
```typescript
const AGENT_ID_TO_NAME: Record<string, string> = {
  builder: "Elon",
  kt: "Katy",
  main: "Buddy",
  ryan: "Ryan",
  harvey: "Harvey",
  rand: "Rand",
  guard: "Mike",
  jobs: "Jerry",
  trader: "Burry",
};
```

### Implementation

Replace the existing `getAllCrons()` function and GET handler with a new one that:
1. Runs `openclaw cron list --json --all` (parse JSON directly — much cleaner than regex parsing)
2. For each enabled job that has `dp-citadel-` or `citadel-push-` prefix, fetch run history: `openclaw cron runs --id <id> --limit 3`
3. Build the scheduleData structure
4. Return merged with existing response (keep backward compat with `crons` array)

Important: fetching runs for ALL crons is slow. Only fetch for the ~10 active/relevant ones. Skip disabled crons' run history.

Parse the JSON output from `openclaw cron list --json` instead of the text table.

---

## Step 2: GodsEyeView — Replace calendar with Schedule View

The GodsEyeView component currently has a calendar grid. Replace it with a **Schedule Timeline**.

### New GodsEyeView layout

```
[Filters bar: agent select | Needs Jay toggle | Live/All toggle]

[Agent Cards row — keep as-is]

[Schedule Timeline]
  Header: "Schedule" | [Live] [All] toggle
  
  Timeline list, newest-first for past, then NOW line, then upcoming:
  
  ──────── ⬤ NOW  21:04 UTC ────────────────
  
  ✓  21:04  🚀 Elon     dp-citadel-elon      4s ago     8.6s   ok
  ✓  20:49  🤖 Buddy    dp-citadel-buddy     19m ago    12s    ok  
  🔄  21:08  🚀 Elon     dp-citadel-elon     Running...          
  ⏳  21:19  🚀 Elon     dp-citadel-elon     in 11m             
  ⏳  21:21  👩 Katy     dp-citadel-katy     in 13m             
```

### Data model for the timeline

Build a flat list of "timeline items":
- Past runs: one item per run entry (status=completed or error)
- Currently running: items where `job.isRunning === true`
- Upcoming fires: next fire for each enabled job

Sort: past runs by runAtMs desc, upcoming by nextRunAtMs asc.
The NOW line separates them.

### Timeline item types

```tsx
type ScheduleItem = {
  id: string; // unique key
  type: "past" | "running" | "upcoming";
  agentLabel: string; // "Elon"
  agentEmoji: string; // "🚀"
  cronName: string; // "dp-citadel-elon"
  timeMs: number; // runAtMs for past, runningAtMs for running, nextRunAtMs for upcoming
  status?: "ok" | "error" | "running";
  durationMs?: number;
  summary?: string; // truncated summary text
  inputTokens?: number;
  outputTokens?: number;
  jobId: string;
};
```

### Timeline item row

Each row:
```
[icon] [time HH:mm] [emoji] [agentName padded] [cronName truncated] [relative time] [duration] [status badge]
```

- Past ok: ✓ green dot, gray text for time, green badge "ok"
- Past error: ✗ red dot, red badge "error"
- Running: 🔄 spinning animation, "Running..." text, no duration yet, bright green + pulse
- Upcoming: ⏳ gray, "in Xm" relative time

Clicking a past run row: shows a detail popover/inline expand with:
- Full summary text (wrap, not truncate)
- Tokens: input/output/total
- Duration
- Session ID (small gray)

### NOW line

```tsx
<div className="flex items-center gap-2 py-2">
  <div className="h-px flex-1 bg-orange-400" />
  <span className="text-xs font-semibold text-orange-500">⬤ NOW {format(now, "HH:mm")} UTC</span>
  <div className="h-px flex-1 bg-orange-400" />
</div>
```

### Polling

The schedule view needs to poll `/api/crons` every 15 seconds to detect:
- New `isRunning` state
- New run completions

Use the existing `cronState` from parent + a prop `onRefreshCrons` that triggers a re-fetch in the parent.
Actually simpler: just poll inside GodsEyeView with useEffect + fetch + setScheduleData local state.

```tsx
const [scheduleData, setScheduleData] = useState<ScheduleDataType | null>(null);

useEffect(() => {
  const fetchSchedule = async () => {
    const res = await fetch("/api/crons");
    if (res.ok) {
      const data = await res.json();
      if (data.scheduleData) setScheduleData(data.scheduleData);
    }
  };
  fetchSchedule();
  const interval = setInterval(fetchSchedule, 15000);
  return () => clearInterval(interval);
}, []);
```

### Agent emoji mapping (for schedule view)
```typescript
const AGENT_EMOJIS: Record<string, string> = {
  Elon: "🚀",
  Buddy: "🤖",
  Katy: "📣",
  Ryan: "🏆",
  Harvey: "⚖️",
  Rand: "🔍",
  Mike: "🛡️",
  Jerry: "💼",
  Burry: "📈",
};
```

### Left stats sidebar (optional, show if space)

If screen is wide enough (lg:), show a narrow stats column on the left of the schedule:
- Total runs today
- Success rate %
- Errors today (red if > 0)
- Most active agent

This can be a simple flex row above the timeline instead if sidebar is complex.

---

## Step 3: TypeScript types

Add this type near the top of page.tsx (after existing types):
```tsx
type ScheduleRun = {
  ts: number;
  status: string;
  summary: string;
  runAtMs: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type ScheduleJob = {
  id: string;
  name: string;
  agentId: string;
  agentLabel: string;
  enabled: boolean;
  scheduleExpr: string;
  nextRunAtMs: number | null;
  lastRunAtMs: number | null;
  lastRunStatus: string | null;
  lastDurationMs: number | null;
  isRunning: boolean;
  runningAtMs: number | null;
  recentRuns: ScheduleRun[];
};

type ScheduleData = {
  jobs: ScheduleJob[];
  fetchedAt: number;
};
```

---

## Step 4: Update GodsEyeProps type

Add:
```tsx
type GodsEyeProps = {
  // ... existing props ...
  // Remove: calendarView, setCalendarView (no longer needed — schedule is primary)
  // Keep filters
};
```

Actually keep calendarView for the Day/Week/Month toggle that shows above the schedule (the calendar events view is secondary, schedule is primary). But make schedule the DEFAULT inner tab.

Add inner tabs to God's Eye:
```
[Schedule] [Calendar]
```
Default: Schedule.

---

## Step 5: Build and deploy

```bash
cd /home/ubuntu/clawd/projects/citadel && npm run build 2>&1 | tail -20
```

Fix TypeScript errors. Then:
```bash
git add -A && git commit -m "feat(gods-eye): schedule timeline with live running state, run history, summaries"
git push origin master
vercel --prod
```

Then:
```bash
openclaw system event --text "Done: God's Eye Schedule view live — real-time cron timeline with running state, run history, summaries, tokens. citadel-iota.vercel.app" --mode now
```

---

## Summary of what Jay will see

1. God's Eye toggle in header
2. Agent cards row (keep existing)
3. **Schedule tab** (default) — chronological timeline of all cron fires:
   - Past runs scrolling up (grayed out with ✓)
   - Orange NOW line
   - Running right now: 🔄 pulsing with "Running..." 
   - Upcoming: gray with countdown
4. Click any past run → see what the agent actually did (full summary text)
5. Calendar tab (existing, secondary)

This directly answers Jay's question: "Is Elon running right now? What did Buddy do 15 minutes ago?"
