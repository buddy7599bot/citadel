#!/usr/bin/env node
"use strict";

const CONVEX_URL = process.env.CONVEX_URL || "https://upbeat-caribou-155.convex.cloud";
const QUERY_URL = `${CONVEX_URL}/api/query`;
const REQUEST_TIMEOUT_MS = 10000;
const WINDOW_MS = 24 * 60 * 60 * 1000;

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

async function query(path, args) {
  return await postJson(QUERY_URL, { path, args });
}

function formatAssignees(task) {
  if (!Array.isArray(task.assignees) || task.assignees.length === 0) return "";
  const names = task.assignees.map((assignee) => assignee?.name).filter(Boolean);
  if (names.length === 0) return "";
  return ` (${names.join(", ")})`;
}

function formatTasks(tasks) {
  if (!tasks || tasks.length === 0) return ["- None"];
  return tasks.map((task) => `- ${task.title}${formatAssignees(task)}`);
}

function formatKeyActivity(activities) {
  if (!activities || activities.length === 0) return ["- None"];

  const byAgent = new Map();
  for (const activity of activities) {
    const agentName = activity.agent?.name || "System";
    const description = activity.description || activity.action || "activity";
    if (!byAgent.has(agentName)) {
      byAgent.set(agentName, []);
    }
    byAgent.get(agentName).push(description);
  }

  const lines = [];
  for (const [agentName, descriptions] of byAgent) {
    lines.push(`- ${agentName}: ${descriptions.join("; ")}`);
  }

  return lines.length > 0 ? lines : ["- None"];
}

function buildStandup(tasks, activities) {
  const completed = tasks.filter((task) => task.status === "done");
  const inProgress = tasks.filter((task) => task.status === "in_progress");
  const blocked = tasks.filter((task) => task.status === "blocked");
  const review = tasks.filter((task) => task.status === "review");

  const notableActions = new Set(["create", "status", "comment"]);
  const keyActivities = activities.filter((activity) => {
    if (notableActions.has(activity.action)) return true;
    return activity.targetType === "message";
  });

  const lines = [];
  lines.push("**Daily Standup**");
  lines.push("Last 24 hours");
  lines.push("");
  lines.push("**Completed Today**");
  lines.push(...formatTasks(completed));
  lines.push("");
  lines.push("**In Progress**");
  lines.push(...formatTasks(inProgress));

  if (blocked.length > 0) {
    lines.push("");
    lines.push("**Blocked**");
    lines.push(...formatTasks(blocked));
  }

  lines.push("");
  lines.push("**Needs Review**");
  lines.push(...formatTasks(review));
  lines.push("");
  lines.push("**Key Activity**");
  lines.push(...formatKeyActivity(keyActivities));

  return lines.join("\n");
}

async function run() {
  const since = Date.now() - WINDOW_MS;
  const [activities, tasks] = await Promise.all([
    query("activities:listSince", { since }),
    query("tasks:listUpdatedSince", { since }),
  ]);

  const safeActivities = Array.isArray(activities) ? activities : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const output = buildStandup(safeTasks, safeActivities);
  console.log(output);
}

run().catch((error) => {
  logError("Standup generation failed", error);
  process.exitCode = 1;
});
