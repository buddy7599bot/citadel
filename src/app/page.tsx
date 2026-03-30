"use client";

import { useEffect, useMemo, useRef, useState, useCallback, type ChangeEvent, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import Image from "next/image";
import { api } from "../../convex/_generated/api";

const AGENT_AVATARS: Record<string, string> = {
  Buddy: "/avatars/buddy.jpg",
  Katy: "/avatars/katy.jpg",
  Elon: "/avatars/elon.jpg",
  Jerry: "/avatars/jerry.jpg",
  Burry: "/avatars/burry.jpg",
  Mike: "/avatars/mike.jpg",
  Rand: "/avatars/rand.jpg",
  Ryan: "/avatars/ryan.jpg",
  Harvey: "/avatars/harvey.jpg",
};

function AgentAvatar({ name, size = 24, className = "" }: { name: string; size?: number; className?: string }) {
  const src = AGENT_AVATARS[name];
  if (!src) return <span className={className}>🤖</span>;
  return (
    <Image
      src={src}
      alt={name}
      width={size}
      height={size}
      className={`rounded-full object-cover shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

function AnimatedCounter({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    const start = prev.current;
    const diff = value - start;
    const duration = 400;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    prev.current = value;
  }, [value]);
  return <span className={className}>{display}</span>;
}

function linkifyContent(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const mentionRegex = /(@\w+)/g;
  const parts = text.split(/(https?:\/\/[^\s]+|@\w+)/g);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      urlRegex.lastIndex = 0;
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-amber-700 underline hover:text-amber-900 break-all">
          {part}
        </a>
      );
    }
    if (mentionRegex.test(part)) {
      mentionRegex.lastIndex = 0;
      return (
        <span key={i} className="font-semibold text-amber-700">{part}</span>
      );
    }
    return part;
  });
}
import type { Id } from "../../convex/_generated/dataModel";
import { timeAgo } from "@/lib/utils";

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      return <h2 key={i} className="mt-4 mb-1 text-lg font-bold text-warm-900">{trimmed.slice(3)}</h2>;
    }
    if (trimmed.startsWith("### ")) {
      return <h3 key={i} className="mt-3 mb-1 text-base font-semibold text-warm-800">{trimmed.slice(4)}</h3>;
    }
    if (trimmed.startsWith("# ")) {
      return <h1 key={i} className="mt-4 mb-2 text-xl font-bold text-warm-900">{trimmed.slice(2)}</h1>;
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const content = trimmed.slice(2);
      return <li key={i} className="ml-4 list-disc text-warm-700">{renderInline(content)}</li>;
    }
    if (trimmed === "") {
      return <div key={i} className="h-2" />;
    }
    return <p key={i} className="text-warm-700 leading-relaxed">{renderInline(trimmed)}</p>;
  });
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-warm-900">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

const STATUS_COLUMNS = [
  { key: "inbox", label: "INBOX", dot: "bg-gray-400" },
  { key: "assigned", label: "ASSIGNED", dot: "bg-yellow-400" },
  { key: "in_progress", label: "IN PROGRESS", dot: "bg-orange-500" },
  { key: "review", label: "REVIEW", dot: "bg-blue-500" },
  { key: "done", label: "DONE", dot: "bg-green-500" },
] as const;

const PRIORITY_BORDER: Record<string, string> = {
  urgent: "border-l-[#EF4444]",
  high: "border-l-[#F97316]",
  medium: "border-l-[#EAB308]",
  low: "border-l-[#D1D5DB]",
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-[#FEE2E2] text-[#991B1B]",
  high: "bg-[#FFEDD5] text-[#9A3412]",
  medium: "bg-[#FEF3C7] text-[#92400E]",
  low: "bg-[#F3F4F6] text-[#6B7280]",
};

const TASK_STATUS_BADGE: Record<string, string> = {
  inbox: "bg-[#E0E7FF] text-[#3730A3]",
  assigned: "bg-[#DBEAFE] text-[#1E40AF]",
  in_progress: "bg-[#DCFCE7] text-[#166534]",
  review: "bg-[#FEF3C7] text-[#92400E]",
  done: "bg-[#F3F4F6] text-[#6B7280]",
};

const LEVEL_BADGE: Record<string, string> = {
  lead: "bg-[#FEF3C7] text-[#92400E]",
  specialist: "bg-[#DBEAFE] text-[#1E40AF]",
  intern: "bg-[#F3F4F6] text-[#374151]",
};

const STATUS_BADGE: Record<string, string> = {
  working: "bg-[#DCFCE7] text-[#166534]",
  idle: "bg-[#F3F4F6] text-[#6B7280]",
  blocked: "bg-[#FEE2E2] text-[#991B1B]",
};

const DOCUMENT_TYPES = ["deliverable", "research", "protocol", "report"] as const;

const DOC_TYPE_BADGE: Record<(typeof DOCUMENT_TYPES)[number], string> = {
  deliverable: "bg-[#DCFCE7] text-[#166534]",
  research: "bg-[#DBEAFE] text-[#1E40AF]",
  protocol: "bg-[#FEF3C7] text-[#92400E]",
  report: "bg-[#F3F4F6] text-[#6B7280]",
};

const FEED_TABS = [
  { key: "all", label: "All", target: undefined },
  { key: "tasks", label: "Tasks", target: "task" },
  { key: "comments", label: "Comments", target: "comment" },
  { key: "decisions", label: "Decisions", target: "decision" },
] as const;

const formatSignedPercent = (value: number, digits = 1) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;

const AGENT_PANEL_META: Record<
  string,
  {
    title: string;
    subtitle: string;
    accent: string;
  }
> = {
  Burry: {
    title: "Trading",
    subtitle: "Mini trading dashboard",
    accent: "border-[#F97316] bg-[#FFF7ED] text-[#9A3412]",
  },
  Katy: {
    title: "Growth / X",
    subtitle: "Social analytics",
    accent: "border-[#D97706] bg-[#FFFBEB] text-[#92400E]",
  },
  Mike: {
    title: "Security",
    subtitle: "Security dashboard",
    accent: "border-[#16A34A] bg-[#F0FDF4] text-[#166534]",
  },
  Jerry: {
    title: "Jobs",
    subtitle: "Job pipeline",
    accent: "border-[#3B82F6] bg-[#EFF6FF] text-[#1D4ED8]",
  },
  Elon: {
    title: "Builder",
    subtitle: "Build status",
    accent: "border-[#0EA5E9] bg-[#F0F9FF] text-[#0369A1]",
  },
  Buddy: {
    title: "Coordinator",
    subtitle: "Overview",
    accent: "border-[#A855F7] bg-[#FAF5FF] text-[#6B21A8]",
  },
};

const CRON_EMPLOYEES_MAIN = [
  { id: "c6e6ed3b", name: "Buddy", cronLabel: "coordinator" },
  { id: "f6a4c7ae", name: "Mike", cronLabel: "security" },
  { id: "2ecada74", name: "Katy", cronLabel: "social" },
  { id: "56710293", name: "Burry", cronLabel: "trading" },
  { id: "0d18550f", name: "Jerry", cronLabel: "jobs" },
  { id: "6a4c5e47", name: "Elon", cronLabel: "build" },
];

const CRON_EMPLOYEES_DASHPANE = [
  { id: "cb57af04", name: "Buddy", cronLabel: "buddy" },
  { id: "5dc5b267", name: "Katy", cronLabel: "katy" },
  { id: "01c4a381", name: "Elon", cronLabel: "elon" },
  { id: "d85b71e5", name: "Ryan", cronLabel: "ryan" },
  { id: "c3eba68f", name: "Harvey", cronLabel: "harvey" },
  { id: "f5a7fa3a", name: "Rand", cronLabel: "rand" },
];

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

function getNextFire(cronName: string): number | null {
  // Exact schedules from openclaw cron list --json (verified 2026-03-29)
  const SCHEDULES: Record<string, string> = {
    // HB crons — every 15 min, staggered by 2 min
    "dp-citadel-buddy":   "0,15,30,45 * * * *",
    "dp-citadel-katy":    "2,17,32,47 * * * *",
    "dp-citadel-elon":    "4,19,34,49 * * * *",
    "dp-citadel-ryan":    "6,21,36,51 * * * *",
    "dp-citadel-harvey":  "8,23,38,53 * * * *",
    "dp-citadel-rand":    "10,25,40,55 * * * *",
    // Proactive crons
    "katy-dashpane":      "30 0,3,6,9,12,15,18,21 * * *",  // every 3hrs at :30
    "elon-dashpane":      "30 2 * * *",                     // daily 02:30 UTC = 08:00 IST
    "ryan-proactive":     "0 */4 * * *",                    // every 4hrs
    "harvey-proactive":   "0 */6 * * *",                    // every 6hrs
    "rand-proactive":     "0 */8 * * *",                    // every 8hrs
    // Monitor
    "dashpane-license-monitor": "0,30 * * * *",            // every 30 min
  };
  const expr = SCHEDULES[cronName];
  if (!expr) return null;
  const nowDate = new Date();
  const parts = expr.split(" ");
  const minPart = parts[0];
  const hourPart = parts[1];
  let minutes: number[] = [];
  if (minPart.startsWith("*/")) {
    const step = parseInt(minPart.slice(2));
    for (let i = 0; i < 60; i += step) minutes.push(i);
  } else if (minPart.includes(",")) {
    minutes = minPart.split(",").map(Number);
  } else {
    minutes = [parseInt(minPart)];
  }
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
  const curH = nowDate.getUTCHours();
  const curM = nowDate.getUTCMinutes();
  for (const h of hours.sort((a, b) => a - b)) {
    for (const m of minutes.sort((a, b) => a - b)) {
      if (h > curH || (h === curH && m > curM)) {
        const next = new Date(nowDate);
        next.setUTCHours(h, m, 0, 0);
        return next.getTime();
      }
    }
  }
  const next = new Date(nowDate);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(hours[0], minutes[0], 0, 0);
  return next.getTime();
}

// DashPane workspace crons only — main workspace crons (daily-standup, morning-package, security-scan) excluded
const AGENT_CRONS: Record<string, string[]> = {
  Buddy: ["dp-citadel-buddy"],
  Katy: ["dp-citadel-katy", "katy-dashpane"],
  Elon: ["dp-citadel-elon", "elon-dashpane", "dashpane-license-monitor"],
  Ryan: ["dp-citadel-ryan", "ryan-proactive"],
  Harvey: ["dp-citadel-harvey", "harvey-proactive"],
  Rand: ["dp-citadel-rand", "rand-proactive"],
  Mike: [],
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

const GE_EVENT_COLORS: Record<string, { bg: string; text: string }> = {
  completed: { bg: "bg-green-100 border-green-300", text: "text-green-800" },
  decision: { bg: "bg-indigo-100 border-indigo-300", text: "text-indigo-800" },
  comment: { bg: "bg-amber-100 border-amber-300", text: "text-amber-800" },
  status: { bg: "bg-gray-100 border-gray-300", text: "text-gray-700" },
};

function classifyActivity(action: string, targetType: string): keyof typeof GE_EVENT_COLORS {
  if (targetType === "decision" || action === "created_decision") return "decision";
  if (action === "completed" || action === "moved_to_done") return "completed";
  if (action === "commented" || action === "posted_comment" || targetType === "comment") return "comment";
  return "status";
}

type GodsEyeActivity = {
  _id: string;
  agentId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  description: string;
  createdAt: number;
  agent?: { _id: string; name: string; avatarEmoji: string } | null;
};
type GodsEyeDecision = {
  _id: string;
  agentId: string;
  title: string;
  description?: string;
  status: string;
  taskId?: string;
  createdAt: number;
  options?: string[];
  resolution?: string;
  comments?: Array<{ text: string; createdAt: number }>;
  agent?: { _id: string; name: string; avatarEmoji: string };
};
type GodsEyeAgent = {
  _id: string;
  name: string;
  role: string;
  status: string;
  avatarEmoji: string;
  currentTask?: string;
  lastActive: number;
};
type GodsEyeTask = {
  _id: string;
  title: string;
  status: string;
  priority: string;
  tags?: string[];
  workspace?: string;
  createdAt: number;
  updatedAt: number;
  assigneeIds: string[];
  trigger?: { source: string; ref?: string; text?: string };
  progress?: { text: string; timestamp: number; agentId?: string }[];
  sessionId?: string;
  outputSummary?: string;
};

type ScheduleRun = {
  ts: number;
  status: string;
  summary: string;
  runAtMs: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  transcriptEntries: Array<{ kind: "assistant" | "tool"; text: string }>;
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

type ScheduleItem = {
  id: string;
  type: "past" | "running" | "upcoming";
  agentLabel: string;
  agentEmoji: string;
  cronName: string;
  timeMs: number;
  status?: "ok" | "error" | "running";
  durationMs?: number;
  summary?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  transcriptEntries?: Array<{ kind: "assistant" | "tool"; text: string }>;
  jobId: string;
};

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

function normalizeCronName(name: string): string {
  if (name.startsWith("dp-citadel-")) return name.slice("dp-citadel-".length);
  if (name.startsWith("citadel-push-")) return name.slice("citadel-push-".length);
  return name;
}

function buildScheduleItems(data: ScheduleData): ScheduleItem[] {
  const items: ScheduleItem[] = [];

  for (const job of data.jobs) {
    const emoji = AGENT_EMOJIS[job.agentLabel] ?? "🤖";

    // Past runs from recentRuns
    for (const run of job.recentRuns) {
      items.push({
        id: `${job.id}-run-${run.ts}`,
        type: "past",
        agentLabel: job.agentLabel,
        agentEmoji: emoji,
        cronName: job.name,
        timeMs: run.runAtMs,
        status: run.status === "ok" ? "ok" : "error",
        durationMs: run.durationMs,
        summary: run.summary,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        totalTokens: run.totalTokens,
        transcriptEntries: run.transcriptEntries,
        jobId: job.id,
      });
    }

    // Currently running
    if (job.isRunning && job.runningAtMs) {
      items.push({
        id: `${job.id}-running`,
        type: "running",
        agentLabel: job.agentLabel,
        agentEmoji: emoji,
        cronName: job.name,
        timeMs: job.runningAtMs,
        status: "running",
        jobId: job.id,
      });
    }

    // Upcoming
    if (job.enabled && job.nextRunAtMs && !job.isRunning) {
      items.push({
        id: `${job.id}-next`,
        type: "upcoming",
        agentLabel: job.agentLabel,
        agentEmoji: emoji,
        cronName: job.name,
        timeMs: job.nextRunAtMs,
        jobId: job.id,
      });
    }
  }

  // Dedup: same agent + cron within a 10-min window → keep the one with richer data
  items.sort((a, b) => {
    const aScore = (a.summary || (a.durationMs && a.durationMs > 0)) ? 0 : 1;
    const bScore = (b.summary || (b.durationMs && b.durationMs > 0)) ? 0 : 1;
    return aScore - bScore || a.timeMs - b.timeMs;
  });
  const seen = new Set<string>();
  const deduped = items.filter((item) => {
    const bucket = Math.floor(item.timeMs / 600000); // 10-min buckets
    const key = `${item.jobId}-${item.agentLabel}-${normalizeCronName(item.cronName)}-${bucket}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

function formatRelativeTime(timeMs: number, nowMs: number): string {
  const diff = nowMs - timeMs;
  if (Math.abs(diff) < 5000) return "just now";
  const absDiff = Math.abs(diff);
  const prefix = diff > 0 ? "" : "in ";
  const suffix = diff > 0 ? " ago" : "";
  if (absDiff < 60000) return `${prefix}${Math.round(absDiff / 1000)}s${suffix}`;
  if (absDiff < 3600000) return `${prefix}${Math.round(absDiff / 60000)}m${suffix}`;
  return `${prefix}${Math.round(absDiff / 3600000)}h${suffix}`;
}

function renderCronTranscript(entries: Array<{ kind: "assistant" | "tool"; text: string }> | undefined) {
  if (!entries || entries.length === 0) return null;
  return (
    <div className="mb-2 space-y-2">
      {entries.map((entry, index) => entry.kind === "assistant" ? (
        <div
          key={`${entry.kind}-${index}`}
          className="rounded border border-warm-200 bg-white px-2 py-1.5"
        >
          <div className="mb-1 text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-warm-500">
            Message
          </div>
          <pre className="whitespace-pre-wrap text-[0.65rem] leading-relaxed text-warm-700">{entry.text}</pre>
        </div>
      ) : (
        <details
          key={`${entry.kind}-${index}`}
          className="rounded border border-sky-200 bg-sky-50 px-2 py-1.5"
        >
          <summary className="cursor-pointer list-none text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-sky-600">
            Tool Output
          </summary>
          <pre className="mt-2 whitespace-pre-wrap text-[0.65rem] leading-relaxed text-warm-700">{entry.text}</pre>
        </details>
      ))}
    </div>
  );
}

function formatUtcTime(ms: number): string {
  const d = new Date(ms);
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(d.getTime() + istOffset);
  const hh = String(ist.getUTCHours()).padStart(2, '0');
  const mm = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// IST offset in ms
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toIstDate(ms: number): Date {
  return new Date(ms + IST_OFFSET_MS);
}

// Cron type classification — pattern-based matching
function getCronTypeBadge(cronName: string): { label: string; className: string } | null {
  // HB — 15-min heartbeat crons
  if (cronName.includes("dp-citadel-")) return { label: "hb", className: "bg-warm-100 text-warm-500 border-warm-200" };
  // MON — monitoring, reporting, package crons (run periodically, aggregate data)
  if (cronName.includes("monitor") || cronName.includes("morning-package") || cronName.includes("daily-standup") || cronName.includes("ideate") || cronName.includes("standup"))
    return { label: "mon", className: "bg-emerald-100 text-emerald-600 border-emerald-200" };
  // PRO — proactive agent shifts (deep work: outreach, research, content, builds)
  if (cronName.includes("-proactive") || cronName.includes("-dashpane") || cronName.includes("security-scan"))
    return { label: "pro", className: "bg-blue-100 text-blue-600 border-blue-200" };
  return null;
}

// Agent colors for timeline visualization
const AGENT_TIMELINE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  Elon: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-800", dot: "bg-blue-500" },
  Buddy: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-800", dot: "bg-emerald-500" },
  Katy: { bg: "bg-pink-50", border: "border-pink-300", text: "text-pink-800", dot: "bg-pink-500" },
  Ryan: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-800", dot: "bg-amber-500" },
  Harvey: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-800", dot: "bg-purple-500" },
  Rand: { bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-800", dot: "bg-cyan-500" },
  Mike: { bg: "bg-red-50", border: "border-red-300", text: "text-red-800", dot: "bg-red-500" },
  Jerry: { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-800", dot: "bg-orange-500" },
  Burry: { bg: "bg-indigo-50", border: "border-indigo-300", text: "text-indigo-800", dot: "bg-indigo-500" },
};

const DEFAULT_AGENT_COLOR = { bg: "bg-gray-50", border: "border-gray-300", text: "text-gray-800", dot: "bg-gray-500" };

// Parse a cron expression and return all fire times (as UTC ms) within a range
function parseScheduleMinutesAndHours(expr: string): { minutes: number[]; hours: number[] } | null {
  if (!expr) return null;
  const parts = expr.split(" ");
  if (parts.length < 5) return null;
  const minPart = parts[0];
  const hourPart = parts[1];

  let minutes: number[] = [];
  if (minPart === "*") { for (let i = 0; i < 60; i++) minutes.push(i); }
  else if (minPart.startsWith("*/")) { const step = parseInt(minPart.slice(2)); for (let i = 0; i < 60; i += step) minutes.push(i); }
  else if (minPart.includes(",")) { minutes = minPart.split(",").map(Number); }
  else { minutes = [parseInt(minPart)]; }

  let hours: number[] = [];
  if (hourPart === "*") { for (let i = 0; i < 24; i++) hours.push(i); }
  else if (hourPart.startsWith("*/")) { const step = parseInt(hourPart.slice(2)); for (let i = 0; i < 24; i += step) hours.push(i); }
  else if (hourPart.includes(",")) { hours = hourPart.split(",").map(Number); }
  else { hours = [parseInt(hourPart)]; }

  return { minutes: minutes.sort((a, b) => a - b), hours: hours.sort((a, b) => a - b) };
}

// Get all fire times for a job on a given day (dayStartUtcMs = start of day in UTC)
function getFireTimesForDay(expr: string, dayStartUtcMs: number): number[] {
  const parsed = parseScheduleMinutesAndHours(expr);
  if (!parsed) return [];
  const times: number[] = [];
  for (const h of parsed.hours) {
    for (const m of parsed.minutes) {
      times.push(dayStartUtcMs + h * 3600000 + m * 60000);
    }
  }
  return times.sort((a, b) => a - b);
}

// Get IST day start in UTC ms for a given timestamp
function getIstDayStartUtc(nowMs: number): number {
  const ist = toIstDate(nowMs);
  // IST day start = midnight IST = (midnight IST in UTC)
  const istMidnight = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 0, 0, 0, 0));
  // Convert back to UTC: subtract IST offset
  return istMidnight.getTime() - IST_OFFSET_MS;
}

type TimelineSlot = {
  hourIst: number;
  items: TimelineItem[];
};

type TimelineItem = {
  id: string;
  jobId: string;
  agentLabel: string;
  agentEmoji: string;
  cronName: string;
  fireTimeMs: number;
  type: "completed" | "error" | "running" | "upcoming";
  durationMs?: number;
  summary?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  transcriptEntries?: Array<{ kind: "assistant" | "tool"; text: string }>;
};

function buildDayTimeline(scheduleData: ScheduleData, nowMs: number, agentFilter: string, dayMs?: number): TimelineSlot[] {
  const dayStartUtc = getIstDayStartUtc(dayMs ?? nowMs);
  const dayEndUtc = dayStartUtc + 24 * 3600000;

  const allItems: TimelineItem[] = [];

  for (const job of scheduleData.jobs) {
    if (!job.agentLabel) continue;
    if (agentFilter !== "all" && job.agentLabel !== agentFilter) continue;
    const emoji = AGENT_EMOJIS[job.agentLabel] ?? "🤖";

    for (const run of job.recentRuns) {
      if (run.runAtMs < dayStartUtc || run.runAtMs >= dayEndUtc) continue;
      allItems.push({
        id: `${job.id}-day-run-${run.runAtMs}`,
        jobId: job.id,
        agentLabel: job.agentLabel,
        agentEmoji: emoji,
        cronName: job.name,
        fireTimeMs: run.runAtMs,
        type: run.status === "ok" ? "completed" : "error",
        durationMs: run.durationMs,
        summary: run.summary,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        totalTokens: run.totalTokens,
        transcriptEntries: run.transcriptEntries,
      });
    }

    if (job.isRunning && job.runningAtMs && job.runningAtMs >= dayStartUtc && job.runningAtMs < dayEndUtc) {
      allItems.push({
        id: `${job.id}-day-running-${job.runningAtMs}`,
        jobId: job.id,
        agentLabel: job.agentLabel,
        agentEmoji: emoji,
        cronName: job.name,
        fireTimeMs: job.runningAtMs,
        type: "running",
      });
    }

    if (job.enabled) {
      const fireTimes = getFireTimesForDay(job.scheduleExpr, dayStartUtc);
      for (const ft of fireTimes) {
        if (ft <= nowMs || ft < dayStartUtc || ft >= dayEndUtc) continue;
        allItems.push({
          id: `${job.id}-day-upcoming-${ft}`,
          jobId: job.id,
          agentLabel: job.agentLabel,
          agentEmoji: emoji,
          cronName: job.name,
          fireTimeMs: ft,
          type: "upcoming",
        });
      }
    }
  }

  // Dedup exact same job/time/type rows while preferring real run rows over synthetic upcoming rows.
  allItems.sort((a, b) => {
    const typeScore = (item: TimelineItem) => {
      if (item.type === "running") return 0;
      if (item.type === "error") return 1;
      if (item.type === "completed" && (item.summary || (item.durationMs && item.durationMs > 0))) return 2;
      if (item.type === "upcoming") return 3;
      return 4; // completed without data
    };
    return typeScore(a) - typeScore(b) || a.fireTimeMs - b.fireTimeMs;
  });
  const seenKeys = new Set<string>();
  const dedupedItems = allItems.filter((item) => {
    const key = `${item.jobId}-${item.type}-${item.fireTimeMs}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  // Group by IST hour
  const slots: TimelineSlot[] = [];
  for (let h = 0; h < 24; h++) {
    const items = dedupedItems
      .filter((i) => {
        const ist = toIstDate(i.fireTimeMs);
        return ist.getUTCHours() === h;
      })
      .sort((a, b) => a.fireTimeMs - b.fireTimeMs);
    slots.push({ hourIst: h, items });
  }

  return slots;
}

type WeekDayData = {
  dateLabel: string;
  dayOfWeek: string;
  isToday: boolean;
  dayStartUtcMs: number;
  completed: number;
  errors: number;
  running: number;
  upcoming: number;
  items: TimelineItem[];
};

function buildWeekView(scheduleData: ScheduleData, nowMs: number, agentFilter: string, weekOffset = 0): WeekDayData[] {
  const todayStartUtc = getIstDayStartUtc(nowMs);
  const istNow = toIstDate(nowMs);
  const todayDow = istNow.getUTCDay(); // 0=Sun
  // Mon-Sun: Monday offset from today
  const monOffset = todayDow === 0 ? -6 : 1 - todayDow;

  const days: WeekDayData[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 0; i < 7; i++) {
    const offset = monOffset + i + weekOffset * 7;
    const dayStartUtc = todayStartUtc + offset * 24 * 3600000;
    const dayEndUtc = dayStartUtc + 24 * 3600000;
    const isToday = offset === 0;

    const istDay = toIstDate(dayStartUtc);
    const dateLabel = `${istDay.getUTCDate()}/${istDay.getUTCMonth() + 1}`;
    const dayOfWeek = dayNames[istDay.getUTCDay()];

    const items: TimelineItem[] = [];

    for (const job of scheduleData.jobs) {
      if (!job.agentLabel) continue;
      if (agentFilter !== "all" && job.agentLabel !== agentFilter) continue;
      const emoji = AGENT_EMOJIS[job.agentLabel] ?? "🤖";

      // Actual runs in this day
      for (const run of job.recentRuns) {
        if (run.runAtMs >= dayStartUtc && run.runAtMs < dayEndUtc) {
          items.push({
            id: `${job.id}-week-${run.runAtMs}`,
            jobId: job.id,
            agentLabel: job.agentLabel,
            agentEmoji: emoji,
            cronName: job.name,
            fireTimeMs: run.runAtMs,
            type: run.status === "ok" ? "completed" : "error",
            durationMs: run.durationMs,
          });
        }
      }

      // For today: add running and upcoming
      if (isToday) {
        if (job.isRunning && job.runningAtMs) {
          items.push({
            id: `${job.id}-week-running`,
            jobId: job.id,
            agentLabel: job.agentLabel,
            agentEmoji: emoji,
            cronName: job.name,
            fireTimeMs: job.runningAtMs,
            type: "running",
          });
        }
        // Compute remaining fire times for today
        const fireTimes = getFireTimesForDay(job.scheduleExpr, dayStartUtc);
        for (const ft of fireTimes) {
          if (ft > nowMs && ft < dayEndUtc) {
            items.push({
              id: `${job.id}-week-upcoming-${ft}`,
              jobId: job.id,
              agentLabel: job.agentLabel,
              agentEmoji: emoji,
              cronName: job.name,
              fireTimeMs: ft,
              type: "upcoming",
            });
          }
        }
      }

      // For future days: compute all scheduled fire times
      if (dayStartUtc > todayStartUtc && job.enabled) {
        const fireTimes = getFireTimesForDay(job.scheduleExpr, dayStartUtc);
        for (const ft of fireTimes) {
          if (ft >= dayStartUtc && ft < dayEndUtc) {
            items.push({
              id: `${job.id}-week-future-${ft}`,
              jobId: job.id,
              agentLabel: job.agentLabel,
              agentEmoji: emoji,
              cronName: job.name,
              fireTimeMs: ft,
              type: "upcoming",
            });
          }
        }
      }
    }

    const completed = items.filter((i) => i.type === "completed").length;
    const errors = items.filter((i) => i.type === "error").length;
    const running = items.filter((i) => i.type === "running").length;
    const upcoming = items.filter((i) => i.type === "upcoming").length;

    days.push({ dateLabel, dayOfWeek, isToday, dayStartUtcMs: dayStartUtc, completed, errors, running, upcoming, items });
  }

  return days;
}

type GodsEyeProps = {
  agents: GodsEyeAgent[];
  tasks: GodsEyeTask[];
  activities: GodsEyeActivity[];
  decisions: GodsEyeDecision[];
  cronState: { crons: { id: string; name: string; label: string; enabled: boolean }[] } | null;
  activeWorkspace: "main" | "dashpane";
  now: Date;

  agentFilter: string;
  setAgentFilter: (v: string) => void;
  needsJayOnly: boolean;
  setNeedsJayOnly: (v: boolean) => void;
  onSelectTask: (taskId: string) => void;
  onSelectAgent: (agentId: string) => void;
  visibleAgentNames: string[];
  liveStatuses: Array<{
    _id: string;
    agentId: string;
    status: string;
    currentTaskId?: string;
    currentTaskTitle?: string;
    startedAt?: number;
    finishedAt?: number;
    updatedAt: number;
  }>;
  onDecisionResolve: (decisionId: string, option: string) => void;
  onDecisionDefer: (args: { id: any }) => void;
  onDecisionCancel: (args: { id: any }) => void;
  decisionCommentDrafts: Record<string, string>;
  onDecisionCommentChange: (decisionId: string, value: string) => void;
  onDecisionCommentSubmit: (decisionId: string) => void;
};

function GodsEyeView({
  agents,
  tasks,
  activities,
  decisions,
  cronState,
  activeWorkspace,
  now,
  agentFilter,
  setAgentFilter,
  needsJayOnly,
  setNeedsJayOnly,
  onSelectTask,
  onSelectAgent,
  visibleAgentNames,
  liveStatuses,
  onDecisionResolve,
  onDecisionDefer,
  onDecisionCancel,
  decisionCommentDrafts,
  onDecisionCommentChange,
  onDecisionCommentSubmit,
}: GodsEyeProps) {
  const [geInnerTab, setGeInnerTab] = useState<"schedule" | "feed">("schedule");
  const [scheduleSubTab, setScheduleSubTab] = useState<"day" | "week" | "month" | "list">("day");
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [expandedTimelineId, setExpandedTimelineId] = useState<string | null>(null);
  const [dayViewDateMs, setDayViewDateMs] = useState<number | null>(null);
  const [detailAgentId, setDetailAgentId] = useState<string | null>(null);
  const [expandedDecisionId, setExpandedDecisionId] = useState<string | null>(null);
  const [resolvedDecisionIds, setResolvedDecisionIds] = useState<Set<string>>(new Set());
  const [resolvingDecisionId, setResolvingDecisionId] = useState<string | null>(null);
  const resolveDecisionMut = useMutation(api.decisions.resolveWithNotify);
  const [feedFilter, setFeedFilter] = useState<"all" | "crons" | "tasks">("all");
  const [cronSubFilter, setCronSubFilter] = useState<"all" | "hb" | "pro" | "mon">("all");
  const [showPastRuns, setShowPastRuns] = useState(false);
  const [errorFilterActive, setErrorFilterActive] = useState(false);
  const [showPastDayRuns, setShowPastDayRuns] = useState(false);
  const [expandedFeedId, setExpandedFeedId] = useState<string | null>(null);
  const [expandedQueuePillId, setExpandedQueuePillId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  // Poll for schedule data — two phase: fast first, then history in background
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const workspaceParam = `workspace=${activeWorkspace}`;
        // Phase 1: fast (~3s) — structure + next run times
        const res = await fetch(`/api/crons?${workspaceParam}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.scheduleData) {
            setScheduleData((prev) => {
              if (!prev) return data.scheduleData;
              return {
                ...data.scheduleData,
                jobs: data.scheduleData.jobs.map((job: ScheduleJob) => {
                  const prevJob = prev.jobs.find((existing) => existing.id === job.id);
                  if ((job.recentRuns?.length ?? 0) > 0 || !(prevJob?.recentRuns?.length)) {
                    return job;
                  }
                  return { ...job, recentRuns: prevJob.recentRuns };
                }),
              };
            });
          }
        }
        // Phase 2: history (~15s) — always load in background
        const res2 = await fetch(`/api/crons?history=1&${workspaceParam}`, { cache: "no-store" });
        if (res2.ok) {
          const data2 = await res2.json();
          if (data2.scheduleData) setScheduleData(data2.scheduleData);
        }
      } catch { /* best effort */ }
    };
    fetchSchedule();
    const interval = setInterval(fetchSchedule, 120000);
    return () => clearInterval(interval);
  }, [activeWorkspace]);

  const pendingDecisions = useMemo(
    () => (decisions ?? []).filter((d) => d.status === "pending"),
    [decisions],
  );
  const needsJayCount = useMemo(
    () => agents.filter((a) => a.status === "blocked").length + pendingDecisions.length,
    [agents, pendingDecisions],
  );

  const filteredAgents = useMemo(() => {
    let list = agents.filter((a) => visibleAgentNames.includes(a.name));
    if (agentFilter !== "all") list = list.filter((a) => a.name === agentFilter);
    if (needsJayOnly) list = list.filter((a) => a.status === "blocked" || pendingDecisions.some((d) => d.agentId === a._id));
    return list;
  }, [agents, visibleAgentNames, agentFilter, needsJayOnly, pendingDecisions]);

  // Schedule items
  const scheduleItems = useMemo(() => {
    if (!scheduleData) return { past: [] as ScheduleItem[], running: [] as ScheduleItem[], upcoming: [] as ScheduleItem[] };
    let all = buildScheduleItems(scheduleData);
    if (agentFilter !== "all") {
      all = all.filter((item) => item.agentLabel === agentFilter);
    }
    const past = all.filter((i) => i.type === "past").sort((a, b) => b.timeMs - a.timeMs);
    const running = all.filter((i) => i.type === "running").sort((a, b) => a.timeMs - b.timeMs);
    const upcoming = all.filter((i) => i.type === "upcoming").sort((a, b) => a.timeMs - b.timeMs);
    return { past, running, upcoming };
  }, [scheduleData, agentFilter]);

  // Schedule stats
  const scheduleStats = useMemo(() => {
    if (!scheduleData) return null;
    const istDayStart = getIstDayStartUtc(Date.now());
    const allRuns = scheduleData.jobs.flatMap((j) => j.recentRuns);
    const todayRuns = allRuns.filter((r) => r.runAtMs >= istDayStart);
    const okCount = todayRuns.filter((r) => r.status === "ok").length;
    const errCount = todayRuns.filter((r) => r.status !== "ok").length;
    const successRate = todayRuns.length > 0 ? Math.round((okCount / todayRuns.length) * 100) : 100;
    const runningCount = scheduleData.jobs.filter((j) => j.isRunning).length;
    return { totalToday: todayRuns.length, successRate, errCount, runningCount };
  }, [scheduleData]);

  const nowMs = now.getTime();

  // Day timeline
  const isDayViewToday = dayViewDateMs == null;
  const dayTimeline = useMemo(() => {
    if (!scheduleData) return [];
    return buildDayTimeline(scheduleData, nowMs, agentFilter, dayViewDateMs ?? undefined);
  }, [scheduleData, nowMs, agentFilter, dayViewDateMs]);

  // Week view
  const weekView = useMemo(() => {
    if (!scheduleData) return [];
    return buildWeekView(scheduleData, nowMs, agentFilter, weekOffset);
  }, [scheduleData, nowMs, agentFilter, weekOffset]);

  // Enhanced stats — use recentRuns if available, else estimate from job state data
  const enhancedStats = useMemo(() => {
    if (!scheduleData) return null;
    const istDayStart = getIstDayStartUtc(nowMs);
    const allRuns = scheduleData.jobs.flatMap((j) => j.recentRuns);
    const hasHistory = allRuns.length > 0;

    if (hasHistory) {
      // Full stats from run history
      const todayRuns = allRuns.filter((r) => r.runAtMs >= istDayStart);
      const okCount = todayRuns.filter((r) => r.status === "ok").length;
      const errCount = todayRuns.filter((r) => r.status !== "ok").length;
      const successRate = todayRuns.length > 0 ? Math.round((okCount / todayRuns.length) * 100) : 100;
      const runningCount = scheduleData.jobs.filter((j) => j.isRunning).length;
      const durations = todayRuns.filter((r) => r.durationMs > 0).map((r) => r.durationMs);
      const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
      return { totalToday: todayRuns.length, successRate, errCount, runningCount, avgDuration, okCount };
    } else {
      // Estimate from job state (available without history fetch)
      const todayJobs = scheduleData.jobs.filter((j) => j.lastRunAtMs && j.lastRunAtMs >= istDayStart);
      const okCount = todayJobs.filter((j) => j.lastRunStatus === "ok").length;
      const errCount = todayJobs.filter((j) => j.lastRunStatus && j.lastRunStatus !== "ok").length;
      const runningCount = scheduleData.jobs.filter((j) => j.isRunning).length;
      const durations = todayJobs.filter((j) => j.lastDurationMs && j.lastDurationMs > 0).map((j) => j.lastDurationMs!);
      const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
      const totalObserved = okCount + errCount;
      const successRate = totalObserved > 0 ? Math.round((okCount / totalObserved) * 100) : 0;
      return { totalToday: totalObserved, successRate, errCount, runningCount, avgDuration, okCount };
    }
  }, [scheduleData, nowMs]);

  // Current IST hour for timeline highlight
  const currentIstHour = useMemo(() => {
    const ist = toIstDate(nowMs);
    return ist.getUTCHours();
  }, [nowMs]);

  const currentIstMinuteFraction = useMemo(() => {
    const ist = toIstDate(nowMs);
    return ist.getUTCMinutes() / 60;
  }, [nowMs]);

  // Calendar data
  const calendarEvents = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let acts = (activities ?? []).filter((a) => a.createdAt > sevenDaysAgo);
    if (agentFilter !== "all") {
      const ag = agents.find((a) => a.name === agentFilter);
      if (ag) acts = acts.filter((a) => a.agentId === ag._id);
    }
    return acts.map((a) => ({
      ...a,
      eventType: classifyActivity(a.action, a.targetType),
      day: new Date(a.createdAt),
    }));
  }, [activities, agentFilter, agents]);

  const weekStart = useMemo(() => {
    const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d;
  }, [now]);
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) { const d = new Date(weekStart); d.setDate(d.getDate() + i); days.push(d); }
    return days;
  }, [weekStart]);
  const monthDays = useMemo(() => {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDay = first.getDay();
    const days: Date[] = [];
    for (let i = -startDay; i < 35 - startDay; i++) { const d = new Date(first); d.setDate(d.getDate() + i); days.push(d); }
    return days;
  }, [now]);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const eventsForDay = (day: Date) => calendarEvents.filter((e) => isSameDay(e.day, day));

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-warm-100">
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="rounded-lg border border-warm-200 bg-white px-2 py-1 text-xs text-warm-700"
        >
          <option value="all">All agents</option>
          {visibleAgentNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setNeedsJayOnly(!needsJayOnly)}
          className={`rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] transition ${
            needsJayOnly
              ? "bg-indigo-600 text-white border-indigo-600"
              : "bg-white text-warm-600 border-warm-200 hover:border-indigo-500 hover:text-indigo-600"
          }`}
        >
          Needs Jay{needsJayCount > 0 ? ` (${needsJayCount})` : ""}
        </button>
        <div className="ml-auto flex items-center gap-1">
          {(["schedule", "feed"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setGeInnerTab(tab)}
              className={`rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] transition ${
                geInnerTab === tab
                  ? "bg-[#D97706] text-white border-[#D97706]"
                  : "bg-white text-warm-600 border-warm-200 hover:border-[#D97706] hover:text-[#D97706]"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* LIVE OPS */}
      <div className="border-b border-warm-100 px-4 py-3">
        <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500 mb-2">Live Ops</h3>
        <div className="grid grid-cols-3 gap-3">
          {/* Column 1: ACTIVE NOW */}
          <div className="rounded-lg border border-warm-200 bg-white p-3">
            <h4 className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-green-700 mb-2">Active Now</h4>
            {(() => {
              const fiveMinAgo = nowMs - 5 * 60 * 1000;
              const tenSecAgo = nowMs - 10 * 1000;
              const activeAgents = agents.filter((agent) => {
                const agentIdStr = agent._id.toString();
                const live = liveStatuses?.find((s) => s.agentId.toString() === agentIdStr);
                if (!live) return false;
                // Running: show only if updated within last 5 min (HB crons finish in <30s, proactive in <5min)
                const activelyRunning = live.status === "running" && live.updatedAt > fiveMinAgo;
                // Just went idle: 10s grace period so cron doesn't flash off too early
                const justWentIdle = live.status === "idle" && live.updatedAt > tenSecAgo;
                return activelyRunning || justWentIdle;
              });
              if (activeAgents.length === 0) {
                return <p className="text-[0.65rem] text-warm-400 italic">All agents idle</p>;
              }
              return activeAgents.map((agent) => {
                const live = liveStatuses?.find((s) => s.agentId === agent._id);
                const agentTask = live?.currentTaskId ? tasks.find((t) => t._id.toString() === live.currentTaskId) : null;
                const latestProgress = agentTask?.progress?.length ? agentTask.progress[agentTask.progress.length - 1] : null;
                return (
                  <div key={agent._id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-warm-50 rounded px-1 -mx-1 transition-colors" onClick={() => onSelectAgent(agent._id)}>
                    <AgentAvatar name={agent.name} size={20} />
                    <div className="min-w-0 flex-1">
                      <span className="text-[0.65rem] font-semibold text-warm-900">{agent.name}</span>
                      {latestProgress ? (
                        <p className="text-[0.55rem] text-warm-600 truncate">{latestProgress.text}</p>
                      ) : live?.currentTaskTitle ? (
                        <p className="text-[0.55rem] text-warm-600 truncate">{live.currentTaskTitle}</p>
                      ) : null}
                    </div>
                    {live?.startedAt && (
                      <span className="text-[0.55rem] text-green-600 font-mono shrink-0">{formatRelativeTime(live.startedAt, nowMs)}</span>
                    )}
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                  </div>
                );
              });
            })()}
          </div>

          {/* Column 2: QUEUE — per-agent rows */}
          <div className="rounded-lg border border-warm-200 bg-white p-3">
            {(() => {
              const queueTasks = tasks.filter((t) => t.status === "in_progress" || t.status === "assigned");
              const totalCount = queueTasks.length;
              // Group tasks by agent
              const agentQueues: { agent: GodsEyeAgent; working: GodsEyeTask[]; next: GodsEyeTask[] }[] = [];
              for (const agent of agents) {
                const working = queueTasks.filter((t) => t.status === "in_progress" && t.assigneeIds.includes(agent._id));
                const next = queueTasks.filter((t) => t.status === "assigned" && t.assigneeIds.includes(agent._id));
                if (working.length > 0 || next.length > 0) {
                  agentQueues.push({ agent, working, next });
                }
              }
              return (
                <>
                  <h4 className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-indigo-700 mb-2">
                    Queue {totalCount > 0 && <span className="text-indigo-500">({totalCount})</span>}
                  </h4>
                  {/* Pending decisions */}
                  {pendingDecisions.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[0.6rem] font-semibold text-warm-700">{pendingDecisions.length} Decision{pendingDecisions.length > 1 ? "s" : ""} Pending</p>
                      {pendingDecisions.slice(0, 3).map((d) => (
                        <p key={d._id} className="text-[0.55rem] text-warm-500 truncate pl-2">• {d.title}</p>
                      ))}
                    </div>
                  )}
                  {/* Per-agent queue rows */}
                  {agentQueues.length > 0 ? (
                    <div className="space-y-1.5">
                      {agentQueues.map(({ agent, working, next }) => {
                        const allTasks = [...working, ...next];
                        const totalAgentTasks = allTasks.length;
                        const shown = allTasks.slice(0, 3);
                        const overflow = totalAgentTasks - 3;
                        return (
                          <div key={agent._id} className="flex items-center gap-1.5 min-w-0">
                            <AgentAvatar name={agent.name} size={16} />
                            <span className="text-[0.55rem] font-semibold text-warm-700 shrink-0 w-[3.5rem] truncate">{agent.name}</span>
                            <div className="flex items-center gap-1 min-w-0 flex-wrap">
                              {shown.map((t, i) => {
                                const live = liveStatuses?.find((s) => s.agentId.toString() === agent._id.toString());
                                // WORKING only if: in_progress AND matches agent's current heartbeat task (or heartbeat updated <3min ago and this is their only in_progress task)
                                const thirtyMinAgo2 = nowMs - 30 * 60 * 1000;
                                const agentIsActive = live && live.status === "running" && live.updatedAt > thirtyMinAgo2;
                                const isWorking = t.status === "in_progress" && agentIsActive && (
                                  !live?.currentTaskTitle || t.title.toLowerCase().includes((live.currentTaskTitle ?? "").toLowerCase().slice(0, 15))
                                );
                                const isExpandedPill = expandedQueuePillId === t._id;
                                const label = t.title;
                                return (
                                  <button
                                    key={t._id}
                                    onClick={() => {
                                      onSelectTask(t._id);
                                      setExpandedQueuePillId(isExpandedPill ? null : t._id);
                                    }}
                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[0.5rem] font-medium cursor-pointer transition-opacity hover:opacity-80 ${
                                      isExpandedPill ? "max-w-none" : "max-w-[11rem]"
                                    } ${
                                      isWorking
                                        ? "bg-green-100 text-green-800 border border-green-300"
                                        : "bg-warm-100 text-warm-600 border border-warm-200"
                                    }`}
                                  >
                                    <span className={`font-bold shrink-0 ${isWorking ? "text-green-600" : "text-warm-400"}`}>
                                      {isWorking ? "WORKING:" : "NEXT:"}
                                    </span>
                                    <span className={isExpandedPill ? "whitespace-normal" : "truncate"}>{label}</span>
                                  </button>
                                );
                              })}
                              {overflow > 0 && (
                                <span className="text-[0.5rem] text-warm-400 font-medium shrink-0">+{overflow} more</span>
                              )}
                            </div>
                            <span className="ml-auto text-[0.5rem] text-warm-400 shrink-0">({totalAgentTasks})</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : pendingDecisions.length === 0 ? (
                    <p className="text-[0.65rem] text-warm-400 italic">Queue clear</p>
                  ) : null}
                  {/* Next cron runs */}
                  {(() => {
                    const upcoming: { agent: string; label: string; ms: number; cronName: string }[] = [];
                    // Prefer nextRunAtMs from scheduleData (accurate gateway data) over client-side computation
                    const scheduleNextMap: Record<string, number> = {};
                    if (scheduleData) {
                      for (const job of scheduleData.jobs) {
                        if (job.nextRunAtMs) scheduleNextMap[job.name] = job.nextRunAtMs;
                      }
                    }
                    for (const [agentName, cronNames] of Object.entries(AGENT_CRONS).filter(([n]) => visibleAgentNames.includes(n))) {
                      for (const c of cronNames) {
                        // Only use scheduleNextMap if the timestamp is actually in the future
                        const rawNext = scheduleNextMap[c];
                        const nextFire = (rawNext && rawNext > nowMs) ? rawNext : getNextFire(c);
                        if (nextFire) {
                          const label = c.includes("dp-citadel") ? "Heartbeat" : c.replace(/-/g, " ");
                          upcoming.push({ agent: agentName, label, ms: nextFire, cronName: c });
                        }
                      }
                    }
                    upcoming.sort((a, b) => a.ms - b.ms);
                    // Dedup by cron name — same cron never appears twice, but different crons for same agent both show
                    const seenCrons = new Set<string>();
                    const deduped = upcoming.filter(u => {
                      if (seenCrons.has(u.cronName)) return false;
                      seenCrons.add(u.cronName);
                      return true;
                    });
                    const next3 = deduped.slice(0, 3);
                    if (next3.length === 0) return null;
                    return (
                      <div className="mt-2">
                        <p className="text-[0.6rem] font-semibold text-warm-700 mb-0.5">Next Crons</p>
                        {next3.map((c, i) => (
                          <div key={i} className="flex items-center gap-1.5 py-0.5">
                            <AgentAvatar name={c.agent} size={14} />
                            <span className="text-[0.55rem] text-warm-600 truncate">{c.agent} · {c.label}</span>
                            <span className="ml-auto text-[0.55rem] font-mono text-warm-400 shrink-0">{formatCountdown(c.ms - nowMs)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </div>

          {/* Column 3: RECENT (last 2 hours) */}
          <div className="rounded-lg border border-warm-200 bg-white p-3">
            <h4 className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-amber-700 mb-2">Recent <span className="font-normal text-warm-400">(2h)</span></h4>
            {(() => {
              const twoHoursAgo = nowMs - 2 * 60 * 60 * 1000;
              const recentActs = (activities ?? [])
                .filter((a) => a.createdAt > twoHoursAgo && !(a.action === "status" && a.targetType === "agent"))
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, 5);
              if (recentActs.length === 0) {
                return <p className="text-[0.65rem] text-warm-400 italic">No recent activity</p>;
              }
              const getSource = (a: GodsEyeActivity) => {
                if (a.targetType === "decision") return "Decision";
                if (a.targetType === "comment" || a.action === "commented") return "Comment";
                if (a.action.includes("cron") || a.action.includes("heartbeat")) return "Cron";
                if (a.action.includes("telegram") || a.action.includes("message")) return "Telegram";
                if (a.action.includes("mention")) return "@mention";
                return "Task";
              };
              const getResult = (a: GodsEyeActivity) => {
                if (a.action === "completed" || a.action === "moved_to_done") return "completed";
                if (a.action === "deployed" || a.description.toLowerCase().includes("deploy")) return "deployed";
                if (a.action === "commented" || a.action === "posted_comment") return "commented";
                if (a.action.includes("sent") || a.description.toLowerCase().includes("sent")) return "sent";
                if (a.action === "resolved") return "resolved";
                return a.action;
              };
              const sourceColors: Record<string, string> = {
                Decision: "bg-indigo-100 text-indigo-700 border-indigo-200",
                Comment: "bg-amber-100 text-amber-700 border-amber-200",
                Cron: "bg-blue-100 text-blue-700 border-blue-200",
                Telegram: "bg-sky-100 text-sky-700 border-sky-200",
                "@mention": "bg-purple-100 text-purple-700 border-purple-200",
                Task: "bg-warm-100 text-warm-700 border-warm-200",
              };
              return recentActs.map((act) => {
                const source = getSource(act);
                const result = getResult(act);
                return (
                  <div key={act._id} className="flex items-start gap-1.5 py-1 border-b border-warm-50 last:border-0">
                    <AgentAvatar name={act.agent?.name ?? "System"} size={16} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className={`rounded px-1 py-0 text-[0.45rem] font-semibold border shrink-0 ${sourceColors[source] ?? sourceColors.Task}`}>{source}</span>
                        <span className="text-[0.55rem] font-medium text-warm-700 truncate">{act.agent?.name ?? "System"}</span>
                      </div>
                      <p className="text-[0.55rem] text-warm-600 truncate">{act.description.slice(0, 60)}{act.description.length > 60 ? "…" : ""}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[0.5rem] text-warm-400">{formatRelativeTime(act.createdAt, nowMs)}</span>
                        <span className="text-[0.5rem] font-medium text-green-600">{result}</span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredAgents.map((agent) => {
          const agentDecisions = pendingDecisions.filter((d) => d.agentId === agent._id);
          const lastActivity = (activities ?? []).find((a) => a.agentId === agent._id);
          const crons = AGENT_CRONS[agent.name] ?? [];
          const cronCountdowns = crons
            .map((c) => {
              const nextFire = getNextFire(c);
              if (!nextFire) return null;
              const label = c.includes("dp-citadel") ? "Heartbeat" : c.replace(/-/g, " ");
              return { label, ms: nextFire - now.getTime() };
            })
            .filter(Boolean) as { label: string; ms: number }[];

          return (
            <div
              key={agent._id}
              role="button"
              tabIndex={0}
              onClick={() => setDetailAgentId(agent._id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setDetailAgentId(agent._id); }}
              className="rounded-lg border border-warm-200 bg-white p-3 shadow-sm transition hover:shadow-md cursor-pointer hover:border-amber-300"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <AgentAvatar name={agent.name} size={32} />
                  <div>
                    <span className="text-sm font-semibold text-warm-900">{agent.name}</span>
                    <p className="text-[0.65rem] text-warm-500">{agent.role}</p>
                  </div>
                </div>
                {(() => {
                  const live = liveStatuses?.find((s) => s.agentId.toString() === agent._id.toString());
                  const isRunning = live?.status === "running" && live.updatedAt > (nowMs - 5 * 60 * 1000);
                  return (
                    <div className="flex items-center gap-1.5">
                      {isRunning ? (
                        <>
                          <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-[0.6rem] font-semibold text-green-700 animate-pulse">Running</span>
                        </>
                      ) : (
                        <>
                          <span className={`inline-block h-2 w-2 rounded-full ${GE_STATUS_COLORS[agent.status] ?? "bg-gray-400"}`} />
                          <span className="text-[0.6rem] font-medium text-warm-500">
                            {GE_STATUS_LABELS[agent.status] ?? agent.status}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
              {agent.currentTask && (
                <p className="mt-2 truncate text-xs text-warm-700">
                  <span className="font-medium text-warm-500">Task:</span> {agent.currentTask}
                </p>
              )}
              {(() => {
                const live = liveStatuses?.find((s) => s.agentId.toString() === agent._id.toString());
                if (!live) return null;
                const isRunning = live.status === "running" && live.updatedAt > (nowMs - 5 * 60 * 1000);
                const justFinished = live.status === "idle" && live.finishedAt && (Date.now() - live.finishedAt) < 5 * 60 * 1000;
                if (isRunning) {
                  return (
                    <p className="mt-1 text-[0.65rem] font-semibold text-green-700 animate-pulse">
                      {"🔄 Working"}
                      {live.currentTaskTitle ? `: ${live.currentTaskTitle.slice(0, 40)}${live.currentTaskTitle.length > 40 ? "..." : ""}` : ""}
                      {live.startedAt ? ` · ${formatRelativeTime(live.startedAt, nowMs)}` : ""}
                    </p>
                  );
                }
                if (justFinished && live.finishedAt) {
                  return (
                    <p className="mt-1 text-[0.65rem] text-green-600">
                      {"✅ Done "}
                      {formatRelativeTime(live.finishedAt, nowMs)}
                      {live.currentTaskTitle ? `: ${live.currentTaskTitle.slice(0, 35)}${live.currentTaskTitle.length > 35 ? "..." : ""}` : ""}
                    </p>
                  );
                }
                return null;
              })()}
              {lastActivity && (
                <p className="mt-1 truncate text-[0.65rem] text-warm-500">
                  <span className="font-medium">Last:</span> {lastActivity.description} &middot; {timeAgo(lastActivity.createdAt)}
                </p>
              )}
              {cronCountdowns.length > 0 && (
                <p className="mt-1 text-[0.65rem] text-warm-500">
                  <span className="font-medium">Crons:</span>{" "}
                  {cronCountdowns.map((c, i) => (
                    <span key={c.label}>
                      {i > 0 && " | "}
                      {c.label} in {formatCountdown(c.ms)}
                    </span>
                  ))}
                </p>
              )}
              {agentDecisions.length > 0 && (
                <div className="mt-2">
                  <span className="inline-flex items-center rounded-full bg-indigo-100 border border-indigo-300 px-2 py-0.5 text-[0.6rem] font-semibold text-indigo-700">
                    {agentDecisions.length} Decision{agentDecisions.length > 1 ? "s" : ""} Pending
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Schedule Tab */}
      {geInnerTab === "schedule" && (
        <div className="border-t border-warm-100 px-4 py-3">
          {/* Schedule header: title, calendar view picker */}
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
              Schedule
            </h3>
            <div className="ml-auto flex items-center gap-1">
              {(["day", "week", "month"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setScheduleSubTab(tab)}
                  className={`rounded-full border px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.15em] transition ${
                    scheduleSubTab === tab
                      ? "bg-[#D97706] text-white border-[#D97706]"
                      : "bg-white text-warm-600 border-warm-200 hover:border-[#D97706] hover:text-[#D97706]"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Summary Stats Panel */}
          {enhancedStats && (
            <div className="mb-3 grid grid-cols-4 gap-2">
              <div className="rounded-lg border border-warm-200 bg-warm-50 px-3 py-2 text-center">
                <div className="text-lg font-bold text-warm-800">{enhancedStats.totalToday}</div>
                <div className="text-[0.55rem] uppercase tracking-wider text-warm-500">Runs Today</div>
              </div>
              <div className="rounded-lg border border-warm-200 bg-warm-50 px-3 py-2 text-center">
                <div className={`text-lg font-bold ${enhancedStats.successRate >= 90 ? "text-green-700" : enhancedStats.successRate >= 70 ? "text-amber-700" : "text-red-700"}`}>
                  {enhancedStats.successRate}%
                </div>
                <div className="text-[0.55rem] uppercase tracking-wider text-warm-500">Success Rate</div>
              </div>
              <div className="rounded-lg border border-warm-200 bg-warm-50 px-3 py-2 text-center">
                <div className="text-lg font-bold text-warm-800">
                  {enhancedStats.avgDuration > 0 ? formatDuration(enhancedStats.avgDuration) : "—"}
                </div>
                <div className="text-[0.55rem] uppercase tracking-wider text-warm-500">Avg Duration</div>
              </div>
              <div
                className={`rounded-lg border px-3 py-2 text-center ${enhancedStats.errCount > 0 ? "border-red-300 bg-red-50 cursor-pointer hover:bg-red-100 transition-colors" : "border-warm-200 bg-warm-50"}`}
                onClick={() => { if (enhancedStats.errCount > 0) { setScheduleSubTab("list"); setErrorFilterActive(true); setShowPastRuns(true); } }}
                title={enhancedStats.errCount > 0 ? "Click to see error runs" : undefined}
              >
                <div className={`text-lg font-bold ${enhancedStats.errCount > 0 ? "text-red-700" : "text-warm-800"}`}>
                  {enhancedStats.errCount}
                </div>
                <div className={`text-[0.55rem] uppercase tracking-wider ${enhancedStats.errCount > 0 ? "text-red-500" : "text-warm-500"}`}>Errors</div>
              </div>
            </div>
          )}

          {!scheduleData && (
            <p className="py-6 text-center text-xs text-warm-400">Loading schedule...</p>
          )}

          {/* DAY View — Vertical 24hr Timeline */}
          {scheduleData && scheduleSubTab === "day" && (() => {
            // Split day timeline slots into past vs current+future
            const pastSlots = isDayViewToday
              ? dayTimeline.filter((s) => s.hourIst < currentIstHour && s.items.length > 0)
              : dayTimeline.filter((s) => s.items.length > 0);
            const presentFutureSlots = isDayViewToday
              ? dayTimeline.filter((s) => s.hourIst >= currentIstHour)
              : [];
            const pastRunCount = pastSlots.reduce((acc, s) => acc + s.items.length, 0);

            const renderSlot = (slot: TimelineSlot) => {
              const isPastHour = isDayViewToday ? slot.hourIst < currentIstHour : true;
              const isCurrentHour = isDayViewToday && slot.hourIst === currentIstHour;
              const hourLabel = `${String(slot.hourIst).padStart(2, "0")}:00`;

              // Group concurrent items (same minute)
              const groups: TimelineItem[][] = [];
              let currentGroup: TimelineItem[] = [];
              let lastMinute = -1;
              for (const item of slot.items) {
                const ist = toIstDate(item.fireTimeMs);
                const minute = ist.getUTCMinutes();
                if (currentGroup.length > 0 && Math.abs(minute - lastMinute) <= 2) {
                  currentGroup.push(item);
                } else {
                  if (currentGroup.length > 0) groups.push(currentGroup);
                  currentGroup = [item];
                  lastMinute = minute;
                }
              }
              if (currentGroup.length > 0) groups.push(currentGroup);

              return (
                <div key={slot.hourIst} className="relative flex min-h-[2rem]">
                  {/* Hour label */}
                  <div className={`w-12 shrink-0 text-right pr-3 text-[0.6rem] font-mono ${isCurrentHour ? "text-orange-600 font-bold" : isPastHour ? "text-warm-400" : "text-warm-500"}`}>
                    {hourLabel}
                  </div>
                  {/* Timeline line */}
                  <div className="relative w-4 shrink-0 flex flex-col items-center">
                    <div className={`w-px flex-1 ${isCurrentHour ? "bg-orange-400" : isPastHour ? "bg-warm-200" : "bg-warm-300"}`} />
                    {isCurrentHour && (
                      <div
                        className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-orange-500 border-2 border-white shadow-sm z-10"
                        style={{ top: `${currentIstMinuteFraction * 100}%` }}
                        title={`NOW ${formatUtcTime(nowMs)} IST`}
                      />
                    )}
                  </div>
                  {/* Items area */}
                  <div className="flex-1 py-0.5 pl-2">
                    {groups.map((group, gi) => (
                      <div key={gi} className={`flex flex-wrap gap-1 ${gi > 0 ? "mt-1" : ""}`}>
                        {group.map((item) => {
                          const colors = AGENT_TIMELINE_COLORS[item.agentLabel] ?? DEFAULT_AGENT_COLOR;
                          const isExpanded = expandedTimelineId === item.id;
                          const isRunning = item.type === "running";
                          const isError = item.type === "error";
                          const isUpcoming = item.type === "upcoming";

                          return (
                            <div key={item.id} className="flex flex-col">
                              <button
                                type="button"
                                onClick={() => setExpandedTimelineId(isExpanded ? null : item.id)}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.55rem] font-medium transition hover:shadow-sm ${
                                  isRunning
                                    ? "bg-green-50 border-green-300 text-green-800 animate-pulse"
                                    : isError
                                    ? "bg-red-50 border-red-300 text-red-800"
                                    : isUpcoming
                                    ? "bg-white border-warm-200 text-warm-400"
                                    : `${colors.bg} ${colors.border} ${colors.text}`
                                }`}
                                title={`${item.agentLabel} — ${item.cronName} @ ${formatUtcTime(item.fireTimeMs)}`}
                              >
                                <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                                  isRunning ? "bg-green-500 animate-pulse" : isError ? "bg-red-500" : isUpcoming ? "bg-warm-300" : colors.dot
                                }`} />
                                <span>{item.agentLabel} <span className="opacity-40 text-[0.45rem] font-normal">{normalizeCronName(item.cronName)}</span></span>
                                <span className="font-mono">{formatUtcTime(item.fireTimeMs)}</span>
                                {isRunning && <span>⟳</span>}
                                {isError && <span>✗</span>}
                                {!isRunning && !isError && !isUpcoming && <span>✓</span>}
                                {isUpcoming && <span className="text-warm-400">{formatRelativeTime(item.fireTimeMs, nowMs)}</span>}
                                {item.durationMs != null && item.durationMs > 0 && (
                                  <span className="opacity-60">{formatDuration(item.durationMs)}</span>
                                )}
                                {(() => {
                                  const badge = getCronTypeBadge(item.cronName);
                                  if (!badge) return null;
                                  return <span className={`rounded px-1 py-0 text-[0.45rem] font-semibold border ${badge.className}`}>{badge.label}</span>;
                                })()}
                              </button>
                              {isExpanded && ((item.transcriptEntries && item.transcriptEntries.length > 0) || item.summary || (item.durationMs != null && item.durationMs > 0)) && (
                                <div className="mt-1 ml-2 mb-1 rounded-lg border border-warm-200 bg-warm-50 p-2 text-[0.6rem] max-w-md">
                                  {renderCronTranscript(item.transcriptEntries)}
                                  {!item.transcriptEntries?.length && item.summary && <pre className="whitespace-pre-wrap text-warm-700 leading-relaxed">{item.summary}</pre>}
                                  <div className="mt-1 flex flex-wrap gap-2 text-warm-500">
                                    {item.durationMs != null && item.durationMs > 0 && <span>Duration: {formatDuration(item.durationMs)}</span>}
                                    {item.inputTokens != null && item.inputTokens > 0 && <span>In: {item.inputTokens.toLocaleString()}</span>}
                                    {item.outputTokens != null && item.outputTokens > 0 && <span>Out: {item.outputTokens.toLocaleString()}</span>}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {group.length > 1 && (
                          <span className="self-center text-[0.5rem] text-warm-400 font-medium">
                            {group.length} concurrent
                          </span>
                        )}
                      </div>
                    ))}
                    {/* NOW marker text for current hour */}
                    {isCurrentHour && (
                      <div className="mt-0.5 text-[0.55rem] font-semibold text-orange-500">
                        NOW {formatUtcTime(nowMs)} IST
                      </div>
                    )}
                  </div>
                </div>
              );
            };

            return (
              <div className="flex flex-col">
                <div className="mb-2 flex items-center gap-2 text-[0.6rem] text-warm-500 font-medium">
                  <span>
                    {(() => { const ist = toIstDate(dayViewDateMs ?? nowMs); return `${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][ist.getUTCDay()]}, ${ist.getUTCDate()}/${ist.getUTCMonth()+1} IST`; })()}
                  </span>
                  {!isDayViewToday && (
                    <button
                      type="button"
                      onClick={() => setDayViewDateMs(null)}
                      className="rounded border border-warm-200 px-1.5 py-0.5 text-[0.55rem] text-warm-500 hover:bg-warm-50"
                    >
                      ← Today
                    </button>
                  )}
                </div>

                {/* NOW line + upcoming/current hours (always visible) */}
                {isDayViewToday && (
                  <div className="flex items-center gap-2 py-1.5 mb-1">
                    <div className="h-px flex-1 bg-orange-400" />
                    <span className="text-[0.6rem] font-semibold text-orange-500 whitespace-nowrap">
                      ⬤ NOW {formatUtcTime(nowMs)} IST
                    </span>
                    <div className="h-px flex-1 bg-orange-400" />
                  </div>
                )}

                <div className="relative flex flex-col">
                  {/* Present + future slots first (visible by default) */}
                  {isDayViewToday
                    ? presentFutureSlots.map((slot) => slot.items.length > 0 || slot.hourIst === currentIstHour ? renderSlot(slot) : null)
                    : pastSlots.map((slot) => renderSlot(slot))
                  }

                  {/* Past runs toggle (only for today) */}
                  {isDayViewToday && pastRunCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowPastDayRuns(!showPastDayRuns)}
                      className="flex items-center gap-2 py-2 my-1 text-[0.6rem] font-medium text-warm-500 hover:text-warm-700 transition"
                    >
                      <div className="h-px flex-1 bg-warm-200" />
                      <span className="whitespace-nowrap">
                        {showPastDayRuns ? "▾ Hide past" : "▸ Show past"} ({pastRunCount} runs)
                      </span>
                      <div className="h-px flex-1 bg-warm-200" />
                    </button>
                  )}

                  {/* Past slots (hidden by default on today) */}
                  {isDayViewToday && showPastDayRuns && pastSlots.map((slot) => renderSlot(slot))}
                </div>
              </div>
            );
          })()}

          {/* WEEK View */}
          {scheduleData && scheduleSubTab === "week" && (
            <div className="grid grid-cols-7 gap-1.5">
              {weekView.map((day) => (
                <div
                  key={day.dateLabel}
                  role="button"
                  tabIndex={0}
                  onClick={() => { setDayViewDateMs(day.isToday ? null : day.dayStartUtcMs); setScheduleSubTab("day"); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setDayViewDateMs(day.isToday ? null : day.dayStartUtcMs); setScheduleSubTab("day"); } }}
                  className={`rounded-lg border p-2 min-h-[100px] cursor-pointer transition hover:shadow-sm hover:border-orange-300 ${
                    day.isToday ? "border-orange-300 bg-orange-50/30" : "border-warm-200 bg-white"
                  }`}
                >
                  <div className={`text-center text-[0.6rem] font-semibold uppercase tracking-wider mb-1 ${
                    day.isToday ? "text-orange-600" : "text-warm-500"
                  }`}>
                    {day.dayOfWeek}
                    <div className="text-[0.55rem] font-normal">{day.dateLabel}</div>
                  </div>
                  {/* Stats bar */}
                  <div className="flex justify-center gap-1 mb-1.5">
                    {day.completed > 0 && (
                      <span className="rounded-full bg-green-100 text-green-800 px-1.5 py-0 text-[0.5rem] font-semibold">
                        ✓{day.completed}
                      </span>
                    )}
                    {day.errors > 0 && (
                      <span className="rounded-full bg-red-100 text-red-800 px-1.5 py-0 text-[0.5rem] font-semibold">
                        ✗{day.errors}
                      </span>
                    )}
                    {day.running > 0 && (
                      <span className="rounded-full bg-green-100 text-green-800 px-1.5 py-0 text-[0.5rem] font-semibold animate-pulse">
                        ⟳{day.running}
                      </span>
                    )}
                    {day.upcoming > 0 && (
                      <span className="rounded-full bg-warm-100 text-warm-500 px-1.5 py-0 text-[0.5rem] font-medium">
                        {day.completed === 0 && day.running === 0 ? `📅${day.upcoming} scheduled` : `⏳${day.upcoming}`}
                      </span>
                    )}
                  </div>
                  {/* Agent dots */}
                  <div className="flex flex-wrap gap-0.5 justify-center">
                    {(() => {
                      // Group by agent
                      const agentCounts = new Map<string, { emoji: string; count: number; hasError: boolean }>();
                      for (const item of day.items) {
                        const existing = agentCounts.get(item.agentLabel);
                        if (existing) {
                          existing.count++;
                          if (item.type === "error") existing.hasError = true;
                        } else {
                          agentCounts.set(item.agentLabel, { emoji: item.agentEmoji, count: 1, hasError: item.type === "error" });
                        }
                      }
                      return Array.from(agentCounts.entries()).map(([label, data]) => {
                        const colors = AGENT_TIMELINE_COLORS[label] ?? DEFAULT_AGENT_COLOR;
                        return (
                          <span
                            key={label}
                            className={`inline-flex items-center gap-0.5 rounded-full border px-1 py-0 text-[0.5rem] ${
                              data.hasError ? "bg-red-50 border-red-200 text-red-700" : `${colors.bg} ${colors.border} ${colors.text}`
                            }`}
                            title={`${label}: ${data.count} runs`}
                          >
                            <span>{label.slice(0,3)}</span>
                            <span>{data.count}</span>
                          </span>
                        );
                      });
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MONTH View — Calendar grid of cron runs */}
          {scheduleData && scheduleSubTab === "month" && (() => {
            // Build month grid using IST-based month days
            const istNow = toIstDate(nowMs);
            const year = istNow.getUTCFullYear();
            const month = istNow.getUTCMonth();
            // First day of month in IST
            const firstOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0) - 5.5 * 3600000);
            const startDow = firstOfMonth.getUTCDay(); // 0=Sun
            // Last day of month
            const lastOfMonth = new Date(Date.UTC(year, month + 1, 0, 18, 30, 0)); // end of last day IST
            const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
            // Build array of day cells (padding + month days)
            const cells: Array<{ date: number | null; dayStartUtcMs: number | null }> = [];
            for (let i = 0; i < startDow; i++) cells.push({ date: null, dayStartUtcMs: null });
            for (let d = 1; d <= daysInMonth; d++) {
              // IST midnight of this date = UTC(year, month, d) - 5.5h
              const dayStartUtcMs = Date.UTC(year, month, d) - 5.5 * 3600000;
              cells.push({ date: d, dayStartUtcMs });
            }
            // Pad to full weeks
            while (cells.length % 7 !== 0) cells.push({ date: null, dayStartUtcMs: null });

            const todayStartUtcMs = getIstDayStartUtc(nowMs);
            const dayNames2 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

            return (
              <div>
                {/* Month label */}
                <div className="mb-2 text-[0.65rem] font-semibold text-warm-600">
                  {new Date(Date.UTC(year, month, 15)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
                </div>
                {/* Day name headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {dayNames2.map((d) => (
                    <div key={d} className="text-center text-[0.55rem] font-semibold uppercase tracking-wider text-warm-400">{d}</div>
                  ))}
                </div>
                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1">
                  {cells.map((cell, ci) => {
                    if (!cell.date || !cell.dayStartUtcMs) {
                      return <div key={`pad-${ci}`} className="min-h-[52px]" />;
                    }
                    const dayEndUtcMs = cell.dayStartUtcMs + 24 * 3600000;
                    const isToday = cell.dayStartUtcMs === todayStartUtcMs;
                    // Collect all cron run items for this day
                    const runItems: { agentLabel: string; type: string; name: string }[] = [];
                    for (const job of scheduleData.jobs) {
                      for (const run of job.recentRuns) {
                        if (run.runAtMs >= cell.dayStartUtcMs && run.runAtMs < dayEndUtcMs) {
                          runItems.push({ agentLabel: job.agentLabel, type: run.status === "error" ? "error" : "done", name: job.name });
                        }
                      }
                    }
                    // Count by type
                    const completed = runItems.filter((r) => r.type === "done").length;
                    const errors = runItems.filter((r) => r.type === "error").length;
                    // Agent summary
                    const agentMap = new Map<string, { hasError: boolean; count: number }>();
                    for (const r of runItems) {
                      const ex = agentMap.get(r.agentLabel);
                      if (ex) { ex.count++; if (r.type === "error") ex.hasError = true; }
                      else agentMap.set(r.agentLabel, { hasError: r.type === "error", count: 1 });
                    }

                    return (
                      <button
                        key={cell.date}
                        type="button"
                        onClick={() => { setDayViewDateMs(isToday ? null : cell.dayStartUtcMs!); setScheduleSubTab("day"); }}
                        className={`min-h-[52px] rounded border p-1 text-left transition hover:shadow-sm hover:border-orange-300 ${
                          isToday ? "border-orange-300 bg-orange-50/30" : "border-warm-100 bg-white"
                        }`}
                      >
                        <div className={`text-[0.55rem] font-semibold mb-0.5 ${isToday ? "text-orange-600" : "text-warm-600"}`}>
                          {cell.date}
                        </div>
                        {runItems.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mb-0.5">
                            {completed > 0 && (
                              <span className="rounded-full bg-green-100 text-green-700 px-1 text-[0.45rem] font-semibold">✓{completed}</span>
                            )}
                            {errors > 0 && (
                              <span className="rounded-full bg-red-100 text-red-700 px-1 text-[0.45rem] font-semibold">✗{errors}</span>
                            )}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-0.5">
                          {Array.from(agentMap.entries()).slice(0, 4).map(([label, data]) => {
                            const colors = AGENT_TIMELINE_COLORS[label] ?? DEFAULT_AGENT_COLOR;
                            return (
                              <span
                                key={label}
                                className={`inline-block h-1.5 w-1.5 rounded-full ${data.hasError ? "bg-red-500" : colors.dot}`}
                                title={`${label}: ${data.count} runs`}
                              />
                            );
                          })}
                          {agentMap.size > 4 && <span className="text-[0.45rem] text-warm-400">+{agentMap.size - 4}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* LIST View */}
          {scheduleData && scheduleSubTab === "list" && (
            <div className="flex flex-col gap-0">
              {/* Error filter banner */}
              {errorFilterActive && (
                <div className="flex items-center justify-between px-2 py-1 mb-1 rounded bg-red-50 border border-red-200">
                  <span className="text-[0.6rem] font-semibold text-red-700">⚠ Showing error runs only</span>
                  <button onClick={() => setErrorFilterActive(false)} className="text-[0.6rem] text-red-500 hover:text-red-700 font-semibold">Clear filter ✕</button>
                </div>
              )}
              {/* NOW line */}
              <div className="flex items-center gap-2 py-2 my-1">
                <div className="h-px flex-1 bg-orange-400" />
                <span className="text-[0.6rem] font-semibold text-orange-500 whitespace-nowrap">
                  ⬤ NOW {formatUtcTime(nowMs)} IST
                </span>
                <div className="h-px flex-1 bg-orange-400" />
              </div>

              {/* Running */}
              {scheduleItems.running.map((item) => (
                <div key={item.id} className="flex items-center gap-2 py-1.5 px-2 rounded bg-green-50 border border-green-200">
                  <span className="w-12 text-[0.65rem] font-mono text-green-700">{formatUtcTime(item.timeMs)}</span>
                  <span className="w-16 text-[0.65rem] font-semibold text-green-800 truncate">{item.agentLabel}</span>
                  <span className="flex-1 text-[0.6rem] font-mono text-green-700 truncate">{item.cronName}</span>
                  {(() => { const b = getCronTypeBadge(item.cronName); return b ? <span className={`rounded px-1 py-0 text-[0.45rem] font-semibold border ${b.className}`}>{b.label}</span> : null; })()}
                  <span className="text-[0.6rem] font-semibold text-green-700 animate-pulse">Running...</span>
                </div>
              ))}

              {/* Upcoming (nearest first) */}
              {scheduleItems.upcoming.map((item) => (
                <div key={item.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-warm-50 text-warm-400">
                  <span className="w-12 text-[0.65rem] font-mono">{formatUtcTime(item.timeMs)}</span>
                  <span className="w-16 text-[0.65rem] font-medium truncate">{item.agentLabel}</span>
                  <span className="flex-1 text-[0.6rem] font-mono truncate">{item.cronName}</span>
                  {(() => { const b = getCronTypeBadge(item.cronName); return b ? <span className={`rounded px-1 py-0 text-[0.45rem] font-semibold border ${b.className}`}>{b.label}</span> : null; })()}
                  <span className="text-[0.6rem]">{formatRelativeTime(item.timeMs, nowMs)}</span>
                </div>
              ))}

              {/* Past runs toggle */}
              {scheduleItems.past.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPastRuns(!showPastRuns)}
                  className="flex items-center gap-2 py-2 my-1 text-[0.6rem] font-medium text-warm-500 hover:text-warm-700 transition"
                >
                  <div className={`h-px flex-1 ${errorFilterActive ? "bg-red-200" : "bg-warm-200"}`} />
                  <span className="whitespace-nowrap">
                    {showPastRuns ? "▾ Hide past" : "▸ Show past"} ({errorFilterActive ? scheduleItems.past.filter(i => i.status === "error").length + " errors" : scheduleItems.past.length + " runs"})
                  </span>
                  <div className={`h-px flex-1 ${errorFilterActive ? "bg-red-200" : "bg-warm-200"}`} />
                </button>
              )}

              {/* Past runs (hidden by default) */}
              {showPastRuns && scheduleItems.past.filter(item => !errorFilterActive || item.status === "error").map((item) => {
                const isExpanded = expandedRunId === item.id;
                const isError = item.status === "error";
                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedRunId(isExpanded ? null : item.id)}
                      className={`flex w-full items-center gap-2 py-1.5 px-2 rounded text-left transition hover:bg-warm-50 ${isError ? "text-red-600" : "text-warm-600"}`}
                    >
                      <span className="text-[0.65rem]">{isError ? "✗" : "✓"}</span>
                      <span className="w-12 text-[0.65rem] font-mono">{formatUtcTime(item.timeMs)}</span>
                      <span className="w-16 text-[0.65rem] font-medium truncate">{item.agentLabel}</span>
                      <span className="flex-1 text-[0.6rem] font-mono truncate opacity-70">{item.cronName}</span>
                      {(() => { const b = getCronTypeBadge(item.cronName); return b ? <span className={`rounded px-1 py-0 text-[0.45rem] font-semibold border ${b.className}`}>{b.label}</span> : null; })()}
                      <span className="text-[0.6rem] opacity-60">{formatRelativeTime(item.timeMs, nowMs)}</span>
                      {item.durationMs != null && (
                        <span className="text-[0.6rem] opacity-60">{formatDuration(item.durationMs)}</span>
                      )}
                      <span className={`rounded-full px-1.5 py-0.5 text-[0.55rem] font-semibold ${
                        isError ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      }`}>
                        {item.status}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="ml-8 mr-2 mb-2 rounded-lg border border-warm-200 bg-warm-50 p-3 text-xs">
                        {renderCronTranscript(item.transcriptEntries)}
                        {!item.transcriptEntries?.length && item.summary && (
                          <pre className="whitespace-pre-wrap text-[0.65rem] text-warm-700 mb-2 leading-relaxed">{item.summary}</pre>
                        )}
                        <div className="flex flex-wrap gap-3 text-[0.6rem] text-warm-500">
                          {item.durationMs != null && <span>Duration: {formatDuration(item.durationMs)}</span>}
                          {item.inputTokens != null && item.inputTokens > 0 && <span>In: {item.inputTokens.toLocaleString()} tok</span>}
                          {item.outputTokens != null && item.outputTokens > 0 && <span>Out: {item.outputTokens.toLocaleString()} tok</span>}
                          {item.totalTokens != null && item.totalTokens > 0 && <span>Total: {item.totalTokens.toLocaleString()} tok</span>}
                          <span className="opacity-50">Job: {item.jobId.slice(0, 8)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {scheduleItems.past.length === 0 && scheduleItems.running.length === 0 && scheduleItems.upcoming.length === 0 && (
                <p className="py-6 text-center text-xs text-warm-400">No schedule data available</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Unified Activity Feed Tab */}
      {geInnerTab === "feed" && (
        <div className="border-t border-warm-100 px-4 py-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">Activity Feed</h3>
            <div className="ml-auto flex items-center gap-1">
              {(["all", "crons", "tasks"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => { setFeedFilter(f); if (f !== "crons") setCronSubFilter("all"); }}
                  className={`rounded-full border px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.15em] transition ${
                    feedFilter === f ? "bg-[#D97706] text-white border-[#D97706]" : "bg-white text-warm-600 border-warm-200 hover:border-[#D97706]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          {/* Cron sub-filters */}
          {feedFilter === "crons" && (
            <div className="mb-3 flex items-center gap-1">
              {(["all", "hb", "pro", "mon"] as const).map((sf) => (
                <button
                  key={sf}
                  type="button"
                  onClick={() => setCronSubFilter(sf)}
                  className={`rounded-full border px-2 py-0.5 text-[0.55rem] font-semibold uppercase transition ${
                    cronSubFilter === sf ? "bg-warm-700 text-white border-warm-700" : "bg-white text-warm-500 border-warm-200 hover:border-warm-400"
                  }`}
                >
                  {sf === "all" ? "All Crons" : sf === "hb" ? "Heartbeat" : sf === "pro" ? "Proactive" : "Monitor"}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-0 max-h-[500px] overflow-y-auto">
            {(() => {
              // Build unified feed items
              type FeedItem = { id: string; type: "cron" | "task"; timeMs: number; label: string; agentLabel: string; detail: string; fullDetail?: string; status?: string; cronBadge?: { label: string; className: string } | null; targetId?: string; cronRunTimeMs?: number; triggerSource?: string };
              const feedItems: FeedItem[] = [];

              // Cron runs from scheduleData
              if (feedFilter === "all" || feedFilter === "crons") {
                if (scheduleData) {
                  for (const job of scheduleData.jobs) {
                    const badge = getCronTypeBadge(job.name);
                    if (feedFilter === "crons" && cronSubFilter !== "all") {
                      if (!badge || badge.label !== cronSubFilter) continue;
                    }
                    for (const run of job.recentRuns) {
                      feedItems.push({
                        id: `cron-${job.id}-${run.ts}`,
                        type: "cron",
                        timeMs: run.runAtMs,
                        label: job.name,
                        agentLabel: job.agentLabel,
                        detail: run.summary ? run.summary.slice(0, 80) : `${run.status} · ${formatDuration(run.durationMs)}`,
                        fullDetail: run.summary || `${run.status} · ${formatDuration(run.durationMs)}`,
                        status: run.status,
                        cronBadge: badge,
                        cronRunTimeMs: run.runAtMs,
                      });
                    }
                    if (job.isRunning && job.runningAtMs) {
                      feedItems.push({
                        id: `cron-${job.id}-running`,
                        type: "cron",
                        timeMs: job.runningAtMs,
                        label: job.name,
                        agentLabel: job.agentLabel,
                        detail: "Running...",
                        status: "running",
                        cronBadge: badge,
                        cronRunTimeMs: job.runningAtMs,
                      });
                    }
                  }
                }
              }

              // Task activities
              if (feedFilter === "all" || feedFilter === "tasks") {
                for (const act of (activities ?? [])) {
                  if (act.action === "status" && act.targetType === "agent") continue;
                  const linkedTask = act.targetId ? tasks.find((t) => t._id.toString() === act.targetId) : null;
                  feedItems.push({
                    id: `act-${act._id}`,
                    type: "task",
                    timeMs: act.createdAt,
                    label: act.action,
                    agentLabel: act.agent?.name ?? "System",
                    detail: act.description.length > 80 ? act.description.slice(0, 80) + "…" : act.description,
                    fullDetail: act.description,
                    targetId: act.targetId,
                    triggerSource: linkedTask?.trigger?.source,
                  });
                }
              }

              feedItems.sort((a, b) => b.timeMs - a.timeMs);
              const limited = feedItems.slice(0, 100);

              if (limited.length === 0) {
                return <p className="py-6 text-center text-xs text-warm-400">No activity</p>;
              }

              return limited.map((item) => {
                const isExpanded = expandedFeedId === item.id;
                const hasFullDetail = item.fullDetail && item.fullDetail.length > 80;
                const isClickable = (item.type === "task" && item.targetId) || item.type === "cron";
                return (
                  <div key={item.id} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => {
                        if (hasFullDetail) {
                          setExpandedFeedId(isExpanded ? null : item.id);
                        } else if (item.type === "task" && item.targetId) {
                          onSelectTask(item.targetId);
                        } else if (item.type === "cron") {
                          setGeInnerTab("schedule");
                          setScheduleSubTab("day");
                          if (item.cronRunTimeMs) {
                            const runDay = getIstDayStartUtc(item.cronRunTimeMs);
                            const today = getIstDayStartUtc(nowMs);
                            setDayViewDateMs(runDay === today ? null : runDay);
                          }
                        }
                      }}
                      className={`flex items-center gap-2 py-1.5 px-2 rounded text-xs transition text-left w-full ${
                        item.status === "running" ? "bg-green-50" : ""
                      } ${isClickable || hasFullDetail ? "hover:bg-warm-50 cursor-pointer" : ""}`}
                    >
                      <span className="w-10 text-[0.6rem] font-mono text-warm-400 shrink-0">{formatUtcTime(item.timeMs)}</span>
                      <AgentAvatar name={item.agentLabel} size={16} />
                      <span className="w-14 text-[0.6rem] font-medium text-warm-700 truncate shrink-0">{item.agentLabel}</span>
                      {item.type === "cron" && item.cronBadge && (
                        <span className={`rounded px-1 py-0 text-[0.45rem] font-semibold border shrink-0 ${item.cronBadge.className}`}>{item.cronBadge.label}</span>
                      )}
                      {item.type === "task" && (
                        <span className="rounded px-1 py-0 text-[0.45rem] font-semibold border bg-amber-50 text-amber-700 border-amber-200 shrink-0">task</span>
                      )}
                      {item.triggerSource && (
                        <span className={`rounded px-1 py-0 text-[0.45rem] font-semibold border shrink-0 ${
                          item.triggerSource === "telegram" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          item.triggerSource === "cron" ? "bg-purple-50 text-purple-700 border-purple-200" :
                          item.triggerSource === "decision" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          item.triggerSource === "comment" ? "bg-green-50 text-green-700 border-green-200" :
                          item.triggerSource === "mention" ? "bg-pink-50 text-pink-700 border-pink-200" :
                          "bg-warm-50 text-warm-600 border-warm-200"
                        }`}>{item.triggerSource}</span>
                      )}
                      <span className={`flex-1 text-[0.6rem] text-warm-600 ${isExpanded ? "" : "truncate"}`}>{isExpanded ? "" : item.detail}</span>
                      <span className="text-[0.55rem] text-warm-400 shrink-0">{formatRelativeTime(item.timeMs, nowMs)}</span>
                      {hasFullDetail && (
                        <span className="text-[0.5rem] text-warm-400 shrink-0">{isExpanded ? "▾" : "▸"}</span>
                      )}
                    </button>
                    {isExpanded && item.fullDetail && (
                      <div className="ml-8 mr-2 mb-1 rounded-lg border border-warm-200 bg-warm-50 p-2">
                        <pre className="whitespace-pre-wrap text-[0.6rem] text-warm-700 leading-relaxed">{item.fullDetail}</pre>
                        {(item.type === "task" && item.targetId) && (
                          <button type="button" onClick={() => onSelectTask(item.targetId!)} className="mt-1 text-[0.55rem] text-amber-700 hover:underline font-medium">Open task →</button>
                        )}
                        {item.type === "cron" && (
                          <button type="button" onClick={() => { setGeInnerTab("schedule"); setScheduleSubTab("day"); if (item.cronRunTimeMs) { const runDay = getIstDayStartUtc(item.cronRunTimeMs); const today = getIstDayStartUtc(nowMs); setDayViewDateMs(runDay === today ? null : runDay); } }} className="mt-1 text-[0.55rem] text-amber-700 hover:underline font-medium">View in schedule →</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Agent Detail Slide-in Panel */}
      {detailAgentId && (() => {
        const agent = agents.find((a) => a._id === detailAgentId);
        if (!agent) return null;
        const agentDecisions = (decisions ?? []).filter((d) => d.agentId === agent._id && d.status === "pending");
        const agentActivities = (activities ?? []).filter((a) => a.agentId === agent._id).slice(0, 5);
        const agentTasks = tasks.filter((t) => t.assigneeIds.includes(agent._id) && t.status === "in_progress");
        const crons = AGENT_CRONS[agent.name] ?? [];
        const live = liveStatuses?.find((s) => s.agentId === agent._id);

        // Cron details from scheduleData
        const agentCronDetails = crons.map((cronName) => {
          const job = scheduleData?.jobs.find((j) => j.name === cronName);
          return {
            name: cronName,
            badge: getCronTypeBadge(cronName),
            nextRunAtMs: job?.nextRunAtMs ?? null,
            lastRunAtMs: job?.lastRunAtMs ?? null,
            lastDurationMs: job?.lastDurationMs ?? null,
            isRunning: job?.isRunning ?? false,
            enabled: job?.enabled ?? true,
          };
        });

        return (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setDetailAgentId(null)}
            />
            {/* Panel */}
            <div className="fixed top-0 right-0 h-full w-[380px] max-w-[90vw] bg-white shadow-2xl z-50 flex flex-col border-l border-warm-200 animate-in slide-in-from-right duration-200">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-warm-100">
                <AgentAvatar name={agent.name} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-warm-900">{agent.name}</span>
                    <span className="text-lg">{agent.avatarEmoji}</span>
                    {live?.status === "running" ? (
                      <span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-[0.55rem] font-semibold animate-pulse">Running</span>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-[0.55rem] font-semibold ${STATUS_BADGE[agent.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {GE_STATUS_LABELS[agent.status] ?? agent.status}
                      </span>
                    )}
                  </div>
                  <p className="text-[0.65rem] text-warm-500">{agent.role}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailAgentId(null)}
                  className="rounded-full p-1 hover:bg-warm-100 text-warm-400 hover:text-warm-700 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
                {/* Current Task */}
                <div>
                  <h4 className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-warm-500 mb-1">Current Task</h4>
                  {live?.status === "running" && live.currentTaskTitle ? (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-2">
                      <p className="text-xs font-medium text-green-800">{live.currentTaskTitle}</p>
                      {live.startedAt && (
                        <p className="text-[0.6rem] text-green-600 mt-0.5">Started {formatRelativeTime(live.startedAt, nowMs)}</p>
                      )}
                    </div>
                  ) : agent.currentTask ? (
                    <p className="text-xs text-warm-700 bg-warm-50 rounded-lg p-2">{agent.currentTask}</p>
                  ) : (
                    <p className="text-xs text-warm-400 italic">No active task</p>
                  )}
                </div>

                {/* Pending Decisions */}
                <div>
                  <h4 className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-warm-500 mb-1">Pending Decisions</h4>
                  {agentDecisions.length === 0 ? (
                    <p className="text-xs text-warm-400 italic">No pending decisions</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {agentDecisions.map((decision) => {
                        const decisionKey = decision._id.toString();
                        const options = decision.options ?? [];
                        const commentValue = decisionCommentDrafts[decisionKey] ?? "";

                        return (
                          <div
                            key={decision._id}
                            className="rounded-lg border border-[#F59E0B] bg-[#FFFBEB] p-3 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-warm-900">
                                  {decision.title}
                                </p>
                                {decision.description && (
                                  <p className="mt-1 text-xs text-warm-700">
                                    {decision.description
                                      .replace(/\*\*(.+?)\*\*/g, "$1")
                                      .replace(/\*(.+?)\*/g, "$1")
                                      .replace(/`(.+?)`/g, "$1")
                                      .slice(0, 200)}
                                  </p>
                                )}
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.65rem] text-warm-500">
                                  <span className="flex items-center gap-1">
                                    {decision.agent ? <AgentAvatar name={decision.agent.name} size={20} /> : <span className="text-base">🧭</span>}
                                    <span>{decision.agent?.name ?? "Unknown"}</span>
                                  </span>
                                  <span>{timeAgo(decision.createdAt)}</span>
                                </div>
                              </div>
                              <span className="rounded-full bg-[#F59E0B] px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white">
                                pending
                              </span>
                            </div>

                            {/* Numbered option cards */}
                            {options.length > 0 && (
                              <div className="mt-3 grid gap-2">
                                {options.map((option: string, index: number) => (
                                  <button
                                    key={`${decision._id}-${option}`}
                                    type="button"
                                    onClick={() => onDecisionResolve(decisionKey, option)}
                                    className="flex items-center gap-2 rounded-lg border border-[#FDE68A] bg-white px-3 py-2 text-left text-xs font-semibold text-warm-800 transition hover:border-[#F59E0B] hover:bg-[#FFF7ED] cursor-pointer"
                                  >
                                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#F59E0B] text-[0.65rem] font-semibold text-white">
                                      {index + 1}
                                    </span>
                                    <span>{option}</span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Not Now + Cancel buttons */}
                            <div className="mt-3 flex items-center gap-2 border-t border-[#FDE68A] pt-3">
                              <button
                                type="button"
                                onClick={() => onDecisionDefer({ id: decision._id })}
                                className="flex-1 rounded-lg border border-warm-300 bg-white px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-warm-600 transition hover:border-warm-400 hover:bg-warm-50"
                              >
                                ⏳ Not Now
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Cancel this decision? "${decision.title}"`)) {
                                    onDecisionCancel({ id: decision._id });
                                  }
                                }}
                                className="flex-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-red-600 transition hover:border-red-300 hover:bg-red-50"
                              >
                                ✕ Cancel
                              </button>
                            </div>

                            {/* Comment / reply field */}
                            <div className="mt-3 flex flex-col gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <input
                                  className="min-w-0 flex-1 rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs"
                                  placeholder="Jay's response / comment…"
                                  value={commentValue}
                                  onChange={(event) =>
                                    onDecisionCommentChange(decisionKey, event.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey && commentValue.trim()) {
                                      e.preventDefault();
                                      onDecisionCommentSubmit(decisionKey);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  disabled={!commentValue.trim()}
                                  onClick={() => onDecisionCommentSubmit(decisionKey)}
                                  className={`flex-shrink-0 rounded-full px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white ${
                                    commentValue.trim()
                                      ? "bg-[#D97706] hover:bg-[#C56A05]"
                                      : "cursor-not-allowed bg-[#D6D3D1]"
                                  }`}
                                >
                                  Reply
                                </button>
                              </div>
                              {(decision.comments ?? []).map((comment, index) => (
                                <div
                                  key={`${decision._id}-comment-${index}`}
                                  className="rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs text-warm-700"
                                >
                                  <div className="flex items-center justify-between text-[0.6rem] text-warm-500">
                                    <span className="font-semibold text-[#D97706]">Jay</span>
                                    <span>{timeAgo(comment.createdAt)}</span>
                                  </div>
                                  <p className="mt-1 text-xs text-warm-700 whitespace-pre-wrap">
                                    {comment.text
                                      .replace(/\*\*(.+?)\*\*/g, "$1")
                                      .replace(/\*(.+?)\*/g, "$1")
                                      .replace(/`(.+?)`/g, "$1")}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Recent Activity */}
                <div>
                  <h4 className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-warm-500 mb-1">Recent Activity</h4>
                  {agentActivities.length === 0 ? (
                    <p className="text-xs text-warm-400 italic">No recent activity</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {agentActivities.map((act) => (
                        <button
                          key={act._id}
                          type="button"
                          onClick={() => { if (act.targetId) { onSelectTask(act.targetId); setDetailAgentId(null); } }}
                          className="flex items-center gap-2 rounded-lg border border-warm-100 bg-warm-50 px-2 py-1.5 text-left text-xs transition hover:border-warm-300 hover:shadow-sm"
                        >
                          <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${
                            act.targetType === "decision" ? "bg-indigo-500" : act.action.includes("complet") ? "bg-green-500" : "bg-amber-400"
                          }`} />
                          <span className="flex-1 truncate text-warm-700">{act.description}</span>
                          <span className="text-[0.55rem] text-warm-400 shrink-0">{timeAgo(act.createdAt)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cron Status */}
                <div>
                  <h4 className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-warm-500 mb-1">Cron Status</h4>
                  {agentCronDetails.length === 0 ? (
                    <p className="text-xs text-warm-400 italic">No crons configured</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {agentCronDetails.map((c) => (
                        <div key={c.name} className="rounded-lg border border-warm-100 bg-warm-50 p-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[0.65rem] font-mono text-warm-700">{c.name}</span>
                            {c.badge && (
                              <span className={`rounded px-1 py-0 text-[0.45rem] font-semibold border ${c.badge.className}`}>{c.badge.label}</span>
                            )}
                            {c.isRunning && <span className="text-[0.55rem] font-semibold text-green-600 animate-pulse">Running</span>}
                            {!c.enabled && <span className="text-[0.55rem] text-warm-400">disabled</span>}
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-3 text-[0.55rem] text-warm-500">
                            {c.nextRunAtMs && (
                              <span>Next: {formatUtcTime(c.nextRunAtMs)} IST ({formatRelativeTime(c.nextRunAtMs, nowMs)})</span>
                            )}
                            {c.lastRunAtMs && (
                              <span>Last: {formatRelativeTime(c.lastRunAtMs, nowMs)}{c.lastDurationMs ? ` · ${formatDuration(c.lastDurationMs)}` : ""}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* In-Progress Tasks */}
                <div>
                  <h4 className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-warm-500 mb-1">In-Progress Tasks</h4>
                  {agentTasks.length === 0 ? (
                    <p className="text-xs text-warm-400 italic">No in-progress tasks</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {agentTasks.map((t) => (
                        <button
                          key={t._id}
                          type="button"
                          onClick={() => { onSelectTask(t._id); setDetailAgentId(null); }}
                          className="flex items-center gap-2 rounded-lg border border-warm-100 bg-warm-50 px-2 py-1.5 text-left text-xs transition hover:border-warm-300 hover:shadow-sm"
                        >
                          <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY_BORDER[t.priority]?.replace("border-l-", "bg-") ?? "bg-gray-400"}`} />
                          <span className="flex-1 truncate text-warm-700">{t.title}</span>
                          <span className={`rounded-full px-1.5 py-0 text-[0.5rem] font-semibold ${PRIORITY_BADGE[t.priority] ?? ""}`}>{t.priority}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

export default function Home() {
  const agents = useQuery(api.agents.list);
  const tasks = useQuery(api.tasks.list);
  const [activeWorkspace, setActiveWorkspace] = useState<"main" | "dashpane">("dashpane");
  const MAIN_AGENTS = ["Buddy", "Katy", "Elon", "Jerry", "Mike", "Burry"];
  const DASHPANE_AGENTS = ["Buddy", "Katy", "Elon", "Ryan", "Harvey", "Rand"];

  // Unified helper: a task belongs to DashPane if it has the workspace field OR the tag
  const isDashpaneTask = (task: { workspace?: string; tags?: string[] }) =>
    task.workspace === "dashpane" || (task.tags?.includes("dashpane-launch") ?? false);
  const [feedTab, setFeedTab] = useState<(typeof FEED_TABS)[number]["key"]>("all");
  const [rightPanel, setRightPanel] = useState<"feed" | "docs" | "status">("feed");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const feedTabTarget = FEED_TABS.find((tab) => tab.key === feedTab)?.target;
  const activities = useQuery(api.activities.list, {
    targetType:
      rightPanel === "status" && !selectedAgentId
        ? undefined
        : feedTabTarget ?? undefined,
  });
  const documents = useQuery(api.documents.list);
  const decisions = useQuery(api.decisions.list);
  const agentLiveStatuses = useQuery(api.agents.getLiveStatus);
  const deferredDecisions = useQuery(api.decisions.listDeferred);
  const notifications = useQuery(api.notifications.listAll);

  const seedAgents = useMutation(api.agents.seed);
  const seedDomainData = useMutation(api.domain.seedDomainData);
  const createTask = useMutation(api.tasks.create);
  const removeTask = useMutation(api.tasks.remove);
  const createMessage = useMutation(api.messages.create);
  const createDocument = useMutation(api.documents.create);
  const updateTaskStatus = useMutation(api.tasks.updateStatus);
  const updateTask = useMutation(api.tasks.update);
  const subscribeAgent = useMutation(api.subscriptions.subscribe);
  const unsubscribeAgent = useMutation(api.subscriptions.unsubscribe);
  const resolveDecision = useMutation(api.decisions.resolveWithNotify);
  const addDecisionComment = useMutation(api.decisions.addComment);
  const deferDecision = useMutation(api.decisions.defer);
  const cancelDecision = useMutation(api.decisions.cancel);
  const reactivateDecision = useMutation(api.decisions.reactivate);
  const markNotificationRead = useMutation(api.notifications.markRead);

  const [now, setNow] = useState(() => new Date());
  const [mounted, setMounted] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState(false);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [tags, setTags] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [messageContent, setMessageContent] = useState("");
  const [messageTaskId, setMessageTaskId] = useState("");
  const [messageAgentId, setMessageAgentId] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionAnchor, setMentionAnchor] = useState<number | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [docTypeFilter, setDocTypeFilter] = useState<"all" | (typeof DOCUMENT_TYPES)[number]>(
    "all",
  );
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [fullViewDocId, setFullViewDocId] = useState<string | null>(null);
  const [showDocForm, setShowDocForm] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docType, setDocType] = useState<(typeof DOCUMENT_TYPES)[number]>("deliverable");
  const [docTaskId, setDocTaskId] = useState("");
  const [docAuthorId, setDocAuthorId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [scrollToCommentId, setScrollToCommentId] = useState<string | null>(null);
  const [isTaskExpanded, setIsTaskExpanded] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedNotificationAgentId, setSelectedNotificationAgentId] = useState<string | null>(null);
  const [detailMessageContent, setDetailMessageContent] = useState("");
  const [detailMessageAgentId, setDetailMessageAgentId] = useState("");
  const [showDetailMentions, setShowDetailMentions] = useState(false);
  const [detailMentionQuery, setDetailMentionQuery] = useState("");
  const [detailMentionAnchor, setDetailMentionAnchor] = useState<number | null>(null);
  const detailMessageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [decisionCommentDrafts, setDecisionCommentDrafts] = useState<Record<string, string>>({});
  const [decisionSubTab, setDecisionSubTab] = useState<"all" | "pending" | "resolved" | "cancelled" | "deferred">("pending");
  const [profileAgentId, setProfileAgentId] = useState<string | null>(null);
  const [revenueMetrics, setRevenueMetrics] = useState<{
    revenue: number;
    sales: number;
    activated: number;
  } | null>(null);

  const [cronState, setCronState] = useState<{
    crons: { id: string; label: string; name: string; enabled: boolean }[];
    allEnabled: boolean;
    allDisabled: boolean;
  } | null>(null);
  const [cronLoading, setCronLoading] = useState(false);
  const [cronItemLoading, setCronItemLoading] = useState<string | null>(null);
  const [cronExpanded, setCronExpanded] = useState(false);

  const [mainView, setMainView] = useState<"holocron" | "gods_eye">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("citadel_main_view") as "holocron" | "gods_eye") ?? "holocron";
    }
    return "holocron";
  });

  const [geAgentFilter, setGeAgentFilter] = useState<string>("all");
  const [geNeedsJayOnly, setGeNeedsJayOnly] = useState(false);

  useEffect(() => {
    if (agents && agents.length === 0) {
      seedAgents();
    }
  }, [agents, seedAgents]);

  useEffect(() => {
    if (agents && agents.length > 0) {
      seedDomainData();
    }
  }, [agents, seedDomainData]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchRevenue = async () => {
      try {
        const res = await fetch("/api/revenue");
        if (res.ok) {
          const data = await res.json();
          setRevenueMetrics({ revenue: data.revenue, sales: data.sales, activated: data.activated });
        }
      } catch {}
    };
    fetchRevenue();
    const interval = setInterval(fetchRevenue, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchCrons = async () => {
      try {
        const res = await fetch(`/api/crons?workspace=${activeWorkspace}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setCronState(data);
        }
      } catch {}
    };
    fetchCrons();
    const interval = setInterval(fetchCrons, 60000);
    return () => clearInterval(interval);
  }, [activeWorkspace]);

  useEffect(() => {
    if (tasks && tasks.length > 0 && !messageTaskId) {
      setMessageTaskId(tasks[0]._id.toString());
    }
  }, [tasks, messageTaskId]);

  useEffect(() => {
    if (agents && agents.length > 0 && !messageAgentId) {
      setMessageAgentId(agents[0]._id.toString());
    }
  }, [agents, messageAgentId]);

  useEffect(() => {
    if (agents && agents.length > 0 && !detailMessageAgentId) {
      setDetailMessageAgentId(agents[0]._id.toString());
    }
  }, [agents, detailMessageAgentId]);

  useEffect(() => {
    if (agents && agents.length > 0 && !docAuthorId) {
      setDocAuthorId(agents[0]._id.toString());
    }
  }, [agents, docAuthorId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedTaskId) {
        if (isTaskExpanded) {
          setIsTaskExpanded(false);
        } else {
          setSelectedTaskId(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTaskId, isTaskExpanded]);

  const visibleAgents = (agents ?? []).filter(a =>
    activeWorkspace === "main"
      ? MAIN_AGENTS.includes(a.name)
      : DASHPANE_AGENTS.includes(a.name)
  );
  const activeAgents = visibleAgents.filter((agent) => agent.status === "working");
  const tasksInQueue = (tasks ?? []).filter((task) => {
    if (task.status === "done") return false;
    const dp = isDashpaneTask(task);
    return activeWorkspace === "dashpane" ? dp : !dp;
  });
  const unreadNotifications =
    notifications?.filter((notification) => !notification.read) ?? [];
  // notificationCount only counts workspace-relevant unread notifications
  const notificationCount = unreadNotifications.filter((n) => {
    // Use taskWorkspace from the query when available
    if (n.taskWorkspace) {
      return n.taskWorkspace === activeWorkspace;
    }
    // Notifications without a task: scope by agent name
    const workspaceAgents = activeWorkspace === "dashpane" ? DASHPANE_AGENTS : MAIN_AGENTS;
    return workspaceAgents.includes(n.agentName ?? "");
  }).length;
  const filteredNotifications = useMemo(() => {
    const ordered = [...(notifications ?? [])]
      .filter((n) => {
        if (n.taskWorkspace) {
          return n.taskWorkspace === activeWorkspace;
        }
        const workspaceAgents = activeWorkspace === "dashpane" ? DASHPANE_AGENTS : MAIN_AGENTS;
        return workspaceAgents.includes(n.agentName ?? "");
      })
      .sort((a, b) => b.createdAt - a.createdAt);
    if (!selectedNotificationAgentId) return ordered;
    return ordered.filter((notification) => notification.agentId === selectedNotificationAgentId);
  }, [notifications, selectedNotificationAgentId, activeWorkspace]);

  const selectedAgent = (agents ?? []).find((agent) => agent._id.toString() === selectedAgentId);
  const selectedAgentConvexId = selectedAgentId ? (selectedAgentId as Id<"agents">) : null;

  const tradingData = useQuery(
    api.domain.getTradingData,
    selectedAgentConvexId && selectedAgent?.role === "Trading"
      ? { agentId: selectedAgentConvexId }
      : "skip",
  );
  const socialMetrics = useQuery(
    api.domain.getSocialMetrics,
    selectedAgentConvexId && selectedAgent?.role === "Growth"
      ? { agentId: selectedAgentConvexId }
      : "skip",
  );
  const securityScans = useQuery(
    api.domain.getSecurityScans,
    selectedAgentConvexId && selectedAgent?.role === "Security"
      ? { agentId: selectedAgentConvexId }
      : "skip",
  );
  const jobPipeline = useQuery(
    api.domain.getJobPipeline,
    selectedAgentConvexId && selectedAgent?.role === "Jobs"
      ? { agentId: selectedAgentConvexId }
      : "skip",
  );
  const buildStatus = useQuery(
    api.domain.getBuildStatus,
    selectedAgentConvexId && selectedAgent?.role === "Builder"
      ? { agentId: selectedAgentConvexId }
      : "skip",
  );

  const [dmText, setDmText] = useState("");
  const [dmSending, setDmSending] = useState(false);
  const [dmSent, setDmSent] = useState(false);

  const AGENT_BIOS: Record<string, string> = {
    Ryan: "Named after Ryan Hoover (PH founder). Owns Product Hunt launch day, Reddit communities, and Show HN. Replies to every comment within 15 minutes on launch day.",
    Harvey: "Named after Harvey Specter. Never takes no for an answer. Researches and drafts cold outreach to macOS newsletters, blogs, and YouTubers. Every email is personal.",
    Rand: "Named after Rand Fishkin (Moz). Thinks in keywords and conversion funnels. Audits dashpane.pro SEO, tracks rankings, optimises what converts.",
    Buddy: "Chief of Staff. Coordinates the whole team. You talk to Buddy, Buddy delegates. Nothing falls through the cracks.",
    Katy: "Growth & social. Owns X, LinkedIn, and Reddit content for the launch. All DashPane launch week content goes through her.",
    Elon: "Builder. Makes dashpane.pro launch-ready. Handles website fixes, PH badge, conversion improvements.",
  };

  const AGENT_SESSION_KEYS: Record<string, string> = {
    Ryan: "agent:ryan:main",
    Harvey: "agent:harvey:main",
    Rand: "agent:rand:main",
    Buddy: "agent:main:main",
    Katy: "agent:kt:main",
    Elon: "agent:builder:main",
  };

  const handleSendDm = async (agentName: string) => {
    const trimmed = dmText.trim();
    if (!trimmed) return;
    const sessionKey = AGENT_SESSION_KEYS[agentName];
    if (!sessionKey) return;
    setDmSending(true);
    try {
      const res = await fetch("/api/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey, message: trimmed }),
      });
      if (res.ok) {
        setDmText("");
        setDmSent(true);
        setTimeout(() => setDmSent(false), 2000);
      }
    } catch {
      // silent fail
    } finally {
      setDmSending(false);
    }
  };

  const profileAgent = (agents ?? []).find((a) => a._id.toString() === profileAgentId);
  const profileAgentConvexId = profileAgentId ? (profileAgentId as Id<"agents">) : null;

  const profileMessageCount = useQuery(
    api.messages.countByAgent,
    profileAgentConvexId ? { agentId: profileAgentConvexId } : "skip",
  );
  const profileDocuments = useQuery(
    api.documents.listByAgent,
    profileAgentConvexId ? { agentId: profileAgentConvexId } : "skip",
  );
  const profileActivities = useQuery(
    api.activities.listByAgent,
    profileAgentConvexId ? { agentId: profileAgentConvexId } : "skip",
  );

  const profileStats = useMemo(() => {
    if (!profileAgent || !tasks) return null;
    const agentId = profileAgent._id.toString();
    const completedTasks = (tasks ?? []).filter(
      (t) => t.status === "done" && t.assigneeIds.some((id) => id.toString() === agentId),
    );
    const allAgentTasks = (tasks ?? []).filter(
      (t) => t.assigneeIds.some((id) => id.toString() === agentId),
    );
    const currentTasks = allAgentTasks.filter((t) => t.status === "in_progress");
    const docCount = (documents ?? []).filter(
      (d) => d.authorId?.toString() === agentId,
    ).length;

    return {
      tasksCompleted: completedTasks.length,
      documentsCreated: docCount,
      commentsPosted: profileMessageCount ?? 0,
      lastActive: profileAgent.lastActive,
      currentTask: profileAgent.currentTask,
      completedHistory: completedTasks
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 10),
      currentTasks,
    };
  }, [profileAgent, tasks, documents, profileMessageCount]);

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    // First filter by workspace
    const workspaceTasks = tasks.filter(t => {
      const dp = isDashpaneTask(t);
      return activeWorkspace === "dashpane" ? dp : !dp;
    });
    if (!selectedAgentId) return workspaceTasks;
    return workspaceTasks.filter((task) =>
      (task.assigneeIds ?? []).some((assigneeId) => assigneeId.toString() === selectedAgentId),
    );
  }, [tasks, selectedAgentId, activeWorkspace]);

  const mentionOptions = useMemo(() => {
    if (!agents) return [];
    const query = mentionQuery.trim().toLowerCase();
    if (!query) return agents;
    return agents.filter((agent) => agent.name.toLowerCase().includes(query));
  }, [agents, mentionQuery]);

  const handleMessageChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setMessageContent(value);
    const cursor = event.target.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const atIndex = before.lastIndexOf("@");
    if (atIndex >= 0 && (atIndex === 0 || /\s/.test(before[atIndex - 1] ?? ""))) {
      const query = before.slice(atIndex + 1);
      if (!query.includes(" ") && !query.includes("\n")) {
        setShowMentions(true);
        setMentionQuery(query);
        setMentionAnchor(atIndex);
        return;
      }
    }
    setShowMentions(false);
    setMentionQuery("");
    setMentionAnchor(null);
  };

  type Agent = NonNullable<typeof agents>[number];

  const handleMentionSelect = (agent: Agent) => {
    const input = messageInputRef.current;
    if (!input) return;
    const value = messageContent;
    const cursor = input.selectionStart ?? value.length;
    const anchor = mentionAnchor ?? value.lastIndexOf("@");
    if (anchor < 0) return;
    const before = value.slice(0, anchor);
    const after = value.slice(cursor);
    const nextValue = `${before}@${agent.name} ${after}`;
    setMessageContent(nextValue);
    setShowMentions(false);
    setMentionQuery("");
    setMentionAnchor(null);
    requestAnimationFrame(() => {
      const nextPos = (before + `@${agent.name} `).length;
      input.focus();
      input.setSelectionRange(nextPos, nextPos);
    });
  };

  const handleDetailMessageChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setDetailMessageContent(value);
    const cursor = event.target.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const atIndex = before.lastIndexOf("@");
    if (atIndex >= 0 && (atIndex === 0 || /\s/.test(before[atIndex - 1] ?? ""))) {
      const query = before.slice(atIndex + 1);
      if (!query.includes(" ") && !query.includes("\n")) {
        setShowDetailMentions(true);
        setDetailMentionQuery(query);
        setDetailMentionAnchor(atIndex);
        return;
      }
    }
    setShowDetailMentions(false);
    setDetailMentionQuery("");
    setDetailMentionAnchor(null);
  };

  const handleDetailMentionSelect = (agent: Agent) => {
    const input = detailMessageInputRef.current;
    if (!input) return;
    const value = detailMessageContent;
    const cursor = input.selectionStart ?? value.length;
    const anchor = detailMentionAnchor ?? value.lastIndexOf("@");
    if (anchor < 0) return;
    const before = value.slice(0, anchor);
    const after = value.slice(cursor);
    const nextValue = `${before}@${agent.name} ${after}`;
    setDetailMessageContent(nextValue);
    setShowDetailMentions(false);
    setDetailMentionQuery("");
    setDetailMentionAnchor(null);
    requestAnimationFrame(() => {
      const nextPos = (before + `@${agent.name} `).length;
      input.focus();
      input.setSelectionRange(nextPos, nextPos);
    });
  };

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = messageContent.trim();
    if (!trimmed || !messageTaskId || !messageAgentId) return;
    await createMessage({
      taskId: messageTaskId as Id<"tasks">,
      agentId: messageAgentId as Id<"agents">,
      content: trimmed,
    });
    setMessageContent("");
    setShowMentions(false);
    setMentionQuery("");
    setMentionAnchor(null);
  };

  const canSendMessage = messageContent.trim().length > 0 && messageTaskId && messageAgentId;

  const handleSendDetailMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = detailMessageContent.trim();
    if (!trimmed || !selectedTaskId || !detailMessageAgentId) return;
    await createMessage({
      taskId: selectedTaskId as Id<"tasks">,
      agentId: detailMessageAgentId as Id<"agents">,
      content: trimmed,
    });
    setDetailMessageContent("");
    setShowDetailMentions(false);
    setDetailMentionQuery("");
    setDetailMentionAnchor(null);
  };

  const canSendDetailMessage =
    detailMessageContent.trim().length > 0 && selectedTaskId && detailMessageAgentId;

  const handleDecisionResolve = async (decisionId: string, option: string) => {
    const normalized = option.toLowerCase();
    let status: "approved" | "rejected" | "resolved" = "resolved";
    if (normalized.includes("approve")) status = "approved";
    if (normalized.includes("reject") || normalized.includes("deny")) status = "rejected";
    await resolveDecision({
      id: decisionId as Id<"decisions">,
      status,
      resolution: option,
    });
  };

  const handleDecisionCommentChange = (decisionId: string, value: string) => {
    setDecisionCommentDrafts((prev) => ({ ...prev, [decisionId]: value }));
  };

  const handleDecisionCommentSubmit = async (decisionId: string) => {
    const text = decisionCommentDrafts[decisionId]?.trim();
    if (!text) return;
    // addComment now auto-resolves the decision and notifies the agent
    await addDecisionComment({
      id: decisionId as Id<"decisions">,
      text,
      jayToken: "jay-citadel-owner-2026",
    });
    setDecisionCommentDrafts((prev) => ({ ...prev, [decisionId]: "" }));
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    const confirmed = window.confirm(`Delete "${selectedTask.title}"? This cannot be undone.`);
    if (!confirmed) return;
    await removeTask({ id: selectedTask._id });
    setSelectedTaskId(null);
  };

  const handleNotificationClick = useCallback(
    async (notification: NonNullable<typeof notifications>[number]) => {
      if (!notification.read) {
        await markNotificationRead({ id: notification._id });
      }
      if (notification.sourceTaskId) {
        setSelectedTaskId(notification.sourceTaskId.toString());
      }
    },
    [markNotificationRead],
  );

  const handleMarkAllNotificationsRead = useCallback(async () => {
    if (unreadNotifications.length === 0) return;
    await Promise.all(
      unreadNotifications.map((notification) => markNotificationRead({ id: notification._id })),
    );
  }, [markNotificationRead, unreadNotifications]);

  const handleCronToggle = async () => {
    if (cronLoading || cronItemLoading || !cronState) return;
    setCronLoading(true);
    try {
      // API now returns only workspace-specific crons
      const workspaceCrons = cronState.crons;
      const allOn = workspaceCrons.every((c: Record<string, unknown>) => c.enabled);
      // Toggle each individually
      for (const cron of workspaceCrons) {
        await fetch("/api/crons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "toggle", cronId: cron.id, enabled: !allOn }),
        });
      }
      const freshRes = await fetch(`/api/crons?workspace=${activeWorkspace}`);
      if (freshRes.ok) setCronState(await freshRes.json());
    } catch {} finally {
      setCronLoading(false);
    }
  };

  const handleCronItemToggle = async (cronId: string, enabled: boolean) => {
    if (cronLoading || cronItemLoading || !cronState) return;
    setCronItemLoading(cronId);
    try {
      const res = await fetch("/api/crons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", cronId, enabled }),
      });
      if (res.ok) {
        const freshRes = await fetch(`/api/crons?workspace=${activeWorkspace}`);
        if (freshRes.ok) setCronState(await freshRes.json());
      }
    } catch {} finally {
      setCronItemLoading(null);
    }
  };

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, typeof tasks> = {
      inbox: [],
      assigned: [],
      in_progress: [],
      review: [],
      done: [],
    };
    for (const task of filteredTasks ?? []) {
      if (task.status === "inbox" && (task.assignees ?? []).length > 0) {
        grouped["assigned"]?.push(task);
      } else {
        grouped[task.status]?.push(task);
      }
    }
    return grouped;
  }, [filteredTasks]);

  const workspaceAgentNames = activeWorkspace === "main" ? MAIN_AGENTS : DASHPANE_AGENTS;

  // Must be declared before agentCounts, filteredActivities, and pendingDecisions
  const dashpaneTaskIdsPre = useMemo(() => {
    const ids = new Set<string>();
    for (const task of tasks ?? []) {
      if (isDashpaneTask(task)) ids.add(task._id.toString());
    }
    return ids;
  }, [tasks]);

  const DASHPANE_ONLY_AGENTS = ["Ryan", "Harvey", "Rand"];
  const MAIN_ONLY_AGENTS = ["Jerry", "Mike", "Burry"];

  const dashpaneTaskIds = dashpaneTaskIdsPre;

  const pendingDecisions = useMemo(
    () => (decisions ?? []).filter((decision) => {
      if (decision.status !== "pending") return false;
      // 1. Explicit workspace field (now also computed from task in the query)
      if ((decision as any).workspace) {
        return (decision as any).workspace === activeWorkspace;
      }
      // 2. Check if decision's taskId is a dashpane task
      if (decision.taskId) {
        const dp = dashpaneTaskIds.has(decision.taskId.toString());
        return activeWorkspace === "dashpane" ? dp : !dp;
      }
      // 3. Fall back to agent-name scoping
      const agentName = decision.agent?.name;
      return !agentName || workspaceAgentNames.includes(agentName);
    }),
    [decisions, workspaceAgentNames, activeWorkspace, dashpaneTaskIds],
  );

  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    const workspaceFiltered = activities.filter((activity) => {
      // Exclude heartbeat status noise from activity feed
      if (activity.action === "status" && activity.targetType === "agent") return false;
      const agentName = activity.agent?.name;
      // Unique-workspace agents: easy filter
      if (activeWorkspace === "dashpane" && MAIN_ONLY_AGENTS.includes(agentName ?? "")) return false;
      if (activeWorkspace === "main" && DASHPANE_ONLY_AGENTS.includes(agentName ?? "")) return false;
      // Shared agents (Buddy/Katy/Elon): filter by whether their activity targets a DashPane task
      const sharedAgents = ["Buddy", "Katy", "Elon"];
      if (agentName && sharedAgents.includes(agentName)) {
        if (activity.targetType === "task" && activity.targetId) {
          const isDashpaneTask = dashpaneTaskIds.has(activity.targetId.toString());
          return activeWorkspace === "dashpane" ? isDashpaneTask : !isDashpaneTask;
        }
        // Non-task activities from shared agents (create, comment, etc): show in both workspaces
        return true;
      }
      return true;
    });
    if (selectedAgentId) {
      return workspaceFiltered.filter((activity) => activity.agentId?.toString() === selectedAgentId);
    }
    if (agentFilter === "all") return workspaceFiltered;
    return workspaceFiltered.filter((activity) => activity.agentId?.toString() === agentFilter);
  }, [activities, agentFilter, selectedAgentId, workspaceAgentNames]);

  const feedActivities = useMemo(
    () => filteredActivities.filter((activity) => activity.action !== "status"),
    [filteredActivities],
  );

  const agentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    // Use feedActivities so counts always match the active tab filter
    for (const activity of feedActivities) {
      if (activity.agentId) {
        const key = activity.agentId.toString();
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
    return counts;
  }, [feedActivities]);

  const statusActivities = useMemo(
    () => (activities ?? []).filter((activity) => {
      if (activity.action !== "status") return false;
      const agentName = activity.agent?.name;
      return !agentName || workspaceAgentNames.includes(agentName);
    }),
    [activities, workspaceAgentNames],
  );

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setTitleError(true);
      return;
    }

    const parsedTags = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    await createTask({
      title: title.trim(),
      description: description.trim() ? description.trim() : undefined,
      priority: priority as "low" | "medium" | "high" | "urgent",
      tags: parsedTags,
      assigneeIds: assignees.map((assignee) => assignee as Id<"agents">),
      workspace: activeWorkspace,
    });

    setTitle("");
    setDescription("");
    setPriority("medium");
    setTags("");
    setAssignees([]);
    setTitleError(false);
    setShowForm(false);
  };

  const handleCreateDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!docTitle.trim() || !docContent.trim() || !docAuthorId) return;
    await createDocument({
      title: docTitle.trim(),
      content: docContent.trim(),
      type: docType,
      taskId: docTaskId ? (docTaskId as Id<"tasks">) : undefined,
      authorId: docAuthorId as Id<"agents">,
    });

    setDocTitle("");
    setDocContent("");
    setDocType("deliverable");
    setDocTaskId("");
    setShowDocForm(false);
  };

  const timeString = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);

  const dateString = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(now);

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  const numberFormatter = useMemo(() => new Intl.NumberFormat("en-US"), []);
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  );

  const panelMeta = selectedAgent ? AGENT_PANEL_META[selectedAgent.name] : null;
  const panelLoading =
    (selectedAgent?.role === "Trading" && tradingData === undefined) ||
    (selectedAgent?.role === "Growth" && socialMetrics === undefined) ||
    (selectedAgent?.role === "Security" && securityScans === undefined) ||
    (selectedAgent?.role === "Jobs" && jobPipeline === undefined) ||
    (selectedAgent?.role === "Builder" && buildStatus === undefined);
  const panelEmpty =
    (selectedAgent?.role === "Trading" && tradingData === null) ||
    (selectedAgent?.role === "Growth" && socialMetrics === null) ||
    (selectedAgent?.role === "Security" && securityScans === null) ||
    (selectedAgent?.role === "Jobs" && jobPipeline === null) ||
    (selectedAgent?.role === "Builder" && buildStatus === null);

  const panelData = useMemo(() => {
    if (!selectedAgent) return null;

    if (selectedAgent.role === "Trading") {
      if (!tradingData) return null;
      const positions = tradingData.positions ?? [];
      return {
        summary: [
          {
            label: "Portfolio",
            value: currencyFormatter.format(tradingData.portfolioValue),
            helper: formatSignedPercent(tradingData.portfolioChange),
          },
          { label: "Monthly P&L", value: currencyFormatter.format(tradingData.monthlyPnl) },
          { label: "Win rate", value: `${tradingData.winRate.toFixed(1)}%` },
        ],
        sections: [
          {
            label: "Open positions",
            items:
              positions.length > 0
                ? positions.map((position) => ({
                    primary: position.pair,
                    secondary: position.direction,
                    tertiary: formatSignedPercent(position.pnlPercent),
                    status: position.pnlPercent >= 0 ? "good" : "bad",
                  }))
                : [{ primary: "No open positions" }],
          },
        ],
      };
    }

    if (selectedAgent.role === "Growth") {
      if (!socialMetrics) return null;
      return {
        summary: [
          {
            label: "Followers",
            value: numberFormatter.format(socialMetrics.followers),
            helper: `${formatSignedPercent(socialMetrics.followersWeekChange, 0)} this week`,
          },
          { label: "Views today", value: socialMetrics.viewsToday >= 1000 ? `~${Math.round(socialMetrics.viewsToday / 1000 * 10) / 10}K` : socialMetrics.viewsToday > 0 ? "<1K" : "0" },
          { label: "Engagement", value: `${socialMetrics.engagementRate.toFixed(1)}%` },
        ],
        sections: [
          {
            label: "Publishing",
            items: [
              {
                primary: "Scheduled posts",
                secondary: `${socialMetrics.scheduledPosts} queued`,
              },
              {
                primary: "Weekly growth",
                secondary: `${formatSignedPercent(socialMetrics.followersWeekChange, 0)} followers`,
              },
            ],
          },
        ],
      };
    }

    if (selectedAgent.role === "Security") {
      if (!securityScans) return null;
      return {
        summary: [
          { label: "Open ports", value: `${securityScans.openPorts}` },
          { label: "Last scan", value: timeAgo(securityScans.lastScanAt) },
          { label: "Firewall rules", value: `${securityScans.firewallRules} active` },
        ],
        sections: [
          {
            label: "Vulnerabilities",
            items: [
              {
                primary: "Critical",
                secondary: `${securityScans.criticalVulns}`,
                status: securityScans.criticalVulns === 0 ? "good" : "bad",
              },
              {
                primary: "Medium",
                secondary: `${securityScans.mediumVulns}`,
                status: securityScans.mediumVulns === 0 ? "good" : "warn",
              },
              {
                primary: "Low",
                secondary: `${securityScans.lowVulns}`,
                status: securityScans.lowVulns === 0 ? "good" : "warn",
              },
            ],
          },
          {
            label: "SSH defenses",
            items: [
              {
                primary: "Failed attempts (24h)",
                secondary: `${securityScans.failedSshAttempts} blocked`,
                status: "good",
              },
            ],
          },
        ],
      };
    }

    if (selectedAgent.role === "Jobs") {
      if (!jobPipeline) return null;
      return {
        summary: [
          { label: "Active applications", value: `${jobPipeline.activeApplications}` },
          {
            label: "Pipeline",
            value: `${jobPipeline.applied} Applied · ${jobPipeline.interviewing} Interview · ${jobPipeline.offers} Offer`,
          },
          { label: "New listings", value: `${jobPipeline.newListingsToday} today` },
        ],
        sections: [
          {
            label: "Pipeline stages",
            items: [
              { primary: "Applied", secondary: `${jobPipeline.applied}` },
              { primary: "Interviewing", secondary: `${jobPipeline.interviewing}` },
              { primary: "Offers", secondary: `${jobPipeline.offers}` },
            ],
          },
        ],
      };
    }

    if (selectedAgent.role === "Builder") {
      if (!buildStatus) return null;
      return {
        summary: [
          { label: "Active projects", value: `${buildStatus.activeProjects}` },
          { label: "Commits today", value: `${buildStatus.commitsToday}` },
          { label: "Builds", value: buildStatus.allGreen ? "All green" : "Needs attention" },
        ],
        sections: [
          {
            label: "Build health",
            items: [
              {
                primary: buildStatus.allGreen ? "Pipelines healthy" : "Failures detected",
                secondary: buildStatus.allGreen ? "No action required" : "Investigate failing jobs",
                status: buildStatus.allGreen ? "good" : "bad",
              },
            ],
          },
        ],
      };
    }

    if (selectedAgent.role === "Coordinator") {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const doneToday =
        tasks?.filter((task) => task.status === "done" && task.updatedAt >= startOfDay.getTime())
          .length ?? 0;
      const pendingReviews = tasks?.filter((task) => task.status === "review").length ?? 0;
      const utilization =
        agents && agents.length > 0
          ? Math.round((activeAgents.length / agents.length) * 100)
          : 0;

      return {
        summary: [
          { label: "Tasks completed", value: `${doneToday} today` },
          { label: "Pending reviews", value: `${pendingReviews}` },
          { label: "Utilization", value: `${utilization}%` },
        ],
        sections: [
          {
            label: "Standup",
            items: [
              { primary: "Next standup", secondary: "8:30 PM IST" },
              { primary: "Updates logged", secondary: `${activities?.length ?? 0} entries` },
            ],
          },
        ],
      };
    }

    return null;
  }, [
    selectedAgent,
    tradingData,
    socialMetrics,
    securityScans,
    jobPipeline,
    buildStatus,
    tasks,
    agents,
    activeAgents,
    activities,
    now,
    numberFormatter,
    currencyFormatter,
  ]);

  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    // Filter by workspace using task-derived workspace field
    const workspaceFiltered = documents.filter((doc) => {
      if (doc.workspace) return doc.workspace === activeWorkspace;
      // Fallback for docs without task: use author name, but only match exclusive agents
      const authorName = doc.author?.name;
      return !authorName || workspaceAgentNames.includes(authorName);
    });
    const filtered =
      docTypeFilter === "all" ? workspaceFiltered : workspaceFiltered.filter((doc) => doc.type === docTypeFilter);
    return [...filtered].sort((a, b) => b.createdAt - a.createdAt);
  }, [documents, docTypeFilter, activeWorkspace, workspaceAgentNames]);

  const selectedTask = (tasks ?? []).find((task) => task._id.toString() === selectedTaskId) ?? null;
  const selectedTaskConvexId = selectedTaskId ? (selectedTaskId as Id<"tasks">) : null;
  const taskMessages = useQuery(
    api.messages.listByTask,
    selectedTaskConvexId ? { taskId: selectedTaskConvexId } : "skip",
  );
  const taskSubscriptions = useQuery(
    api.subscriptions.listByTask,
    selectedTaskConvexId ? { taskId: selectedTaskConvexId } : "skip",
  );
  const taskSubscribers = useMemo(() => {
    if (!taskSubscriptions || !agents) return [];
    const agentMap = new Map(agents.map((agent) => [agent._id.toString(), agent]));
    return taskSubscriptions
      .map((subscription) => agentMap.get(subscription.agentId.toString()))
      .filter((agent): agent is Agent => Boolean(agent));
  }, [taskSubscriptions, agents]);

  const detailMentionOptions = useMemo(() => {
    if (!agents) return [];
    const query = detailMentionQuery.trim().toLowerCase();
    if (!query) return agents;
    return agents.filter((agent) => agent.name.toLowerCase().includes(query));
  }, [agents, detailMentionQuery]);

  const renderActivityCards = (
    activityItems: typeof filteredActivities,
    emptyMessage: string,
  ) => (
    <div className="flex flex-col gap-3 pr-2">
      {activityItems.map((activity) =>
        activity.targetId ? (
          <button
            key={activity._id}
            type="button"
            onClick={() => {
              if (activity.targetType === "task" && activity.targetId) {
                setSelectedTaskId(activity.targetId);
                setScrollToCommentId(null);
              } else if (activity.targetType === "document" && activity.targetId) {
                setFullViewDocId(activity.targetId);
              } else if ((activity.targetType === "comment" || activity.targetType === "message" || activity.action === "comment") && activity.targetId) {
                // activity.targetId for comment activities is the task ID
                // (stored as `targetId: args.taskId` in messages.ts).
                // Do NOT use title-based lookup — it breaks when two tasks share
                // the same first 20 chars (e.g. "DashPane post-launch content"
                // vs "DashPane post-launch outreach").
                setSelectedTaskId(activity.targetId);
                setScrollToCommentId(null);
              }
            }}
            className="flex gap-3 rounded-lg border border-warm-200 bg-white p-3 cursor-pointer hover:bg-warm-50"
          >
            <div className="mt-2 h-2 w-2 rounded-full bg-[#16A34A]" />
            <div className="flex-1 text-left">
              <p className="text-sm text-warm-900">
                <span className="font-semibold">
                  {activity.agent?.name ?? "System"}
                </span>{" "}
                <span>{activity.description}</span>
              </p>
              <p className="mt-1 text-xs text-warm-600">
                {(activity.agent?.name ?? "System")} · {timeAgo(activity.createdAt)}
              </p>
            </div>
          </button>
        ) : (
          <div
            key={activity._id}
            className="flex gap-3 rounded-lg border border-warm-200 bg-white p-3"
          >
            <div className="mt-2 h-2 w-2 rounded-full bg-[#16A34A]" />
            <div className="flex-1">
              <p className="text-sm text-warm-900">
                <span className="font-semibold">
                  {activity.agent?.name ?? "System"}
                </span>{" "}
                <span>{activity.description}</span>
              </p>
              <p className="mt-1 text-xs text-warm-600">
                {(activity.agent?.name ?? "System")} · {timeAgo(activity.createdAt)}
              </p>
            </div>
          </div>
        ),
      )}
      {activityItems.length === 0 && (
        <div className="rounded-lg border border-dashed border-warm-200 bg-[#F5F3EF] p-6 text-center text-sm text-warm-600">
          {emptyMessage}
        </div>
      )}
    </div>
  );

  const liveFeedContent = (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-2">
      <div className="flex flex-wrap gap-2">
        {FEED_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFeedTab(tab.key)}
            className={`rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] transition ${
              feedTab === tab.key
                ? "border-[#D97706] bg-[#FEF3C7] text-[#92400E]"
                : "border-warm-200 text-warm-600"
            }`}
          >
            {tab.key === "decisions" ? (
              <span className="flex items-center gap-2">
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[0.55rem] font-semibold ${
                    pendingDecisions.length > 0
                      ? "bg-[#F59E0B] text-white"
                      : "bg-warm-100 text-warm-500"
                  }`}
                >
                  {pendingDecisions.length}
                </span>
              </span>
            ) : (
              tab.label
            )}
          </button>
        ))}
      </div>
      {feedTab === "decisions" ? (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-2 scrollbar-thin">
          {/* Status filter tabs: All, Pending, Resolved, Cancelled, Deferred */}
          <div className="flex flex-wrap items-center gap-2 border-b border-warm-100 pb-2">
            {([
              { key: "all", label: "All", color: "bg-warm-600" },
              { key: "pending", label: "Pending", color: "bg-[#F59E0B]" },
              { key: "resolved", label: "Resolved", color: "bg-[#16A34A]" },
              { key: "cancelled", label: "Cancelled", color: "bg-[#EF4444]" },
              { key: "deferred", label: "Not Now", color: "bg-[#6B7280]" },
            ] as const).map((tab) => {
              const count = (() => {
                const allDecisions = decisions ?? [];
                const workspaceFiltered = allDecisions.filter((d) => {
                  if ((d as any).workspace) return (d as any).workspace === activeWorkspace;
                  if (d.taskId) {
                    const dp = dashpaneTaskIds.has(d.taskId.toString());
                    return activeWorkspace === "dashpane" ? dp : !dp;
                  }
                  const agentName = d.agent?.name;
                  return !agentName || workspaceAgentNames.includes(agentName);
                });
                if (tab.key === "all") return workspaceFiltered.length;
                if (tab.key === "resolved") return workspaceFiltered.filter((d) => ["approved", "rejected", "resolved"].includes(d.status)).length;
                return workspaceFiltered.filter((d) => d.status === tab.key).length;
              })();
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDecisionSubTab(tab.key)}
                  className={`rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.15em] transition ${
                    decisionSubTab === tab.key
                      ? `${tab.color} text-white`
                      : "bg-warm-100 text-warm-500 hover:bg-warm-200"
                  }`}
                >
                  {tab.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Decision cards - filtered by selected tab */}
          {(() => {
            const allDecisions = decisions ?? [];
            const workspaceFiltered = allDecisions.filter((d) => {
              if ((d as any).workspace) return (d as any).workspace === activeWorkspace;
              if (d.taskId) {
                const dp = dashpaneTaskIds.has(d.taskId.toString());
                return activeWorkspace === "dashpane" ? dp : !dp;
              }
              const agentName = d.agent?.name;
              return !agentName || workspaceAgentNames.includes(agentName);
            });
            
            const filteredDecisions = workspaceFiltered.filter((d) => {
              if (decisionSubTab === "all") return true;
              if (decisionSubTab === "resolved") return ["approved", "rejected", "resolved"].includes(d.status);
              return d.status === decisionSubTab;
            });

            if (filteredDecisions.length === 0) {
              return (
                <div className="rounded-lg border border-dashed border-warm-200 bg-[#F5F3EF] p-6 text-center text-sm text-warm-600">
                  {decisionSubTab === "pending" ? "No pending decisions. 🎉" :
                   decisionSubTab === "resolved" ? "No resolved decisions yet." :
                   decisionSubTab === "cancelled" ? "No cancelled decisions." :
                   decisionSubTab === "deferred" ? "No deferred decisions." :
                   "No decisions yet."}
                </div>
              );
            }

            return filteredDecisions.map((decision) => {
              const isPending = decision.status === "pending";
              const isDeferred = decision.status === "deferred";
              const isCancelled = decision.status === "cancelled";
              const isResolved = ["approved", "rejected", "resolved"].includes(decision.status);
              const decisionKey = decision._id.toString();
              const options = decision.options ?? [];
              const commentValue = decisionCommentDrafts[decisionKey] ?? "";

              // Card styling based on status
              const cardStyle = isPending
                ? "border-[#F59E0B] bg-[#FFFBEB]"
                : isDeferred
                  ? "border-warm-300 bg-warm-50"
                  : isCancelled
                    ? "border-red-200 bg-red-50/50"
                    : isResolved
                      ? "border-green-200 bg-green-50/50"
                      : "border-warm-200 bg-[#F5F3EF]";

              const statusBadge = isPending
                ? "bg-[#F59E0B] text-white"
                : isDeferred
                  ? "bg-[#6B7280] text-white"
                  : isCancelled
                    ? "bg-[#EF4444] text-white"
                    : isResolved
                      ? "bg-[#16A34A] text-white"
                      : "bg-warm-200 text-warm-600";

              return (
                <div
                  key={decision._id}
                  className={`rounded-lg border p-3 shadow-sm ${cardStyle}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${isPending ? "text-warm-900" : "text-warm-700"}`}>
                        {decision.title}
                      </p>
                      <p className={`mt-1 text-xs ${isPending ? "text-warm-700" : "text-warm-500"}`}>
                        {(decision.description ?? "")
                          .replace(/\*\*(.+?)\*\*/g, "$1")
                          .replace(/\*(.+?)\*/g, "$1")
                          .replace(/`(.+?)`/g, "$1")
                          .slice(0, 200)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.65rem] text-warm-500">
                        <span className="flex items-center gap-1">
                          {decision.agent ? <AgentAvatar name={decision.agent.name} size={20} /> : <span className="text-base">🧭</span>}
                          <span>{decision.agent?.name ?? "Unknown"}</span>
                        </span>
                        <span>
                          {isDeferred
                            ? `Deferred ${timeAgo((decision as any).deferredAt ?? decision.createdAt)}`
                            : isCancelled
                              ? `Cancelled ${timeAgo((decision as any).cancelledAt ?? decision.createdAt)}`
                              : isResolved
                                ? `Resolved ${timeAgo((decision as any).resolvedAt ?? decision.createdAt)}`
                                : timeAgo(decision.createdAt)}
                        </span>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.2em] ${statusBadge}`}>
                      {decision.status.replace("_", " ")}
                    </span>
                  </div>

                  {/* Options - only show for pending decisions */}
                  {isPending && options.length > 0 && (
                    <div className="mt-3 grid gap-2">
                      {options.map((option, index) => (
                        <button
                          key={`${decision._id}-${option}`}
                          type="button"
                          onClick={() => handleDecisionResolve(decisionKey, option)}
                          className="flex items-center gap-2 rounded-lg border border-[#FDE68A] bg-white px-3 py-2 text-left text-xs font-semibold text-warm-800 transition hover:border-[#F59E0B] hover:bg-[#FFF7ED] cursor-pointer"
                        >
                          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#F59E0B] text-[0.65rem] font-semibold text-white">
                            {index + 1}
                          </span>
                          <span>{option}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Resolution info for resolved decisions */}
                  {isResolved && decision.resolution && (
                    <div className="mt-3 rounded-lg border border-green-200 bg-white/70 px-3 py-2 text-xs text-warm-600">
                      Resolution: <span className="font-semibold text-green-700">{decision.resolution}</span>
                    </div>
                  )}

                  {/* Action buttons based on status */}
                  {isPending && (
                    <div className="mt-3 flex items-center gap-2 border-t border-[#FDE68A] pt-3">
                      <button
                        type="button"
                        onClick={() => deferDecision({ id: decision._id })}
                        className="flex-1 rounded-lg border border-warm-300 bg-white px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-warm-600 transition hover:border-warm-400 hover:bg-warm-50"
                      >
                        ⏳ Not Now
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Cancel this decision? "${decision.title}"`)) {
                            cancelDecision({ id: decision._id });
                          }
                        }}
                        className="flex-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-red-600 transition hover:border-red-300 hover:bg-red-50"
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  )}

                  {isDeferred && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => reactivateDecision({ id: decision._id })}
                        className="flex-1 rounded-lg border border-[#F59E0B] bg-[#FFFBEB] px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-[#92400E] transition hover:bg-[#FEF3C7]"
                      >
                        ↻ Reactivate
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Permanently cancel this decision? "${decision.title}"`)) {
                            cancelDecision({ id: decision._id });
                          }
                        }}
                        className="rounded-lg border border-red-200 bg-white px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-red-600 transition hover:border-red-300 hover:bg-red-50"
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  )}

                  {/* Comment section - only for pending decisions */}
                  {isPending && (
                    <div className="mt-3 flex flex-col gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <input
                          className="min-w-0 flex-1 rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs"
                          placeholder="Jay's response / comment…"
                          value={commentValue}
                          onChange={(event) =>
                            handleDecisionCommentChange(decisionKey, event.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey && commentValue.trim()) {
                              e.preventDefault();
                              handleDecisionCommentSubmit(decisionKey);
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={!commentValue.trim()}
                          onClick={() => handleDecisionCommentSubmit(decisionKey)}
                          className={`flex-shrink-0 rounded-full px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white ${
                            commentValue.trim()
                              ? "bg-[#D97706] hover:bg-[#C56A05]"
                              : "cursor-not-allowed bg-[#D6D3D1]"
                          }`}
                        >
                          Reply
                        </button>
                      </div>
                      {(decision.comments ?? []).map((comment, index) => (
                        <div
                          key={`${decision._id}-comment-${index}`}
                          className="rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs text-warm-700"
                        >
                          <div className="flex items-center justify-between text-[0.6rem] text-warm-500">
                            <span className="font-semibold text-[#D97706]">Jay</span>
                            <span>{timeAgo(comment.createdAt)}</span>
                          </div>
                          <p className="mt-1 text-xs text-warm-700 whitespace-pre-wrap">
                            {comment.text
                              .replace(/\*\*(.+?)\*\*/g, "$1")
                              .replace(/\*(.+?)\*/g, "$1")
                              .replace(/`(.+?)`/g, "$1")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Show comments for non-pending decisions too (read-only) */}
                  {!isPending && (decision.comments ?? []).length > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                      {(decision.comments ?? []).map((comment, index) => (
                        <div
                          key={`${decision._id}-comment-${index}`}
                          className="rounded-lg border border-warm-200 bg-white/70 px-3 py-2 text-xs text-warm-600"
                        >
                          <div className="flex items-center justify-between text-[0.6rem] text-warm-400">
                            <span className="font-semibold text-[#D97706]">Jay</span>
                            <span>{timeAgo(comment.createdAt)}</span>
                          </div>
                          <p className="mt-1 text-xs text-warm-600 whitespace-pre-wrap">
                            {comment.text
                              .replace(/\*\*(.+?)\*\*/g, "$1")
                              .replace(/\*(.+?)\*/g, "$1")
                              .replace(/`(.+?)`/g, "$1")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAgentFilter("all")}
              className={`pill ${agentFilter === "all" ? "!border-[#D97706] !bg-[#FEF3C7] !text-[#92400E]" : ""}`}
            >
              All Agents
            </button>
            {(visibleAgents).map((agent) => (
              <button
                key={agent._id}
                type="button"
                onClick={() => setAgentFilter(agent._id.toString())}
                className={`pill ${
                  agentFilter === agent._id.toString()
                    ? "!border-[#D97706] !bg-[#FEF3C7] !text-[#92400E]"
                    : ""
                }`}
              >
                <AgentAvatar name={agent.name} size={24} />
                <span>{agentCounts[agent._id.toString()] ?? 0}</span>
              </button>
            ))}
          </div>
          <form onSubmit={handleSendMessage} className="rounded-lg border border-warm-200 bg-[#FFF7ED] p-2">
            <div className="flex flex-wrap gap-1.5">
              <select
                className="min-w-[140px] flex-1 rounded border border-warm-200 bg-white px-2 py-1 text-[0.65rem]"
                value={messageTaskId}
                onChange={(event) => setMessageTaskId(event.target.value)}
              >
                {filteredTasks?.length === 0 && <option value="">No tasks available</option>}
                {(filteredTasks ?? []).map((task) => (
                  <option key={task._id} value={task._id.toString()}>
                    {task.title}
                  </option>
                ))}
              </select>
              <select
                className="min-w-[100px] flex-1 rounded border border-warm-200 bg-white px-2 py-1 text-[0.65rem]"
                value={messageAgentId}
                onChange={(event) => setMessageAgentId(event.target.value)}
              >
                {agents?.length === 0 && <option value="">No agents available</option>}
                {(visibleAgents).map((agent) => (
                  <option key={agent._id} value={agent._id.toString()}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative mt-1.5">
              <textarea
                ref={messageInputRef}
                className="min-h-[56px] w-full rounded border border-warm-200 bg-white px-2 py-1.5 text-xs"
                placeholder="Write an update… Use @ to mention an agent."
                value={messageContent}
                onChange={handleMessageChange}
                onKeyDown={(e) => {
                  if (showMentions && mentionOptions.length > 0 && (e.key === "Enter" || e.key === "Tab")) {
                    e.preventDefault();
                    handleMentionSelect(mentionOptions[0]);
                  }
                }}
              />
              {showMentions && (
                <div className="absolute left-0 top-full z-10 mt-2 w-full rounded-lg border border-warm-200 bg-white shadow-card">
                  {mentionOptions.length === 0 && (
                    <div className="px-3 py-2 text-xs text-warm-500">No matches</div>
                  )}
                  {mentionOptions.map((agent, i) => (
                    <button
                      key={agent._id}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleMentionSelect(agent);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-warm-700 transition hover:bg-[#FFF7ED] ${i === 0 ? "bg-[#FFF7ED]" : ""}`}
                    >
                      <AgentAvatar name={agent.name} size={20} />
                      <span className="font-semibold">{agent.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-end">
              <button
                type="submit"
                disabled={!canSendMessage}
                className={`rounded-full px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white ${
                  canSendMessage ? "bg-[#D97706] hover:bg-[#C56A05]" : "cursor-not-allowed bg-[#D6D3D1]"
                }`}
              >
                Post
              </button>
            </div>
          </form>
          {renderActivityCards(
            feedActivities,
            "No activity yet. Updates will appear as missions progress.",
          )}
        </>
      )}
    </div>
  );

  const statusFeedContent = (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-2">
      {renderActivityCards(
        statusActivities,
        "No status changes yet. Agent state updates will appear here.",
      )}
    </div>
  );

  const workspaceCronList = cronState?.crons ?? [];
  const cronIsRunning = cronState?.allEnabled ?? false;
  const cronHasPaused = workspaceCronList.some((c: Record<string, unknown>) => !c.enabled);
  const cronLabel = cronIsRunning ? "Crons: Running" : "Crons: Paused";
  const cronAccent = cronIsRunning
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
  const cronDot = cronIsRunning ? "bg-emerald-500" : "bg-amber-500";

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-white text-warm-900">
      <div className="flex w-full flex-1 flex-col gap-0">
        {/* Workspace Switcher */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-warm-100 bg-warm-50">
          <div className="flex items-center gap-2">
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-warm-400">Workspace</span>
            <div className="flex items-center gap-1 ml-2">
              <button
                type="button"
                onClick={() => setActiveWorkspace("main")}
                className={`rounded-full px-3 py-1 text-[0.65rem] font-semibold transition ${
                  activeWorkspace === "main"
                    ? "bg-[#D97706] text-white"
                    : "bg-warm-100 text-warm-500 hover:bg-warm-200"
                }`}
              >
                Personal
              </button>
              <button
                type="button"
                onClick={() => setActiveWorkspace("dashpane")}
                className={`rounded-full px-3 py-1 text-[0.65rem] font-semibold transition ${
                  activeWorkspace === "dashpane"
                    ? "bg-[#D97706] text-white"
                    : "bg-warm-100 text-warm-500 hover:bg-warm-200"
                }`}
              >
                DashPane Launch
              </button>
            </div>
          </div>
          {/* Agents active + tasks in queue — moved here from header */}
          <div className="flex items-center gap-4 pr-1">
            <div className="flex items-center gap-1.5">
              <AnimatedCounter value={activeAgents.length} className="text-sm font-bold tabular-nums text-warm-700" />
              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-warm-400">Agents Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AnimatedCounter value={tasksInQueue.length} className="text-sm font-bold tabular-nums text-warm-700" />
              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-warm-400">Tasks in Queue</span>
            </div>
          </div>
        </div>
        <header className="flex items-center justify-between border-b border-warm-200 bg-white px-4 py-3">
          <div className="flex flex-col">
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-warm-400">CITADEL</span>
            <h1 className="text-lg font-semibold tracking-tight">
              {activeWorkspace === "dashpane" ? "DashPane Mission Control" : "Personal Dashboard"}
            </h1>
            {activeWorkspace === "dashpane" && (
              <span className="mt-0.5 text-[0.65rem] font-semibold text-[#D97706]">
                🎯 Goal: $1K MRR — DashPane launched March 27
              </span>
            )}
          </div>
          {/* Revenue metrics */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums text-[#16A34A]">
                {revenueMetrics != null
                  ? `$${revenueMetrics.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : "—"}
              </p>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-warm-400">Revenue</p>
            </div>
            <div className="text-center">
              <AnimatedCounter
                value={revenueMetrics?.sales ?? 0}
                className="text-2xl font-bold tabular-nums"
              />
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-warm-400">Sales</p>
            </div>
            <div className="text-center">
              <AnimatedCounter
                value={revenueMetrics?.activated ?? 0}
                className="text-2xl font-bold tabular-nums"
              />
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-warm-400">Activated</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {cronState && (
              <div className="relative">
                <div
                  className={`flex w-full flex-col gap-1 rounded-xl border px-3 py-2 text-left text-xs font-semibold shadow-sm transition ${
                    cronAccent
                  } ${cronLoading ? "cursor-not-allowed opacity-70" : "hover:shadow-card"}`}
                >
                  <button
                    type="button"
                    onClick={() => setCronExpanded((prev) => !prev)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                    title="Click to expand individual cron toggles"
                    aria-expanded={cronExpanded}
                  >
                    <span className="flex items-center gap-2 uppercase tracking-[0.2em]">
                      <span className={`h-2.5 w-2.5 rounded-full ${cronLoading ? "bg-yellow-400 animate-pulse" : cronDot}`} />
                      <span>{cronLoading ? "Syncing..." : cronLabel}</span>
                    </span>
                    <span className="text-[0.65rem] font-semibold text-amber-700">
                      {cronExpanded ? "^" : "v"}
                    </span>
                  </button>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1">
                      {workspaceCronList.map((c) => (
                        <span
                          key={c.id}
                          title={`${c.label}: ${c.enabled ? "running" : "paused"}`}
                          className={`inline-block h-1.5 w-1.5 rounded-full ${c.enabled ? "bg-emerald-400" : "bg-red-400"}`}
                        />
                      ))}
                      <span className="ml-1 text-[0.6rem] font-medium text-warm-500">
                        {workspaceCronList.filter((c: Record<string, unknown>) => c.enabled).length} active
                      </span>
                    </div>
                    {(cronIsRunning || cronHasPaused) && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCronToggle();
                        }}
                        disabled={cronLoading}
                        className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-amber-700 transition hover:border-amber-300"
                        title={cronIsRunning ? "Pause all crons" : "Resume all paused crons"}
                        aria-busy={cronLoading}
                      >
                        {cronIsRunning ? "Pause all" : "Resume all"}
                      </button>
                    )}
                  </div>
                </div>
                {cronExpanded && (
                  <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-amber-200 bg-[#FFFBF2] p-3 shadow-lg">
                    <div className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-amber-700">
                      Individual Crons
                    </div>
                    <div className="flex flex-col gap-2">
                      {(activeWorkspace === "main" ? CRON_EMPLOYEES_MAIN : CRON_EMPLOYEES_DASHPANE).map((employee) => {
                        const cron = cronState.crons.find((c) => c.id?.startsWith(employee.id) || c.label === employee.cronLabel);
                        const enabled = cron?.enabled ?? false;
                        const cronId = cron?.id;
                        const isLoading = cronId ? cronItemLoading === cronId : false;
                        const cronName = cron?.name ?? "No cron configured";

                        return (
                          <div
                            key={employee.id}
                            className="flex items-center justify-between rounded-lg border border-amber-100 bg-white/70 px-2 py-1.5 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-warm-900">
                                {employee.name} <span className="text-[0.65rem] font-normal text-warm-500">({employee.cronLabel})</span>
                              </p>
                              <p className="text-[0.65rem] text-warm-600 truncate">{cronName}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full flex-shrink-0 ${enabled ? "bg-emerald-500" : "bg-red-400"}`} />
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (!cronId) return;
                                  handleCronItemToggle(cronId, !enabled);
                                }}
                                disabled={!cronId || isLoading || cronLoading}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full border transition ${
                                  enabled ? "border-emerald-500 bg-emerald-500" : "border-amber-200 bg-amber-100"
                                } ${isLoading ? "opacity-60" : ""}`}
                                aria-pressed={enabled}
                                title={cronId ? `${enabled ? "Disable" : "Enable"} ${employee.name} cron` : `${employee.name} cron not found`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                                    enabled ? "translate-x-4" : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="text-right">
              <p className="text-lg font-semibold tabular-nums">
                {mounted ? timeString : "-- : -- : --"}
              </p>
              <p className="text-xs text-warm-500">{mounted ? dateString : ""}</p>
            </div>
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" title="Online" />
          </div>
        </header>

        <main className="grid grid-cols-1 gap-0 border-t border-warm-200 bg-white xl:grid-cols-[200px_minmax(0,1fr)_280px]">
          <section className="flex flex-col overflow-hidden xl:border-r xl:border-warm-200">
            <div className="flex h-10 items-center justify-between px-3 border-b border-warm-100">
              <span className="section-title">Jedis</span>
              <span className="rounded-full bg-warm-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-warm-500">
                {visibleAgents.length}
              </span>
            </div>
            <div className="flex flex-col divide-y divide-warm-100 overflow-y-auto px-2">
              {visibleAgents.map((agent) => {
                const isSelected = selectedAgentId === agent._id.toString();
                const lastActiveAt = agent.lastActive ?? 0;
                const lastActiveAge = Date.now() - lastActiveAt;
                // Use status field (pushed by heartbeat) as source of truth for dot color.
                // Fall back to grey only if no heartbeat in 30+ minutes (truly offline).
                const isOffline = lastActiveAge > 30 * 60 * 1000;
                const statusColor = isOffline
                    ? "bg-gray-400"
                    : agent.status === "blocked"
                      ? "bg-red-500"
                      : agent.status === "working"
                        ? "bg-green-500"
                        : "bg-amber-400";
                return (
                  <div
                    key={agent._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedAgentId((prev) =>
                        prev === agent._id.toString() ? null : agent._id.toString(),
                      );
                      setProfileAgentId(agent._id.toString());
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedAgentId((prev) =>
                          prev === agent._id.toString() ? null : agent._id.toString(),
                        );
                        setProfileAgentId(agent._id.toString());
                      }
                    }}
                    className={`flex cursor-pointer items-center gap-2 px-2 py-3 transition hover:bg-warm-50 ${
                      isSelected ? "border-l-2 border-[#D97706] bg-[#FFFBEB]" : ""
                    }`}
                  >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center text-base">
                    <AgentAvatar name={agent.name} size={32} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-xs font-semibold">{agent.name}</p>
                      {agent.level === "lead" && (
                        <span className={`badge text-[0.6rem] px-1 py-0 ${LEVEL_BADGE[agent.level]}`}>
                          LEAD
                        </span>
                      )}
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusColor}`} />
                    </div>
                    <p className="truncate text-[0.65rem] text-warm-500">{agent.role}</p>
                    <p className="truncate text-[0.6rem] text-warm-400">Last seen {timeAgo(lastActiveAt)}</p>
                  </div>
                </div>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col overflow-hidden xl:border-r xl:border-warm-200">
            <div className="flex h-10 items-center justify-between px-3 border-b border-warm-100">
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
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowNotifications((prev) => !prev)}
                    className="relative flex h-7 w-7 items-center justify-center rounded-full border border-warm-200 bg-white text-warm-600 transition hover:border-[#D97706] hover:text-[#D97706]"
                    aria-label="Toggle notifications"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path d="M12 22a2.5 2.5 0 0 0 2.4-2h-4.8A2.5 2.5 0 0 0 12 22Z" />
                      <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2Z" />
                    </svg>
                    {notificationCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#EF4444] px-1 text-[0.55rem] font-semibold text-white">
                        {notificationCount}
                      </span>
                    )}
                  </button>
                  {showNotifications && (
                    <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-lg border border-warm-200 bg-white shadow-card">
                      <div className="flex items-center justify-between border-b border-warm-100 px-3 py-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-warm-500">
                          Notifications
                        </span>
                        <button
                          type="button"
                          onClick={handleMarkAllNotificationsRead}
                          className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-warm-500 hover:text-[#D97706]"
                        >
                          Mark all read
                        </button>
                      </div>
                      <div className="flex items-center gap-2 border-b border-warm-100 px-3 py-2">
                        {(visibleAgents).map((agent) => {
                          const isSelected = selectedNotificationAgentId === agent._id.toString();
                          return (
                            <button
                              key={agent._id}
                              type="button"
                              onClick={() =>
                                setSelectedNotificationAgentId((prev) =>
                                  prev === agent._id.toString() ? null : agent._id.toString(),
                                )
                              }
                              className={`rounded-full transition ${
                                isSelected ? "ring-2 ring-[#D97706] ring-offset-2 ring-offset-white" : ""
                              }`}
                              aria-pressed={isSelected}
                            >
                              <AgentAvatar name={agent.name} size={28} />
                            </button>
                          );
                        })}
                      </div>
                      <div className="max-h-[400px] overflow-y-auto">
                        {filteredNotifications.length === 0 ? (
                          <div className="px-4 py-6 text-center text-xs text-warm-500">
                            No notifications yet.
                          </div>
                        ) : (
                          <div className="flex flex-col divide-y divide-warm-100">
                            {filteredNotifications.map((notification) => (
                              <button
                                key={notification._id}
                                type="button"
                                onClick={() => handleNotificationClick(notification)}
                                className={`flex w-full items-start gap-3 px-3 py-3 text-left transition hover:bg-warm-50 ${
                                  notification.read ? "text-warm-600" : "text-warm-900"
                                }`}
                              >
                                <AgentAvatar name={notification.agentName} size={24} />
                                <div className="flex-1">
                                  <p className={`text-xs ${notification.read ? "" : "font-semibold"}`}>
                                    {notification.message}
                                  </p>
                                  <p className="mt-1 text-[0.6rem] text-warm-500">
                                    {timeAgo(notification.createdAt)}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm((prev) => !prev)}
                  className="rounded-full border border-warm-200 bg-white px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-warm-600 transition hover:border-[#D97706] hover:text-[#D97706]"
                >
                  New Task
                </button>
              </div>
            </div>

            {mainView === "holocron" && (<>
            {showForm && (
              <form onSubmit={handleCreate} className="card flex flex-col gap-3 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                      Title
                    </label>
                    <input
                      className={`w-full rounded-lg border px-3 py-2 text-sm ${
                        titleError ? "border-[#EF4444]" : "border-warm-200"
                      }`}
                      placeholder="Task title"
                      value={title}
                      onChange={(event) => {
                        setTitle(event.target.value);
                        if (titleError && event.target.value.trim()) {
                          setTitleError(false);
                        }
                      }}
                    />
                    {titleError && (
                      <span className="text-[0.65rem] font-semibold text-[#B91C1C]">
                        Title is required.
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                      Priority
                    </label>
                    <select
                      className="w-full rounded-lg border border-warm-200 px-3 py-2 text-sm"
                      value={priority}
                      onChange={(event) => setPriority(event.target.value)}
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                    Description
                  </label>
                  <textarea
                    className="min-h-[90px] w-full rounded-lg border border-warm-200 px-3 py-2 text-sm"
                    placeholder="Description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                      Tags
                    </label>
                    <input
                      className="w-full rounded-lg border border-warm-200 px-3 py-2 text-sm"
                      placeholder="Tags (comma separated)"
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                      Assignees
                    </label>
                    <div className="flex max-h-[120px] flex-wrap gap-2 overflow-y-auto rounded-lg border border-warm-200 bg-white p-2 text-xs">
                      {(visibleAgents).map((agent) => {
                        const checked = assignees.includes(agent._id.toString());
                        return (
                          <label
                            key={agent._id}
                            className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 transition ${
                              checked
                                ? "border-[#D97706] bg-[#FEF3C7] text-[#92400E]"
                                : "border-warm-200 text-warm-600"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={checked}
                              onChange={() => {
                                setAssignees((prev) =>
                                  prev.includes(agent._id.toString())
                                    ? prev.filter((id) => id !== agent._id.toString())
                                    : [...prev, agent._id.toString()],
                                );
                              }}
                            />
                            <AgentAvatar name={agent.name} size={20} />
                            <span>{agent.name}</span>
                          </label>
                        );
                      })}
                      {(agents ?? []).length === 0 && (
                        <span className="text-[0.7rem] text-warm-500">No agents available.</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-warm-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-warm-600"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-full bg-[#D97706] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
                  >
                    Create
                  </button>
                </div>
              </form>
            )}

            <div className="flex flex-1 flex-col gap-3 overflow-y-auto scrollbar-thin">
              {selectedAgentId && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-xs text-[#92400E]">
                  <span>
                    Showing tasks for: <span className="font-semibold">{selectedAgent?.name ?? "Agent"}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedAgentId(null)}
                    className="rounded-full border border-[#FDE68A] bg-white px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#92400E] transition hover:border-[#D97706] hover:text-[#D97706]"
                  >
                    Clear filter
                  </button>
                </div>
              )}
              <div className="grid flex-1 grid-cols-5 gap-2 overflow-x-hidden px-3 py-2">
                {STATUS_COLUMNS.map((column) => (
                  <div key={column.key} className="flex min-w-0 flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full ${column.dot}`} />
                        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-600">{column.label}</span>
                      </div>
                      <span className="rounded-full bg-warm-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-warm-500">
                        {tasksByStatus[column.key]?.length ?? 0}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {(tasksByStatus[column.key] ?? []).map((task) => (
                        <div
                          key={task._id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedTaskId(task._id.toString())}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedTaskId(task._id.toString());
                            }
                          }}
                          className="rounded-lg border border-warm-100 border-l-[3px] border-l-[#D97706] bg-white p-3 shadow-sm transition hover:shadow-md"
                        >
                          <div className="flex flex-col gap-1">
                            <p className="text-[0.8rem] font-semibold leading-snug text-warm-900">{task.title}</p>
                            {task.description && (
                              <p className="text-clamp-2 text-[0.7rem] leading-relaxed text-warm-500">{task.description}</p>
                            )}
                          </div>
                          {(task.tags ?? []).length > 0 && (
                            <div className="mt-2 flex flex-wrap items-center gap-1">
                              {(task.tags ?? []).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded border border-warm-200 bg-warm-50 px-1.5 py-0.5 text-[0.6rem] text-warm-600"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 flex items-center justify-between text-[0.65rem] text-warm-500">
                            <div className="flex items-center gap-1">
                              {(task.assignees ?? []).length === 0 && <span>Unassigned</span>}
                              {(task.assignees ?? []).map((assignee) => (
                                <span key={assignee._id}>
                                  <AgentAvatar name={assignee.name} size={22} />
                                </span>
                              ))}
                            </div>
                            <span>{timeAgo(task.updatedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </>)}
            {mainView === "gods_eye" && (
              <GodsEyeView
                agents={(agents ?? []).map(a => ({ _id: a._id.toString(), name: a.name, role: a.role, status: a.status, avatarEmoji: a.avatarEmoji ?? "🤖", currentTask: a.currentTask, lastActive: a.lastActive }))}
                tasks={(tasks ?? []).map(t => ({
                  _id: t._id.toString(),
                  title: t.title,
                  status: t.status,
                  priority: t.priority,
                  tags: t.tags,
                  workspace: t.workspace,
                  createdAt: t.createdAt,
                  updatedAt: t.updatedAt,
                  assigneeIds: (t.assigneeIds ?? []).map(String),
                  trigger: t.trigger,
                  progress: t.progress,
                  sessionId: t.sessionId,
                  outputSummary: t.outputSummary,
                }))}
                activities={(activities ?? []).map(a => ({ _id: a._id.toString(), agentId: a.agentId?.toString(), action: a.action, targetType: a.targetType, targetId: a.targetId?.toString(), description: a.description, createdAt: a.createdAt, agent: a.agent ? { _id: a.agent._id.toString(), name: a.agent.name, avatarEmoji: a.agent.avatarEmoji ?? "🤖" } : null }))}
                decisions={(decisions ?? []).map(d => ({ _id: d._id.toString(), agentId: d.agentId.toString(), title: d.title, description: d.description, status: d.status, taskId: d.taskId?.toString(), createdAt: d.createdAt, options: d.options, resolution: d.resolution, comments: d.comments, agent: d.agent ? { _id: d.agent._id.toString(), name: d.agent.name, avatarEmoji: d.agent.avatarEmoji ?? "🤖" } : undefined }))}
                cronState={cronState}
                activeWorkspace={activeWorkspace}
                now={now}
                agentFilter={geAgentFilter}
                setAgentFilter={setGeAgentFilter}
                needsJayOnly={geNeedsJayOnly}
                setNeedsJayOnly={setGeNeedsJayOnly}
                onSelectTask={(id) => setSelectedTaskId(id)}
                onSelectAgent={(id) => setProfileAgentId(id)}
                visibleAgentNames={visibleAgents.map(a => a.name)}
                liveStatuses={agentLiveStatuses?.map(s => ({ ...s, agentId: s.agentId as string, _id: s._id as string })) ?? []}
                onDecisionResolve={handleDecisionResolve}
                onDecisionDefer={deferDecision}
                onDecisionCancel={cancelDecision}
                decisionCommentDrafts={decisionCommentDrafts}
                onDecisionCommentChange={handleDecisionCommentChange}
                onDecisionCommentSubmit={handleDecisionCommentSubmit}
              />
            )}
          </section>

          {!selectedAgent ? (
            <section className="flex flex-col" style={{maxHeight: 'calc(100vh - 48px)', overflowY: 'auto'}}>
              <div className="flex h-10 items-center justify-between px-3 border-b border-warm-100">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setRightPanel("feed")} className={`text-[0.65rem] font-semibold uppercase tracking-[0.2em] transition pb-1 ${rightPanel === "feed" ? "text-warm-900 border-b-2 border-[#D97706]" : "text-warm-400"}`}>Activity</button>
                  <button type="button" onClick={() => setRightPanel("docs")} className={`text-[0.65rem] font-semibold uppercase tracking-[0.2em] transition pb-1 ${rightPanel === "docs" ? "text-warm-900 border-b-2 border-[#D97706]" : "text-warm-400"}`}>Docs</button>
                  <button type="button" onClick={() => setRightPanel("status")} className={`text-[0.65rem] font-semibold uppercase tracking-[0.2em] transition pb-1 ${rightPanel === "status" ? "text-warm-900 border-b-2 border-[#D97706]" : "text-warm-400"}`}>Status</button>
                </div>
                {rightPanel === "docs" && (
                <button
                  type="button"
                  onClick={() => setShowDocForm((prev) => !prev)}
                  className="rounded-full border border-warm-200 bg-white px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-warm-600 transition hover:border-[#D97706] hover:text-[#D97706]"
                >
                  + New
                </button>
                )}

              </div>
              {rightPanel === "docs" ? (
              <div className="flex flex-1 flex-col overflow-y-auto">

              <div className="flex flex-col gap-4 px-3 py-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDocTypeFilter("all")}
                    className={`rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] transition ${
                      docTypeFilter === "all"
                        ? "border-[#D97706] bg-[#FEF3C7] text-[#92400E]"
                        : "border-warm-200 text-warm-600"
                    }`}
                  >
                    All
                  </button>
                  {DOCUMENT_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDocTypeFilter(type)}
                      className={`rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] transition ${
                        docTypeFilter === type
                          ? "border-[#D97706] bg-[#FEF3C7] text-[#92400E]"
                          : "border-warm-200 text-warm-600"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {showDocForm && (
                  <form
                    onSubmit={handleCreateDocument}
                    className="rounded-lg border border-warm-200 bg-[#FFF7ED] p-3"
                  >
                    <div className="flex flex-col gap-2">
                      <input
                        className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm"
                        placeholder="Document title"
                        value={docTitle}
                        onChange={(event) => setDocTitle(event.target.value)}
                      />
                      <div className="grid gap-2 md:grid-cols-2">
                        <select
                          className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs"
                          value={docType}
                          onChange={(event) =>
                            setDocType(event.target.value as (typeof DOCUMENT_TYPES)[number])
                          }
                        >
                          {DOCUMENT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </option>
                          ))}
                        </select>
                        <select
                          className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs"
                          value={docAuthorId}
                          onChange={(event) => setDocAuthorId(event.target.value)}
                        >
                          {agents?.length === 0 && <option value="">No agents available</option>}
                          {(visibleAgents).map((agent) => (
                            <option key={agent._id} value={agent._id.toString()}>
                              {agent.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <select
                        className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs"
                        value={docTaskId}
                        onChange={(event) => setDocTaskId(event.target.value)}
                      >
                        <option value="">Link to task (optional)</option>
                        {(tasks ?? []).map((task) => (
                          <option key={task._id} value={task._id.toString()}>
                            {task.title}
                          </option>
                        ))}
                      </select>
                      <textarea
                        className="min-h-[120px] w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm"
                        placeholder="Document content"
                        value={docContent}
                        onChange={(event) => setDocContent(event.target.value)}
                      />
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-warm-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-warm-600"
                        onClick={() => setShowDocForm(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded-full bg-[#D97706] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
                      >
                        Create
                      </button>
                    </div>
                  </form>
                )}

                <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-2 scrollbar-thin">
                  {filteredDocuments.map((doc) => {
                    const isOpen = selectedDocId === doc._id.toString();
                    return (
                      <div key={doc._id} className="rounded-lg border border-warm-200 bg-white p-3">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedDocId((prev) =>
                              prev === doc._id.toString() ? null : doc._id.toString(),
                            )
                          }
                          className="flex w-full items-start justify-between gap-3 text-left"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-warm-900">{doc.title}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-warm-600">
                              <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${DOC_TYPE_BADGE[doc.type]}`}>
                                {doc.type.toUpperCase()}
                              </span>
                              <span className="flex items-center gap-1">
                                {doc.author ? <AgentAvatar name={doc.author.name} size={20} /> : <span className="text-base">📝</span>}
                                <span>{doc.author?.name ?? "Unknown"}</span>
                              </span>
                              <span>{timeAgo(doc.createdAt)}</span>
                            </div>
                          </div>
                          <span className="text-xs text-warm-500">{isOpen ? "Collapse" : "Expand"}</span>
                        </button>
                        {isOpen && (
                          <div className="mt-3">
                            <div className="rounded-lg border border-dashed border-warm-200 bg-[#F5F3EF] p-3 text-sm text-warm-700 whitespace-pre-wrap line-clamp-6">
                              {linkifyContent(doc.content)}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setFullViewDocId(doc._id.toString()); }}
                              className="mt-2 text-xs font-semibold text-amber-700 hover:text-amber-900 transition"
                            >
                              Read full document →
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredDocuments.length === 0 && (
                    <div className="rounded-lg border border-dashed border-warm-200 bg-[#F5F3EF] p-6 text-center text-sm text-warm-600">
                      No documents yet. Create the first one.
                    </div>
                  )}
                </div>
              </div>
              </div>
              ) : rightPanel === "status" ? (
                statusFeedContent
              ) : (
                liveFeedContent
              )}
            </section>
          ) : (
            <section className="flex flex-col gap-3 overflow-y-auto pt-3 pb-3 scrollbar-thin">
              {selectedAgent && panelMeta && (
                <div className="px-3">
                  <div className="card flex flex-col gap-4 border border-warm-200 bg-white p-4">
                    <div
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold ${panelMeta.accent}`}
                    >
                      <div className="flex items-center gap-2">
                        <AgentAvatar name={selectedAgent.name} size={28} />
                        <div>
                          <p className="text-[0.7rem] uppercase tracking-[0.2em]">{selectedAgent.name}</p>
                          <p className="text-[0.7rem] font-normal">{panelMeta.subtitle}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-white/70 px-2 py-1 text-[0.65rem] uppercase tracking-[0.2em]">
                        {panelMeta.title}
                      </span>
                    </div>

                    {panelLoading && (
                      <div className="flex items-center justify-center py-6">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-warm-200 border-t-[#D97706]" />
                      </div>
                    )}

                    {!panelLoading && panelEmpty && (
                      <div className="rounded-lg border border-dashed border-warm-200 bg-[#F5F3EF] p-4 text-center text-xs text-warm-600">
                        No data yet
                      </div>
                    )}

                    {!panelLoading && !panelEmpty && panelData && (
                      <>
                        <div className="grid gap-3 text-[0.7rem] text-warm-700">
                          {panelData.summary.map((item) => {
                            const helper = (item as { helper?: string }).helper;
                            return (
                              <div
                                key={item.label}
                                className="flex items-center justify-between border-b border-dashed border-warm-200 pb-2 last:border-b-0 last:pb-0"
                              >
                                <span className="uppercase tracking-[0.2em] text-warm-500">{item.label}</span>
                                <span className="text-warm-900">
                                  {item.value}
                                  {helper && <span className="ml-2 text-[#D97706]">{helper}</span>}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {panelData.sections.map((section) => (
                          <div key={section.label} className="flex flex-col gap-2">
                            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-warm-500">
                              {section.label}
                            </span>
                            <div className="flex flex-col gap-2">
                              {section.items.map((item, index) => {
                                const secondary = (item as { secondary?: string }).secondary;
                                const tertiary = (item as { tertiary?: string }).tertiary;
                                const status = (item as { status?: string }).status;
                                const tone =
                                  status === "good"
                                    ? "text-[#166534]"
                                    : status === "bad"
                                      ? "text-[#991B1B]"
                                      : status === "warn"
                                        ? "text-[#B45309]"
                                        : "text-warm-700";
                                return (
                                  <div
                                    key={`${item.primary}-${index}`}
                                    className="flex items-center justify-between rounded-lg border border-warm-200 bg-[#F5F3EF] px-3 py-2 text-[0.72rem]"
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-semibold text-warm-900">{item.primary}</span>
                                      {secondary && (
                                        <span className="text-warm-600">{secondary}</span>
                                      )}
                                    </div>
                                    <div className={`text-right ${tone}`}>
                                      {tertiary && <div className="font-semibold">{tertiary}</div>}
                                      {status && !tertiary && <div className="font-semibold">●</div>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between px-3">
                <span className="section-title">Live Feed</span>
                <span className="badge bg-[#DCFCE7] text-[#166534]">Live</span>
              </div>
              {liveFeedContent}
            </section>
          )}
        </main>
      </div>

      {profileAgent && profileAgentId && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button
            type="button"
            aria-label="Close agent profile"
            onClick={() => setProfileAgentId(null)}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          />
          <aside className="relative z-50 flex h-full w-full max-w-[480px] flex-col gap-4 overflow-y-auto border-l border-warm-200 bg-[#FFFCF7] p-6 shadow-2xl animate-slide-in-right">
            {/* Close button */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <AgentAvatar name={profileAgent.name} size={56} />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#FFFCF7] ${
                      profileAgent.status === "working"
                        ? "bg-green-500"
                        : profileAgent.status === "blocked"
                          ? "bg-red-500"
                          : "bg-gray-400"
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-warm-900">{profileAgent.name}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.2em] ${LEVEL_BADGE[profileAgent.level]}`}>
                      {profileAgent.level}
                    </span>
                  </div>
                  <p className="text-sm text-warm-500">{profileAgent.role}</p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.15em] ${STATUS_BADGE[profileAgent.status]}`}>
                    {profileAgent.status}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileAgentId(null)}
                className="rounded-full border border-warm-200 bg-white px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-600 transition hover:border-[#D97706] hover:text-[#D97706]"
              >
                ✕
              </button>
            </div>

            {/* Bio (DashPane workspace only) */}
            {activeWorkspace === "dashpane" && AGENT_BIOS[profileAgent.name] && (
              <div className="rounded-lg border border-warm-200 bg-white p-3">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-warm-500">Bio</span>
                <p className="mt-1 text-sm text-warm-700 leading-relaxed">{AGENT_BIOS[profileAgent.name]}</p>
              </div>
            )}

            {/* Stats row */}
            {profileStats && (
              <div className="grid grid-cols-4 gap-3">
                <div className="flex flex-col items-center rounded-lg border border-warm-200 bg-white p-3">
                  <span className="text-xl font-bold tabular-nums text-warm-900">{profileStats.tasksCompleted}</span>
                  <span className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-warm-500">Tasks done</span>
                </div>
                <div className="flex flex-col items-center rounded-lg border border-warm-200 bg-white p-3">
                  <span className="text-xl font-bold tabular-nums text-warm-900">{profileStats.documentsCreated}</span>
                  <span className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-warm-500">Docs</span>
                </div>
                <div className="flex flex-col items-center rounded-lg border border-warm-200 bg-white p-3">
                  <span className="text-xl font-bold tabular-nums text-warm-900">{profileStats.commentsPosted}</span>
                  <span className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-warm-500">Comments</span>
                </div>
                <div className="flex flex-col items-center rounded-lg border border-warm-200 bg-white p-3">
                  <span className="text-[0.75rem] font-semibold tabular-nums text-warm-900">{timeAgo(profileStats.lastActive)}</span>
                  <span className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-warm-500">Last active</span>
                </div>
              </div>
            )}

            {/* Current task */}
            {profileStats?.currentTask && (
              <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#92400E]">Currently working on</span>
                <p className="mt-1 text-sm font-medium text-warm-900">{profileStats.currentTask}</p>
                {profileStats.currentTasks.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {profileStats.currentTasks.map((t) => (
                      <button
                        key={t._id}
                        type="button"
                        onClick={() => {
                          setSelectedTaskId(t._id.toString());
                          setProfileAgentId(null);
                        }}
                        className="text-left text-xs text-[#D97706] hover:underline"
                      >
                        → {t.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Work history */}
            <div className="card flex flex-col gap-3 border border-warm-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-warm-500">Work History</span>
                <span className="rounded-full bg-warm-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-warm-500">
                  {profileStats?.completedHistory.length ?? 0}
                </span>
              </div>
              <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto scrollbar-thin">
                {(profileStats?.completedHistory ?? []).map((task) => (
                  <button
                    key={task._id}
                    type="button"
                    onClick={() => {
                      setSelectedTaskId(task._id.toString());
                      setProfileAgentId(null);
                    }}
                    className="flex items-center justify-between rounded-lg border border-warm-100 bg-[#F5F3EF] px-3 py-2 text-left hover:border-[#D97706] transition"
                  >
                    <span className="text-xs font-medium text-warm-800 truncate flex-1 mr-2">{task.title}</span>
                    <span className="text-[0.6rem] text-warm-500 shrink-0">{timeAgo(task.updatedAt)}</span>
                  </button>
                ))}
                {(profileStats?.completedHistory ?? []).length === 0 && (
                  <div className="text-center text-xs text-warm-500 py-3">No completed tasks yet.</div>
                )}
              </div>
            </div>

            {/* Recent documents */}
            <div className="card flex flex-col gap-3 border border-warm-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-warm-500">Recent Documents</span>
                <span className="rounded-full bg-warm-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-warm-500">
                  {profileDocuments?.length ?? 0}
                </span>
              </div>
              <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto scrollbar-thin">
                {(profileDocuments ?? []).map((doc) => (
                  <button
                    key={doc._id}
                    type="button"
                    onClick={() => setFullViewDocId(doc._id.toString())}
                    className="flex w-full items-center justify-between rounded-lg border border-warm-100 bg-[#F5F3EF] px-3 py-2 cursor-pointer transition hover:bg-warm-50 hover:border-warm-200 text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`rounded-full px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase ${DOC_TYPE_BADGE[doc.type]}`}>
                        {doc.type}
                      </span>
                      <span className="text-xs font-medium text-warm-800 truncate">{doc.title}</span>
                    </div>
                    <span className="text-[0.6rem] text-warm-500 shrink-0 ml-2">{timeAgo(doc.createdAt)}</span>
                  </button>
                ))}
                {(profileDocuments ?? []).length === 0 && (
                  <div className="text-center text-xs text-warm-500 py-3">No documents yet.</div>
                )}
              </div>
            </div>

            {/* Recent activity */}
            <div className="card flex flex-col gap-3 border border-warm-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-warm-500">Recent Activity</span>
                <span className="badge bg-[#DCFCE7] text-[#166534]">Live</span>
              </div>
              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto scrollbar-thin">
                {(profileActivities ?? []).map((activity) => (
                  <div key={activity._id} className="flex gap-2 rounded-lg border border-warm-100 bg-[#F5F3EF] px-3 py-2">
                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#16A34A] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-warm-800">{activity.description}</p>
                      <p className="mt-0.5 text-[0.6rem] text-warm-500">{timeAgo(activity.createdAt)}</p>
                    </div>
                  </div>
                ))}
                {(profileActivities ?? []).length === 0 && (
                  <div className="text-center text-xs text-warm-500 py-3">No recent activity.</div>
                )}
              </div>
            </div>

            {/* DM box (DashPane workspace only) */}
            {activeWorkspace === "dashpane" && AGENT_SESSION_KEYS[profileAgent.name] && (
              <div className="card flex flex-col gap-2 border border-warm-200 bg-white p-4">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-warm-500">Direct Message</span>
                <textarea
                  className="min-h-[70px] w-full rounded-lg border border-warm-200 bg-[#FFFBF5] px-3 py-2 text-sm"
                  placeholder={`Message ${profileAgent.name}...`}
                  value={dmText}
                  onChange={(e) => setDmText(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  {dmSent && (
                    <span className="text-xs font-semibold text-green-600">Sent ✓</span>
                  )}
                  {!dmSent && <span />}
                  <button
                    type="button"
                    disabled={!dmText.trim() || dmSending}
                    onClick={() => handleSendDm(profileAgent.name)}
                    className={`rounded-full px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white ${
                      dmText.trim() && !dmSending
                        ? "bg-[#D97706] hover:bg-[#C56A05]"
                        : "cursor-not-allowed bg-[#D6D3D1]"
                    }`}
                  >
                    {dmSending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button
            type="button"
            aria-label="Close task detail"
            onClick={() => { setIsTaskExpanded(false); setSelectedTaskId(null); }}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          />
          <aside className={`relative z-50 flex h-full flex-col gap-4 overflow-y-auto border-l border-warm-200 bg-[#FFFCF7] p-6 shadow-2xl transition-all duration-300 ${isTaskExpanded ? "w-full max-w-full" : "w-full max-w-[520px]"}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <span className="section-title">Task Detail</span>
                <h2
                  className="text-2xl font-semibold text-warm-900 cursor-text rounded px-1 -mx-1 hover:bg-warm-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const newTitle = e.currentTarget.textContent?.trim();
                    if (newTitle && newTitle !== selectedTask.title) {
                      updateTask({ id: selectedTask._id, title: newTitle });
                    }
                  }}
                >{selectedTask.title}</h2>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`badge ${TASK_STATUS_BADGE[selectedTask.status]}`}>
                    {selectedTask.status.replace("_", " ").toUpperCase()}
                  </span>
                  <span className={`badge ${PRIORITY_BADGE[selectedTask.priority]}`}>
                    {selectedTask.priority.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTaskExpanded((v) => !v)}
                  title={isTaskExpanded ? "Collapse panel" : "Expand to full width"}
                  className="rounded-full border border-warm-200 bg-white px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-600 transition hover:border-[#D97706] hover:text-[#D97706]"
                >
                  {isTaskExpanded ? "⤡" : "⤢"}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsTaskExpanded(false); setSelectedTaskId(null); }}
                  className="rounded-full border border-warm-200 bg-white px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-600 transition hover:border-[#D97706] hover:text-[#D97706]"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="card flex flex-col gap-4 border border-warm-200 bg-white p-4 shadow-card">
              <div className="flex flex-col gap-2 text-sm text-warm-700">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                  Description
                </span>
                <p
                  className="whitespace-pre-wrap cursor-text rounded px-1 -mx-1 hover:bg-warm-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[2em]"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const newDesc = e.currentTarget.textContent?.trim() ?? "";
                    if (newDesc !== (selectedTask.description ?? "")) {
                      updateTask({ id: selectedTask._id, description: newDesc });
                    }
                  }}
                >{selectedTask.description?.trim() ? selectedTask.description : "No description yet."}</p>
              </div>

              <div className="grid gap-3 text-xs text-warm-600">
                <div className="flex items-center justify-between">
                  <span className="uppercase tracking-[0.2em] text-warm-500">Status</span>
                  <select
                    className="rounded-full border border-warm-200 bg-white px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-600"
                    value={selectedTask.status}
                    onChange={(event) =>
                      updateTaskStatus({
                        id: selectedTask._id,
                        status: event.target.value as (typeof STATUS_COLUMNS)[number]["key"],
                        agentId: detailMessageAgentId
                          ? (detailMessageAgentId as Id<"agents">)
                          : undefined,
                      })
                    }
                  >
                    {STATUS_COLUMNS.map((status) => (
                      <option key={status.key} value={status.key}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="uppercase tracking-[0.2em] text-warm-500">Created</span>
                  <span>{dateTimeFormatter.format(selectedTask.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="uppercase tracking-[0.2em] text-warm-500">Updated</span>
                  <span>{dateTimeFormatter.format(selectedTask.updatedAt)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                  Assignees
                </span>
                <div className="flex flex-wrap gap-2">
                  {(selectedTask.assignees ?? []).length === 0 && (
                    <span className="text-xs text-warm-500">Unassigned</span>
                  )}
                  {(selectedTask.assignees ?? []).map((assignee) => (
                    <div
                      key={assignee._id}
                      className="group relative cursor-pointer"
                      title={assignee.name}
                      onClick={() => {
                        const newIds = selectedTask.assigneeIds.filter((id: string) => id !== assignee._id) as Id<"agents">[];
                        updateTask({ id: selectedTask._id, assigneeIds: newIds });
                      }}
                    >
                      <AgentAvatar name={assignee.name} size={36} />
                      <span className="absolute inset-0 hidden group-hover:flex items-center justify-center rounded-full bg-black/40 text-white text-sm font-bold">×</span>
                    </div>
                  ))}
                  <select
                    className="rounded-full border border-dashed border-warm-300 bg-white px-3 py-1 text-[0.65rem] text-warm-500 cursor-pointer"
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const newIds = [...selectedTask.assigneeIds, e.target.value as Id<"agents">];
                      updateTask({ id: selectedTask._id, assigneeIds: newIds });
                      e.target.value = "";
                    }}
                  >
                    <option value="">+ Add</option>
                    {visibleAgents
                      .filter((a) => !selectedTask.assigneeIds.includes(a._id))
                      .map((a) => (
                        <option key={a._id} value={a._id}>{a.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                  Tags
                </span>
                <div className="flex flex-wrap gap-2">
                  {(selectedTask.tags ?? []).length === 0 && (
                    <span className="text-xs text-warm-500">No tags yet.</span>
                  )}
                  {(selectedTask.tags ?? []).map((tag) => (
                    <span
                      key={tag}
                      className="group flex items-center gap-1 rounded-full bg-[#F5F3EF] px-2 py-1 text-[0.65rem] font-semibold text-warm-600"
                    >
                      {tag}
                      <button
                        type="button"
                        className="hidden group-hover:inline text-warm-400 hover:text-red-500"
                        onClick={() => {
                          const newTags = (selectedTask.tags ?? []).filter((t: string) => t !== tag);
                          updateTask({ id: selectedTask._id, tags: newTags });
                        }}
                      >×</button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="+ tag"
                    className="w-16 rounded-full border border-dashed border-warm-300 bg-white px-2 py-1 text-[0.65rem] text-warm-600 outline-none focus:w-24 focus:border-amber-400 transition-all"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = e.currentTarget.value.trim();
                        if (val && !(selectedTask.tags ?? []).includes(val)) {
                          updateTask({ id: selectedTask._id, tags: [...(selectedTask.tags ?? []), val] });
                        }
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                  Subscribers
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {taskSubscribers.length === 0 && (
                    <span className="text-xs text-warm-500">No subscribers yet.</span>
                  )}
                  {taskSubscribers.map((agent) => (
                    <div
                      key={agent._id}
                      className="group relative cursor-pointer"
                      title={`${agent.name} (click to unsubscribe)`}
                      onClick={() => unsubscribeAgent({ agentId: agent._id, taskId: selectedTask._id })}
                    >
                      <AgentAvatar name={agent.name} size={36} />
                      <span className="absolute inset-0 hidden group-hover:flex items-center justify-center rounded-full bg-black/40 text-white text-sm font-bold">×</span>
                    </div>
                  ))}
                  <select
                    className="rounded-full border border-dashed border-warm-300 bg-white px-3 py-1 text-[0.65rem] text-warm-500 cursor-pointer"
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      subscribeAgent({ agentId: e.target.value as Id<"agents">, taskId: selectedTask._id });
                      e.target.value = "";
                    }}
                  >
                    <option value="">+ Add</option>
                    {visibleAgents
                      .filter((a) => !taskSubscribers.some((s) => s._id === a._id))
                      .map((a) => (
                        <option key={a._id} value={a._id}>{a.name}</option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Trigger Source */}
            {selectedTask.trigger && (
              <div className="card flex flex-col gap-2 border border-warm-200 bg-white p-4 shadow-card">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">Trigger</span>
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider border ${
                    selectedTask.trigger.source === "telegram" ? "bg-blue-50 text-blue-700 border-blue-200" :
                    selectedTask.trigger.source === "cron" ? "bg-purple-50 text-purple-700 border-purple-200" :
                    selectedTask.trigger.source === "decision" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    selectedTask.trigger.source === "comment" ? "bg-green-50 text-green-700 border-green-200" :
                    selectedTask.trigger.source === "mention" ? "bg-pink-50 text-pink-700 border-pink-200" :
                    "bg-warm-50 text-warm-700 border-warm-200"
                  }`}>{selectedTask.trigger.source}</span>
                  {selectedTask.trigger.ref && (
                    <span className="text-[0.6rem] text-warm-500 font-mono">{selectedTask.trigger.ref}</span>
                  )}
                </div>
                {selectedTask.trigger.text && (
                  <p className="text-xs text-warm-700 bg-warm-50 rounded p-2 mt-1 italic">&ldquo;{selectedTask.trigger.text}&rdquo;</p>
                )}
              </div>
            )}

            {/* Progress Timeline */}
            {selectedTask.progress && selectedTask.progress.length > 0 && (
              <div className="card flex flex-col gap-2 border border-warm-200 bg-white p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">Progress</span>
                  <span className="badge bg-[#F3F4F6] text-[#6B7280]">{selectedTask.progress.length}</span>
                </div>
                <div className="flex flex-col gap-0 max-h-[200px] overflow-y-auto">
                  {selectedTask.progress.map((p: { text: string; timestamp: number; agentId?: string }, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 py-1.5 border-l-2 border-warm-200 pl-3 ml-1">
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs text-warm-800">{p.text}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[0.55rem] font-mono text-warm-400">
                            {new Date(p.timestamp + 5.5 * 60 * 60 * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })} IST
                          </span>
                          {p.agentId && (
                            <span className="text-[0.55rem] text-warm-500">
                              {(agents ?? []).find(a => a._id.toString() === p.agentId)?.name ?? p.agentId.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Output Summary */}
            {selectedTask.outputSummary && (
              <div className="card flex flex-col gap-2 border border-green-200 bg-green-50 p-4 shadow-card">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-green-700">Output</span>
                <p className="text-sm text-green-900">{selectedTask.outputSummary}</p>
              </div>
            )}

            <div className="card flex flex-col gap-3 border border-warm-200 bg-white p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="section-title">Comments</span>
                <span className="badge bg-[#F3F4F6] text-[#6B7280]">{taskMessages?.length ?? 0}</span>
              </div>
              <div className="flex max-h-[280px] flex-col gap-3 overflow-y-auto pr-1 scrollbar-thin">
                {(taskMessages ?? []).map((message) => (
                  <div key={message._id} id={`comment-${message._id}`} ref={scrollToCommentId === message._id.toString() ? (el) => { if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); setScrollToCommentId(null); } } : null} className={`flex gap-3 rounded-lg border p-3 ${scrollToCommentId === message._id.toString() ? "border-[#D97706] bg-amber-50" : "border-warm-200 bg-[#FFFBF5]"}`}>
                    <div className="flex items-center justify-center shrink-0">
                      {message.agent ? <AgentAvatar name={message.agent.name} size={32} /> : <span className="text-lg">💬</span>}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs text-warm-500">
                        <span className="font-semibold text-warm-800">
                          {message.agent?.name ?? "Unknown"}
                        </span>
                        <span>{timeAgo(message.createdAt)}</span>
                      </div>
                      <div className="mt-2 text-sm text-warm-800">{renderMarkdown(message.content)}</div>
                    </div>
                  </div>
                ))}
                {(taskMessages ?? []).length === 0 && (
                  <div className="rounded-lg border border-dashed border-warm-200 bg-[#F5F3EF] p-4 text-center text-sm text-warm-600">
                    No comments yet. Start the thread.
                  </div>
                )}
              </div>

              <form onSubmit={handleSendDetailMessage} className="rounded-lg border border-warm-200 bg-[#FFF7ED] p-3">
                <div className="flex flex-wrap gap-2">
                  <select
                    className="min-w-[160px] flex-1 rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs"
                    value={detailMessageAgentId}
                    onChange={(event) => setDetailMessageAgentId(event.target.value)}
                  >
                    {agents?.length === 0 && <option value="">No agents available</option>}
                    {(visibleAgents).map((agent) => (
                      <option key={agent._id} value={agent._id.toString()}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="relative mt-2">
                  <textarea
                    ref={detailMessageInputRef}
                    className="min-h-[80px] w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm"
                    placeholder="Write a comment… Use @ to mention an agent."
                    value={detailMessageContent}
                    onChange={handleDetailMessageChange}
                    onKeyDown={(e) => {
                      if (showDetailMentions && detailMentionOptions.length > 0 && (e.key === "Enter" || e.key === "Tab")) {
                        e.preventDefault();
                        handleDetailMentionSelect(detailMentionOptions[0]);
                      }
                    }}
                  />
                  {showDetailMentions && (
                    <div className="absolute left-0 top-full z-10 mt-2 w-full rounded-lg border border-warm-200 bg-white shadow-card">
                      {detailMentionOptions.length === 0 && (
                        <div className="px-3 py-2 text-xs text-warm-500">No matches</div>
                      )}
                      {detailMentionOptions.map((agent, i) => (
                        <button
                          key={agent._id}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleDetailMentionSelect(agent);
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-warm-700 transition hover:bg-[#FFF7ED] ${i === 0 ? "bg-[#FFF7ED]" : ""}`}
                        >
                          <AgentAvatar name={agent.name} size={20} />
                          <span className="font-semibold">{agent.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  
                  <button
                    type="submit"
                    disabled={!canSendDetailMessage}
                    className={`rounded-full px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white ${
                      canSendDetailMessage
                        ? "bg-[#D97706] hover:bg-[#C56A05]"
                        : "cursor-not-allowed bg-[#D6D3D1]"
                    }`}
                  >
                    Post
                  </button>
                </div>
              </form>
            </div>

            <button
              type="button"
              onClick={handleDeleteTask}
              className="w-full rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-red-600 transition hover:border-red-400 hover:text-red-700"
            >
              Delete Task
            </button>
          </aside>
        </div>
      )}

      {/* Full Document Reader Modal */}
      {fullViewDocId && (() => {
        const allDocs = [...(filteredDocuments ?? []), ...(profileDocuments ?? [])];
        const doc = allDocs.find((d) => d._id.toString() === fullViewDocId);
        if (!doc) return null;
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setFullViewDocId(null)}>
            <div className="relative mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-warm-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-start justify-between border-b border-warm-100 px-6 py-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-warm-900 leading-tight">{doc.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-warm-600">
                    <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase ${DOC_TYPE_BADGE[doc.type]}`}>
                      {doc.type}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {doc.author ? <AgentAvatar name={doc.author.name} size={22} /> : <span className="text-base">📝</span>}
                      <span className="font-medium">{doc.author?.name ?? "Unknown"}</span>
                    </span>
                    <span className="text-warm-500">{timeAgo(doc.createdAt)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFullViewDocId(null)}
                  className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-warm-500 transition hover:bg-warm-100 hover:text-warm-700"
                >
                  ✕
                </button>
              </div>
              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-5 text-sm leading-relaxed scrollbar-thin">
                {renderMarkdown(doc.content)}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
