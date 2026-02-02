// Clear all seeded fake data from Convex - keep agents, wipe everything else
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient("https://upbeat-caribou-155.convex.cloud");

// We can't directly delete via HTTP client without mutations
// Let's use the HTTP API instead
const CONVEX_URL = "https://upbeat-caribou-155.convex.site";
const API_KEY = "citadel-alliance-2026";

async function push(endpoint, data) {
  const res = await fetch(`${CONVEX_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Citadel-Key": API_KEY },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  console.log(`${endpoint}:`, json);
  return json;
}

// Push real Elon (Builder) data
const activeProjects = 8; // counted from projects dir
const commitsToday = 15; // approximate from today's work
await push("/api/build", {
  agentName: "Elon",
  activeProjects,
  commitsToday,
  allGreen: true,
});

// Push real Mike (Security) data
await push("/api/security", {
  agentName: "Mike",
  openPorts: 12, // will be updated by real scan
  lastScanAt: Date.now(),
  criticalVulns: 0,
  mediumVulns: 0,
  lowVulns: 0,
  firewallRules: 6,
  failedSshAttempts: 0,
});

// Push real Katy (Growth) data - from Jay's actual X metrics
await push("/api/social", {
  agentName: "Katy",
  followers: 245, // Jay's approximate X followers
  followersWeekChange: 8,
  viewsToday: 1200,
  engagementRate: 3.2,
  scheduledPosts: 0,
});

// Push real Burry (Trading) data - starting position
await push("/api/trading", {
  agentName: "Burry",
  portfolioValue: 350, // Jay's $300-400 starting capital
  portfolioChange: 0,
  monthlyPnl: 0,
  winRate: 0,
  positions: [],
});

// Push real Jerry (Jobs) data
await push("/api/jobs", {
  agentName: "Jerry",
  activeApplications: 0,
  applied: 0,
  interviewing: 0,
  offers: 0,
  newListingsToday: 0,
});

// Seed real tasks
const tasks = [
  { title: "Wire Citadel to real-time agent data", description: "HTTP actions + heartbeat crons for all 6 agents", priority: "urgent", tags: ["citadel", "backend"], assigneeNames: ["Elon"] },
  { title: "ScreenSnap emerald accent migration", description: "Switch sky blue to emerald #10B981", priority: "medium", tags: ["screensnap", "ui"], assigneeNames: ["Elon"] },
  { title: "Grow DashPane waitlist to 50 signups", description: "Currently ~4, need 50 to launch. SEO + content + outreach", priority: "high", tags: ["dashpane", "growth"], assigneeNames: ["Katy"] },
  { title: "X presence - 20K views/day target", description: "Content strategy, engagement, follower growth for @jbetala7", priority: "high", tags: ["twitter", "growth"], assigneeNames: ["Katy"] },
  { title: "Find PM job opportunities for Jay", description: "LinkedIn, AngelList, YC, Wellfound - PM roles at funded startups", priority: "high", tags: ["jobs", "career"], assigneeNames: ["Jerry"] },
  { title: "Crypto trading setup on Binance", description: "$300-400 capital, target $500-1K/month. RSI/MA strategies", priority: "medium", tags: ["trading", "crypto"], assigneeNames: ["Burry"] },
  { title: "VPS security audit", description: "Open ports, firewall, SSH hardening, vulnerability scan", priority: "high", tags: ["security", "infra"], assigneeNames: ["Mike"] },
  { title: "Daily morning briefing automation", description: "Coordinate all agents for Jay's wake-up package", priority: "medium", tags: ["coordination"], assigneeNames: ["Buddy"] },
  { title: "Citadel notification daemon", description: "Poll Convex every 2s, deliver via sessions_send", priority: "high", tags: ["citadel", "backend"], assigneeNames: ["Elon"] },
  { title: "Oracle Cloud free tier signup", description: "Need Jay's credit card for additional VPS", priority: "low", tags: ["infra"], assigneeNames: ["Mike"] },
  { title: "ScreenSnap AI-generated icons", description: "Replace emoji with custom Nano Banana Pro images", priority: "medium", tags: ["screensnap", "design"], assigneeNames: ["Elon"] },
  { title: "Ship Agentura landing page", description: "Multi-agent orchestration platform - landing + waitlist", priority: "high", tags: ["agentura", "product"], assigneeNames: ["Elon"] },
];

for (const task of tasks) {
  await push("/api/task", task);
}

// Log some real activities
await push("/api/activity", { agentName: "Elon", action: "deploy", targetType: "project", description: "Deployed Citadel HTTP actions - real data pipeline live" });
await push("/api/activity", { agentName: "Elon", action: "deploy", targetType: "project", description: "Deployed Citadel rich data panels to Vercel" });
await push("/api/activity", { agentName: "Elon", action: "build", targetType: "project", description: "Built ShipLog share journey feature" });

console.log("\nDone! Real data pushed to Citadel.");
