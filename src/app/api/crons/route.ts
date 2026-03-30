import { NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENCLAW_BIN = "/home/ubuntu/.npm-global/bin/openclaw";
const OPENCLAW_CRON_JOBS_FILE = "/home/ubuntu/.openclaw/cron/jobs.json";
const OPENCLAW_CRON_RUNS_DIR = "/home/ubuntu/.openclaw/cron/runs";
const CITADEL_PUSH_PREFIX = "citadel-push-";
const DP_CITADEL_PREFIX = "dp-citadel-";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function runOpenclaw(command: string): string {
  // Check if openclaw binary exists — won't be present on Vercel
  const fs = require("fs");
  if (!fs.existsSync(OPENCLAW_BIN)) {
    throw new Error(`OpenClaw binary not found at ${OPENCLAW_BIN}. This API requires local execution.`);
  }
  return execSync(command, {
    encoding: "utf8",
    timeout: 5000,
    env: { ...process.env, PATH: `/home/ubuntu/.npm-global/bin:${process.env.PATH}` },
  });
}

// ---- Legacy text-based parsing (kept for backward compat `crons` array) ----

interface CronRow {
  fullId: string;
  name: string;
  status: string;
}

interface ApiCron {
  id: string;
  name: string;
  label: string;
  enabled: boolean;
  status: string;
  isCitadelPush: boolean;
}

const ANSI_RE = /\u001b\[[0-9;]*m/g;

function sanitizeAnsi(input: string): string {
  return input.replace(ANSI_RE, "");
}

function normalizeStatus(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === "ok" ||
    normalized === "disabled" ||
    normalized === "running" ||
    normalized === "error" ||
    normalized === "idle" ||
    normalized === "skipped"
  ) {
    return normalized;
  }
  return normalized || "unknown";
}

function parseCronLine(line: string): CronRow | null {
  const cleanLine = sanitizeAnsi(line);
  const idMatch = cleanLine.match(/^\s*([0-9a-f-]{36})\s+/i);
  if (!idMatch) return null;

  const fullId = idMatch[1];
  if (!UUID_RE.test(fullId)) return null;
  const lineFromId = cleanLine.slice(cleanLine.indexOf(fullId));

  if (lineFromId.length >= 126) {
    const name = lineFromId.slice(37, 61).trim();
    const status = normalizeStatus(lineFromId.slice(117, 126));
    return { fullId, name, status };
  }

  const afterId = lineFromId.slice(37);
  const cols = afterId.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
  const name = cols[0] ?? "";
  const statusCandidate = cols[4] ?? cols[5] ?? "";
  const status = normalizeStatus(statusCandidate);
  return { fullId, name, status };
}

function parseCronList(output: string): CronRow[] {
  const lines = output.split("\n");
  const results: CronRow[] = [];
  for (const line of lines) {
    const parsed = parseCronLine(line);
    if (parsed) results.push(parsed);
  }
  return results;
}

function mapCronRow(row: CronRow): ApiCron {
  const isCitadelPush = row.name.startsWith(CITADEL_PUSH_PREFIX) || row.name.startsWith(DP_CITADEL_PREFIX);
  const label = row.name.startsWith(DP_CITADEL_PREFIX)
    ? row.name.slice(DP_CITADEL_PREFIX.length)
    : isCitadelPush ? row.name.slice(CITADEL_PUSH_PREFIX.length) : row.name;
  const enabled = row.status !== "disabled";
  return { id: row.fullId, name: row.name, label, enabled, status: row.status, isCitadelPush };
}

function getAllCronsLegacy(): CronRow[] {
  const output = runOpenclaw(`${OPENCLAW_BIN} cron list --all`);
  return parseCronList(output);
}

// ---- Schedule data (JSON-based) ----

interface OpenclawJob {
  id: string;
  name: string;
  agentId?: string;
  enabled?: boolean;
  payload?: { model?: string; kind?: string; agentId?: string };
  schedule?: { kind: string; expr?: string; tz?: string; everyMs?: number };
  state?: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastRunStatus?: string;
    lastStatus?: string;
    lastDurationMs?: number;
    runningAtMs?: number;
  };
}

interface OpenclawRunEntry {
  ts?: number;
  jobId?: string;
  action?: string;
  status?: string;
  summary?: string;
  runAtMs?: number;
  durationMs?: number;
  nextRunAtMs?: number;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
}

