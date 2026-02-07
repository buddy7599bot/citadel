import { NextResponse } from "next/server";
import { execSync } from "child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENCLAW_BIN = "/home/ubuntu/.npm-global/bin/openclaw";

const CRONS = [
  { id: "c6e6ed3b", label: "coordinator", name: "citadel-push-coordinator" },
  { id: "f6a4c7ae", label: "security", name: "citadel-push-security" },
  { id: "2ecada74", label: "social", name: "citadel-push-social" },
  { id: "56710293", label: "trading", name: "citadel-push-trading" },
  { id: "0d18550f", label: "jobs", name: "citadel-push-jobs" },
  { id: "6a4c5e47", label: "build", name: "citadel-push-build" },
] as const;

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

function parseCronList(output: string): CronRow[] {
  const lines = output.split("\n").filter(Boolean);
  if (lines.length < 1) return [];

  // Parse header to find column positions
  const header = lines[0];
  const statusIdx = header.indexOf("Status");
  const targetIdx = header.indexOf("Target");
  const nameIdx = header.indexOf("Name");

  const results: CronRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Extract full ID (first column, always UUID format)
    const idMatch = line.match(/^([0-9a-f-]{36})/);
    if (!idMatch) continue;

    const fullId = idMatch[1];

    // Extract name using column position
    const nameStr = nameIdx >= 0 && statusIdx >= 0
      ? line.substring(nameIdx, nameIdx + 25).trim().split(/\s+/)[0]
      : "";

    // Extract status using column position
    const statusStr = statusIdx >= 0 && targetIdx >= 0
      ? line.substring(statusIdx, targetIdx).trim()
      : statusIdx >= 0
        ? line.substring(statusIdx, statusIdx + 12).trim()
        : "";

    results.push({
      fullId,
      name: nameStr,
      status: statusStr.toLowerCase(),
    });
  }

  return results;
}

export async function GET() {
  try {
    const output = runOpenclaw(`${OPENCLAW_BIN} cron list`);
    const parsed = parseCronList(output);

    const crons = CRONS.map((cron) => {
      const row = parsed.find((r) => r.fullId.startsWith(cron.id));
      // "ok" = enabled, "disabled" = disabled
      const enabled = row ? row.status !== "disabled" : true;

      return {
        id: cron.id,
        name: row?.name ?? cron.name,
        label: cron.label,
        enabled,
      };
    });

    const allEnabled = crons.every((c) => c.enabled);
    const allDisabled = crons.every((c) => !c.enabled);

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

    if (action !== "pause" && action !== "resume") {
      return NextResponse.json(
        { ok: false, error: 'Invalid action. Use "pause" or "resume".' },
        { status: 400 },
      );
    }

    const verb = action === "pause" ? "disable" : "enable";
    const errors: string[] = [];

    for (const cron of CRONS) {
      try {
        runOpenclaw(`${OPENCLAW_BIN} cron ${verb} ${cron.id}`);
      } catch (err) {
        errors.push(`${cron.label}: ${err instanceof Error ? err.message : "failed"}`);
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
