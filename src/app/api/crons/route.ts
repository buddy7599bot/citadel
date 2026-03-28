import { NextResponse } from "next/server";
import { execSync } from "child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENCLAW_BIN = "/home/ubuntu/.npm-global/bin/openclaw";
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
  return execSync(command, {
    encoding: "utf8",
    timeout: 30000,
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
  agentId: string;
  enabled: boolean;
  schedule?: { kind: string; expr: string; tz?: string };
  state?: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastRunStatus?: string;
    lastDurationMs?: number;
    runningAtMs?: number;
  };
}

interface OpenclawRunEntry {
  ts: number;
  jobId: string;
  action: string;
  status: string;
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

function isCitadelJob(name: string): boolean {
  return name.startsWith(DP_CITADEL_PREFIX) || name.startsWith(CITADEL_PUSH_PREFIX);
}

function fetchRunHistory(jobId: string): ScheduleRun[] {
  try {
    const raw = runOpenclaw(`${OPENCLAW_BIN} cron runs --id ${jobId} --limit 5`);
    const parsed = JSON.parse(sanitizeAnsi(raw));
    const entries: OpenclawRunEntry[] = parsed.entries ?? [];
    return entries
      .filter((e) => e.action === "finished" || e.status)
      .map((e) => ({
        ts: e.ts,
        status: e.status ?? "unknown",
        summary: (e.summary ?? "").trim(),
        runAtMs: e.runAtMs ?? e.ts,
        durationMs: e.durationMs ?? 0,
        inputTokens: e.usage?.input_tokens ?? 0,
        outputTokens: e.usage?.output_tokens ?? 0,
        totalTokens: e.usage?.total_tokens ?? 0,
      }));
  } catch {
    return [];
  }
}

function getScheduleData(): { jobs: ScheduleJob[]; fetchedAt: number } {
  const raw = runOpenclaw(`${OPENCLAW_BIN} cron list --json --all`);
  const parsed = JSON.parse(sanitizeAnsi(raw));
  const allJobs: OpenclawJob[] = parsed.jobs ?? [];

  const citadelJobs = allJobs.filter((j) => isCitadelJob(j.name));

  const jobs: ScheduleJob[] = citadelJobs.map((j) => {
    const state = j.state ?? {};
    const agentLabel = AGENT_ID_TO_NAME[j.agentId] ?? j.agentId;
    const recentRuns = j.enabled ? fetchRunHistory(j.id) : [];

    return {
      id: j.id,
      name: j.name,
      agentId: j.agentId,
      agentLabel,
      enabled: j.enabled,
      scheduleExpr: j.schedule?.expr ?? "",
      nextRunAtMs: state.nextRunAtMs ?? null,
      lastRunAtMs: state.lastRunAtMs ?? null,
      lastRunStatus: state.lastRunStatus ?? null,
      lastDurationMs: state.lastDurationMs ?? null,
      isRunning: state.runningAtMs != null,
      runningAtMs: state.runningAtMs ?? null,
      recentRuns,
    };
  });

  return { jobs, fetchedAt: Date.now() };
}

// ---- Handlers ----

export async function GET() {
  try {
    // Legacy crons array (backward compat)
    const parsed = getAllCronsLegacy();
    const crons = parsed.map(mapCronRow);
    const citadelPushCrons = crons.filter((cron) => cron.isCitadelPush);
    const dpCrons = citadelPushCrons.filter((cron) => cron.name.startsWith(DP_CITADEL_PREFIX));
    const mainCrons = citadelPushCrons.filter((cron) => cron.name.startsWith(CITADEL_PUSH_PREFIX));
    const activeCrons = dpCrons.length > 0 ? dpCrons : mainCrons;
    const allEnabled = activeCrons.length > 0 && activeCrons.every((cron) => cron.enabled);
    const allDisabled = activeCrons.length > 0 && activeCrons.every((cron) => !cron.enabled);

    // Schedule data (rich)
    let scheduleData: { jobs: ScheduleJob[]; fetchedAt: number } | null = null;
    try {
      scheduleData = getScheduleData();
    } catch {
      // schedule data is best-effort; don't fail the whole response
    }

    return NextResponse.json({ crons, allEnabled, allDisabled, scheduleData });
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
