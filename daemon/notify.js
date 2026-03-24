#!/usr/bin/env node
"use strict";

const CONVEX_URL = process.env.CONVEX_URL || "https://upbeat-caribou-155.convex.cloud";
const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL || "https://upbeat-caribou-155.convex.site";
const CITADEL_API_KEY = process.env.CITADEL_API_KEY || "citadel-alliance-2026";
const GATEWAY_URL = process.env.GATEWAY_URL || "http://127.0.0.1:18789";
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || "31d9ec4a0955d94dc3823bed0e19a00649af46f13ef1879f";
const QUERY_URL = `${CONVEX_URL}/api/query`;
const MUTATION_URL = `${CONVEX_URL}/api/mutation`;
const POLL_INTERVAL_MS = 3000;
const REQUEST_TIMEOUT_MS = 60000; // 60s for agent responses
const SIMPLE_TIMEOUT_MS = 10000;  // 10s for simple API calls

let cycle = 0;
let stopping = false;
const alertedBlockedAgents = new Set(); // Track already-alerted blocked agents to avoid spam
const recentDeliveries = new Map(); // agentId+taskId -> timestamp, to prevent duplicate delivery storms
const DELIVERY_DEDUP_MS = 2 * 60 * 1000; // 10 minutes dedup window

const AGENT_ID_TO_CITADEL_KEY = {
  main: "main",
  builder: "builder",
  guard: "guard",
  kt: "kt",
  trader: "trader",
  jobs: "jobs",
};

// Jay's Telegram chat ID — for @Jay mention routing
const JAY_TELEGRAM_CHAT_ID = "1844628037";

// Cron session keys for instant wake on @mention
// When an agent is @mentioned, we also fire to their cron session so they wake up immediately
// instead of waiting up to 15 minutes for the next heartbeat tick.
const AGENT_CRON_SESSION_KEYS = {
  kt: "agent:kt:cron:5dc5b267-f0ba-46db-8289-fe77693c12aa",
  builder: "agent:builder:cron:01c4a381-783d-4790-bd37-cd50f9330d5d",
  ryan: "agent:ryan:cron:38a8eac0-4532-4117-863d-b06dff0c6929",
  harvey: "agent:harvey:cron:c3eba68f-417c-4188-9c1e-8611bd41dacb",
  rand: "agent:rand:cron:f5a7fa3a-d0f1-4c7a-8de6-daa9577f2060",
  // Buddy/main has no separate cron key — main session IS always live
};

const lastPushedActive = {}; // Track last pushed timestamp per agent to avoid redundant updates

// --- Auto-compact & cooldown wiper config ---
const fs = require("fs");
const path = require("path");
const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/home/ubuntu/.openclaw";
const AUTH_PROFILES_GLOB = path.join(OPENCLAW_DIR, "agents/*/agent/auth-profiles.json");
const COMPACT_THRESHOLD = 999; // DISABLED — auto-compact turned off per Jay's request
const COMPACT_COOLDOWN_MS = 10 * 60 * 1000; // 10 min cooldown after compacting an agent
const lastCompactedAt = {}; // agentId -> timestamp of last compact trigger
const AGENT_IDS = ["main", "builder", "guard", "kt", "trader", "jobs"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function logInfo(message) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${message}`);
}

function logError(message, error) {
  const ts = new Date().toISOString();
  const detail = error instanceof Error ? error.stack || error.message : String(error);
  console.error(`[${ts}] ${message}: ${detail}`);
}

async function postJson(url, body, headers = {}, timeoutMs = SIMPLE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} - ${text}`);
    }

    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timeout);
  }
}

async function listUndelivered() {
  const result = await postJson(QUERY_URL, {
    path: "notifications:listUndelivered",
    args: {},
  });
  if (result && result.status === "success") {
    return result.value;
  }
  return result;
}

async function markDelivered(id) {
  return await postJson(MUTATION_URL, {
    path: "notifications:markDelivered",
    args: { id },
  });
}

