"use client";

import { useEffect, useMemo, useRef, useState, useCallback, type ChangeEvent, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import Image from "next/image";
import { api } from "../../convex/_generated/api";

const AGENT_AVATARS: Record<string, string> = {
  Buddy: "/avatars/buddy.jpg",
  Katy: "/avatars/katy.jpg",
  Elon: "/avatars/elon.jpg",
  Jerry: "/avatars/jerry.jpg",
  Burry: "/avatars/burry.jpg",
  Mike: "/avatars/mike.jpg",
  Rand: "/avatars/rand.jpg",
  Ryan: "/avatars/ryan.jpg",
  Harvey: "/avatars/harvey.jpg",
};

function AgentAvatar({ name, size = 24, className = "" }: { name: string; size?: number; className?: string }) {
  const src = AGENT_AVATARS[name];
  if (!src) return <span className={className}>🤖</span>;
  return (
    <Image
      src={src}
      alt={name}
      width={size}
      height={size}
      className={`rounded-full object-cover shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

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

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      return <h2 key={i} className="mt-4 mb-1 text-lg font-bold text-warm-900">{trimmed.slice(3)}</h2>;
    }
    if (trimmed.startsWith("### ")) {
      return <h3 key={i} className="mt-3 mb-1 text-base font-semibold text-warm-800">{trimmed.slice(4)}</h3>;
    }
    if (trimmed.startsWith("# ")) {
      return <h1 key={i} className="mt-4 mb-2 text-xl font-bold text-warm-900">{trimmed.slice(2)}</h1>;
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const content = trimmed.slice(2);
      return <li key={i} className="ml-4 list-disc text-warm-700">{renderInline(content)}</li>;
    }
    if (trimmed === "") {
      return <div key={i} className="h-2" />;
    }
    return <p key={i} className="text-warm-700 leading-relaxed">{renderInline(trimmed)}</p>;
  });
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-warm-900">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

const STATUS_COLUMNS = [
  { key: "inbox", label: "INBOX", dot: "bg-gray-400" },
  { key: "assigned", label: "ASSIGNED", dot: "bg-yellow-400" },
  { key: "in_progress", label: "IN PROGRESS", dot: "bg-orange-500" },
  { key: "review", label: "REVIEW", dot: "bg-blue-500" },
  { key: "done", label: "DONE", dot: "bg-green-500" },
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

const CRON_EMPLOYEES_MAIN = [
  { id: "c6e6ed3b", name: "Buddy", cronLabel: "coordinator" },
  { id: "f6a4c7ae", name: "Mike", cronLabel: "security" },
  { id: "2ecada74", name: "Katy", cronLabel: "social" },
  { id: "56710293", name: "Burry", cronLabel: "trading" },
  { id: "0d18550f", name: "Jerry", cronLabel: "jobs" },
  { id: "6a4c5e47", name: "Elon", cronLabel: "build" },
];

const CRON_EMPLOYEES_DASHPANE = [
  { id: "cb57af04", name: "Buddy", cronLabel: "buddy" },
  { id: "5dc5b267", name: "Katy", cronLabel: "katy" },
  { id: "01c4a381", name: "Elon", cronLabel: "elon" },
  { id: "d85b71e5", name: "Ryan", cronLabel: "ryan" },
  { id: "c3eba68f", name: "Harvey", cronLabel: "harvey" },
  { id: "f5a7fa3a", name: "Rand", cronLabel: "rand" },
];

export default function Home() {
  const agents = useQuery(api.agents.list);
  const tasks = useQuery(api.tasks.list);
  const [activeWorkspace, setActiveWorkspace] = useState<"main" | "dashpane">("dashpane");
  const MAIN_AGENTS = ["Buddy", "Katy", "Elon", "Jerry", "Mike", "Burry"];
  const DASHPANE_AGENTS = ["Buddy", "Katy", "Elon", "Ryan", "Harvey", "Rand"];
  const [feedTab, setFeedTab] = useState<(typeof FEED_TABS)[number]["key"]>("all");
  const [rightPanel, setRightPanel] = useState<"feed" | "docs" | "status">("feed");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const feedTabTarget = FEED_TABS.find((tab) => tab.key === feedTab)?.target;
  const activities = useQuery(api.activities.list, {
    targetType:
      rightPanel === "status" && !selectedAgentId
        ? undefined
        : feedTabTarget ?? undefined,
  });
  const documents = useQuery(api.documents.list);
  const decisions = useQuery(api.decisions.list);
  const notifications = useQuery(api.notifications.listAll);

  const seedAgents = useMutation(api.agents.seed);
  const seedDomainData = useMutation(api.domain.seedDomainData);
  const createTask = useMutation(api.tasks.create);
  const removeTask = useMutation(api.tasks.remove);
  const createMessage = useMutation(api.messages.create);
  const createDocument = useMutation(api.documents.create);
  const updateTaskStatus = useMutation(api.tasks.updateStatus);
  const updateTask = useMutation(api.tasks.update);
  const subscribeAgent = useMutation(api.subscriptions.subscribe);
  const unsubscribeAgent = useMutation(api.subscriptions.unsubscribe);
  const resolveDecision = useMutation(api.decisions.resolveWithNotify);
  const addDecisionComment = useMutation(api.decisions.addComment);
  const markNotificationRead = useMutation(api.notifications.markRead);

  const [now, setNow] = useState(() => new Date());
  const [mounted, setMounted] = useState(false);
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
  const [fullViewDocId, setFullViewDocId] = useState<string | null>(null);
  const [showDocForm, setShowDocForm] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docType, setDocType] = useState<(typeof DOCUMENT_TYPES)[number]>("deliverable");
  const [docTaskId, setDocTaskId] = useState("");
  const [docAuthorId, setDocAuthorId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [scrollToCommentId, setScrollToCommentId] = useState<string | null>(null);
  const [isTaskExpanded, setIsTaskExpanded] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedNotificationAgentId, setSelectedNotificationAgentId] = useState<string | null>(null);
  const [detailMessageContent, setDetailMessageContent] = useState("");
  const [detailMessageAgentId, setDetailMessageAgentId] = useState("");
  const [showDetailMentions, setShowDetailMentions] = useState(false);
  const [detailMentionQuery, setDetailMentionQuery] = useState("");
  const [detailMentionAnchor, setDetailMentionAnchor] = useState<number | null>(null);
  const detailMessageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [decisionCommentDrafts, setDecisionCommentDrafts] = useState<Record<string, string>>({});
  const [profileAgentId, setProfileAgentId] = useState<string | null>(null);
  const [cronState, setCronState] = useState<{
    crons: { id: string; label: string; name: string; enabled: boolean }[];
    allEnabled: boolean;
    allDisabled: boolean;
  } | null>(null);
  const [cronLoading, setCronLoading] = useState(false);
  const [cronItemLoading, setCronItemLoading] = useState<string | null>(null);
  const [cronExpanded, setCronExpanded] = useState(false);

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
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchCrons = async () => {
      try {
        const res = await fetch("/api/crons");
        if (res.ok) {
          const data = await res.json();
          setCronState(data);
        }
      } catch {}
    };
    fetchCrons();
    const interval = setInterval(fetchCrons, 30000);
    return () => clearInterval(interval);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedTaskId) {
        if (isTaskExpanded) {
          setIsTaskExpanded(false);
        } else {
          setSelectedTaskId(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTaskId, isTaskExpanded]);

  const visibleAgents = (agents ?? []).filter(a =>
    activeWorkspace === "main"
      ? MAIN_AGENTS.includes(a.name)
      : DASHPANE_AGENTS.includes(a.name)
  );
  const activeAgents = visibleAgents.filter((agent) => agent.status === "working");
  const tasksInQueue = (tasks ?? []).filter((task) => {
    if (task.status === "done") return false;
    if (activeWorkspace === "dashpane") return task.tags?.includes("dashpane-launch");
    return !task.tags?.includes("dashpane-launch");
  });
  const unreadNotifications =
    notifications?.filter((notification) => !notification.read) ?? [];
  // notificationCount only counts workspace-relevant unread notifications
  const dashpaneTaskIdsForCount = new Set((tasks ?? []).filter(t => t.tags?.includes("dashpane-launch")).map(t => t._id.toString()));
  const notificationCount = unreadNotifications.filter((n) => {
    if (n.sourceTaskId) {
      const isDashpane = dashpaneTaskIdsForCount.has(n.sourceTaskId.toString());
      return activeWorkspace === "dashpane" ? isDashpane : !isDashpane;
    }
    const workspaceAgents = activeWorkspace === "dashpane" ? DASHPANE_AGENTS : MAIN_AGENTS;
    return workspaceAgents.includes(n.agentName ?? "");
  }).length;
  const filteredNotifications = useMemo(() => {
    const dpTaskIds = new Set((tasks ?? []).filter(t => t.tags?.includes("dashpane-launch")).map(t => t._id.toString()));
    const ordered = [...(notifications ?? [])]
      .filter((n) => {
        if (n.sourceTaskId) {
          const isDashpane = dpTaskIds.has(n.sourceTaskId.toString());
          return activeWorkspace === "dashpane" ? isDashpane : !isDashpane;
        }
        const workspaceAgents = activeWorkspace === "dashpane" ? DASHPANE_AGENTS : MAIN_AGENTS;
        return workspaceAgents.includes(n.agentName ?? "");
      })
      .sort((a, b) => b.createdAt - a.createdAt);
    if (!selectedNotificationAgentId) return ordered;
    return ordered.filter((notification) => notification.agentId === selectedNotificationAgentId);
  }, [notifications, selectedNotificationAgentId, activeWorkspace, tasks]);

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

  const [dmText, setDmText] = useState("");
  const [dmSending, setDmSending] = useState(false);
  const [dmSent, setDmSent] = useState(false);

  const AGENT_BIOS: Record<string, string> = {
    Ryan: "Named after Ryan Hoover (PH founder). Owns Product Hunt launch day, Reddit communities, and Show HN. Replies to every comment within 15 minutes on launch day.",
    Harvey: "Named after Harvey Specter. Never takes no for an answer. Researches and drafts cold outreach to macOS newsletters, blogs, and YouTubers. Every email is personal.",
    Rand: "Named after Rand Fishkin (Moz). Thinks in keywords and conversion funnels. Audits dashpane.pro SEO, tracks rankings, optimises what converts.",
    Buddy: "Chief of Staff. Coordinates the whole team. You talk to Buddy, Buddy delegates. Nothing falls through the cracks.",
    Katy: "Growth & social. Owns X, LinkedIn, and Reddit content for the launch. All DashPane launch week content goes through her.",
    Elon: "Builder. Makes dashpane.pro launch-ready. Handles website fixes, PH badge, conversion improvements.",
  };

  const AGENT_SESSION_KEYS: Record<string, string> = {
    Ryan: "agent:ryan:main",
    Harvey: "agent:harvey:main",
    Rand: "agent:rand:main",
    Buddy: "agent:main:main",
    Katy: "agent:kt:main",
    Elon: "agent:builder:main",
  };

  const handleSendDm = async (agentName: string) => {
    const trimmed = dmText.trim();
    if (!trimmed) return;
    const sessionKey = AGENT_SESSION_KEYS[agentName];
    if (!sessionKey) return;
    setDmSending(true);
    try {
      await fetch("/api/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey, message: trimmed }),
      });
      setDmText("");
      setDmSent(true);
      setTimeout(() => setDmSent(false), 2000);
    } catch {
      // silent fail
    } finally {
      setDmSending(false);
    }
  };

  const profileAgent = (agents ?? []).find((a) => a._id.toString() === profileAgentId);
  const profileAgentConvexId = profileAgentId ? (profileAgentId as Id<"agents">) : null;

  const profileMessageCount = useQuery(
    api.messages.countByAgent,
    profileAgentConvexId ? { agentId: profileAgentConvexId } : "skip",
  );
  const profileDocuments = useQuery(
    api.documents.listByAgent,
    profileAgentConvexId ? { agentId: profileAgentConvexId } : "skip",
  );
  const profileActivities = useQuery(
    api.activities.listByAgent,
    profileAgentConvexId ? { agentId: profileAgentConvexId } : "skip",
  );

  const profileStats = useMemo(() => {
    if (!profileAgent || !tasks) return null;
    const agentId = profileAgent._id.toString();
    const completedTasks = (tasks ?? []).filter(
      (t) => t.status === "done" && t.assigneeIds.some((id) => id.toString() === agentId),
    );
    const allAgentTasks = (tasks ?? []).filter(
      (t) => t.assigneeIds.some((id) => id.toString() === agentId),
    );
    const currentTasks = allAgentTasks.filter((t) => t.status === "in_progress");
    const docCount = (documents ?? []).filter(
      (d) => d.authorId?.toString() === agentId,
    ).length;

    return {
      tasksCompleted: completedTasks.length,
      documentsCreated: docCount,
      commentsPosted: profileMessageCount ?? 0,
      lastActive: profileAgent.lastActive,
      currentTask: profileAgent.currentTask,
      completedHistory: completedTasks
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 10),
      currentTasks,
    };
  }, [profileAgent, tasks, documents, profileMessageCount]);

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    // First filter by workspace
    const workspaceTasks = tasks.filter(t =>
      activeWorkspace === "main"
        ? !t.tags?.includes("dashpane-launch")
        : t.tags?.includes("dashpane-launch")
    );
    if (!selectedAgentId) return workspaceTasks;
    return workspaceTasks.filter((task) =>
      (task.assigneeIds ?? []).some((assigneeId) => assigneeId.toString() === selectedAgentId),
    );
  }, [tasks, selectedAgentId, activeWorkspace]);

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

  const handleDecisionResolve = async (decisionId: string, option: string) => {
    const normalized = option.toLowerCase();
    let status: "approved" | "rejected" | "resolved" = "resolved";
    if (normalized.includes("approve")) status = "approved";
    if (normalized.includes("reject") || normalized.includes("deny")) status = "rejected";
    await resolveDecision({
      id: decisionId as Id<"decisions">,
      status,
      resolution: option,
    });
  };

  const handleDecisionCommentChange = (decisionId: string, value: string) => {
    setDecisionCommentDrafts((prev) => ({ ...prev, [decisionId]: value }));
  };

  const handleDecisionCommentSubmit = async (decisionId: string) => {
    const text = decisionCommentDrafts[decisionId]?.trim();
    if (!text) return;
    // addComment now auto-resolves the decision and notifies the agent
    await addDecisionComment({ id: decisionId as Id<"decisions">, text });
    setDecisionCommentDrafts((prev) => ({ ...prev, [decisionId]: "" }));
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    const confirmed = window.confirm(`Delete "${selectedTask.title}"? This cannot be undone.`);
    if (!confirmed) return;
    await removeTask({ id: selectedTask._id });
    setSelectedTaskId(null);
  };

  const handleNotificationClick = useCallback(
    async (notification: NonNullable<typeof notifications>[number]) => {
      if (!notification.read) {
        await markNotificationRead({ id: notification._id });
      }
      if (notification.sourceTaskId) {
        setSelectedTaskId(notification.sourceTaskId.toString());
      }
    },
    [markNotificationRead],
  );

  const handleMarkAllNotificationsRead = useCallback(async () => {
    if (unreadNotifications.length === 0) return;
    await Promise.all(
      unreadNotifications.map((notification) => markNotificationRead({ id: notification._id })),
    );
  }, [markNotificationRead, unreadNotifications]);

  const handleCronToggle = async () => {
    if (cronLoading || cronItemLoading || !cronState) return;
    setCronLoading(true);
    try {
      // Get workspace-specific crons
      const workspaceCrons = cronState.crons.filter((c: Record<string, unknown>) =>
        activeWorkspace === "dashpane"
          ? String(c.name).startsWith("dp-citadel-")
          : (c.isCitadelPush && !String(c.name).startsWith("dp-citadel-"))
      );
      const allOn = workspaceCrons.every((c: Record<string, unknown>) => c.enabled);
      // Toggle each individually
      for (const cron of workspaceCrons) {
        await fetch("/api/crons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "toggle", cronId: cron.id, enabled: !allOn }),
        });
      }
      const freshRes = await fetch("/api/crons");
      if (freshRes.ok) setCronState(await freshRes.json());
    } catch {} finally {
      setCronLoading(false);
    }
  };

  const handleCronItemToggle = async (cronId: string, enabled: boolean) => {
    if (cronLoading || cronItemLoading || !cronState) return;
    setCronItemLoading(cronId);
    try {
      const res = await fetch("/api/crons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", cronId, enabled }),
      });
      if (res.ok) {
        const freshRes = await fetch("/api/crons");
        if (freshRes.ok) setCronState(await freshRes.json());
      }
    } catch {} finally {
      setCronItemLoading(null);
    }
  };

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

  const workspaceAgentNames = activeWorkspace === "main" ? MAIN_AGENTS : DASHPANE_AGENTS;

  const pendingDecisions = useMemo(
    () => (decisions ?? []).filter((decision) => {
      if (decision.status !== "pending") return false;
      // Prefer workspace field for scoping; fall back to agent-name
      if ((decision as any).workspace) {
        return (decision as any).workspace === activeWorkspace;
      }
      const agentName = decision.agent?.name;
      return !agentName || workspaceAgentNames.includes(agentName);
    }),
    [decisions, workspaceAgentNames, activeWorkspace],
  );

  // Must be declared before agentCounts and filteredActivities
  const dashpaneTaskIdsPre = useMemo(() => {
    const ids = new Set<string>();
    for (const task of tasks ?? []) {
      if (task.tags?.includes("dashpane-launch")) ids.add(task._id.toString());
    }
    return ids;
  }, [tasks]);

  const agentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    // Use feedActivities so counts always match the active tab filter
    for (const activity of feedActivities) {
      if (activity.agentId) {
        const key = activity.agentId.toString();
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
    return counts;
  }, [feedActivities]);

  const DASHPANE_ONLY_AGENTS = ["Ryan", "Harvey", "Rand"];
  const MAIN_ONLY_AGENTS = ["Jerry", "Mike", "Burry"];

  const dashpaneTaskIds = dashpaneTaskIdsPre;

  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    const workspaceFiltered = activities.filter((activity) => {
      // Exclude heartbeat status noise from activity feed
      if (activity.action === "status" && activity.targetType === "agent") return false;
      const agentName = activity.agent?.name;
      // Unique-workspace agents: easy filter
      if (activeWorkspace === "dashpane" && MAIN_ONLY_AGENTS.includes(agentName ?? "")) return false;
      if (activeWorkspace === "main" && DASHPANE_ONLY_AGENTS.includes(agentName ?? "")) return false;
      // Shared agents (Buddy/Katy/Elon): filter by whether their activity targets a DashPane task
      const sharedAgents = ["Buddy", "Katy", "Elon"];
      if (agentName && sharedAgents.includes(agentName)) {
        if (activity.targetType === "task" && activity.targetId) {
          const isDashpaneTask = dashpaneTaskIds.has(activity.targetId.toString());
          return activeWorkspace === "dashpane" ? isDashpaneTask : !isDashpaneTask;
        }
        // Non-task activities from shared agents (create, comment, etc): show in both workspaces
        return true;
      }
      return true;
    });
    if (selectedAgentId) {
      return workspaceFiltered.filter((activity) => activity.agentId?.toString() === selectedAgentId);
    }
    if (agentFilter === "all") return workspaceFiltered;
    return workspaceFiltered.filter((activity) => activity.agentId?.toString() === agentFilter);
  }, [activities, agentFilter, selectedAgentId, workspaceAgentNames]);

  const feedActivities = useMemo(
    () => filteredActivities.filter((activity) => activity.action !== "status"),
    [filteredActivities],
  );

  const statusActivities = useMemo(
    () => (activities ?? []).filter((activity) => {
      if (activity.action !== "status") return false;
      const agentName = activity.agent?.name;
      return !agentName || workspaceAgentNames.includes(agentName);
    }),
    [activities, workspaceAgentNames],
  );

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
    // Filter by workspace using task-derived workspace field
    const workspaceFiltered = documents.filter((doc) => {
      if (doc.workspace) return doc.workspace === activeWorkspace;
      // Fallback for docs without task: use author name, but only match exclusive agents
      const authorName = doc.author?.name;
      return !authorName || workspaceAgentNames.includes(authorName);
    });
    const filtered =
      docTypeFilter === "all" ? workspaceFiltered : workspaceFiltered.filter((doc) => doc.type === docTypeFilter);
    return [...filtered].sort((a, b) => b.createdAt - a.createdAt);
  }, [documents, docTypeFilter, activeWorkspace, workspaceAgentNames]);

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

  const renderActivityCards = (
    activityItems: typeof filteredActivities,
    emptyMessage: string,
  ) => (
    <div className="flex max-h-[640px] flex-col gap-3 overflow-y-auto pr-2 scrollbar-thin">
      {activityItems.map((activity) =>
        activity.targetId ? (
          <button
            key={activity._id}
            type="button"
            onClick={() => {
              if (activity.targetType === "task" && activity.targetId) {
                setSelectedTaskId(activity.targetId);
                setScrollToCommentId(null);
              } else if (activity.targetType === "document" && activity.targetId) {
                setFullViewDocId(activity.targetId);
              } else if ((activity.targetType === "comment" || activity.targetType === "message" || activity.action === "comment") && activity.targetId) {
                // Comment on a task — open the task and scroll to the comment
                // targetId for comments is the message/comment ID; find the task via description
                const taskMatch = activity.description?.match(/[a-z0-9]{20,}/);
                if (taskMatch) setScrollToCommentId(activity.targetId);
                // Try to find which task this comment belongs to by looking at taskMessages or use sourceTaskId
                // For now open whichever task is currently selected or find from description
                const descTaskId = (tasks ?? []).find(t => 
                  activity.description?.includes(t.title?.slice(0, 20) ?? "")
                )?._id?.toString();
                if (descTaskId) setSelectedTaskId(descTaskId);
              }
            }}
            className="flex gap-3 rounded-lg border border-warm-200 bg-white p-3 cursor-pointer hover:bg-warm-50"
          >
            <div className="mt-2 h-2 w-2 rounded-full bg-[#16A34A]" />
            <div className="flex-1 text-left">
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
          </button>
        ) : (
          <div
            key={activity._id}
            className="flex gap-3 rounded-lg border border-warm-200 bg-white p-3"
          >
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
        ),
      )}
      {activityItems.length === 0 && (
        <div className="rounded-lg border border-dashed border-warm-200 bg-[#F5F3EF] p-6 text-center text-sm text-warm-600">
          {emptyMessage}
        </div>
      )}
    </div>
  );

  const liveFeedContent = (
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
            {tab.key === "decisions" ? (
              <span className="flex items-center gap-2">
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[0.55rem] font-semibold ${
                    pendingDecisions.length > 0
                      ? "bg-[#F59E0B] text-white"
                      : "bg-warm-100 text-warm-500"
                  }`}
                >
                  {pendingDecisions.length}
                </span>
              </span>
            ) : (
              tab.label
            )}
          </button>
        ))}
      </div>
      {feedTab === "decisions" ? (
        <div className="flex max-h-[640px] flex-col gap-3 overflow-y-auto pr-2 scrollbar-thin">
          {(decisions ?? []).filter((d) => {
            // Filter by workspace field if present; fall back to agent-name scoping
            if ((d as any).workspace) {
              return (d as any).workspace === activeWorkspace;
            }
            const agentName = d.agent?.name;
            return !agentName || workspaceAgentNames.includes(agentName);
          }).map((decision) => {
            const isPending = decision.status === "pending";
            const decisionKey = decision._id.toString();
            const options = decision.options ?? [];
            const commentValue = decisionCommentDrafts[decisionKey] ?? "";
            return (
              <div
                key={decision._id}
                className={`rounded-lg border p-3 shadow-sm ${
                  isPending
                    ? "border-[#F59E0B] bg-[#FFFBEB]"
                    : "border-warm-200 bg-[#F5F3EF] text-warm-600"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p
                      className={`text-sm font-semibold ${
                        isPending ? "text-warm-900" : "text-warm-500"
                      }`}
                    >
                      {decision.title}
                    </p>
                    <p
                      className={`mt-1 text-xs ${
                        isPending ? "text-warm-700" : "text-warm-500"
                      }`}
                    >
                      {(decision.description ?? "")
                        .replace(/\*\*(.+?)\*\*/g, "$1")
                        .replace(/\*(.+?)\*/g, "$1")
                        .replace(/`(.+?)`/g, "$1")
                        .slice(0, 200)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.65rem] text-warm-500">
                      <span className="flex items-center gap-1">
                        {decision.agent ? <AgentAvatar name={decision.agent.name} size={20} /> : <span className="text-base">🧭</span>}
                        <span>{decision.agent?.name ?? "Unknown"}</span>
                      </span>
                      <span>{timeAgo(decision.createdAt)}</span>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.2em] ${
                      isPending ? "bg-[#F59E0B] text-white" : "bg-warm-200 text-warm-600"
                    }`}
                  >
                    {decision.status.replace("_", " ")}
                  </span>
                </div>

                {options.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    {options.map((option, index) => {
                      const isChosen = !isPending && decision.resolution === option;
                      return (
                        <button
                          key={`${decision._id}-${option}`}
                          type="button"
                          onClick={() => isPending ? handleDecisionResolve(decisionKey, option) : undefined}
                          disabled={!isPending}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                            isChosen
                              ? "border-[#D97706] bg-[#FFF7ED] text-[#92400E]"
                              : isPending
                                ? "border-[#FDE68A] bg-white text-warm-800 hover:border-[#F59E0B] hover:bg-[#FFF7ED] cursor-pointer"
                                : "border-warm-200 bg-warm-50 text-warm-500 cursor-default opacity-70"
                          }`}
                        >
                          <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold text-white ${isChosen ? "bg-[#D97706]" : isPending ? "bg-[#F59E0B]" : "bg-warm-300"}`}>
                            {isChosen ? "✓" : index + 1}
                          </span>
                          <span>{option}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {!isPending && (
                  <div className="mt-3 rounded-lg border border-warm-200 bg-white/70 px-3 py-2 text-xs text-warm-600">
                    Resolution:{" "}
                    <span className="font-semibold text-warm-700">
                      {decision.resolution ?? decision.status}
                    </span>
                  </div>
                )}

                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs"
                      placeholder="Jay's response / comment…"
                      value={commentValue}
                      onChange={(event) =>
                        handleDecisionCommentChange(decisionKey, event.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && commentValue.trim()) {
                          e.preventDefault();
                          handleDecisionCommentSubmit(decisionKey);
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={!commentValue.trim()}
                      onClick={() => handleDecisionCommentSubmit(decisionKey)}
                      className={`flex-shrink-0 rounded-full px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white ${
                        commentValue.trim()
                          ? "bg-[#D97706] hover:bg-[#C56A05]"
                          : "cursor-not-allowed bg-[#D6D3D1]"
                      }`}
                    >
                      Reply
                    </button>
                  </div>
                  {(decision.comments ?? []).map((comment, index) => (
                    <div
                      key={`${decision._id}-comment-${index}`}
                      className="rounded-lg border border-warm-200 bg-white px-3 py-2 text-xs text-warm-700"
                    >
                      <div className="flex items-center justify-between text-[0.6rem] text-warm-500">
                        <span className="font-semibold text-[#D97706]">Jay</span>
                        <span>{timeAgo(comment.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-xs text-warm-700 whitespace-pre-wrap">
                        {comment.text
                          .replace(/\*\*(.+?)\*\*/g, "$1")
                          .replace(/\*(.+?)\*/g, "$1")
                          .replace(/`(.+?)`/g, "$1")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {(decisions ?? []).length === 0 && (
            <div className="rounded-lg border border-dashed border-warm-200 bg-[#F5F3EF] p-6 text-center text-sm text-warm-600">
              No decisions yet. Requests will appear here.
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAgentFilter("all")}
              className={`pill ${agentFilter === "all" ? "!border-[#D97706] !bg-[#FEF3C7] !text-[#92400E]" : ""}`}
            >
              All Agents
            </button>
            {(visibleAgents).map((agent) => (
              <button
                key={agent._id}
                type="button"
                onClick={() => setAgentFilter(agent._id.toString())}
                className={`pill ${
                  agentFilter === agent._id.toString()
                    ? "!border-[#D97706] !bg-[#FEF3C7] !text-[#92400E]"
                    : ""
                }`}
              >
                <AgentAvatar name={agent.name} size={24} />
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
                {filteredTasks?.length === 0 && <option value="">No tasks available</option>}
                {(filteredTasks ?? []).map((task) => (
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
                {(visibleAgents).map((agent) => (
                  <option key={agent._id} value={agent._id.toString()}>
                    {agent.name}
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
                onKeyDown={(e) => {
                  if (showMentions && mentionOptions.length > 0 && (e.key === "Enter" || e.key === "Tab")) {
                    e.preventDefault();
                    handleMentionSelect(mentionOptions[0]);
                  }
                }}
              />
              {showMentions && (
                <div className="absolute left-0 top-full z-10 mt-2 w-full rounded-lg border border-warm-200 bg-white shadow-card">
                  {mentionOptions.length === 0 && (
                    <div className="px-3 py-2 text-xs text-warm-500">No matches</div>
                  )}
                  {mentionOptions.map((agent, i) => (
                    <button
                      key={agent._id}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleMentionSelect(agent);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-warm-700 transition hover:bg-[#FFF7ED] ${i === 0 ? "bg-[#FFF7ED]" : ""}`}
                    >
                      <AgentAvatar name={agent.name} size={20} />
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
          {renderActivityCards(
            feedActivities,
            "No activity yet. Updates will appear as missions progress.",
          )}
        </>
      )}
    </div>
  );

  const statusFeedContent = (
    <div className="flex flex-col gap-4 px-3 py-2">
      {renderActivityCards(
        statusActivities,
        "No status changes yet. Agent state updates will appear here.",
      )}
    </div>
  );

  const workspaceCronList = cronState?.crons.filter((c: Record<string, unknown>) =>
    activeWorkspace === "dashpane"
      ? String(c.name).startsWith("dp-citadel-")
      : (c.isCitadelPush && !String(c.name).startsWith("dp-citadel-"))
  ) ?? [];
  const cronIsRunning = workspaceCronList.length > 0 && workspaceCronList.every((c: Record<string, unknown>) => c.enabled);
  const cronHasPaused = workspaceCronList.some((c: Record<string, unknown>) => !c.enabled);
  const cronLabel = cronIsRunning ? "Crons: Running" : "Crons: Paused";
  const cronAccent = cronIsRunning
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
  const cronDot = cronIsRunning ? "bg-emerald-500" : "bg-amber-500";

  return (
    <div className="flex h-screen w-full flex-col overflow-x-hidden bg-white text-warm-900">
      <div className="flex w-full flex-1 flex-col gap-0 overflow-hidden">
        {/* Workspace Switcher */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-warm-100 bg-warm-50">
          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-warm-400">Workspace</span>
          <div className="flex items-center gap-1 ml-2">
            <button
              type="button"
              onClick={() => setActiveWorkspace("main")}
              className={`rounded-full px-3 py-1 text-[0.65rem] font-semibold transition ${
                activeWorkspace === "main"
                  ? "bg-[#D97706] text-white"
                  : "bg-warm-100 text-warm-500 hover:bg-warm-200"
              }`}
            >
              Personal
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkspace("dashpane")}
              className={`rounded-full px-3 py-1 text-[0.65rem] font-semibold transition ${
                activeWorkspace === "dashpane"
                  ? "bg-[#D97706] text-white"
                  : "bg-warm-100 text-warm-500 hover:bg-warm-200"
              }`}
            >
              DashPane Launch
            </button>
          </div>
        </div>
        <header className="flex items-center justify-between border-b border-warm-200 bg-white px-4 py-3">
          <div className="flex flex-col">
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-warm-400">CITADEL</span>
            <h1 className="text-lg font-semibold tracking-tight">
              {activeWorkspace === "dashpane" ? "DashPane Mission Control" : "Personal Dashboard"}
            </h1>
            {activeWorkspace === "dashpane" && (
              <span className="mt-0.5 text-[0.65rem] font-semibold text-[#D97706]">
                🎯 Goal: $2K MRR — DashPane launches March 31
              </span>
            )}
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
            {cronState && (
              <div className="relative">
                <div
                  className={`flex w-full flex-col gap-1 rounded-xl border px-3 py-2 text-left text-xs font-semibold shadow-sm transition ${
                    cronAccent
                  } ${cronLoading ? "cursor-not-allowed opacity-70" : "hover:shadow-card"}`}
                >
                  <button
                    type="button"
                    onClick={() => setCronExpanded((prev) => !prev)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                    title="Click to expand individual cron toggles"
                    aria-expanded={cronExpanded}
                  >
                    <span className="flex items-center gap-2 uppercase tracking-[0.2em]">
                      <span className={`h-2.5 w-2.5 rounded-full ${cronLoading ? "bg-yellow-400 animate-pulse" : cronDot}`} />
                      <span>{cronLoading ? "Syncing..." : cronLabel}</span>
                    </span>
                    <span className="text-[0.65rem] font-semibold text-amber-700">
                      {cronExpanded ? "^" : "v"}
                    </span>
                  </button>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1">
                      {cronState.crons.filter((c: Record<string, unknown>) =>
                        activeWorkspace === "dashpane"
                          ? String(c.name).startsWith("dp-citadel-")
                          : c.isCitadelPush && !String(c.name).startsWith("dp-citadel-")
                      ).map((c) => (
                        <span
                          key={c.id}
                          title={`${c.label}: ${c.enabled ? "running" : "paused"}`}
                          className={`inline-block h-1.5 w-1.5 rounded-full ${c.enabled ? "bg-emerald-400" : "bg-red-400"}`}
                        />
                      ))}
                      <span className="ml-1 text-[0.6rem] font-medium text-warm-500">
                        {cronIsRunning ? "6 active" : "~12K tok/hr saved"}
                      </span>
                    </div>
                    {(cronIsRunning || cronHasPaused) && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCronToggle();
                        }}
                        disabled={cronLoading}
                        className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-amber-700 transition hover:border-amber-300"
                        title={cronIsRunning ? "Pause all crons" : "Resume all paused crons"}
                        aria-busy={cronLoading}
                      >
                        {cronIsRunning ? "Pause all" : "Resume all"}
                      </button>
                    )}
                  </div>
                </div>
                {cronExpanded && (
                  <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-amber-200 bg-[#FFFBF2] p-3 shadow-lg">
                    <div className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-amber-700">
                      Individual Crons
                    </div>
                    <div className="flex flex-col gap-2">
                      {(activeWorkspace === "main" ? CRON_EMPLOYEES_MAIN : CRON_EMPLOYEES_DASHPANE).map((employee) => {
                        const cron = cronState.crons.find((c) => c.id?.startsWith(employee.id) || c.label === employee.cronLabel);
                        const enabled = cron?.enabled ?? false;
                        const cronId = cron?.id ?? employee.id;
                        const isLoading = cronItemLoading === cronId;
                        const cronName = cron?.name ?? `citadel-push-${employee.cronLabel}`;

                        return (
                          <div
                            key={employee.id}
                            className="flex items-center justify-between rounded-lg border border-amber-100 bg-white/70 px-2 py-1.5 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-warm-900">
                                {employee.name} <span className="text-[0.65rem] font-normal text-warm-500">({employee.cronLabel})</span>
                              </p>
                              <p className="text-[0.65rem] text-warm-600 truncate">{cronName}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full flex-shrink-0 ${enabled ? "bg-emerald-500" : "bg-red-400"}`} />
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleCronItemToggle(cronId, !enabled);
                                }}
                                disabled={isLoading || cronLoading}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full border transition ${
                                  enabled ? "border-emerald-500 bg-emerald-500" : "border-amber-200 bg-amber-100"
                                } ${isLoading ? "opacity-60" : ""}`}
                                aria-pressed={enabled}
                                title={`${enabled ? "Disable" : "Enable"} ${employee.name} cron`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                                    enabled ? "translate-x-4" : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="text-right">
              <p className="text-lg font-semibold tabular-nums">
                {mounted ? timeString : "-- : -- : --"}
              </p>
              <p className="text-xs text-warm-500">{mounted ? dateString : ""}</p>
            </div>
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" title="Online" />
          </div>
        </header>

        <main className="grid flex-1 grid-cols-1 gap-0 overflow-hidden border-t border-warm-200 bg-white xl:grid-cols-[200px_minmax(0,1fr)_280px]">
          <section className="flex flex-col overflow-hidden xl:border-r xl:border-warm-200">
            <div className="flex h-10 items-center justify-between px-3 border-b border-warm-100">
              <span className="section-title">Jedis</span>
              <span className="rounded-full bg-warm-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-warm-500">
                {visibleAgents.length}
              </span>
            </div>
            <div className="flex flex-col divide-y divide-warm-100 overflow-y-auto px-2">
              {visibleAgents.map((agent) => {
                const isSelected = selectedAgentId === agent._id.toString();
                const lastActiveAt = agent.lastActive ?? 0;
                const lastActiveAge = Date.now() - lastActiveAt;
                const isIdle = lastActiveAge > 5 * 60 * 1000;
                const isStale = lastActiveAge > 10 * 60 * 1000;
                const statusColor = agent.status === "blocked"
                    ? "bg-red-500"
                    : isStale
                      ? "bg-gray-400"
                      : agent.status === "working" && !isIdle
                      ? "bg-green-500"
                      : "bg-amber-400";
                return (
                  <div
                    key={agent._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedAgentId((prev) =>
                        prev === agent._id.toString() ? null : agent._id.toString(),
                      );
                      setProfileAgentId(agent._id.toString());
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedAgentId((prev) =>
                          prev === agent._id.toString() ? null : agent._id.toString(),
                        );
                        setProfileAgentId(agent._id.toString());
                      }
                    }}
                    className={`flex cursor-pointer items-center gap-2 px-2 py-3 transition hover:bg-warm-50 ${
                      isSelected ? "border-l-2 border-[#D97706] bg-[#FFFBEB]" : ""
                    }`}
                  >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center text-base">
                    <AgentAvatar name={agent.name} size={32} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-xs font-semibold">{agent.name}</p>
                      {agent.level === "lead" && (
                        <span className={`badge text-[0.6rem] px-1 py-0 ${LEVEL_BADGE[agent.level]}`}>
                          LEAD
                        </span>
                      )}
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusColor}`} />
                    </div>
                    <p className="truncate text-[0.65rem] text-warm-500">{agent.role}</p>
                    <p className="truncate text-[0.6rem] text-warm-400">Last seen {timeAgo(lastActiveAt)}</p>
                  </div>
                </div>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col overflow-hidden xl:border-r xl:border-warm-200">
            <div className="flex h-10 items-center justify-between px-3 border-b border-warm-100">
              <span className="section-title">Holocron</span>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowNotifications((prev) => !prev)}
                    className="relative flex h-7 w-7 items-center justify-center rounded-full border border-warm-200 bg-white text-warm-600 transition hover:border-[#D97706] hover:text-[#D97706]"
                    aria-label="Toggle notifications"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path d="M12 22a2.5 2.5 0 0 0 2.4-2h-4.8A2.5 2.5 0 0 0 12 22Z" />
                      <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2Z" />
                    </svg>
                    {notificationCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#EF4444] px-1 text-[0.55rem] font-semibold text-white">
                        {notificationCount}
                      </span>
                    )}
                  </button>
                  {showNotifications && (
                    <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-lg border border-warm-200 bg-white shadow-card">
                      <div className="flex items-center justify-between border-b border-warm-100 px-3 py-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-warm-500">
                          Notifications
                        </span>
                        <button
                          type="button"
                          onClick={handleMarkAllNotificationsRead}
                          className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-warm-500 hover:text-[#D97706]"
                        >
                          Mark all read
                        </button>
                      </div>
                      <div className="flex items-center gap-2 border-b border-warm-100 px-3 py-2">
                        {(visibleAgents).map((agent) => {
                          const isSelected = selectedNotificationAgentId === agent._id.toString();
                          return (
                            <button
                              key={agent._id}
                              type="button"
                              onClick={() =>
                                setSelectedNotificationAgentId((prev) =>
                                  prev === agent._id.toString() ? null : agent._id.toString(),
                                )
                              }
                              className={`rounded-full transition ${
                                isSelected ? "ring-2 ring-[#D97706] ring-offset-2 ring-offset-white" : ""
                              }`}
                              aria-pressed={isSelected}
                            >
                              <AgentAvatar name={agent.name} size={28} />
                            </button>
                          );
                        })}
                      </div>
                      <div className="max-h-[400px] overflow-y-auto">
                        {filteredNotifications.length === 0 ? (
                          <div className="px-4 py-6 text-center text-xs text-warm-500">
                            No notifications yet.
                          </div>
                        ) : (
                          <div className="flex flex-col divide-y divide-warm-100">
                            {filteredNotifications.map((notification) => (
                              <button
                                key={notification._id}
                                type="button"
                                onClick={() => handleNotificationClick(notification)}
                                className={`flex w-full items-start gap-3 px-3 py-3 text-left transition hover:bg-warm-50 ${
                                  notification.read ? "text-warm-600" : "text-warm-900"
                                }`}
                              >
                                <AgentAvatar name={notification.agentName} size={24} />
                                <div className="flex-1">
                                  <p className={`text-xs ${notification.read ? "" : "font-semibold"}`}>
                                    {notification.message}
                                  </p>
                                  <p className="mt-1 text-[0.6rem] text-warm-500">
                                    {timeAgo(notification.createdAt)}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm((prev) => !prev)}
                  className="rounded-full border border-warm-200 bg-white px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-warm-600 transition hover:border-[#D97706] hover:text-[#D97706]"
                >
                  New Task
                </button>
              </div>
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
                      {(visibleAgents).map((agent) => {
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
                            <AgentAvatar name={agent.name} size={20} />
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
                                <span key={assignee._id}>
                                  <AgentAvatar name={assignee.name} size={22} />
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
                  <button type="button" onClick={() => setRightPanel("status")} className={`text-[0.65rem] font-semibold uppercase tracking-[0.2em] transition pb-1 ${rightPanel === "status" ? "text-warm-900 border-b-2 border-[#D97706]" : "text-warm-400"}`}>Status</button>
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
                          {(visibleAgents).map((agent) => (
                            <option key={agent._id} value={agent._id.toString()}>
                              {agent.name}
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
                                {doc.author ? <AgentAvatar name={doc.author.name} size={20} /> : <span className="text-base">📝</span>}
                                <span>{doc.author?.name ?? "Unknown"}</span>
                              </span>
                              <span>{timeAgo(doc.createdAt)}</span>
                            </div>
                          </div>
                          <span className="text-xs text-warm-500">{isOpen ? "Collapse" : "Expand"}</span>
                        </button>
                        {isOpen && (
                          <div className="mt-3">
                            <div className="rounded-lg border border-dashed border-warm-200 bg-[#F5F3EF] p-3 text-sm text-warm-700 whitespace-pre-wrap line-clamp-6">
                              {linkifyContent(doc.content)}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setFullViewDocId(doc._id.toString()); }}
                              className="mt-2 text-xs font-semibold text-amber-700 hover:text-amber-900 transition"
                            >
                              Read full document →
                            </button>
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
              ) : rightPanel === "status" ? (
                statusFeedContent
              ) : (
                liveFeedContent
              )}
            </section>
          ) : (
            <section className="flex flex-col gap-3 overflow-y-auto pt-3 pb-3 scrollbar-thin">
              {selectedAgent && panelMeta && (
                <div className="px-3">
                  <div className="card flex flex-col gap-4 border border-warm-200 bg-white p-4">
                    <div
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold ${panelMeta.accent}`}
                    >
                      <div className="flex items-center gap-2">
                        <AgentAvatar name={selectedAgent.name} size={28} />
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
                </div>
              )}
              <div className="flex items-center justify-between px-3">
                <span className="section-title">Live Feed</span>
                <span className="badge bg-[#DCFCE7] text-[#166534]">Live</span>
              </div>
              {liveFeedContent}
            </section>
          )}
        </main>
      </div>

      {profileAgent && profileAgentId && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button
            type="button"
            aria-label="Close agent profile"
            onClick={() => setProfileAgentId(null)}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          />
          <aside className="relative z-50 flex h-full w-full max-w-[480px] flex-col gap-4 overflow-y-auto border-l border-warm-200 bg-[#FFFCF7] p-6 shadow-2xl animate-slide-in-right">
            {/* Close button */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <AgentAvatar name={profileAgent.name} size={56} />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#FFFCF7] ${
                      profileAgent.status === "working"
                        ? "bg-green-500"
                        : profileAgent.status === "blocked"
                          ? "bg-red-500"
                          : "bg-gray-400"
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-warm-900">{profileAgent.name}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.2em] ${LEVEL_BADGE[profileAgent.level]}`}>
                      {profileAgent.level}
                    </span>
                  </div>
                  <p className="text-sm text-warm-500">{profileAgent.role}</p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.15em] ${STATUS_BADGE[profileAgent.status]}`}>
                    {profileAgent.status}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileAgentId(null)}
                className="rounded-full border border-warm-200 bg-white px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-600 transition hover:border-[#D97706] hover:text-[#D97706]"
              >
                ✕
              </button>
            </div>

            {/* Bio (DashPane workspace only) */}
            {activeWorkspace === "dashpane" && AGENT_BIOS[profileAgent.name] && (
              <div className="rounded-lg border border-warm-200 bg-white p-3">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-warm-500">Bio</span>
                <p className="mt-1 text-sm text-warm-700 leading-relaxed">{AGENT_BIOS[profileAgent.name]}</p>
              </div>
            )}

            {/* Stats row */}
            {profileStats && (
              <div className="grid grid-cols-4 gap-3">
                <div className="flex flex-col items-center rounded-lg border border-warm-200 bg-white p-3">
                  <span className="text-xl font-bold tabular-nums text-warm-900">{profileStats.tasksCompleted}</span>
                  <span className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-warm-500">Tasks done</span>
                </div>
                <div className="flex flex-col items-center rounded-lg border border-warm-200 bg-white p-3">
                  <span className="text-xl font-bold tabular-nums text-warm-900">{profileStats.documentsCreated}</span>
                  <span className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-warm-500">Docs</span>
                </div>
                <div className="flex flex-col items-center rounded-lg border border-warm-200 bg-white p-3">
                  <span className="text-xl font-bold tabular-nums text-warm-900">{profileStats.commentsPosted}</span>
                  <span className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-warm-500">Comments</span>
                </div>
                <div className="flex flex-col items-center rounded-lg border border-warm-200 bg-white p-3">
                  <span className="text-[0.75rem] font-semibold tabular-nums text-warm-900">{timeAgo(profileStats.lastActive)}</span>
                  <span className="text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-warm-500">Last active</span>
                </div>
              </div>
            )}

            {/* Current task */}
            {profileStats?.currentTask && (
              <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#92400E]">Currently working on</span>
                <p className="mt-1 text-sm font-medium text-warm-900">{profileStats.currentTask}</p>
                {profileStats.currentTasks.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {profileStats.currentTasks.map((t) => (
                      <button
                        key={t._id}
                        type="button"
                        onClick={() => {
                          setSelectedTaskId(t._id.toString());
                          setProfileAgentId(null);
                        }}
                        className="text-left text-xs text-[#D97706] hover:underline"
                      >
                        → {t.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Work history */}
            <div className="card flex flex-col gap-3 border border-warm-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-warm-500">Work History</span>
                <span className="rounded-full bg-warm-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-warm-500">
                  {profileStats?.completedHistory.length ?? 0}
                </span>
              </div>
              <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto scrollbar-thin">
                {(profileStats?.completedHistory ?? []).map((task) => (
                  <button
                    key={task._id}
                    type="button"
                    onClick={() => {
                      setSelectedTaskId(task._id.toString());
                      setProfileAgentId(null);
                    }}
                    className="flex items-center justify-between rounded-lg border border-warm-100 bg-[#F5F3EF] px-3 py-2 text-left hover:border-[#D97706] transition"
                  >
                    <span className="text-xs font-medium text-warm-800 truncate flex-1 mr-2">{task.title}</span>
                    <span className="text-[0.6rem] text-warm-500 shrink-0">{timeAgo(task.updatedAt)}</span>
                  </button>
                ))}
                {(profileStats?.completedHistory ?? []).length === 0 && (
                  <div className="text-center text-xs text-warm-500 py-3">No completed tasks yet.</div>
                )}
              </div>
            </div>

            {/* Recent documents */}
            <div className="card flex flex-col gap-3 border border-warm-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-warm-500">Recent Documents</span>
                <span className="rounded-full bg-warm-100 px-1.5 py-0.5 text-[0.6rem] font-medium text-warm-500">
                  {profileDocuments?.length ?? 0}
                </span>
              </div>
              <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto scrollbar-thin">
                {(profileDocuments ?? []).map((doc) => (
                  <button
                    key={doc._id}
                    type="button"
                    onClick={() => setFullViewDocId(doc._id.toString())}
                    className="flex w-full items-center justify-between rounded-lg border border-warm-100 bg-[#F5F3EF] px-3 py-2 cursor-pointer transition hover:bg-warm-50 hover:border-warm-200 text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`rounded-full px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase ${DOC_TYPE_BADGE[doc.type]}`}>
                        {doc.type}
                      </span>
                      <span className="text-xs font-medium text-warm-800 truncate">{doc.title}</span>
                    </div>
                    <span className="text-[0.6rem] text-warm-500 shrink-0 ml-2">{timeAgo(doc.createdAt)}</span>
                  </button>
                ))}
                {(profileDocuments ?? []).length === 0 && (
                  <div className="text-center text-xs text-warm-500 py-3">No documents yet.</div>
                )}
              </div>
            </div>

            {/* Recent activity */}
            <div className="card flex flex-col gap-3 border border-warm-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-warm-500">Recent Activity</span>
                <span className="badge bg-[#DCFCE7] text-[#166534]">Live</span>
              </div>
              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto scrollbar-thin">
                {(profileActivities ?? []).map((activity) => (
                  <div key={activity._id} className="flex gap-2 rounded-lg border border-warm-100 bg-[#F5F3EF] px-3 py-2">
                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#16A34A] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-warm-800">{activity.description}</p>
                      <p className="mt-0.5 text-[0.6rem] text-warm-500">{timeAgo(activity.createdAt)}</p>
                    </div>
                  </div>
                ))}
                {(profileActivities ?? []).length === 0 && (
                  <div className="text-center text-xs text-warm-500 py-3">No recent activity.</div>
                )}
              </div>
            </div>

            {/* DM box (DashPane workspace only) */}
            {activeWorkspace === "dashpane" && AGENT_SESSION_KEYS[profileAgent.name] && (
              <div className="card flex flex-col gap-2 border border-warm-200 bg-white p-4">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-warm-500">Direct Message</span>
                <textarea
                  className="min-h-[70px] w-full rounded-lg border border-warm-200 bg-[#FFFBF5] px-3 py-2 text-sm"
                  placeholder={`Message ${profileAgent.name}...`}
                  value={dmText}
                  onChange={(e) => setDmText(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  {dmSent && (
                    <span className="text-xs font-semibold text-green-600">Sent ✓</span>
                  )}
                  {!dmSent && <span />}
                  <button
                    type="button"
                    disabled={!dmText.trim() || dmSending}
                    onClick={() => handleSendDm(profileAgent.name)}
                    className={`rounded-full px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white ${
                      dmText.trim() && !dmSending
                        ? "bg-[#D97706] hover:bg-[#C56A05]"
                        : "cursor-not-allowed bg-[#D6D3D1]"
                    }`}
                  >
                    {dmSending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button
            type="button"
            aria-label="Close task detail"
            onClick={() => { setIsTaskExpanded(false); setSelectedTaskId(null); }}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          />
          <aside className={`relative z-50 flex h-full flex-col gap-4 overflow-y-auto border-l border-warm-200 bg-[#FFFCF7] p-6 shadow-2xl transition-all duration-300 ${isTaskExpanded ? "w-full max-w-full" : "w-full max-w-[520px]"}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <span className="section-title">Task Detail</span>
                <h2
                  className="text-2xl font-semibold text-warm-900 cursor-text rounded px-1 -mx-1 hover:bg-warm-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const newTitle = e.currentTarget.textContent?.trim();
                    if (newTitle && newTitle !== selectedTask.title) {
                      updateTask({ id: selectedTask._id, title: newTitle });
                    }
                  }}
                >{selectedTask.title}</h2>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`badge ${TASK_STATUS_BADGE[selectedTask.status]}`}>
                    {selectedTask.status.replace("_", " ").toUpperCase()}
                  </span>
                  <span className={`badge ${PRIORITY_BADGE[selectedTask.priority]}`}>
                    {selectedTask.priority.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTaskExpanded((v) => !v)}
                  title={isTaskExpanded ? "Collapse panel" : "Expand to full width"}
                  className="rounded-full border border-warm-200 bg-white px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-600 transition hover:border-[#D97706] hover:text-[#D97706]"
                >
                  {isTaskExpanded ? "⤡" : "⤢"}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsTaskExpanded(false); setSelectedTaskId(null); }}
                  className="rounded-full border border-warm-200 bg-white px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-600 transition hover:border-[#D97706] hover:text-[#D97706]"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="card flex flex-col gap-4 border border-warm-200 bg-white p-4 shadow-card">
              <div className="flex flex-col gap-2 text-sm text-warm-700">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                  Description
                </span>
                <p
                  className="whitespace-pre-wrap cursor-text rounded px-1 -mx-1 hover:bg-warm-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[2em]"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const newDesc = e.currentTarget.textContent?.trim() ?? "";
                    if (newDesc !== (selectedTask.description ?? "")) {
                      updateTask({ id: selectedTask._id, description: newDesc });
                    }
                  }}
                >{selectedTask.description?.trim() ? selectedTask.description : "No description yet."}</p>
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
                    <div
                      key={assignee._id}
                      className="group relative cursor-pointer"
                      title={assignee.name}
                      onClick={() => {
                        const newIds = selectedTask.assigneeIds.filter((id: string) => id !== assignee._id) as Id<"agents">[];
                        updateTask({ id: selectedTask._id, assigneeIds: newIds });
                      }}
                    >
                      <AgentAvatar name={assignee.name} size={36} />
                      <span className="absolute inset-0 hidden group-hover:flex items-center justify-center rounded-full bg-black/40 text-white text-sm font-bold">×</span>
                    </div>
                  ))}
                  <select
                    className="rounded-full border border-dashed border-warm-300 bg-white px-3 py-1 text-[0.65rem] text-warm-500 cursor-pointer"
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const newIds = [...selectedTask.assigneeIds, e.target.value as Id<"agents">];
                      updateTask({ id: selectedTask._id, assigneeIds: newIds });
                      e.target.value = "";
                    }}
                  >
                    <option value="">+ Add</option>
                    {visibleAgents
                      .filter((a) => !selectedTask.assigneeIds.includes(a._id))
                      .map((a) => (
                        <option key={a._id} value={a._id}>{a.name}</option>
                      ))}
                  </select>
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
                      className="group flex items-center gap-1 rounded-full bg-[#F5F3EF] px-2 py-1 text-[0.65rem] font-semibold text-warm-600"
                    >
                      {tag}
                      <button
                        type="button"
                        className="hidden group-hover:inline text-warm-400 hover:text-red-500"
                        onClick={() => {
                          const newTags = (selectedTask.tags ?? []).filter((t: string) => t !== tag);
                          updateTask({ id: selectedTask._id, tags: newTags });
                        }}
                      >×</button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="+ tag"
                    className="w-16 rounded-full border border-dashed border-warm-300 bg-white px-2 py-1 text-[0.65rem] text-warm-600 outline-none focus:w-24 focus:border-amber-400 transition-all"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = e.currentTarget.value.trim();
                        if (val && !(selectedTask.tags ?? []).includes(val)) {
                          updateTask({ id: selectedTask._id, tags: [...(selectedTask.tags ?? []), val] });
                        }
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-warm-500">
                  Subscribers
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {taskSubscribers.length === 0 && (
                    <span className="text-xs text-warm-500">No subscribers yet.</span>
                  )}
                  {taskSubscribers.map((agent) => (
                    <div
                      key={agent._id}
                      className="group relative cursor-pointer"
                      title={`${agent.name} (click to unsubscribe)`}
                      onClick={() => unsubscribeAgent({ agentId: agent._id, taskId: selectedTask._id })}
                    >
                      <AgentAvatar name={agent.name} size={36} />
                      <span className="absolute inset-0 hidden group-hover:flex items-center justify-center rounded-full bg-black/40 text-white text-sm font-bold">×</span>
                    </div>
                  ))}
                  <select
                    className="rounded-full border border-dashed border-warm-300 bg-white px-3 py-1 text-[0.65rem] text-warm-500 cursor-pointer"
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      subscribeAgent({ agentId: e.target.value as Id<"agents">, taskId: selectedTask._id });
                      e.target.value = "";
                    }}
                  >
                    <option value="">+ Add</option>
                    {visibleAgents
                      .filter((a) => !taskSubscribers.some((s) => s._id === a._id))
                      .map((a) => (
                        <option key={a._id} value={a._id}>{a.name}</option>
                      ))}
                  </select>
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
                  <div key={message._id} id={`comment-${message._id}`} ref={scrollToCommentId === message._id.toString() ? (el) => { if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); setScrollToCommentId(null); } } : null} className={`flex gap-3 rounded-lg border p-3 ${scrollToCommentId === message._id.toString() ? "border-[#D97706] bg-amber-50" : "border-warm-200 bg-[#FFFBF5]"}`}>
                    <div className="flex items-center justify-center shrink-0">
                      {message.agent ? <AgentAvatar name={message.agent.name} size={32} /> : <span className="text-lg">💬</span>}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs text-warm-500">
                        <span className="font-semibold text-warm-800">
                          {message.agent?.name ?? "Unknown"}
                        </span>
                        <span>{timeAgo(message.createdAt)}</span>
                      </div>
                      <div className="mt-2 text-sm text-warm-800">{renderMarkdown(message.content)}</div>
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
                    {(visibleAgents).map((agent) => (
                      <option key={agent._id} value={agent._id.toString()}>
                        {agent.name}
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
                    onKeyDown={(e) => {
                      if (showDetailMentions && detailMentionOptions.length > 0 && (e.key === "Enter" || e.key === "Tab")) {
                        e.preventDefault();
                        handleDetailMentionSelect(detailMentionOptions[0]);
                      }
                    }}
                  />
                  {showDetailMentions && (
                    <div className="absolute left-0 top-full z-10 mt-2 w-full rounded-lg border border-warm-200 bg-white shadow-card">
                      {detailMentionOptions.length === 0 && (
                        <div className="px-3 py-2 text-xs text-warm-500">No matches</div>
                      )}
                      {detailMentionOptions.map((agent, i) => (
                        <button
                          key={agent._id}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleDetailMentionSelect(agent);
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-warm-700 transition hover:bg-[#FFF7ED] ${i === 0 ? "bg-[#FFF7ED]" : ""}`}
                        >
                          <AgentAvatar name={agent.name} size={20} />
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

            <button
              type="button"
              onClick={handleDeleteTask}
              className="w-full rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-red-600 transition hover:border-red-400 hover:text-red-700"
            >
              Delete Task
            </button>
          </aside>
        </div>
      )}

      {/* Full Document Reader Modal */}
      {fullViewDocId && (() => {
        const allDocs = [...(filteredDocuments ?? []), ...(profileDocuments ?? [])];
        const doc = allDocs.find((d) => d._id.toString() === fullViewDocId);
        if (!doc) return null;
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setFullViewDocId(null)}>
            <div className="relative mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-warm-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-start justify-between border-b border-warm-100 px-6 py-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-warm-900 leading-tight">{doc.title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-warm-600">
                    <span className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase ${DOC_TYPE_BADGE[doc.type]}`}>
                      {doc.type}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {doc.author ? <AgentAvatar name={doc.author.name} size={22} /> : <span className="text-base">📝</span>}
                      <span className="font-medium">{doc.author?.name ?? "Unknown"}</span>
                    </span>
                    <span className="text-warm-500">{timeAgo(doc.createdAt)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFullViewDocId(null)}
                  className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-warm-500 transition hover:bg-warm-100 hover:text-warm-700"
                >
                  ✕
                </button>
              </div>
              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-5 text-sm leading-relaxed scrollbar-thin">
                {renderMarkdown(doc.content)}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
