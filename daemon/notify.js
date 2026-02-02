#!/usr/bin/env node
"use strict";

const CONVEX_URL = process.env.CONVEX_URL || "https://upbeat-caribou-155.convex.cloud";
const QUERY_URL = `${CONVEX_URL}/api/query`;
const MUTATION_URL = `${CONVEX_URL}/api/mutation`;
const POLL_INTERVAL_MS = 3000;
const REQUEST_TIMEOUT_MS = 10000;

let cycle = 0;
let stopping = false;

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

async function postJson(url, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  return await postJson(QUERY_URL, {
    path: "notifications:listUndelivered",
    args: {},
  });
}

async function markDelivered(id) {
  return await postJson(MUTATION_URL, {
    path: "notifications:markDelivered",
    args: { id },
  });
}

async function deliverNotification(notification) {
  const agentName = notification.agentName || "Unknown";
  const sessionKey = notification.agentSessionKey;

  if (!sessionKey) {
    logError(`Missing sessionKey for agent ${agentName}`, "No sessionKey");
    return false;
  }

  logInfo(`Delivery to ${agentName}: ${notification.message}`);
  console.log(`Session ${sessionKey} -> ${notification.message}`);
  return true;
}

async function pollOnce() {
  cycle += 1;
  if (cycle % 10 === 0) {
    logInfo("Polling...");
  }

  const notifications = await listUndelivered();
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return;
  }

  for (const notification of notifications) {
    try {
      const delivered = await deliverNotification(notification);
      if (delivered) {
        await markDelivered(notification._id);
      }
    } catch (error) {
      logError(`Failed to deliver notification ${notification._id}`, error);
    }
  }
}

async function run() {
  logInfo(`Citadel notifier starting (poll every ${POLL_INTERVAL_MS}ms)`);

  while (!stopping) {
    try {
      await pollOnce();
    } catch (error) {
      logError("Polling cycle failed", error);
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