// Fire a lightweight wake ping to the agent's cron session so they pick up @mentions immediately
// This is fire-and-forget — we don't wait for a response, just kick the session awake
async function wakeCronSession(agentId, mentionSummary) {
  const cronSessionKey = AGENT_CRON_SESSION_KEYS[agentId];
  if (!cronSessionKey) return; // No cron key for this agent (e.g. Buddy)

  try {
    await postJson(
      `${GATEWAY_URL}/tools/invoke`,
      {
        tool: "sessions_send",
        args: {
          sessionKey: cronSessionKey,
          message: `🔔 You were @mentioned in Citadel. Check your main session for the full context.\n\n${mentionSummary}`,
          timeoutSeconds: 0, // fire-and-forget
        },
      },
      { Authorization: `Bearer ${GATEWAY_TOKEN}` },
      SIMPLE_TIMEOUT_MS
    );
    logInfo(`Wake ping sent to cron session: ${cronSessionKey}`);
  } catch (err) {
    // Non-critical — cron session may be between runs, that's fine
    logInfo(`Wake ping to ${cronSessionKey} failed (non-critical): ${err.message}`);
  }
}

async function autoSubscribe(agentId, taskId) {
  // Auto-subscribe agent to task thread (Bhanu's approach: interact = subscribed)
  try {
    await postJson(MUTATION_URL, {
      path: "subscriptions:subscribe",
      args: { agentId, taskId },
    });
  } catch {
    // Subscription may already exist — silent fail is fine
  }
}

async function postCommentToCitadel(agentName, taskId, content) {
  return await postJson(
    `${CONVEX_SITE_URL}/api/comment`,
    { agent: agentName, taskId, content },
    { "X-Citadel-Key": CITADEL_API_KEY }
  );
}

async function postDocumentToCitadel(agentName, taskId, title, content, type = "deliverable") {
  return await postJson(
    `${CONVEX_SITE_URL}/api/document`,
    { agent: agentName, taskId, title, content, type },
    { "X-Citadel-Key": CITADEL_API_KEY }
  );
}

function detectDocumentType(content) {
  const lower = content.toLowerCase();
  if (lower.includes("competitor") || lower.includes("analysis") || lower.includes("research") || lower.includes("findings")) return "research";
  if (lower.includes("report") || lower.includes("summary") || lower.includes("results")) return "report";
  if (lower.includes("spec") || lower.includes("plan") || lower.includes("architecture") || lower.includes("protocol")) return "protocol";
  return "deliverable";
}

async function spawnAgentTask(sessionKey, task) {
  // Extract agentId from session key (agent:<id>:main -> <id>)
  const agentId = sessionKey.split(":")[1] || sessionKey;
  const result = await postJson(
    `${GATEWAY_URL}/tools/invoke`,
    {
      tool: "sessions_spawn",
      args: {
        agentId: agentId,
        task: task,
        runTimeoutSeconds: 300, // 5 minutes for real work
      },
      sessionKey: sessionKey,
    },
    { Authorization: `Bearer ${GATEWAY_TOKEN}` },
    SIMPLE_TIMEOUT_MS
  );
  if (result && result.ok && result.result && result.result.details) {
    return result.result.details;
  }
  return null;
}

async function sendToAgentAndGetReply(sessionKey, message) {
  const result = await postJson(
    `${GATEWAY_URL}/tools/invoke`,
    {
      tool: "sessions_send",
      args: {
        sessionKey: sessionKey,
        message: message,
      },
    },
    { Authorization: `Bearer ${GATEWAY_TOKEN}` },
    REQUEST_TIMEOUT_MS
  );

  // Extract the agent's reply text from the result
  if (result && result.ok && result.result) {
    // Check details.reply first (sessions_send format)
    if (result.result.details && result.result.details.reply) {
      return result.result.details.reply;
    }
    // Fallback: try to parse from content text
    const content = result.result.content || result.result;
    if (Array.isArray(content)) {
      const textPart = content.find((c) => c.type === "text");
      if (textPart && textPart.text) {
        // Try parsing as JSON to extract reply field
        try {
          const parsed = JSON.parse(textPart.text);
          // Filter out error/timeout responses
          if (parsed.status === "error" || parsed.status === "timeout") {
            logInfo(`Agent returned ${parsed.status}: ${parsed.error || "timeout"}`);
            return null;
          }
          if (parsed.reply) return parsed.reply;
        } catch {}
        // If it looks like JSON (starts with {), don't return it as text
        if (textPart.text.trim().startsWith("{")) return null;
        return textPart.text;
      }
    }
    if (typeof content === "string" && !content.trim().startsWith("{")) return content;
  }
  return null;
}

