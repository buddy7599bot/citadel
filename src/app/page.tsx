"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { timeAgo } from "@/lib/utils";

const STATUS_COLUMNS = [
  { key: "inbox", label: "INBOX" },
  { key: "assigned", label: "ASSIGNED" },
  { key: "in_progress", label: "IN PROGRESS" },
  { key: "review", label: "REVIEW" },
  { key: "done", label: "DONE" },
] as const;

const PRIORITY_BORDER: Record<string, string> = {
  urgent: "border-l-[#EF4444]",
  high: "border-l-[#F97316]",
  medium: "border-l-[#EAB308]",
  low: "border-l-[#D1D5DB]",
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

const FEED_TABS = [
  { key: "all", label: "All", target: undefined },
  { key: "tasks", label: "Tasks", target: "task" },
  { key: "comments", label: "Comments", target: "comment" },
  { key: "docs", label: "Docs", target: "doc" },
  { key: "status", label: "Status", target: "status" },
] as const;

const AGENT_PANELS: Record<
  string,
  {
    title: string;
    subtitle: string;
    accent: string;
    summary: { label: string; value: string; helper?: string }[];
    sections: {
      label: string;
      items: { primary: string; secondary?: string; tertiary?: string; status?: "good" | "warn" | "bad" }[];
    }[];
  }
> = {
  Burry: {
    title: "Trading",
    subtitle: "Mini trading dashboard",
    accent: "border-[#F97316] bg-[#FFF7ED] text-[#9A3412]",
    summary: [
      { label: "Portfolio", value: "$347.82", helper: "+12.4%" },
      { label: "Monthly P&L", value: "$89.50" },
      { label: "Win rate", value: "64%" },
    ],
    sections: [
      {
        label: "Open positions",
        items: [
          { primary: "BTC/USDT", secondary: "Long", tertiary: "+3.2%", status: "good" },
          { primary: "ETH/USDT", secondary: "Short", tertiary: "-1.1%", status: "bad" },
          { primary: "SOL/USDT", secondary: "Long", tertiary: "+5.7%", status: "good" },
        ],
      },
      {
        label: "Recent signals",
        items: [
          { primary: "Buy · BTC/USDT", secondary: "86% · 10:14", status: "good" },
          { primary: "Sell · ETH/USDT", secondary: "71% · 09:48", status: "warn" },
          { primary: "Buy · SOL/USDT", secondary: "64% · 08:52", status: "good" },
        ],
      },
    ],
  },
  Katy: {
    title: "Growth / X",
    subtitle: "Social analytics",
    accent: "border-[#D97706] bg-[#FFFBEB] text-[#92400E]",
    summary: [
      { label: "Followers", value: "1,247", helper: "+23 this week" },
      { label: "Views today", value: "4,521" },
      { label: "Engagement", value: "3.8%" },
    ],
    sections: [
      {
        label: "Top tweets",
        items: [
          { primary: "Post A", secondary: "12.4k imps · 241 likes", tertiary: "39 RTs" },
          { primary: "Post B", secondary: "9.1k imps · 188 likes", tertiary: "31 RTs" },
          { primary: "Post C", secondary: "7.6k imps · 160 likes", tertiary: "22 RTs" },
        ],
      },
      {
        label: "Schedule",
        items: [
          { primary: "2 posts pending", secondary: "Next in 3h" },
        ],
      },
    ],
  },
  Mike: {
    title: "Security",
    subtitle: "Security dashboard",
    accent: "border-[#16A34A] bg-[#F0FDF4] text-[#166534]",
    summary: [
      { label: "Open ports", value: "2", helper: "22/SSH · 443/HTTPS" },
      { label: "Last scan", value: "2 hours ago" },
      { label: "Firewall rules", value: "12 active" },
    ],
    sections: [
      {
        label: "Vulnerabilities",
        items: [
          { primary: "Critical", secondary: "0", status: "good" },
          { primary: "Medium", secondary: "1", status: "warn" },
          { primary: "Low", secondary: "3", status: "warn" },
        ],
      },
      {
        label: "SSH defenses",
        items: [
          { primary: "Failed attempts (24h)", secondary: "47 blocked", status: "good" },
          { primary: "Ports healthy", secondary: "✅ 22 · ✅ 443", status: "good" },
        ],
      },
    ],
  },
  Jerry: {
    title: "Jobs",
    subtitle: "Job pipeline",
    accent: "border-[#3B82F6] bg-[#EFF6FF] text-[#1D4ED8]",
    summary: [
      { label: "Active applications", value: "4" },
      { label: "Pipeline", value: "2 Applied · 1 Interview · 1 Offer" },
      { label: "New listings", value: "7 today" },
    ],
    sections: [
      {
        label: "Top matches",
        items: [
          { primary: "Atlas Corp", secondary: "Growth Analyst", tertiary: "$95k–$115k · 92%" },
          { primary: "Pine Labs", secondary: "Ops Lead", tertiary: "$88k–$102k · 87%" },
          { primary: "Skyforge", secondary: "Product Ops", tertiary: "$105k–$125k · 84%" },
        ],
      },
    ],
  },
  Elon: {
    title: "Builder",
    subtitle: "Build status",
    accent: "border-[#0EA5E9] bg-[#F0F9FF] text-[#0369A1]",
    summary: [
      { label: "Active projects", value: "8" },
      { label: "Commits today", value: "12" },
      { label: "Vercel", value: "All green" },
    ],
    sections: [
      {
        label: "Recent deploys",
        items: [
          { primary: "Citadel UI", secondary: "Success · 11:18", status: "good" },
          { primary: "Ops Console", secondary: "Fail · 10:02", status: "bad" },
          { primary: "Telemetry", secondary: "Success · 09:21", status: "good" },
        ],
      },
    ],
  },
  Buddy: {
    title: "Coordinator",
    subtitle: "Overview",
    accent: "border-[#A855F7] bg-[#FAF5FF] text-[#6B21A8]",
    summary: [
      { label: "Tasks completed", value: "4 today" },
      { label: "Pending reviews", value: "2" },
      { label: "Utilization", value: "83%" },
    ],
    sections: [
      {
        label: "Standup",
        items: [
          { primary: "Next standup", secondary: "8:30 PM IST" },
        ],
      },
    ],
  },
};

export default function Home() {
  const agents = useQuery(api.agents.list);
  const tasks = useQuery(api.tasks.list);
  const [feedTab, setFeedTab] = useState<(typeof FEED_TABS)[number]["key"]>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const activities = useQuery(api.activities.list, {
    targetType: FEED_TABS.find((tab) => tab.key === feedTab)?.target,
  });

  const seedAgents = useMutation(api.agents.seed);
  const createTask = useMutation(api.tasks.create);

  const [now, setNow] = useState(() => new Date());
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (agents && agents.length === 0) {
      seedAgents();
    }
  }, [agents, seedAgents]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeAgents = agents?.filter((agent) => agent.status === "working") ?? [];
  const tasksInQueue = tasks?.filter((task) => task.status !== "done") ?? [];

  const selectedAgent = (agents ?? []).find((agent) => agent._id.toString() === selectedAgentId);

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    if (!selectedAgentId) return tasks;
    return tasks.filter((task) =>
      (task.assigneeIds ?? []).some((assigneeId) => assigneeId.toString() === selectedAgentId),
    );
  }, [tasks, selectedAgentId]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, typeof tasks> = {
      inbox: [],
      assigned: [],
      in_progress: [],
      review: [],
      done: [],
    };
    for (const task of filteredTasks ?? []) {
      grouped[task.status]?.push(task);
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
    if (!title.trim()) return;

    const parsedTags = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    await createTask({
      title: title.trim(),
      description: description.trim() ? description.trim() : undefined,
      priority: priority as "low" | "medium" | "high" | "urgent",
      tags: parsedTags,
      assigneeIds: [],
    });

    setTitle("");
    setDescription("");
    setPriority("medium");
    setTags("");
    setShowForm(false);
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

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-warm-50 text-warm-900">
      <div className="flex w-full flex-col gap-5 px-5 py-6">
        <header className="flex flex-col gap-4 rounded-lg border border-warm-200 bg-white p-6 shadow-card lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2">
            <span className="section-title">CITADEL</span>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">Alliance Dashboard</h1>
              <span className="pill bg-[#FEF3C7] text-[#92400E]">Alliance</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
            <div className="card flex min-w-[200px] flex-1 flex-col gap-2 px-4 py-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-warm-600">
                Agents Active
              </p>
              <p className="text-2xl font-semibold">{activeAgents.length}</p>
            </div>
            <div className="card flex min-w-[200px] flex-1 flex-col gap-2 px-4 py-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-warm-600">
                Tasks In Queue
              </p>
              <p className="text-2xl font-semibold">{tasksInQueue.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xl font-semibold tabular-nums">{timeString}</p>
              <p className="text-sm text-warm-600">{dateString}</p>
            </div>
            <span className="badge bg-[#DCFCE7] text-[#166534]">ONLINE</span>
          </div>
        </header>

        <main className="grid grid-cols-1 gap-5 xl:grid-cols-[250px_minmax(0,1fr)_300px]">
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="section-title">Agents</span>
              <span className="badge bg-[#F3F4F6] text-[#6B7280]">
                {agents?.length ?? 0}
              </span>
            </div>
            <div className="flex flex-col gap-3">
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
                    className={`card flex cursor-pointer flex-col gap-3 p-4 transition ${
                      isSelected ? "border-l-4 border-[#D97706] bg-[#FFFBEB]" : ""
                    }`}
                  >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F3EF] text-xl">
                        {agent.avatarEmoji}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{agent.name}</p>
                          <span className={`badge ${LEVEL_BADGE[agent.level]}`}>
                            {agent.level === "lead" ? "LEAD" : agent.level === "intern" ? "INT" : "SPC"}
                          </span>
                        </div>
                        <p className="text-xs text-warm-600">{agent.role}</p>
                      </div>
                    </div>
                    <span className={`badge ${STATUS_BADGE[agent.status]}`}>
                      {agent.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-warm-600">
                    <p className="truncate">
                      {agent.currentTask ? `Task: ${agent.currentTask}` : "No active task"}
                    </p>
                    <p>{timeAgo(agent.lastActive)}</p>
                  </div>
                </div>
                );
              })}
            </div>
            {selectedAgent && AGENT_PANELS[selectedAgent.name] && (
              <div className="card flex flex-col gap-4 border border-warm-200 bg-white p-4">
                <div className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold ${AGENT_PANELS[selectedAgent.name].accent}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{selectedAgent.avatarEmoji}</span>
                    <div>
                      <p className="text-[0.7rem] uppercase tracking-[0.2em]">{selectedAgent.name}</p>
                      <p className="text-[0.7rem] font-normal">{AGENT_PANELS[selectedAgent.name].subtitle}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white/70 px-2 py-1 text-[0.65rem] uppercase tracking-[0.2em]">
                    {AGENT_PANELS[selectedAgent.name].title}
                  </span>
                </div>

                <div className="grid gap-3 text-[0.7rem] text-warm-700">
                  {AGENT_PANELS[selectedAgent.name].summary.map((item) => (
                    <div key={item.label} className="flex items-center justify-between border-b border-dashed border-warm-200 pb-2 last:border-b-0 last:pb-0">
                      <span className="uppercase tracking-[0.2em] text-warm-500">{item.label}</span>
                      <span className="text-warm-900">
                        {item.value}
                        {item.helper && <span className="ml-2 text-[#D97706]">{item.helper}</span>}
                      </span>
                    </div>
                  ))}
                </div>

                {AGENT_PANELS[selectedAgent.name].sections.map((section) => (
                  <div key={section.label} className="flex flex-col gap-2">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-warm-500">
                      {section.label}
                    </span>
                    <div className="flex flex-col gap-2">
                      {section.items.map((item, index) => {
                        const tone =
                          item.status === "good"
                            ? "text-[#166534]"
                            : item.status === "bad"
                              ? "text-[#991B1B]"
                              : item.status === "warn"
                                ? "text-[#B45309]"
                                : "text-warm-700";
                        return (
                          <div
                            key={`${item.primary}-${index}`}
                            className="flex items-center justify-between rounded-lg border border-warm-200 bg-[#F5F3EF] px-3 py-2 text-[0.72rem]"
                          >
                            <div className="flex flex-col">
                              <span className="font-semibold text-warm-900">{item.primary}</span>
                              {item.secondary && <span className="text-warm-600">{item.secondary}</span>}
                            </div>
                            <div className={`text-right ${tone}`}>
                              {item.tertiary && <div className="font-semibold">{item.tertiary}</div>}
                              {item.status && !item.tertiary && <div className="font-semibold">●</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="section-title">Mission Queue</span>
              <button
                type="button"
                onClick={() => setShowForm((prev) => !prev)}
                className="rounded-full border border-warm-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-warm-600 transition hover:border-[#D97706] hover:text-[#D97706]"
              >
                New Task
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleCreate} className="card flex flex-col gap-3 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="w-full rounded-lg border border-warm-200 px-3 py-2 text-sm"
                    placeholder="Task title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
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
                <textarea
                  className="min-h-[90px] w-full rounded-lg border border-warm-200 px-3 py-2 text-sm"
                  placeholder="Description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
                <input
                  className="w-full rounded-lg border border-warm-200 px-3 py-2 text-sm"
                  placeholder="Tags (comma separated)"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                />
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

            <div className="card flex h-[640px] flex-col gap-3 overflow-hidden p-3">
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
              <div className="grid flex-1 grid-cols-5 gap-3 overflow-x-hidden pb-1">
                {STATUS_COLUMNS.map((column) => (
                  <div key={column.key} className="flex min-w-0 flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="section-title">{column.label}</span>
                      <span className="badge bg-[#F3F4F6] text-[#6B7280]">
                        {tasksByStatus[column.key]?.length ?? 0}
                      </span>
                    </div>
                    <div className="flex max-h-[560px] flex-col gap-2 overflow-y-auto overflow-x-hidden rounded-lg bg-[#F5F3EF] p-2 scrollbar-thin">
                      {(tasksByStatus[column.key] ?? []).map((task) => (
                        <div
                          key={task._id}
                          className={`rounded-lg border border-warm-200 bg-white p-2 shadow-card border-l-4 ${
                            PRIORITY_BORDER[task.priority]
                          }`}
                        >
                          <div className="flex flex-col gap-2">
                            <p className="text-sm font-semibold leading-snug">{task.title}</p>
                            {task.description && (
                              <p className="text-clamp-2 text-xs text-warm-600">{task.description}</p>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {(task.tags ?? []).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-[#F5F3EF] px-2 py-0.5 text-[0.65rem] font-semibold text-warm-600"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs text-warm-600">
                            <div className="flex items-center gap-1">
                              {(task.assignees ?? []).length === 0 && <span>Unassigned</span>}
                              {(task.assignees ?? []).map((assignee) => (
                                <span key={assignee._id} className="text-base">
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

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="section-title">Live Feed</span>
              <span className="badge bg-[#DCFCE7] text-[#166534]">Live</span>
            </div>
            <div className="card flex flex-col gap-4 p-4">
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
                  className={`pill ${agentFilter === "all" ? "border-[#D97706] text-[#92400E]" : ""}`}
                >
                  All Agents
                </button>
                {(agents ?? []).map((agent) => (
                  <button
                    key={agent._id}
                    type="button"
                    onClick={() => setAgentFilter(agent._id.toString())}
                    className={`pill ${
                      agentFilter === agent._id.toString() ? "border-[#D97706] text-[#92400E]" : ""
                    }`}
                  >
                    <span>{agent.avatarEmoji}</span>
                    <span>{agentCounts[agent._id.toString()] ?? 0}</span>
                  </button>
                ))}
              </div>
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
          </section>
        </main>
      </div>
    </div>
  );
}
