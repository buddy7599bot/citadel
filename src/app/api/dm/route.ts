import { NextRequest, NextResponse } from "next/server";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://127.0.0.1:18789/tools/invoke";
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || "31d9ec4a0955d94dc3823bed0e19a00649af46f13ef1879f";

export async function POST(req: NextRequest) {
  try {
    const { sessionKey, message } = await req.json();

    if (!sessionKey || !message) {
      return NextResponse.json(
        { error: "sessionKey and message are required" },
        { status: 400 }
      );
    }

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GATEWAY_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "sessions_send",
        args: {
          sessionKey,
          message,
          timeoutSeconds: 0,
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, data }, { status: res.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to send DM", detail: String(error) },
      { status: 500 }
    );
  }
}