async function deliverNotification(notification) {
  const agentName = notification.agentName || "Unknown";
  const sessionKey = notification.agentSessionKey;
  const isMention = notification.type === "mention";
  const taskId = notification.sourceTaskId;

  if (!sessionKey) {
    logError(`Missing sessionKey for agent ${agentName}`, "No sessionKey");
    return false;
  }

  // For agents that only operate via cron (Katy, Elon, Ryan, Harvey, Rand),
  // deliver to their cron session directly — not :main which is never active.
  // Buddy (main) is the only agent with an always-live :main session.
  const agentId = sessionKey.includes(":") ? sessionKey.split(":")[1] : sessionKey;
  const cronKey = AGENT_CRON_SESSION_KEYS[agentId];
  const fullSessionKey = cronKey || (sessionKey.includes(":") ? sessionKey : `agent:${sessionKey}:main`);

  logInfo(`Delivering to ${agentName} (session: ${fullSessionKey}): ${notification.message}`);

  // @Jay mention — send directly to Jay's Telegram from the mentioning agent's context
  // Only the original agent's notification fires; no chain reaction to other agents
  if (notification.type === "jay_mention") {
    const senderSessionKey = notification.agentSessionKey
      ? (notification.agentSessionKey.includes(":") ? notification.agentSessionKey : `agent:${notification.agentSessionKey}:main`)
      : null;

    if (!senderSessionKey) {
      logInfo(`jay_mention: no sessionKey for sender ${agentName}, marking delivered`);
      return true;
    }

    // Build a concise Telegram message for Jay
    const taskUrl = taskId ? `https://citadel.dashpane.pro/tasks/${taskId}` : "";
    const telegramMsg = [
      `📌 *@Jay mention in Citadel*`,
      `*From:* ${agentName}`,
      notification.message,
      taskUrl ? `\n[View task](${taskUrl})` : "",
    ].filter(Boolean).join("\n");

    try {
      await postJson(
        `${GATEWAY_URL}/tools/invoke`,
        {
          tool: "message",
          args: {
            action: "send",
            channel: "telegram",
            accountId: senderSessionKey.split(":")[1] || "builder",
            target: JAY_TELEGRAM_CHAT_ID,
            message: telegramMsg,
          },
        },
        { Authorization: `Bearer ${GATEWAY_TOKEN}` },
        SIMPLE_TIMEOUT_MS
      );
      logInfo(`jay_mention delivered to Jay's Telegram from ${agentName}`);
    } catch (err) {
      logError(`jay_mention Telegram delivery failed for ${agentName}`, err);
    }
    return true; // always mark delivered — no retry loop
  }

  if (isMention && taskId) {
    // For mentions: send context, get reply, post back to Citadel
    // Fetch task details and recent comments for context
    let taskContext = "";
    let taskTitle = "Unknown task";
    try {
      const taskResult = await postJson(QUERY_URL, {
        path: "tasks:getById",
        args: { id: taskId },
      });
      if (taskResult && taskResult.status === "success" && taskResult.value) {
        taskTitle = taskResult.value.title || taskTitle;
        if (taskResult.value.description) {
          taskContext += `\nTask description: ${taskResult.value.description}`;
        }
      }
    } catch {}

    try {
      const commentsResult = await postJson(QUERY_URL, {
        path: "messages:listByTask",
        args: { taskId },
      });
      if (commentsResult && commentsResult.status === "success" && Array.isArray(commentsResult.value)) {
        const recent = commentsResult.value.slice(-5);
        if (recent.length > 0) {
          taskContext += "\n\nRecent comments on this task:\n" +
            recent.map((c) => `- ${c.content}`).join("\n");
        }
      }
    } catch {}

    // Build the prompt for all notification types — deliver via sessions_send (Bhanu's approach)
    // No spawning. Agent picks it up on their next heartbeat.
    const isAssignment = notification.message.startsWith("You were assigned to:");

    let prompt;
    if (isAssignment) {
      prompt = [
        `🔔 CITADEL TASK ASSIGNED TO YOU: "${taskTitle}"`,
        `Task ID: ${taskId}`,
        taskContext,
        ``,
        `Pick this up on your next work cycle. Check Citadel for full details:`,
        `  curl -s 'https://upbeat-caribou-155.convex.site/api/my-tasks?agent=${agentName}' -H 'X-Citadel-Key: citadel-alliance-2026'`,
        ``,
        `When you're ready to work on it:`,
        `  citadel-cli status ${agentName} ${taskId} in_progress`,
        `  citadel-cli comment ${agentName} ${taskId} "On it — [brief plan]"`,
      ].join("\n");
    } else {
      prompt = [
        `🔔 CITADEL @MENTION — RESPOND NOW: "${taskTitle}"`,
        `Task ID: ${taskId}`,
        `Message: ${notification.message}`,
        taskContext,
        ``,
        `You have been @mentioned. If you are free, act on this immediately.`,
        `If you are mid-task, acknowledge and queue it.`,
        ``,
        `DO THE WORK NOW if you can:`,
        `1. Read the task context above`,
        `2. Do the research/analysis/work requested`,
        `3. Post your response: bash /home/ubuntu/clawd/projects/citadel/scripts/citadel-cli.sh comment ${agentName} ${taskId} "your response"`,
        `4. If you produced a document: bash /home/ubuntu/clawd/projects/citadel/scripts/citadel-cli.sh document ${agentName} ${taskId} "Title" "content" research`,
        ``,
        `If you need help from a teammate, @mention them in your comment.`,
        `Reply with what you did or what you need.`,
      ].join("\n");
    }

    try {
      // @mentions get a real timeout so agents respond immediately if free.
      // Assignments are fire-and-forget (picked up on next heartbeat).
      const isMentionType = !isAssignment;
      const timeout = isMentionType ? 120 : 0; // 2 min for mentions, async for assignments
      const timeoutMs = isMentionType ? REQUEST_TIMEOUT_MS : SIMPLE_TIMEOUT_MS;

      // Fire cron wake BEFORE the main session send (fire-and-forget, doesn't block)
      // This ensures the agent's cron session gets the wake signal even if main session times out
      if (isMentionType) {
        const agentKeyId = fullSessionKey.split(":")[1]; // e.g. "builder", "kt", "rand"
        await wakeCronSession(agentKeyId, notification.message);
      }

      await postJson(
        `${GATEWAY_URL}/tools/invoke`,
        {
          tool: "sessions_send",
          args: {
            sessionKey: fullSessionKey,
            message: prompt,
            timeoutSeconds: timeout,
          },
        },
        { Authorization: `Bearer ${GATEWAY_TOKEN}` },
        timeoutMs
      );
      // Auto-subscribe agent to task thread (Bhanu's approach)
      if (taskId && notification.agentId) {
        await autoSubscribe(notification.agentId, taskId);
      }
      logInfo(`Delivered notification to ${agentName} via sessions_send (${isMentionType ? "instant @mention" : "async assignment"})`);
      return true;
    } catch (error) {
      // On timeout/error, still mark as delivered to prevent infinite retry loop
      // The agent will pick it up on their next heartbeat
      logInfo(`Delivery failed/timed out for ${agentName} — marking delivered to prevent loop`);
      return true; // Return true so markDelivered is called in the outer loop
    }
  } else {
    // For regular comment notifications: fire-and-forget sessions_send
    const message = `🔔 Citadel: ${notification.message}`;
    try {
      await postJson(
        `${GATEWAY_URL}/tools/invoke`,
        {
          tool: "sessions_send",
          args: { sessionKey: fullSessionKey, message, timeoutSeconds: 0 },
        },
        { Authorization: `Bearer ${GATEWAY_TOKEN}` },
        SIMPLE_TIMEOUT_MS
      );
      logInfo(`Delivered to ${agentName} successfully`);
      return true;
    } catch (error) {
      logError(`Failed to deliver to ${agentName} via gateway`, error);
      return false;
    }
  }
}

