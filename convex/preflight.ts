import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const SCOPE_BY_AGENT: Record<string, string> = {
  Buddy: "coordination",
  Katy: "social",
  Burry: "trading",
  Mike: "security",
  Jerry: "jobs",
  Elon: "building",
};

const MAX_CONTENT_LENGTH = 500;

const normalizePattern = (pattern: string) => {
  const trimmed = pattern.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("absence of ")) {
    return { negative: true, value: trimmed.slice("absence of ".length) };
  }
  if (lower.startsWith("absence:")) {
    return { negative: true, value: trimmed.slice("absence:".length) };
  }
  if (lower.startsWith("absent:")) {
    return { negative: true, value: trimmed.slice("absent:".length) };
  }
  if (lower.startsWith("missing:")) {
    return { negative: true, value: trimmed.slice("missing:".length) };
  }
  return { negative: false, value: trimmed };
};

const runPatternCheck = (content: string, pattern: string) => {
  const normalized = normalizePattern(pattern);
  const patternValue = normalized.value.trim();
  if (!patternValue) {
    return {
      passed: false,
      details: "Empty check pattern",
    };
  }

  let matched = false;
  let regexError: string | null = null;
  try {
    const regex = new RegExp(patternValue, "i");
    matched = regex.test(content);
  } catch (error) {
    regexError = error instanceof Error ? error.message : "Invalid regex";
    matched = content.toLowerCase().includes(patternValue.toLowerCase());
  }

  // For violation patterns (default): finding the pattern means FAIL
  // For "absence of" patterns: NOT finding the pattern means FAIL
  const passed = normalized.negative ? matched : !matched;
  let details: string | undefined;

  if (!passed) {
    details = normalized.negative
      ? `Required pattern not found: ${patternValue}`
      : `Violation found: ${patternValue}`;
  }
  if (regexError) {
    details = `${details ? `${details}. ` : ""}Regex error: ${regexError}`;
  }

  return { passed, details };
};

export const listRecent = query({
  args: {
    agentId: v.optional(v.id("agents")),
    passed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const agentId = args.agentId;
    const passed = args.passed;
    
    if (agentId && passed !== undefined) {
      const logs = await ctx.db
        .query("preflight_logs")
        .withIndex("by_agent", (q) =>
          q.eq("agentId", agentId).gte("createdAt", 0)
        )
        .order("desc")
        .collect();
      return logs
        .filter((log) => log.passed === passed)
        .slice(0, 100);
    }

    if (agentId) {
      return await ctx.db
        .query("preflight_logs")
        .withIndex("by_agent", (q) =>
          q.eq("agentId", agentId).gte("createdAt", 0)
        )
        .order("desc")
        .take(100);
    }

    if (passed !== undefined) {
      return await ctx.db
        .query("preflight_logs")
        .withIndex("by_passed", (q) => q.eq("passed", passed).gte("createdAt", 0))
        .order("desc")
        .take(100);
    }

    return await ctx.db.query("preflight_logs").order("desc").take(100);
  },
});

export const getFailures = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("preflight_logs")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId).gte("createdAt", 0))
      .order("desc")
      .collect();
    return logs.filter((log) => !log.passed).slice(0, 50);
  },
});

export const log = mutation({
  args: {
    agentId: v.id("agents"),
    taskId: v.optional(v.id("tasks")),
    checkType: v.string(),
    passed: v.boolean(),
    details: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("preflight_logs", {
      agentId: args.agentId,
      taskId: args.taskId,
      checkType: args.checkType,
      passed: args.passed,
      details: args.details,
      content: args.content,
      createdAt: now,
    });
  },
});

export const runChecks = mutation({
  args: {
    agentId: v.id("agents"),
    content: v.string(),
    taskId: v.optional(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    const scope = agent ? SCOPE_BY_AGENT[agent.name] : undefined;
    const rules = await ctx.db.query("rules").collect();
    const applicable = rules.filter(
      (rule) =>
        rule.active &&
        rule.checkable &&
        rule.checkPattern &&
        (rule.scope === "global" || (scope && rule.scope === scope))
    );

    const contentSnippet =
      args.content.length > MAX_CONTENT_LENGTH
        ? args.content.slice(0, MAX_CONTENT_LENGTH)
        : args.content;

    const results = [] as Array<{ ruleId: Id<"rules">; passed: boolean; details?: string }>;

    for (const rule of applicable) {
      const { passed, details } = runPatternCheck(args.content, rule.checkPattern as string);
      results.push({ ruleId: rule._id, passed, details });

      await ctx.db.insert("preflight_logs", {
        agentId: args.agentId,
        taskId: args.taskId,
        checkType: `rule:${rule._id}`,
        passed,
        details,
        content: contentSnippet,
        createdAt: Date.now(),
      });
    }

    return results;
  },
});
