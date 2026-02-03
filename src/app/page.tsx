"use client";

import { useEffect, useMemo, useRef, useState, useCallback, type ChangeEvent, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

function AnimatedCounter({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    const start = prev.current;
    const diff = value - start;
    const duration = 400;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    prev.current = value;
  }, [value]);
  return <span className={className}>{display}</span>;
}

function linkifyContent(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const mentionRegex = /(@\w+)/g;
  const parts = text.split(/(https?:\/\/[^\s]+|@\w+)/g);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      urlRegex.lastIndex = 0;
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-amber-700 underline hover:text-amber-900 break-all">
          {part}
        </a>
      );
    }
    if (mentionRegex.test(part)) {
      mentionRegex.lastIndex = 0;
      return (
        <span key={i} className="font-semibold text-amber-700">{part}</span>
      );
    }
    return part;
  });
}
import type { Id } from "../../convex/_generated/dataModel";
import { timeAgo } from "@/lib/utils";

const STATUS_COLUMNS = [
  { key: "inbox", label: "INBOX", dot: "bg-warm-400" },
  { key: "assigned", label: "ASSIGNED", dot: "bg-amber-500" },
  { key: "in_progress", label: "IN PROGRESS", dot: "bg-green-500" },
  { key: "review", label: "REVIEW", dot: "bg-blue-500" },
  { key: "done", label: "DONE", dot: "bg-warm-300" },
] as const;