async function checkBlockedAgents() {
  try {
    const result = await postJson(QUERY_URL, {
      path: "agents:list",
      args: {},
    });
    if (!result || result.status !== "success" || !Array.isArray(result.value)) return;

    const agents = result.value;
    const blocked = agents.filter((a) => a.status === "blocked");
    const newlyBlocked = blocked.filter((a) => !alertedBlockedAgents.has(a.name));

    if (newlyBlocked.length === 0) return;

    for (const agent of newlyBlocked) {
      alertedBlockedAgents.add(agent.name);
      const task = agent.currentTask || "unknown issue";
      const alertMsg = `🚨 BLOCKED AGENT ALERT: ${agent.name} is blocked!\nReason: ${task}\n\nAs supervisor, investigate and either unblock them or escalate to Jay immediately.`;

      logInfo(`Alerting Buddy about blocked agent: ${agent.name}`);

      // Alert Buddy (supervisor)
      try {
        await postJson(
          `${GATEWAY_URL}/tools/invoke`,
          {
            tool: "sessions_send",
            args: { sessionKey: "agent:main:main", message: alertMsg },
          },
          { Authorization: `Bearer ${GATEWAY_TOKEN}` },
          REQUEST_TIMEOUT_MS
        );
      } catch (err) {
        logError(`Failed to alert Buddy about ${agent.name}`, err);
      }
    }

    // Clear agents that are no longer blocked
    for (const name of alertedBlockedAgents) {
      if (!blocked.find((a) => a.name === name)) {
        alertedBlockedAgents.delete(name);
      }
    }
  } catch (error) {
    logError("Failed to check blocked agents", error);
  }
}

