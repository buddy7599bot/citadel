#!/usr/bin/env bash
# Seed Citadel with REAL tasks from actual Alliance work
set -euo pipefail

CONVEX_URL="https://upbeat-caribou-155.convex.site"
API_KEY="citadel-alliance-2026"

push_task() {
  local title="$1"
  local desc="$2"
  local priority="$3"
  local tags="$4"
  local assignees="$5"
  
  curl -s -X POST "$CONVEX_URL/api/task" \
    -H "Content-Type: application/json" \
    -H "X-Citadel-Key: $API_KEY" \
    -d "{
      \"title\": \"$title\",
      \"description\": \"$desc\",
      \"priority\": \"$priority\",
      \"tags\": $tags,
      \"assigneeNames\": $assignees
    }" || true
  echo " -> $title"
}

echo "=== Seeding Real Tasks ==="

# IN PROGRESS tasks
push_task "Wire Citadel to real agent data" "Build HTTP actions, heartbeat scripts, real-time data push from all 6 agents" "urgent" '["citadel","backend"]' '["Elon"]'
push_task "ScreenSnap emerald accent migration" "Switch from sky blue to emerald #10B981 across all components" "medium" '["screensnap","ui"]' '["Elon"]'
push_task "ScreenSnap AI-generated icons" "Replace emoji icons with custom Nano Banana Pro generated images" "medium" '["screensnap","design"]' '["Elon"]'
push_task "Grow DashPane waitlist to 50" "Currently ~4 signups, need 50 to launch. SEO, content, outreach" "high" '["dashpane","growth"]' '["Katy"]'
push_task "X presence growth" "Target 20K views/day, 10-15 followers/day for @jbetala7" "high" '["twitter","growth"]' '["Katy"]'
push_task "Find PM job opportunities" "Monitor LinkedIn, AngelList, YC, Wellfound for PM roles. Startups or corporates, good product, funded" "high" '["jobs","career"]' '["Jerry"]'
push_task "Crypto trading research" "Binance trading with $300-400 capital. Target $500-1K/month. RSI/MA algorithms, scalp/swing" "medium" '["trading","crypto"]' '["Burry"]'
push_task "Server security audit" "Full audit of VPS - open ports, firewall rules, SSH hardening, vulnerability scan" "high" '["security","infrastructure"]' '["Mike"]'
push_task "Daily morning briefing" "Coordinate all agents for Jay's daily morning package" "medium" '["coordination"]' '["Buddy"]'
push_task "Citadel heartbeat crons" "Set up 15-min staggered heartbeats for all 6 agents pushing real data" "urgent" '["citadel","backend"]' '["Elon","Buddy"]'
push_task "Build notification daemon" "Poll Convex every 2s, deliver notifications via sessions_send" "high" '["citadel","backend"]' '["Elon"]'
push_task "Oracle Cloud signup" "Need Jay's credit card for Oracle Cloud free tier VPS" "low" '["infrastructure"]' '["Mike"]'

echo ""
echo "=== Done seeding tasks ==="
