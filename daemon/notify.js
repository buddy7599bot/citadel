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

  // Clawdbot needs full session key format: agent:<id>:main
  const fullSessionKey = sessionKey.includes(":") ? sessionKey : `agent:${sessionKey}:main`;

  logInfo(`Delivering to ${agentName} (session: ${fullSessionKey}): ${notification.message}`);

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

    // Check if this is a task assignment (needs real work) vs a simple mention
    const isAssignment = notification.message.startsWith("You were assigned to:");
    const isBuddy = agentName === "Buddy";
    
    let prompt;
    if (isAssignment && isBuddy) {
      // BUDDY SPECIAL: Delegate, don't execute
      const spawnTask = [
        `🔔 CITADEL TASK ASSIGNED TO YOU: "${taskTitle}"`,
        `Task ID: ${taskId}`,
        taskContext,
        ``,
        `YOU ARE THE SUPERVISOR. YOU NEVER DO ANY TASKS YOURSELF. EVER.`,
        ``,
        `Your ONLY job is to DELEGATE and SUPERVISE:`,
        `1. Read the task description carefully`,
        `2. Identify which agent(s) should do this:`,
        `   - Building/coding/deploying → Elon`,
        `   - Content/copywriting/social/growth → Katy`,
        `   - Security/infrastructure → Mike`,
        `   - Jobs/career/hiring → Jerry`,
        `   - Trading/crypto/markets → Burry`,
        `   - Multiple skills? Assign multiple agents.`,
        `3. Assign the right agents using citadel-cli:`,
        `   citadel-cli assign Buddy ${taskId} Elon`,
        `   citadel-cli assign Buddy ${taskId} Katy`,
        `4. Post a delegation comment with @mentions explaining who does what:`,
        `   citadel-cli comment Buddy ${taskId} "Delegating: @Elon handle the build, @Katy write the content"`,
        `5. Subscribe yourself so you can monitor progress:`,
        `   (you are auto-subscribed as creator)`,
        `6. Set status to assigned (NOT in_progress):`,
        `   citadel-cli status Buddy ${taskId} assigned`,
        ``,
        `ABSOLUTE RULES:`,
        `- NEVER do the work yourself. No coding, no writing, no research.`,
        `- NEVER use sessions_spawn to do work. Delegate via @mentions ONLY.`,
        `- NEVER mark a task done yourself. The assigned agent marks it done.`,
        `- You supervise: check progress, nudge agents, escalate blockers.`,
        `The @mentions in your comment will notify the agents within 3 seconds.`,
      ].join("\n");

      try {
        const spawnResult = await spawnAgentTask(fullSessionKey, spawnTask);
        if (spawnResult && spawnResult.status === "accepted") {
          logInfo(`Spawned delegation sub-agent for Buddy: ${spawnResult.childSessionKey}`);
          return true;
        } else {
          logError(`Failed to spawn delegation for Buddy`, JSON.stringify(spawnResult));
          return false;
        }
      } catch (error) {
        logError(`Delegation spawn failed for Buddy`, error);
        return false;
      }
    } else if (isAssignment) {
      // Non-Buddy agents: do the actual work
      const spawnTask = [
        `🔔 CITADEL TASK ASSIGNED: "${taskTitle}"`,
        `Task ID: ${taskId}`,
        taskContext,
        ``,
        `You've been assigned this task. ACTUALLY DO THE WORK:`,
        ``,
        `1. First, post an acknowledgment comment: citadel-cli comment YourName ${taskId} "your message"`,
        `2. Update status: citadel-cli status YourName ${taskId} in_progress`,
        `3. DO THE ACTUAL WORK:`,
        `   - FOR ANY CODING TASK: You MUST use Codex (codex exec --full-auto "prompt"). Do NOT write code yourself with Claude/Opus.`,
        `   - For research: use web_search, web_fetch`,
        `   - For content: write it directly`,
        `4. Post progress updates: citadel-cli comment YourName ${taskId} "update"`,
        `5. Post deliverables: citadel-cli document YourName ${taskId} "Title" "content" deliverable`,
        `6. When done: citadel-cli status YourName ${taskId} done`,
        ``,
        `If you need help from a teammate, @mention them in a comment (e.g. @Buddy, @Katy, @Jerry, @Mike, @Burry, @Elon).`,
        `The comment will notify them and they'll respond on the task.`,
        ``,
        `CODING RULE: Always use Codex for code. Run: codex exec --full-auto "prompt" in the project directory.`,
        `Never hand-write code with Claude or Opus. Codex is the coder.`,
        ``,
        `ERROR HANDLING: If something fails (Codex, a command, an API), DO NOT STOP. Try a different approach:`,
        `- If Codex fails, try: codex exec --sandbox danger-full-access "prompt"`,
        `- ALWAYS log failures to Citadel: citadel-cli comment YourName ${taskId} "Failed X, trying Y"`,
        `- Keep going until the task is DONE or you've exhausted all options`,
        `- If truly blocked, post: citadel-cli status YourName ${taskId} assigned and explain what's blocking`,
      ].join("\n");

      try {
        const spawnResult = await spawnAgentTask(fullSessionKey, spawnTask);
        if (spawnResult && spawnResult.status === "accepted") {
          logInfo(`Spawned sub-agent for ${agentName}: ${spawnResult.childSessionKey}`);
          return true;
        } else {
          logError(`Failed to spawn for ${agentName}`, JSON.stringify(spawnResult));
          return false;
        }
      } catch (error) {
        logError(`Spawn failed for ${agentName}`, error);
        return false;
      }
    } else {
      prompt = [
        `🔔 Citadel @mention on task "${taskTitle}": ${notification.message}`,
        `Task ID: ${taskId}`,
        taskContext,
        ``,
        `Reply with a helpful response. If you need input from a teammate, @mention them (e.g. @Buddy, @Katy, @Jerry, @Mike, @Burry, @Elon).`,
        ``,
        `If this requires real work (research, analysis, building), DO THE WORK using your tools, then post results via:`,
        `   citadel-cli comment YourName ${taskId} "your update"`,
        `   citadel-cli document YourName ${taskId} "Title" "content" research|deliverable|report`,
        ``,
        `For now, respond with a short acknowledgment. Then keep working.`,
      ].join("\n");
    }

    try {
      const reply = await sendToAgentAndGetReply(fullSessionKey, prompt);
      if (reply && reply.trim() && reply.trim() !== "NO_REPLY" && reply.trim() !== "HEARTBEAT_OK") {
        let cleanReply = reply.trim();
        
        // Check if reply contains document markers
        if (cleanReply.includes("---COMMENT---") && cleanReply.includes("---DOCUMENT---")) {
          const commentMatch = cleanReply.match(/---COMMENT---\s*([\s\S]*?)(?=---DOCUMENT_TITLE---|---DOCUMENT---|$)/);
          const titleMatch = cleanReply.match(/---DOCUMENT_TITLE---\s*([\s\S]*?)(?=---DOCUMENT---|$)/);
          const docMatch = cleanReply.match(/---DOCUMENT---\s*([\s\S]*?)$/);
          
          const comment = commentMatch ? commentMatch[1].trim() : cleanReply.substring(0, 200);
          const docTitle = titleMatch ? titleMatch[1].trim() : `${agentName}'s deliverable for: ${taskTitle}`;
          const docContent = docMatch ? docMatch[1].trim() : null;
          
          // Post comment
          logInfo(`${agentName} commented: ${comment.substring(0, 100)}...`);
          await postCommentToCitadel(agentName, taskId, comment);
          logInfo(`Posted ${agentName}'s comment to Citadel task ${taskId}`);
          
          // Post document if present
          if (docContent && docContent.length > 50) {
            const docType = detectDocumentType(docContent);
            logInfo(`${agentName} created document: ${docTitle}`);
            await postDocumentToCitadel(agentName, taskId, docTitle, docContent, docType);
            logInfo(`Posted ${agentName}'s document to Citadel task ${taskId}`);
          }
        } else {
          // Simple reply - just post as comment
          logInfo(`${agentName} replied: ${cleanReply.substring(0, 100)}...`);
          await postCommentToCitadel(agentName, taskId, cleanReply);
          logInfo(`Posted ${agentName}'s reply to Citadel task ${taskId}`);
        }
      } else {
        logInfo(`${agentName} had no reply for the mention`);
      }
      return true;
    } catch (error) {
      logError(`Failed mention loop for ${agentName}`, error);
      return false;
    }
  } else {
    // For regular comment notifications: just notify, no reply expected
    const message = `🔔 Citadel: ${notification.message}`;
    try {
      await postJson(
        `${GATEWAY_URL}/tools/invoke`,
        {
          tool: "sessions_send",
          args: { sessionKey: fullSessionKey, message },
        },
        { Authorization: `Bearer ${GATEWAY_TOKEN}` },
        REQUEST_TIMEOUT_MS
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

async function pollOnce() {
  cycle += 1;
  if (cycle % 10 === 0) {
    logInfo("Polling...");
  }

  // Check for blocked agents every 10 cycles (~30s)
  if (cycle % 10 === 0) {
    await checkBlockedAgents();
  }

  const notifications = await listUndelivered();
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return;
  }

  logInfo(`Found ${notifications.length} undelivered notification(s)`);

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
  logInfo(`Gateway: ${GATEWAY_URL}`);
  logInfo(`Citadel: ${CONVEX_SITE_URL}`);

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