async function checkAgentActivity() {
  try {
    // Fetch all sessions active in last 5 minutes
    const result = await postJson(
      `${GATEWAY_URL}/tools/invoke`,
      {
        tool: "sessions_list",
        args: { limit: 20, activeMinutes: 5 },
      },
      { Authorization: `Bearer ${GATEWAY_TOKEN}` },
      SIMPLE_TIMEOUT_MS
    );

    if (!result || !result.ok || !result.result || !result.result.details) return;

    const sessions = result.result.details.sessions || [];
    const now = Date.now();
    const latestByAgent = {};

    for (const session of sessions) {
      const key = session.key || "";
      const segments = key.split(":");
      if (segments.length < 3 || segments[0] !== "agent") continue;

      if (
        key.includes("cron:") &&
        typeof session.label === "string" &&
        session.label.toLowerCase().includes("citadel-push")
      ) {
        continue;
      }

      const agentId = segments[1];
      const citadelKey = AGENT_ID_TO_CITADEL_KEY[agentId];
      if (!citadelKey) continue;

      const rawUpdatedAt = session.updatedAt || 0;
      const updatedAt =
        typeof rawUpdatedAt === "number"
          ? rawUpdatedAt
          : Date.parse(rawUpdatedAt) || 0;
      if (!updatedAt) continue;
      const currentLatest = latestByAgent[citadelKey] || 0;
      if (updatedAt > currentLatest) {
        latestByAgent[citadelKey] = updatedAt;
      }
    }

    for (const [citadelKey, updatedAt] of Object.entries(latestByAgent)) {
      const ageMs = now - updatedAt;
      let status;
      if (ageMs <= 60000) {
        status = "working";
      } else if (ageMs <= 300000) {
        status = "idle";
      } else {
        continue;
      }
      const lastPushed = lastPushedActive[citadelKey] || 0;

      // Only push if session was updated more recently than our last push
      // and at least 5 seconds since last push (avoid spam)
      if (updatedAt > lastPushed && (now - lastPushed) > 5000) {
        try {
          await postJson(MUTATION_URL, {
            path: "agents:heartbeat",
            args: {
              sessionKey: citadelKey,
              status,
              currentTask: undefined,
            },
          });
          lastPushedActive[citadelKey] = now;
          if (cycle % 20 === 0) {
            logInfo(`Updated lastActive for ${citadelKey}`);
          }
        } catch (err) {
          logError(`Failed to push heartbeat for ${citadelKey}`, err);
        }
      }
    }
  } catch (error) {
    logError("Failed to check agent activity", error);
  }
}

