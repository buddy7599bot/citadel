import { NextResponse } from "next/server";
import { execSync } from "child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENCLAW_BIN = "/home/ubuntu/.npm-global/bin/openclaw";
const CITADEL_PUSH_PREFIX = "citadel-push-";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ANSI_RE = /\u001b\[[0-9;]*m/g;

function runOpenclaw(command: string): string {
  return execSync(command, {
    encoding: "utf8",
    timeout: 30000,
    env: { ...process.env, PATH: `/home/ubuntu/.npm-global/bin:${process.env.PATH}` },
  });
}

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

  // OpenClaw prints a fixed-width table:
  // ID(36) Name(24) Schedule(32) Next(10) Last(10) Status(9) Target(9) Agent(10)
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
    if (!parsed) continue;
    results.push(parsed);
  }

  return results;
}

function mapCronRow(row: CronRow): ApiCron {
  const isCitadelPush = row.name.startsWith(CITADEL_PUSH_PREFIX);
  const label = isCitadelPush ? row.name.slice(CITADEL_PUSH_PREFIX.length) : row.name;
  const enabled = row.status !== "disabled";

  return {
    id: row.fullId,
    name: row.name,
    label,
    enabled,
    status: row.status,
    isCitadelPush,
  };
}

function getAllCrons(): CronRow[] {
  const output = runOpenclaw(`${OPENCLAW_BIN} cron list --all`);
  return parseCronList(output);
}

export async function GET() {
  try {
    const parsed = getAllCrons();
    const crons = parsed.map(mapCronRow);
    const citadelPushCrons = crons.filter((cron) => cron.isCitadelPush);

    const allEnabled = citadelPushCrons.length > 0 && citadelPushCrons.every((cron) => cron.enabled);
    const allDisabled = citadelPushCrons.length > 0 && citadelPushCrons.every((cron) => !cron.enabled);

    return NextResponse.json({ crons, allEnabled, allDisabled });
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

      const knownCrons = getAllCrons();
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
    const allCrons = getAllCrons();
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