interface ScheduleRun {
  ts: number;
  status: string;
  summary: string;
  runAtMs: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface ScheduleJob {
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
}

const MANAGED_CRON_NAMES = new Set([
  "harvey-proactive", "ryan-proactive", "rand-proactive",
  "katy-dashpane", "elon-dashpane",
  "dashpane-license-monitor",
]);
const MAIN_MANAGED_CRON_NAMES = new Set(["security-scan", "morning-package", "daily-standup"]);

function isCitadelJob(name: string): boolean {
  return name.startsWith(DP_CITADEL_PREFIX) || MANAGED_CRON_NAMES.has(name);
}

function isMainJob(name: string): boolean {
  return name.startsWith(CITADEL_PUSH_PREFIX) || MAIN_MANAGED_CRON_NAMES.has(name);
}

// In-memory cache: jobId → { runs, fetchedAt }
const runHistoryCache = new Map<string, { runs: ScheduleRun[]; fetchedAt: number }>();
const RUN_CACHE_TTL_MS = 90 * 1000; // 90 seconds

async function fetchRunHistoryAsync(jobId: string): Promise<ScheduleRun[]> {
  // Return cached if fresh
  const cached = runHistoryCache.get(jobId);
  if (cached && Date.now() - cached.fetchedAt < RUN_CACHE_TTL_MS) {
    return cached.runs;
  }
  try {
    const path = `${OPENCLAW_CRON_RUNS_DIR}/${jobId}.jsonl`;
    if (!fs.existsSync(path)) return cached?.runs ?? [];
    const raw = fs.readFileSync(path, "utf8").trim();
    if (!raw) return cached?.runs ?? [];
    const entries: OpenclawRunEntry[] = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as OpenclawRunEntry);
    const runs = entries
      .filter((e) => e.status)
      .slice(-100)
      .map((e) => ({
        ts: e.ts ?? e.runAtMs ?? 0,
        status: e.status ?? "unknown",
        summary: (e.summary ?? "").trim(),
        runAtMs: e.runAtMs ?? e.ts ?? 0,
        durationMs: e.durationMs ?? 0,
        inputTokens: e.usage?.input_tokens ?? 0,
        outputTokens: e.usage?.output_tokens ?? 0,
        totalTokens: e.usage?.total_tokens ?? 0,
      }));
    runHistoryCache.set(jobId, { runs, fetchedAt: Date.now() });
    return runs;
  } catch {
    return cached?.runs ?? []; // return stale cache on error
  }
}

function formatScheduleExpr(schedule?: OpenclawJob["schedule"]): string {
  if (!schedule) return "";
  if (schedule.kind === "cron") return schedule.expr ?? "";
  if (schedule.kind === "every" && typeof schedule.everyMs === "number") {
    if (schedule.everyMs % 3600000 === 0) return `*/${schedule.everyMs / 3600000}h`;
    if (schedule.everyMs % 60000 === 0) return `*/${schedule.everyMs / 60000}m`;
    return `every ${Math.round(schedule.everyMs / 1000)}s`;
  }
  return "";
}

async function getScheduleData(
  includeHistory = true,
  workspace: "main" | "dashpane" = "dashpane"
): Promise<{ jobs: ScheduleJob[]; fetchedAt: number }> {
  if (!fs.existsSync(OPENCLAW_CRON_JOBS_FILE)) {
    return { jobs: [], fetchedAt: Date.now() };
  }
  const raw = fs.readFileSync(OPENCLAW_CRON_JOBS_FILE, "utf8");
  const parsed = JSON.parse(raw);
  const allJobs: OpenclawJob[] = parsed.jobs ?? [];

  const workspaceJobs = allJobs.filter((j) => (workspace === "main" ? isMainJob(j.name) : isCitadelJob(j.name)));

  // Fetch run histories in parallel only if requested
  let allRunHistories: ScheduleRun[][] = workspaceJobs.map(() => []);
  if (includeHistory) {
    const runHistoryPromises = workspaceJobs.map((j) =>
      j.enabled ? fetchRunHistoryAsync(j.id) : Promise.resolve([] as ScheduleRun[])
    );
    const settled = await Promise.allSettled(runHistoryPromises);
    allRunHistories = settled.map((result) =>
      result.status === "fulfilled" ? result.value : []
    );
  }

  const jobs: ScheduleJob[] = workspaceJobs.map((j, idx) => {
    const state = j.state ?? {};
    const agentId = j.agentId ?? j.payload?.agentId ?? "";
    const agentLabel = AGENT_ID_TO_NAME[agentId] ?? agentId;

    return {
      id: j.id,
      name: j.name,
      agentId,
      agentLabel,
      enabled: j.enabled ?? (state.lastStatus !== "disabled"),
      scheduleExpr: formatScheduleExpr(j.schedule),
      nextRunAtMs: state.nextRunAtMs ?? null,
      lastRunAtMs: state.lastRunAtMs ?? null,
      lastRunStatus: state.lastRunStatus ?? state.lastStatus ?? null,
      lastDurationMs: state.lastDurationMs ?? null,
      isRunning: state.runningAtMs != null,
      runningAtMs: state.runningAtMs ?? null,
      recentRuns: allRunHistories[idx] ?? [],
    };
  });

  return { jobs, fetchedAt: Date.now() };
}