// --- Cooldown auto-wiper ---
// Scans each agent's auth-profiles.json for stuck cooldownUntil entries and clears them
async function wipeStaleCooldowns() {
  try {
    for (const agentId of AGENT_IDS) {
      const filePath = path.join(OPENCLAW_DIR, `agents/${agentId}/agent/auth-profiles.json`);
      let raw;
      try {
        raw = fs.readFileSync(filePath, "utf8");
      } catch {
        continue; // File doesn't exist for this agent
      }

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        continue; // Corrupted JSON, skip
      }

      let changed = false;
      const now = Date.now();

      // Check usageStats for cooldownUntil
      const stats = data.usageStats || {};
      for (const [profileKey, profileStats] of Object.entries(stats)) {
        if (profileStats && typeof profileStats === "object") {
          if (profileStats.cooldownUntil && profileStats.cooldownUntil <= now) {
            logInfo(`Wiping expired cooldown for ${agentId}/${profileKey} (expired ${Math.round((now - profileStats.cooldownUntil) / 1000)}s ago)`);
            delete profileStats.cooldownUntil;
            if (profileStats.errorCount) profileStats.errorCount = 0;
            if (profileStats.failureCounts) delete profileStats.failureCounts;
            changed = true;
          }
        }
      }

      // Also check top-level profiles (older format)
      const profiles = data.profiles || {};
      for (const [profileKey, profile] of Object.entries(profiles)) {
        if (profile && typeof profile === "object") {
          if (profile.cooldownUntil && profile.cooldownUntil <= now) {
            logInfo(`Wiping expired cooldown (profiles) for ${agentId}/${profileKey}`);
            delete profile.cooldownUntil;
            if (profile.errorCount) profile.errorCount = 0;
            if (profile.failureCounts) delete profile.failureCounts;
            changed = true;
          }
        }
      }

      if (changed) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        logInfo(`Cleared stale cooldowns for agent: ${agentId}`);
      }
    }
  } catch (error) {
    logError("Cooldown wiper failed", error);
  }
}

// --- Auto-compact at 80% context usage ---
// Checks each agent's main session context usage and triggers /compact if above threshold
async function autoCompactSessions() {
  try {
    // Get all active sessions
    const result = await postJson(
      `${GATEWAY_URL}/tools/invoke`,
      {
        tool: "sessions_list",
        args: { limit: 20, activeMinutes: 60 },
      },
      { Authorization: `Bearer ${GATEWAY_TOKEN}` },
      SIMPLE_TIMEOUT_MS
    );

    if (!result || !result.ok || !result.result || !result.result.details) return;

    const sessions = result.result.details.sessions || [];

    for (const session of sessions) {
      const key = session.key || "";
      // Only compact main agent sessions
      if (!key.match(/^agent:[^:]+:main$/)) continue;

      const contextMax = session.contextTokens || session.contextMax || session.contextWindow || 0;
      const contextUsed = session.totalTokens || session.contextUsed || session.tokenEstimate || 0;

      if (!contextMax || !contextUsed) continue;

      const usage = contextUsed / contextMax;

      if (usage >= COMPACT_THRESHOLD) {
        const agentId = key.split(":")[1];
        const pct = Math.round(usage * 100);

        // Cooldown: skip if we compacted this agent recently
        const lastCompact = lastCompactedAt[agentId] || 0;
        const now = Date.now();
        if (now - lastCompact < COMPACT_COOLDOWN_MS) {
          if (cycle % 100 === 0) {
            logInfo(`Skipping compact for ${agentId} (${pct}%) - cooldown until ${new Date(lastCompact + COMPACT_COOLDOWN_MS).toISOString()}`);
          }
          continue;
        }

        logInfo(`Auto-compacting ${agentId} - context at ${pct}% (${contextUsed}/${contextMax} tokens)`);

        try {
          // First trigger memory flush
          await postJson(
            `${GATEWAY_URL}/tools/invoke`,
            {
              tool: "sessions_send",
              args: {
                sessionKey: key,
                message: `Pre-compaction memory flush. Store durable memories now (use memory/YYYY-MM-DD.md; create memory/ if needed). If nothing to store, reply with NO_REPLY.`,
              },
            },
            { Authorization: `Bearer ${GATEWAY_TOKEN}` },
            REQUEST_TIMEOUT_MS
          );
          logInfo(`Memory flush sent for ${agentId}, now sending /compact`);
          // Then trigger actual compaction
          await postJson(
            `${GATEWAY_URL}/tools/invoke`,
            {
              tool: "sessions_send",
              args: {
                sessionKey: key,
                message: `/compact`,
              },
            },
            { Authorization: `Bearer ${GATEWAY_TOKEN}` },
            REQUEST_TIMEOUT_MS
          );
          lastCompactedAt[agentId] = Date.now();
          logInfo(`Auto-compact triggered for ${agentId} (cooldown ${COMPACT_COOLDOWN_MS / 60000}min)`);
        } catch (err) {
          logError(`Auto-compact failed for ${agentId}`, err);
        }
      }
    }
  } catch (error) {
    logError("Auto-compact check failed", error);
  }
}