const PRIORITY_BORDER: Record<string, string> = {
  urgent: "border-l-[#EF4444]",
  high: "border-l-[#F97316]",
  medium: "border-l-[#EAB308]",
  low: "border-l-[#D1D5DB]",
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-[#FEE2E2] text-[#991B1B]",
  high: "bg-[#FFEDD5] text-[#9A3412]",
  medium: "bg-[#FEF3C7] text-[#92400E]",
  low: "bg-[#F3F4F6] text-[#6B7280]",
};

const TASK_STATUS_BADGE: Record<string, string> = {
  inbox: "bg-[#E0E7FF] text-[#3730A3]",
  assigned: "bg-[#DBEAFE] text-[#1E40AF]",
  in_progress: "bg-[#DCFCE7] text-[#166534]",
  review: "bg-[#FEF3C7] text-[#92400E]",
  done: "bg-[#F3F4F6] text-[#6B7280]",
};

const LEVEL_BADGE: Record<string, string> = {
  lead: "bg-[#FEF3C7] text-[#92400E]",
  specialist: "bg-[#DBEAFE] text-[#1E40AF]",
  intern: "bg-[#F3F4F6] text-[#374151]",
};

const STATUS_BADGE: Record<string, string> = {
  working: "bg-[#DCFCE7] text-[#166534]",
  idle: "bg-[#F3F4F6] text-[#6B7280]",
  blocked: "bg-[#FEE2E2] text-[#991B1B]",
};

const DOCUMENT_TYPES = ["deliverable", "research", "protocol", "report"] as const;

const DOC_TYPE_BADGE: Record<(typeof DOCUMENT_TYPES)[number], string> = {
  deliverable: "bg-[#DCFCE7] text-[#166534]",
  research: "bg-[#DBEAFE] text-[#1E40AF]",
  protocol: "bg-[#FEF3C7] text-[#92400E]",
  report: "bg-[#F3F4F6] text-[#6B7280]",
};

const FEED_TABS = [
  { key: "all", label: "All", target: undefined },
  { key: "tasks", label: "Tasks", target: "task" },
  { key: "comments", label: "Comments", target: "comment" },
  { key: "decisions", label: "Decisions", target: "decision" },
  { key: "status", label: "Status", target: "status" },
] as const;

const formatSignedPercent = (value: number, digits = 1) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;

const AGENT_PANEL_META: Record<
  string,
  {
    title: string;
    subtitle: string;
    accent: string;
  }
> = {
  Burry: {
    title: "Trading",
    subtitle: "Mini trading dashboard",
    accent: "border-[#F97316] bg-[#FFF7ED] text-[#9A3412]",
  },
  Katy: {
    title: "Growth / X",
    subtitle: "Social analytics",
    accent: "border-[#D97706] bg-[#FFFBEB] text-[#92400E]",
  },
  Mike: {
    title: "Security",
    subtitle: "Security dashboard",
    accent: "border-[#16A34A] bg-[#F0FDF4] text-[#166534]",
  },
  Jerry: {
    title: "Jobs",
    subtitle: "Job pipeline",
    accent: "border-[#3B82F6] bg-[#EFF6FF] text-[#1D4ED8]",
  },
  Elon: {
    title: "Builder",
    subtitle: "Build status",
    accent: "border-[#0EA5E9] bg-[#F0F9FF] text-[#0369A1]",
  },
  Buddy: {
    title: "Coordinator",
    subtitle: "Overview",
    accent: "border-[#A855F7] bg-[#FAF5FF] text-[#6B21A8]",
  },
};

export default function Home() {
  const agents = useQuery(api.agents.list);
  const tasks = useQuery(api.tasks.list);
  const [feedTab, setFeedTab] = useState<(typeof FEED_TABS)[number]["key"]>("all");
  const [rightPanel, setRightPanel] = useState<"feed" | "docs">("feed");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const activities = useQuery(api.activities.list, {
    targetType: FEED_TABS.find((tab) => tab.key === feedTab)?.target,
  });
  const documents = useQuery(api.documents.list);

  const seedAgents = useMutation(api.agents.seed);
  const seedDomainData = useMutation(api.domain.seedDomainData);
  const createTask = useMutation(api.tasks.create);
  const createMessage = useMutation(api.messages.create);
  const createDocument = useMutation(api.documents.create);
  const updateTaskStatus = useMutation(api.tasks.updateStatus);

  const [now, setNow] = useState(() => new Date());
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState(false);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [tags, setTags] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [messageContent, setMessageContent] = useState("");
  const [messageTaskId, setMessageTaskId] = useState("");
  const [messageAgentId, setMessageAgentId] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionAnchor, setMentionAnchor] = useState<number | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [docTypeFilter, setDocTypeFilter] = useState<"all" | (typeof DOCUMENT_TYPES)[number]>(
    "all",
  );
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [showDocForm, setShowDocForm] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docType, setDocType] = useState<(typeof DOCUMENT_TYPES)[number]>("deliverable");
  const [docTaskId, setDocTaskId] = useState("");
  const [docAuthorId, setDocAuthorId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailMessageContent, setDetailMessageContent] = useState("");
  const [detailMessageAgentId, setDetailMessageAgentId] = useState("");
  const [showDetailMentions, setShowDetailMentions] = useState(false);
  const [detailMentionQuery, setDetailMentionQuery] = useState("");
  const [detailMentionAnchor, setDetailMentionAnchor] = useState<number | null>(null);
  const detailMessageInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (agents && agents.length === 0) {
      seedAgents();
    }
  }, [agents, seedAgents]);

  useEffect(() => {
    if (agents && agents.length > 0) {
      seedDomainData();
    }
  }, [agents, seedDomainData]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (tasks && tasks.length > 0 && !messageTaskId) {
      setMessageTaskId(tasks[0]._id.toString());
    }
  }, [tasks, messageTaskId]);

  useEffect(() => {
    if (agents && agents.length > 0 && !messageAgentId) {
      setMessageAgentId(agents[0]._id.toString());
    }
  }, [agents, messageAgentId]);

  useEffect(() => {
    if (agents && agents.length > 0 && !detailMessageAgentId) {
      setDetailMessageAgentId(agents[0]._id.toString());
    }
  }, [agents, detailMessageAgentId]);

  useEffect(() => {
    if (agents && agents.length > 0 && !docAuthorId) {
      setDocAuthorId(agents[0]._id.toString());
    }
  }, [agents, docAuthorId]);

  const activeAgents = agents?.filter((agent) => agent.status === "working") ?? [];
  const tasksInQueue = tasks?.filter((task) => task.status !== "done") ?? [];

  const selectedAgent = (agents ?? []).find((agent) => agent._id.toString() === selectedAgentId);
  const selectedAgentConvexId = selectedAgentId ? (selectedAgentId as Id<"agents">) : null;

  const tradingData = useQuery(
    api.domain.getTradingData,
    selectedAgentConvexId && selectedAgent?.role === "Trading"
      ? { agentId: selectedAgentConvexId }
      : "skip",
  );
  const socialMetrics = useQuery(
    api.domain.getSocialMetrics,
    selectedAgentConvexId && selectedAgent?.role === "Growth"
      ? { agentId: selectedAgentConvexId }
      : "skip",
  );
  const securityScans = useQuery(
    api.domain.getSecurityScans,
    selectedAgentConvexId && selectedAgent?.role === "Security"
      ? { agentId: selectedAgentConvexId }
      : "skip",
  );
  const jobPipeline = useQuery(
    api.domain.getJobPipeline,
    selectedAgentConvexId && selectedAgent?.role === "Jobs"
      ? { agentId: selectedAgentConvexId }
      : "skip",
  );
  const buildStatus = useQuery(
    api.domain.getBuildStatus,
    selectedAgentConvexId && selectedAgent?.role === "Builder"
      ? { agentId: selectedAgentConvexId }
      : "skip",
  );

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    if (!selectedAgentId) return tasks;
    return tasks.filter((task) =>
      (task.assigneeIds ?? []).some((assigneeId) => assigneeId.toString() === selectedAgentId),
    );
  }, [tasks, selectedAgentId]);

  const mentionOptions = useMemo(() => {
    if (!agents) return [];
    const query = mentionQuery.trim().toLowerCase();
    if (!query) return agents;
    return agents.filter((agent) => agent.name.toLowerCase().includes(query));
  }, [agents, mentionQuery]);

  const handleMessageChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setMessageContent(value);
    const cursor = event.target.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const atIndex = before.lastIndexOf("@");
    if (atIndex >= 0 && (atIndex === 0 || /\s/.test(before[atIndex - 1] ?? ""))) {
      const query = before.slice(atIndex + 1);
      if (!query.includes(" ") && !query.includes("\n")) {
        setShowMentions(true);
        setMentionQuery(query);
        setMentionAnchor(atIndex);
        return;
      }
    }
    setShowMentions(false);
    setMentionQuery("");
    setMentionAnchor(null);
  };

  type Agent = NonNullable<typeof agents>[number];

  const handleMentionSelect = (agent: Agent) => {
    const input = messageInputRef.current;
    if (!input) return;
    const value = messageContent;
    const cursor = input.selectionStart ?? value.length;
    const anchor = mentionAnchor ?? value.lastIndexOf("@");
    if (anchor < 0) return;
    const before = value.slice(0, anchor);
    const after = value.slice(cursor);
    const nextValue = `${before}@${agent.name} ${after}`;
    setMessageContent(nextValue);
    setShowMentions(false);
    setMentionQuery("");
    setMentionAnchor(null);
    requestAnimationFrame(() => {
      const nextPos = (before + `@${agent.name} `).length;
      input.focus();
      input.setSelectionRange(nextPos, nextPos);
    });
  };

  const handleDetailMessageChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setDetailMessageContent(value);
    const cursor = event.target.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const atIndex = before.lastIndexOf("@");
    if (atIndex >= 0 && (atIndex === 0 || /\s/.test(before[atIndex - 1] ?? ""))) {
      const query = before.slice(atIndex + 1);
      if (!query.includes(" ") && !query.includes("\n")) {
        setShowDetailMentions(true);
        setDetailMentionQuery(query);
        setDetailMentionAnchor(atIndex);
        return;
      }
    }
    setShowDetailMentions(false);
    setDetailMentionQuery("");
    setDetailMentionAnchor(null);
  };

  const handleDetailMentionSelect = (agent: Agent) => {
    const input = detailMessageInputRef.current;
    if (!input) return;
    const value = detailMessageContent;
    const cursor = input.selectionStart ?? value.length;
    const anchor = detailMentionAnchor ?? value.lastIndexOf("@");
    if (anchor < 0) return;
    const before = value.slice(0, anchor);
    const after = value.slice(cursor);
    const nextValue = `${before}@${agent.name} ${after}`;
    setDetailMessageContent(nextValue);
    setShowDetailMentions(false);
    setDetailMentionQuery("");
    setDetailMentionAnchor(null);
    requestAnimationFrame(() => {
      const nextPos = (before + `@${agent.name} `).length;
      input.focus();
      input.setSelectionRange(nextPos, nextPos);
    });
  };

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = messageContent.trim();
    if (!trimmed || !messageTaskId || !messageAgentId) return;
    await createMessage({
      taskId: messageTaskId as Id<"tasks">,
      agentId: messageAgentId as Id<"agents">,
      content: trimmed,
    });
    setMessageContent("");
    setShowMentions(false);
    setMentionQuery("");
    setMentionAnchor(null);
  };

  const canSendMessage = messageContent.trim().length > 0 && messageTaskId && messageAgentId;

  const handleSendDetailMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = detailMessageContent.trim();
    if (!trimmed || !selectedTaskId || !detailMessageAgentId) return;
    await createMessage({
      taskId: selectedTaskId as Id<"tasks">,
      agentId: detailMessageAgentId as Id<"agents">,
      content: trimmed,
    });
    setDetailMessageContent("");
    setShowDetailMentions(false);
    setDetailMentionQuery("");
    setDetailMentionAnchor(null);
  };

  const canSendDetailMessage =
    detailMessageContent.trim().length > 0 && selectedTaskId && detailMessageAgentId;

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, typeof tasks> = {
      inbox: [],
      assigned: [],
      in_progress: [],
      review: [],
      done: [],
    };
    for (const task of filteredTasks ?? []) {
      if (task.status === "inbox" && (task.assignees ?? []).length > 0) {
        grouped["assigned"]?.push(task);
      } else {
        grouped[task.status]?.push(task);
      }
    }
    return grouped;
  }, [filteredTasks]);

  const agentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const activity of activities ?? []) {
      if (activity.agentId) {
        const key = activity.agentId.toString();
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
    return counts;
  }, [activities]);

  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    if (selectedAgentId) {
      return activities.filter((activity) => activity.agentId?.toString() === selectedAgentId);
    }
    if (agentFilter === "all") return activities;
    return activities.filter((activity) => activity.agentId?.toString() === agentFilter);
  }, [activities, agentFilter, selectedAgentId]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setTitleError(true);
      return;
    }

    const parsedTags = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    await createTask({
      title: title.trim(),
      description: description.trim() ? description.trim() : undefined,
      priority: priority as "low" | "medium" | "high" | "urgent",
      tags: parsedTags,
      assigneeIds: assignees.map((assignee) => assignee as Id<"agents">),
    });

    setTitle("");
    setDescription("");
    setPriority("medium");
    setTags("");
    setAssignees([]);
    setTitleError(false);
    setShowForm(false);
  };

  const handleCreateDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!docTitle.trim() || !docContent.trim() || !docAuthorId) return;
    await createDocument({
      title: docTitle.trim(),
      content: docContent.trim(),
      type: docType,
      taskId: docTaskId ? (docTaskId as Id<"tasks">) : undefined,
      authorId: docAuthorId as Id<"agents">,
    });

    setDocTitle("");
    setDocContent("");
    setDocType("deliverable");
    setDocTaskId("");
    setShowDocForm(false);
  };

  const timeString = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);

  const dateString = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(now);

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  const numberFormatter = useMemo(() => new Intl.NumberFormat("en-US"), []);
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  );

  const panelMeta = selectedAgent ? AGENT_PANEL_META[selectedAgent.name] : null;
  const panelLoading =
    (selectedAgent?.role === "Trading" && tradingData === undefined) ||
    (selectedAgent?.role === "Growth" && socialMetrics === undefined) ||
    (selectedAgent?.role === "Security" && securityScans === undefined) ||
    (selectedAgent?.role === "Jobs" && jobPipeline === undefined) ||
    (selectedAgent?.role === "Builder" && buildStatus === undefined);
  const panelEmpty =
    (selectedAgent?.role === "Trading" && tradingData === null) ||
    (selectedAgent?.role === "Growth" && socialMetrics === null) ||
    (selectedAgent?.role === "Security" && securityScans === null) ||
    (selectedAgent?.role === "Jobs" && jobPipeline === null) ||
    (selectedAgent?.role === "Builder" && buildStatus === null);

  const panelData = useMemo(() => {
    if (!selectedAgent) return null;

    if (selectedAgent.role === "Trading") {
      if (!tradingData) return null;
      const positions = tradingData.positions ?? [];
      return {
        summary: [
          {
            label: "Portfolio",
            value: currencyFormatter.format(tradingData.portfolioValue),
            helper: formatSignedPercent(tradingData.portfolioChange),
          },
          { label: "Monthly P&L", value: currencyFormatter.format(tradingData.monthlyPnl) },
          { label: "Win rate", value: `${tradingData.winRate.toFixed(1)}%` },
        ],
        sections: [
          {
            label: "Open positions",
            items:
              positions.length > 0
                ? positions.map((position) => ({
                    primary: position.pair,
                    secondary: position.direction,
                    tertiary: formatSignedPercent(position.pnlPercent),
                    status: position.pnlPercent >= 0 ? "good" : "bad",
                  }))
                : [{ primary: "No open positions" }],
          },
        ],
      };
    }

    if (selectedAgent.role === "Growth") {
      if (!socialMetrics) return null;
      return {
        summary: [
          {
            label: "Followers",
            value: numberFormatter.format(socialMetrics.followers),
            helper: `${formatSignedPercent(socialMetrics.followersWeekChange, 0)} this week`,
          },
          { label: "Views today", value: socialMetrics.viewsToday >= 1000 ? `~${Math.round(socialMetrics.viewsToday / 1000 * 10) / 10}K` : socialMetrics.viewsToday > 0 ? "<1K" : "0" },
          { label: "Engagement", value: `${socialMetrics.engagementRate.toFixed(1)}%` },
        ],
        sections: [
          {
            label: "Publishing",
            items: [
              {
                primary: "Scheduled posts",
                secondary: `${socialMetrics.scheduledPosts} queued`,
              },
              {
                primary: "Weekly growth",
                secondary: `${formatSignedPercent(socialMetrics.followersWeekChange, 0)} followers`,
              },
            ],
          },
        ],
      };
    }

    if (selectedAgent.role === "Security") {
      if (!securityScans) return null;
      return {
        summary: [
          { label: "Open ports", value: `${securityScans.openPorts}` },
          { label: "Last scan", value: timeAgo(securityScans.lastScanAt) },
          { label: "Firewall rules", value: `${securityScans.firewallRules} active` },
        ],
        sections: [
          {
            label: "Vulnerabilities",
            items: [
              {
                primary: "Critical",
                secondary: `${securityScans.criticalVulns}`,
                status: securityScans.criticalVulns === 0 ? "good" : "bad",
              },
              {
                primary: "Medium",
                secondary: `${securityScans.mediumVulns}`,
                status: securityScans.mediumVulns === 0 ? "good" : "warn",
              },
              {
                primary: "Low",
                secondary: `${securityScans.lowVulns}`,
                status: securityScans.lowVulns === 0 ? "good" : "warn",
              },
            ],
          },
          {
            label: "SSH defenses",
            items: [
              {
                primary: "Failed attempts (24h)",
                secondary: `${securityScans.failedSshAttempts} blocked`,
                status: "good",
              },
            ],
          },
        ],
      };
    }

    if (selectedAgent.role === "Jobs") {
      if (!jobPipeline) return null;
      return {
        summary: [
          { label: "Active applications", value: `${jobPipeline.activeApplications}` },
          {
            label: "Pipeline",
            value: `${jobPipeline.applied} Applied · ${jobPipeline.interviewing} Interview · ${jobPipeline.offers} Offer`,
          },
          { label: "New listings", value: `${jobPipeline.newListingsToday} today` },
        ],
        sections: [
          {
            label: "Pipeline stages",
            items: [
              { primary: "Applied", secondary: `${jobPipeline.applied}` },
              { primary: "Interviewing", secondary: `${jobPipeline.interviewing}` },
              { primary: "Offers", secondary: `${jobPipeline.offers}` },
            ],
          },
        ],
      };
    }

    if (selectedAgent.role === "Builder") {
      if (!buildStatus) return null;
      return {
        summary: [
          { label: "Active projects", value: `${buildStatus.activeProjects}` },
          { label: "Commits today", value: `${buildStatus.commitsToday}` },
          { label: "Builds", value: buildStatus.allGreen ? "All green" : "Needs attention" },
        ],
        sections: [
          {
            label: "Build health",
            items: [
              {
                primary: buildStatus.allGreen ? "Pipelines healthy" : "Failures detected",
                secondary: buildStatus.allGreen ? "No action required" : "Investigate failing jobs",
                status: buildStatus.allGreen ? "good" : "bad",
              },
            ],
          },
        ],
      };
    }

    if (selectedAgent.role === "Coordinator") {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const doneToday =
        tasks?.filter((task) => task.status === "done" && task.updatedAt >= startOfDay.getTime())
          .length ?? 0;
      const pendingReviews = tasks?.filter((task) => task.status === "review").length ?? 0;
      const utilization =
        agents && agents.length > 0
          ? Math.round((activeAgents.length / agents.length) * 100)
          : 0;

      return {
        summary: [
          { label: "Tasks completed", value: `${doneToday} today` },
          { label: "Pending reviews", value: `${pendingReviews}` },
          { label: "Utilization", value: `${utilization}%` },
        ],
        sections: [
          {
            label: "Standup",
            items: [
              { primary: "Next standup", secondary: "8:30 PM IST" },
              { primary: "Updates logged", secondary: `${activities?.length ?? 0} entries` },
            ],
          },
        ],
      };
    }

    return null;
  }, [
    selectedAgent,
    tradingData,
    socialMetrics,
    securityScans,
    jobPipeline,
    buildStatus,
    tasks,
    agents,
    activeAgents,
    activities,
    now,
    numberFormatter,
    currencyFormatter,
  ]);

  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    const filtered =
      docTypeFilter === "all" ? documents : documents.filter((doc) => doc.type === docTypeFilter);
    return [...filtered].sort((a, b) => b.createdAt - a.createdAt);
  }, [documents, docTypeFilter]);

  const selectedTask = (tasks ?? []).find((task) => task._id.toString() === selectedTaskId) ?? null;
  const selectedTaskConvexId = selectedTaskId ? (selectedTaskId as Id<"tasks">) : null;
  const taskMessages = useQuery(
    api.messages.listByTask,
    selectedTaskConvexId ? { taskId: selectedTaskConvexId } : "skip",
  );
  const taskSubscriptions = useQuery(
    api.subscriptions.listByTask,
    selectedTaskConvexId ? { taskId: selectedTaskConvexId } : "skip",
  );
  const taskSubscribers = useMemo(() => {
    if (!taskSubscriptions || !agents) return [];
    const agentMap = new Map(agents.map((agent) => [agent._id.toString(), agent]));
    return taskSubscriptions
      .map((subscription) => agentMap.get(subscription.agentId.toString()))
      .filter((agent): agent is Agent => Boolean(agent));
  }, [taskSubscriptions, agents]);

  const detailMentionOptions = useMemo(() => {
    if (!agents) return [];
    const query = detailMentionQuery.trim().toLowerCase();
    if (!query) return agents;
    return agents.filter((agent) => agent.name.toLowerCase().includes(query));
  }, [agents, detailMentionQuery]);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-white text-warm-900">
      <div className="flex w-full flex-col gap-0">
        <header className="flex items-center justify-between border-b border-warm-200 bg-white px-4 py-3">
          <div className="flex flex-col">
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-warm-400">CITADEL</span>
            <h1 className="text-lg font-semibold tracking-tight">Alliance Dashboard</h1>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <AnimatedCounter value={activeAgents.length} className="text-2xl font-bold tabular-nums" />
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-warm-400">Agents Active</p>
            </div>
            <div className="text-center">
              <AnimatedCounter value={tasksInQueue.length} className="text-2xl font-bold tabular-nums" />
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-warm-400">Tasks in Queue</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-lg font-semibold tabular-nums">{timeString}</p>
              <p className="text-xs text-warm-500">{dateString}</p>
            </div>
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" title="Online" />
          </div>
        </header>

        <main className="grid grid-cols-1 gap-0 overflow-hidden border-t border-warm-200 bg-white xl:grid-cols-[200px_minmax(0,1fr)_280px]">
          <section className="flex flex-col overflow-hidden xl:border-r xl:border-warm-200">
            <div className="flex h-10 items-center justify-between px-3 border-b border-warm-100">
              <span className="section-title">Agents</span>
              <span className="rounded-full bg-warm-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-warm-500">
                {agents?.length ?? 0}
              </span>
            </div>
            <div className="flex flex-col divide-y divide-warm-100 overflow-y-auto px-2">
              {(agents ?? []).map((agent) => {
                const isSelected = selectedAgentId === agent._id.toString();
                return (
                  <div
                    key={agent._id}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setSelectedAgentId((prev) =>
                        prev === agent._id.toString() ? null : agent._id.toString(),
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedAgentId((prev) =>
                          prev === agent._id.toString() ? null : agent._id.toString(),
                        );
                      }
                    }}
                    className={`flex cursor-pointer items-center gap-2 px-2 py-3 transition hover:bg-warm-50 ${
                      isSelected ? "border-l-2 border-[#D97706] bg-[#FFFBEB]" : ""
                    }`}
                  >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5F3EF] text-base">
                    {agent.avatarEmoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-xs font-semibold">{agent.name}</p>
                      <span className={`badge text-[0.6rem] px-1 py-0 ${LEVEL_BADGE[agent.level]}`}>
                        {agent.level === "lead" ? "LEAD" : agent.level === "intern" ? "INT" : "SPC"}
                      </span>
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${agent.status === "working" ? "bg-green-500" : agent.status === "blocked" ? "bg-red-500" : "bg-gray-400"}`} />
                    </div>
                    <p className="truncate text-[0.65rem] text-warm-500">{agent.role}</p>
                  </div>
                </div>
                );
              })}
            </div>
            {selectedAgent && panelMeta && (
              <div className="card flex flex-col gap-4 border border-warm-200 bg-white p-4">
                <div
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold ${panelMeta.accent}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{selectedAgent.avatarEmoji}</span>
                    <div>
                      <p className="text-[0.7rem] uppercase tracking-[0.2em]">{selectedAgent.name}</p>
                      <p className="text-[0.7rem] font-normal">{panelMeta.subtitle}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white/70 px-2 py-1 text-[0.65rem] uppercase tracking-[0.2em]">
                    {panelMeta.title}
                  </span>
                </div>

                {panelLoading && (
                  <div className="flex items-center justify-center py-6">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-warm-200 border-t-[#D97706]" />
                  </div>
                )}

                {!panelLoading && panelEmpty && (
                  <div className="rounded-lg border border-dashed border-warm-200 bg-[#F5F3EF] p-4 text-center text-xs text-warm-600">
                    No data yet
                  </div>
                )}

                {!panelLoading && !panelEmpty && panelData && (
                  <>
                    <div className="grid gap-3 text-[0.7rem] text-warm-700">
                      {panelData.summary.map((item) => {
                        const helper = (item as { helper?: string }).helper;
                        return (
                        <div
                          key={item.label}
                          className="flex items-center justify-between border-b border-dashed border-warm-200 pb-2 last:border-b-0 last:pb-0"
                        >
                          <span className="uppercase tracking-[0.2em] text-warm-500">{item.label}</span>
                          <span className="text-warm-900">
                            {item.value}
                            {helper && <span className="ml-2 text-[#D97706]">{helper}</span>}
                          </span>
                        </div>
                        );
                      })}
                    </div>

                    {panelData.sections.map((section) => (
                      <div key={section.label} className="flex flex-col gap-2">
                        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-warm-500">
                          {section.label}
                        </span>
                        <div className="flex flex-col gap-2">
                          {section.items.map((item, index) => {
                            const secondary = (item as { secondary?: string }).secondary;
                            const tertiary = (item as { tertiary?: string }).tertiary;
                            const status = (item as { status?: string }).status;
                            const tone =
                              status === "good"
                                ? "text-[#166534]"
                                : status === "bad"
                                  ? "text-[#991B1B]"
                                  : status === "warn"
                                    ? "text-[#B45309]"
                                    : "text-warm-700";
                            return (
                              <div
                                key={`${item.primary}-${index}`}
                                className="flex items-center justify-between rounded-lg border border-warm-200 bg-[#F5F3EF] px-3 py-2 text-[0.72rem]"
                              >
                                <div className="flex flex-col">
                                  <span className="font-semibold text-warm-900">{item.primary}</span>
                                  {secondary && (
                                    <span className="text-warm-600">{secondary}</span>
                                  )}
                                </div>
                                <div className={`text-right ${tone}`}>
                                  {tertiary && <div className="font-semibold">{tertiary}</div>}
                                  {status && !tertiary && <div className="font-semibold">●</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </section>

          <section className="flex flex-col overflow-hidden xl:border-r xl:border-warm-200">
            <div className="flex h-10 items-center justify-between px-3 border-b border-warm-100">
              <span className="section-title">Mission Queue</span>
              <button
                type="button"
                onClick={() => setShowForm((prev) => !prev)}
                className="rounded-full border border-warm-200 bg-white px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-warm-600 transition hover:border-[#D97706] hover:text-[#D97706]"
              >
                New Task
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleCreate} className="card flex flex-col gap-3 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                      Title
                    </label>
                    <input
                      className={`w-full rounded-lg border px-3 py-2 text-sm ${
                        titleError ? "border-[#EF4444]" : "border-warm-200"
                      }`}
                      placeholder="Task title"
                      value={title}
                      onChange={(event) => {
                        setTitle(event.target.value);
                        if (titleError && event.target.value.trim()) {
                          setTitleError(false);
                        }
                      }}
                    />
                    {titleError && (
                      <span className="text-[0.65rem] font-semibold text-[#B91C1C]">
                        Title is required.
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                      Priority
                    </label>
                    <select
                      className="w-full rounded-lg border border-warm-200 px-3 py-2 text-sm"
                      value={priority}
                      onChange={(event) => setPriority(event.target.value)}
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                    Description
                  </label>
                  <textarea
                    className="min-h-[90px] w-full rounded-lg border border-warm-200 px-3 py-2 text-sm"
                    placeholder="Description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                      Tags
                    </label>
                    <input
                      className="w-full rounded-lg border border-warm-200 px-3 py-2 text-sm"
                      placeholder="Tags (comma separated)"
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                      Assignees
                    </label>
                    <div className="flex max-h-[120px] flex-wrap gap-2 overflow-y-auto rounded-lg border border-warm-200 bg-white p-2 text-xs">
                      {(agents ?? []).map((agent) => {
                        const checked = assignees.includes(agent._id.toString());
                        return (
                          <label
                            key={agent._id}
                            className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 transition ${
                              checked
                                ? "border-[#D97706] bg-[#FEF3C7] text-[#92400E]"
                                : "border-warm-200 text-warm-600"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={checked}
                              onChange={() => {
                                setAssignees((prev) =>
                                  prev.includes(agent._id.toString())
                                    ? prev.filter((id) => id !== agent._id.toString())
                                    : [...prev, agent._id.toString()],
                                );
                              }}
                            />
                            <span className="text-base">{agent.avatarEmoji}</span>
                            <span>{agent.name}</span>
                          </label>
                        );
                      })}
                      {(agents ?? []).length === 0 && (
                        <span className="text-[0.7rem] text-warm-500">No agents available.</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-warm-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-warm-600"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-full bg-[#D97706] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
                  >
                    Create
                  </button>
                </div>
              </form>
            )}

            <div className="flex flex-1 flex-col gap-3 overflow-y-auto scrollbar-thin">
              {selectedAgentId && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-xs text-[#92400E]">
                  <span>
                    Showing tasks for: <span className="font-semibold">{selectedAgent?.name ?? "Agent"}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedAgentId(null)}
                    className="rounded-full border border-[#FDE68A] bg-white px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#92400E] transition hover:border-[#D97706] hover:text-[#D97706]"
                  >
                    Clear filter
                  </button>
                </div>
              )}
              <div className="grid flex-1 grid-cols-5 gap-2 overflow-x-hidden px-3 py-2">
                {STATUS_COLUMNS.map((column) => (
                  <div key={column.key} className="flex min-w-0 flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full ${column.dot}`} />
                        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-600">{column.label}</span>
                      </div>
                      <span className="rounded-full bg-warm-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-warm-500">
                        {tasksByStatus[column.key]?.length ?? 0}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {(tasksByStatus[column.key] ?? []).map((task) => (
                        <div
                          key={task._id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedTaskId(task._id.toString())}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedTaskId(task._id.toString());
                            }
                          }}
                          className="rounded-lg border border-warm-100 border-l-[3px] border-l-[#D97706] bg-white p-3 shadow-sm transition hover:shadow-md"
                        >
                          <div className="flex flex-col gap-1">
                            <p className="text-[0.8rem] font-semibold leading-snug text-warm-900">{task.title}</p>
                            {task.description && (
                              <p className="text-clamp-2 text-[0.7rem] leading-relaxed text-warm-500">{task.description}</p>
                            )}
                          </div>
                          {(task.tags ?? []).length > 0 && (
                            <div className="mt-2 flex flex-wrap items-center gap-1">
                              {(task.tags ?? []).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded border border-warm-200 bg-warm-50 px-1.5 py-0.5 text-[0.6rem] text-warm-600"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 flex items-center justify-between text-[0.65rem] text-warm-500">
                            <div className="flex items-center gap-1">
                              {(task.assignees ?? []).length === 0 && <span>Unassigned</span>}
                              {(task.assignees ?? []).map((assignee) => (
                                <span key={assignee._id} className="text-sm">
                                  {assignee.avatarEmoji}
                                </span>
                              ))}
                            </div>
                            <span>{timeAgo(task.updatedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {!selectedAgent ? (
            <section className="flex flex-col overflow-hidden">
              <div className="flex h-10 items-center justify-between px-3 border-b border-warm-100">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setRightPanel("feed")} className={`text-[0.65rem] font-semibold uppercase tracking-[0.2em] transition pb-1 ${rightPanel === "feed" ? "text-warm-900 border-b-2 border-[#D97706]" : "text-warm-400"}`}>Activity</button>
                  <button type="button" onClick={() => setRightPanel("docs")} className={`text-[0.65rem] font-semibold uppercase tracking-[0.2em] transition pb-1 ${rightPanel === "docs" ? "text-warm-900 border-b-2 border-[#D97706]" : "text-warm-400"}`}>Docs</button>
                </div>
                {rightPanel === "docs" && (
                <button
                  type="button"
                  onClick={() => setShowDocForm((prev) => !prev)}
                  className="rounded-full border border-warm-200 bg-white px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-warm-600 transition hover:border-[#D97706] hover:text-[#D97706]"
                >
                  + New
                </button>
                )}
              </div>
              {rightPanel === "docs" ? (
              <div>

              <div className="flex flex-col gap-4 px-3 py-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDocTypeFilter("all")}
                    className={`rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] transition ${
                      docTypeFilter === "all"
                        ? "border-[#D97706] bg-[#FEF3C7] text-[#92400E]"
                        : "border-warm-200 text-warm-600"
                    }`}
                  >
                    All
                  </button>
                  {DOCUMENT_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDocTypeFilter(type)}
                      className={`rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] transition ${
                        docTypeFilter === type
                          ? "border-[#D97706] bg-[#FEF3C7] text-[#92400E]"
                          : "border-warm-200 text-warm-600"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {showDocForm && (
                  <form
                    onSubmit={handleCreateDocument}
                    className="rounded-lg border border-warm-200 bg-[#FFF7ED] p-3"
                  >
                    <div className="flex flex-col gap-2">
                      <input
                        className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm"
                        placeholder="Document title"
                        value={docTitle}
                        onChange={(event) => setDocTitle(event.target.value)}
                      />
                      <div className="grid gap-2 md:grid-cols-2">
                        <select
                          className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs"
                          value={docType}
                          onChange={(event) =>
                            setDocType(event.target.value as (typeof DOCUMENT_TYPES)[number])
                          }
                        >
                          {DOCUMENT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </option>
                          ))}
                        </select>
                        <select
                          className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs"
                          value={docAuthorId}
                          onChange={(event) => setDocAuthorId(event.target.value)}
                        >
                          {agents?.length === 0 && <option value="">No agents available</option>}
                          {(agents ?? []).map((agent) => (
                            <option key={agent._id} value={agent._id.toString()}>
                              {agent.avatarEmoji} {agent.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <select
                        className="w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs"
                        value={docTaskId}
                        onChange={(event) => setDocTaskId(event.target.value)}
                      >
                        <option value="">Link to task (optional)</option>
                        {(tasks ?? []).map((task) => (
                          <option key={task._id} value={task._id.toString()}>
                            {task.title}
                          </option>
                        ))}
                      </select>
                      <textarea
                        className="min-h-[120px] w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm"
                        placeholder="Document content"
                        value={docContent}
                        onChange={(event) => setDocContent(event.target.value)}
                      />
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-warm-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-warm-600"
                        onClick={() => setShowDocForm(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded-full bg-[#D97706] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
                      >
                        Create
                      </button>
                    </div>
                  </form>
                )}

                <div className="flex max-h-[640px] flex-col gap-3 overflow-y-auto pr-2 scrollbar-thin">
                  {filteredDocuments.map((doc) => {
                    const isOpen = selectedDocId === doc._id.toString();
                    return (
                      <div key={doc._id} className="rounded-lg border border-warm-200 bg-white p-3">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedDocId((prev) =>
                              prev === doc._id.toString() ? null : doc._id.toString(),
                            )
                          }
                          className="flex w-full items-start justify-between gap-3 text-left"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-warm-900">{doc.title}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-warm-600">
                              <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${DOC_TYPE_BADGE[doc.type]}`}>
                                {doc.type.toUpperCase()}
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="text-base">{doc.author?.avatarEmoji ?? "📝"}</span>
                                <span>{doc.author?.name ?? "Unknown"}</span>
                              </span>
                              <span>{timeAgo(doc.createdAt)}</span>
                            </div>
                          </div>
                          <span className="text-xs text-warm-500">{isOpen ? "Collapse" : "Expand"}</span>
                        </button>
                        {isOpen && (
                          <div className="mt-3 rounded-lg border border-dashed border-warm-200 bg-[#F5F3EF] p-3 text-sm text-warm-700 whitespace-pre-wrap">
                            {linkifyContent(doc.content)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredDocuments.length === 0 && (
                    <div className="rounded-lg border border-dashed border-warm-200 bg-[#F5F3EF] p-6 text-center text-sm text-warm-600">
                      No documents yet. Create the first one.
                    </div>
                  )}
                </div>
              </div>
              </div>
              ) : (
              <div className="flex flex-col gap-4 px-3 py-2">
                <div className="flex flex-wrap gap-2">
                  {FEED_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setFeedTab(tab.key)}
                      className={`rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] transition ${
                        feedTab === tab.key
                          ? "border-[#D97706] bg-[#FEF3C7] text-[#92400E]"
                          : "border-warm-200 text-warm-600"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAgentFilter("all")}
                    className={`pill ${agentFilter === "all" ? "!border-[#D97706] !bg-[#FEF3C7] !text-[#92400E]" : ""}`}
                  >
                    All Agents
                  </button>
                  {(agents ?? []).map((agent) => (
                    <button
                      key={agent._id}
                      type="button"
                      onClick={() => setAgentFilter(agent._id.toString())}
                      className={`pill ${
                        agentFilter === agent._id.toString() ? "!border-[#D97706] !bg-[#FEF3C7] !text-[#92400E]" : ""
                      }`}
                    >
                      <span>{agent.avatarEmoji}</span>
                      <span>{agentCounts[agent._id.toString()] ?? 0}</span>
                    </button>
                  ))}
                </div>
                <form onSubmit={handleSendMessage} className="rounded-lg border border-warm-200 bg-[#FFF7ED] p-3">
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="min-w-[180px] flex-1 rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs"
                      value={messageTaskId}
                      onChange={(event) => setMessageTaskId(event.target.value)}
                    >
                      {tasks?.length === 0 && <option value="">No tasks available</option>}
                      {(tasks ?? []).map((task) => (
                        <option key={task._id} value={task._id.toString()}>
                          {task.title}
                        </option>
                      ))}
                    </select>
                    <select
                      className="min-w-[160px] flex-1 rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs"
                      value={messageAgentId}
                      onChange={(event) => setMessageAgentId(event.target.value)}
                    >
                      {agents?.length === 0 && <option value="">No agents available</option>}
                      {(agents ?? []).map((agent) => (
                        <option key={agent._id} value={agent._id.toString()}>
                          {agent.avatarEmoji} {agent.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="relative mt-2">
                    <textarea
                      ref={messageInputRef}
                      className="min-h-[90px] w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm"
                      placeholder="Write an update… Use @ to mention an agent."
                      value={messageContent}
                      onChange={handleMessageChange}
                    />
                    {showMentions && (
                      <div className="absolute left-0 top-full z-10 mt-2 w-full rounded-lg border border-warm-200 bg-white shadow-card">
                        {mentionOptions.length === 0 && (
                          <div className="px-3 py-2 text-xs text-warm-500">No matches</div>
                        )}
                        {mentionOptions.map((agent) => (
                          <button
                            key={agent._id}
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              handleMentionSelect(agent);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-warm-700 transition hover:bg-[#FFF7ED]"
                          >
                            <span className="text-base">{agent.avatarEmoji}</span>
                            <span className="font-semibold">{agent.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={!canSendMessage}
                      className={`rounded-full px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white ${
                        canSendMessage ? "bg-[#D97706] hover:bg-[#C56A05]" : "cursor-not-allowed bg-[#D6D3D1]"
                      }`}
                    >
                      Post
                    </button>
                  </div>
                </form>
                <div className="flex max-h-[640px] flex-col gap-3 overflow-y-auto pr-2 scrollbar-thin">
                  {filteredActivities.map((activity) => (
                    <div key={activity._id} className="flex gap-3 rounded-lg border border-warm-200 bg-white p-3">
                      <div className="mt-2 h-2 w-2 rounded-full bg-[#16A34A]" />
                      <div className="flex-1">
                        <p className="text-sm text-warm-900">
                          <span className="font-semibold">
                            {activity.agent?.name ?? "System"}
                          </span>{" "}
                          <span>{activity.description}</span>
                        </p>
                        <p className="mt-1 text-xs text-warm-600">
                          {(activity.agent?.name ?? "System")} · {timeAgo(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {filteredActivities.length === 0 && (
                    <div className="rounded-lg border border-dashed border-warm-200 bg-[#F5F3EF] p-6 text-center text-sm text-warm-600">
                      No activity yet. Updates will appear as missions progress.
                    </div>
                  )}
                </div>
              </div>
              )}
            </section>
          ) : (
            <section className="flex flex-col gap-3 overflow-hidden px-3 pt-3 pb-3">
              <div className="flex items-center justify-between">
                <span className="section-title">Live Feed</span>
                <span className="badge bg-[#DCFCE7] text-[#166534]">Live</span>
              </div>
            </section>
          )}
        </main>
      </div>

      {selectedTask && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button
            type="button"
            aria-label="Close task detail"
            onClick={() => setSelectedTaskId(null)}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          />
          <aside className="relative z-50 flex h-full w-full max-w-[520px] flex-col gap-4 overflow-y-auto border-l border-warm-200 bg-[#FFFCF7] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <span className="section-title">Task Detail</span>
                <h2 className="text-2xl font-semibold text-warm-900">{selectedTask.title}</h2>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`badge ${TASK_STATUS_BADGE[selectedTask.status]}`}>
                    {selectedTask.status.replace("_", " ").toUpperCase()}
                  </span>
                  <span className={`badge ${PRIORITY_BADGE[selectedTask.priority]}`}>
                    {selectedTask.priority.toUpperCase()}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTaskId(null)}
                className="rounded-full border border-warm-200 bg-white px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-600 transition hover:border-[#D97706] hover:text-[#D97706]"
              >
                Close
              </button>
            </div>

            <div className="card flex flex-col gap-4 border border-warm-200 bg-white p-4 shadow-card">
              <div className="flex flex-col gap-2 text-sm text-warm-700">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                  Description
                </span>
                <p className="whitespace-pre-wrap">
                  {selectedTask.description?.trim() ? selectedTask.description : "No description yet."}
                </p>
              </div>

              <div className="grid gap-3 text-xs text-warm-600">
                <div className="flex items-center justify-between">
                  <span className="uppercase tracking-[0.2em] text-warm-500">Status</span>
                  <select
                    className="rounded-full border border-warm-200 bg-white px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-600"
                    value={selectedTask.status}
                    onChange={(event) =>
                      updateTaskStatus({
                        id: selectedTask._id,
                        status: event.target.value as (typeof STATUS_COLUMNS)[number]["key"],
                        agentId: detailMessageAgentId
                          ? (detailMessageAgentId as Id<"agents">)
                          : undefined,
                      })
                    }
                  >
                    {STATUS_COLUMNS.map((status) => (
                      <option key={status.key} value={status.key}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="uppercase tracking-[0.2em] text-warm-500">Created</span>
                  <span>{dateTimeFormatter.format(selectedTask.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="uppercase tracking-[0.2em] text-warm-500">Updated</span>
                  <span>{dateTimeFormatter.format(selectedTask.updatedAt)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                  Assignees
                </span>
                <div className="flex flex-wrap gap-2">
                  {(selectedTask.assignees ?? []).length === 0 && (
                    <span className="text-xs text-warm-500">Unassigned</span>
                  )}
                  {(selectedTask.assignees ?? []).map((assignee) => (
                    <span
                      key={assignee._id}
                      className="flex items-center gap-2 rounded-full border border-warm-200 bg-[#F5F3EF] px-3 py-1 text-xs text-warm-700"
                    >
                      <span className="text-base">{assignee.avatarEmoji}</span>
                      <span>{assignee.name}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                  Tags
                </span>
                <div className="flex flex-wrap gap-2">
                  {(selectedTask.tags ?? []).length === 0 && (
                    <span className="text-xs text-warm-500">No tags yet.</span>
                  )}
                  {(selectedTask.tags ?? []).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[#F5F3EF] px-2 py-1 text-[0.65rem] font-semibold text-warm-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                  Subscribers
                </span>
                <div className="flex flex-wrap gap-2">
                  {taskSubscribers.length === 0 && (
                    <span className="text-xs text-warm-500">No subscribers yet.</span>
                  )}
                  {taskSubscribers.map((agent) => (
                    <div
                      key={agent._id}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-warm-200 bg-white text-lg"
                      title={agent.name}
                    >
                      {agent.avatarEmoji}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card flex flex-col gap-3 border border-warm-200 bg-white p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="section-title">Comments</span>
                <span className="badge bg-[#F3F4F6] text-[#6B7280]">{taskMessages?.length ?? 0}</span>
              </div>
              <div className="flex max-h-[280px] flex-col gap-3 overflow-y-auto pr-1 scrollbar-thin">
                {(taskMessages ?? []).map((message) => (
                  <div key={message._id} className="flex gap-3 rounded-lg border border-warm-200 bg-[#FFFBF5] p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg">
                      {message.agent?.avatarEmoji ?? "💬"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs text-warm-500">
                        <span className="font-semibold text-warm-800">
                          {message.agent?.name ?? "Unknown"}
                        </span>
                        <span>{timeAgo(message.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm text-warm-800 whitespace-pre-wrap">{linkifyContent(message.content)}</p>
                    </div>
                  </div>
                ))}
                {(taskMessages ?? []).length === 0 && (
                  <div className="rounded-lg border border-dashed border-warm-200 bg-[#F5F3EF] p-4 text-center text-sm text-warm-600">
                    No comments yet. Start the thread.
                  </div>
                )}
              </div>

              <form onSubmit={handleSendDetailMessage} className="rounded-lg border border-warm-200 bg-[#FFF7ED] p-3">
                <div className="flex flex-wrap gap-2">
                  <select
                    className="min-w-[160px] flex-1 rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs"
                    value={detailMessageAgentId}
                    onChange={(event) => setDetailMessageAgentId(event.target.value)}
                  >
                    {agents?.length === 0 && <option value="">No agents available</option>}
                    {(agents ?? []).map((agent) => (
                      <option key={agent._id} value={agent._id.toString()}>
                        {agent.avatarEmoji} {agent.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="relative mt-2">
                  <textarea
                    ref={detailMessageInputRef}
                    className="min-h-[80px] w-full rounded-lg border border-warm-200 bg-white px-3 py-2 text-sm"
                    placeholder="Write a comment… Use @ to mention an agent."
                    value={detailMessageContent}
                    onChange={handleDetailMessageChange}
                  />
                  {showDetailMentions && (
                    <div className="absolute left-0 top-full z-10 mt-2 w-full rounded-lg border border-warm-200 bg-white shadow-card">
                      {detailMentionOptions.length === 0 && (
                        <div className="px-3 py-2 text-xs text-warm-500">No matches</div>
                      )}
                      {detailMentionOptions.map((agent) => (
                        <button
                          key={agent._id}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleDetailMentionSelect(agent);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-warm-700 transition hover:bg-[#FFF7ED]"
                        >
                          <span className="text-base">{agent.avatarEmoji}</span>
                          <span className="font-semibold">{agent.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  
                  <button
                    type="submit"
                    disabled={!canSendDetailMessage}
                    className={`rounded-full px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white ${
                      canSendDetailMessage
                        ? "bg-[#D97706] hover:bg-[#C56A05]"
                        : "cursor-not-allowed bg-[#D6D3D1]"
                    }`}
                  >
                    Post
                  </button>
                </div>
              </form>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