// ---- Handlers ----

export async function GET(request: Request) {
  const url = new URL(request.url);
  const includeHistory = url.searchParams.get("history") === "1";
  const workspace = url.searchParams.get("workspace") === "main" ? "main" : "dashpane";

  const handler = async (): Promise<Response> => {
    // Get schedule data — fast without history (~3s), slow with history (~9s)
    let scheduleData: { jobs: ScheduleJob[]; fetchedAt: number } | null = null;
    try {
      scheduleData = await getScheduleData(includeHistory, workspace);
    } catch {
      // schedule data is best-effort; don't fail the whole response
    }

    // Derive legacy crons from scheduleData (avoids separate slow `cron list --all` call)
    let crons: ApiCron[] = [];
    let allEnabled = false;
    let allDisabled = false;
    if (scheduleData) {
      crons = scheduleData.jobs.map(j => ({
        id: j.id, name: j.name,
        label: j.name.startsWith(DP_CITADEL_PREFIX)
          ? j.name.slice(DP_CITADEL_PREFIX.length)
          : j.name.startsWith(CITADEL_PUSH_PREFIX)
            ? j.name.slice(CITADEL_PUSH_PREFIX.length)
            : j.name,
        enabled: j.enabled, status: j.enabled ? "active" : "disabled",
        isCitadelPush: j.name.startsWith(DP_CITADEL_PREFIX) || j.name.startsWith(CITADEL_PUSH_PREFIX),
      }));
      const managed = crons.filter((c) => (workspace === "main" ? isMainJob(c.name) : isCitadelJob(c.name)));
      allEnabled = managed.length > 0 && managed.every(c => c.enabled);
      allDisabled = managed.length > 0 && managed.every(c => !c.enabled);
    }

    return NextResponse.json({ crons, allEnabled, allDisabled, scheduleData });
  };

  try {
    return await handler();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body?.action;

    if (action === "toggle") {
      const cronId = typeof body?.cronId === "string" ? body.cronId : "";
      const enabled = typeof body?.enabled === "boolean" ? body.enabled : null;

      if (!cronId || enabled === null) {
        return NextResponse.json(
          { ok: false, error: 'Invalid payload. Use { action: "toggle", cronId, enabled }.' },
          { status: 400 },
        );
      }

      if (!UUID_RE.test(cronId)) {
        return NextResponse.json(
          { ok: false, error: "Invalid cron id. Must be a full UUID." },
          { status: 400 },
        );
      }

      const knownCrons = getAllCronsLegacy();
      const cronExists = knownCrons.some((cron) => cron.fullId === cronId);
      if (!cronExists) {
        return NextResponse.json({ ok: false, error: "Unknown cron id." }, { status: 404 });
      }

      const verb = enabled ? "enable" : "disable";
      runOpenclaw(`${OPENCLAW_BIN} cron ${verb} ${cronId}`);

      return NextResponse.json({ ok: true, action: "toggle", cronId, enabled });
    }

    if (action !== "pause" && action !== "resume") {
      return NextResponse.json(
        { ok: false, error: 'Invalid action. Use "pause" or "resume".' },
        { status: 400 },
      );
    }

    const verb = action === "pause" ? "disable" : "enable";
    const errors: string[] = [];
    const allCrons = getAllCronsLegacy();
    const citadelPushCrons = allCrons.filter((cron) => cron.name.startsWith(CITADEL_PUSH_PREFIX));

    if (citadelPushCrons.length === 0) {
      return NextResponse.json({ ok: false, action, error: "No citadel-push crons found." }, { status: 404 });
    }

    for (const cron of citadelPushCrons) {
      try {
        runOpenclaw(`${OPENCLAW_BIN} cron ${verb} ${cron.fullId}`);
      } catch (err) {
        const label = cron.name.slice(CITADEL_PUSH_PREFIX.length) || cron.name;
        errors.push(`${label} (${cron.fullId}): ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ ok: false, action, errors }, { status: 207 });
    }

    return NextResponse.json({ ok: true, action });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