async function pollOnce() {
  cycle += 1;
  if (cycle % 10 === 0) {
    logInfo("Polling...");
  }

  await checkAgentActivity();

  // Check for blocked agents every 10 cycles (~30s)
  if (cycle % 10 === 0) {
    await checkBlockedAgents();
  }

  // Wipe stale cooldowns every 10 cycles (~30s)
  if (cycle % 10 === 0) {
    await wipeStaleCooldowns();
  }

  // Auto-compact check every 20 cycles (~60s)
  if (cycle % 20 === 0) {
    await autoCompactSessions();
  }

  const notifications = await listUndelivered();
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return;
  }

  logInfo(`Found ${notifications.length} undelivered notification(s)`);

  for (const notification of notifications) {
    try {
      // Deduplication: skip if we already delivered to this agent on this task recently
      const dedupKey = `${notification.agentId}-${notification.sourceTaskId || 'notask'}`;
      const lastDelivery = recentDeliveries.get(dedupKey) || 0;
      if (Date.now() - lastDelivery < DELIVERY_DEDUP_MS) {
        logInfo(`Skipping duplicate delivery to ${notification.agentName} (dedup window active)`);
        await markDelivered(notification._id);
        continue;
      }

      const delivered = await deliverNotification(notification);
      if (delivered) {
        await markDelivered(notification._id);
        recentDeliveries.set(dedupKey, Date.now());
      }
    } catch (error) {
      logError(`Failed to deliver notification ${notification._id}`, error);
    }
  }
}

async function run() {
  logInfo(`Citadel notifier starting (poll every ${POLL_INTERVAL_MS}ms)`);
  logInfo(`Gateway: ${GATEWAY_URL}`);
  logInfo(`Citadel: ${CONVEX_SITE_URL}`);

  let consecutiveErrors = 0;

  while (!stopping) {
    try {
      await pollOnce();
      consecutiveErrors = 0;
    } catch (error) {
      consecutiveErrors++;
      logError(`Polling cycle failed (${consecutiveErrors} consecutive)`, error);
      // Exponential backoff: 3s, 6s, 12s, 24s, max 60s
      if (consecutiveErrors > 1) {
        const backoffMs = Math.min(POLL_INTERVAL_MS * Math.pow(2, consecutiveErrors - 1), 60000);
        logInfo(`Backing off ${Math.round(backoffMs / 1000)}s after ${consecutiveErrors} consecutive errors`);
        await sleep(backoffMs);
      }
    }

    if (stopping) break;
    await sleep(POLL_INTERVAL_MS);
  }

  logInfo("Citadel notifier stopped");
}

process.on("SIGINT", () => {
  stopping = true;
  logInfo("SIGINT received, shutting down...");
});

process.on("SIGTERM", () => {
  stopping = true;
  logInfo("SIGTERM received, shutting down...");
});

process.on("unhandledRejection", (reason) => {
  logError("Unhandled rejection", reason);
});

process.on("uncaughtException", (error) => {
  logError("Uncaught exception", error);
});

run().catch((error) => {
  logError("Fatal error", error);
  process.exitCode = 1;
});
