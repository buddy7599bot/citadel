#!/usr/bin/env bash
set -euo pipefail

CONVEX_SITE_URL="${CONVEX_SITE_URL:-https://upbeat-caribou-155.convex.site}"
API_KEY="${CITADEL_API_KEY:-citadel-alliance-2026}"

post() {
  local endpoint="$1"
  local data="$2"
  curl -s -X POST "$CONVEX_SITE_URL/api/$endpoint" \
    -H "Content-Type: application/json" \
    -H "X-Citadel-Key: $API_KEY" \
    -d "$data" > /dev/null
}

json_escape() {
  python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"
}

post_rule() {
  local scope="$1"; local tier="$2"; local text="$3"; local why="$4"; local checkable="$5"; local pattern="${6:-}"
  local text_json; text_json=$(json_escape "$text")
  local why_json; why_json=$(json_escape "$why")
  local pattern_json="null"
  if [ -n "$pattern" ]; then
    pattern_json=$(json_escape "$pattern")
  fi
  post "rules" "{\"scope\":\"$scope\",\"tier\":\"$tier\",\"text\":$text_json,\"why\":$why_json,\"checkable\":$checkable,\"checkPattern\":$pattern_json}"
}

post_standing_order() {
  local agent="$1"; local goal="$2"; local priority="$3"
  local goal_json; goal_json=$(json_escape "$goal")
  post "standing-orders" "{\"agentName\":\"$agent\",\"goal\":$goal_json,\"priority\":\"$priority\"}"
}

# Critical Global Rules
post_rule "global" "critical" "Never use em dashes (double dashes) in any output" "Jay's #1 formatting rule" true "--|—|–"
post_rule "global" "critical" "Never call agents 'bots'" "They are employees with names" true "\\bbot\\b|\\bbots\\b"
post_rule "global" "critical" "All times in IST, no timezone labels" "Jay is in Bangalore" false
post_rule "global" "critical" "Write to file BEFORE responding" "Memory doesn't survive sessions" false
post_rule "global" "critical" "Confirm before acting on ambiguous messages" "Learned from Katy cron disable incident" false

# Role-scoped rules
post_rule "social" "standard" "Every comment draft must include a clickable link" "Ensure posts reference a source" true "absence of https://"
post_rule "social" "standard" "Never post more than 2 comments on same author per shift" "Avoid spamming authors" false
post_rule "trading" "standard" "Never execute live trades without Jay's approval" "Reduce trading risk" false
post_rule "building" "standard" "All coding through Codex, never hand-write code" "Ensure reproducible builds" false
post_rule "building" "standard" "Dev servers bind to 127.0.0.1 only, never 0.0.0.0" "Avoid exposing services" true "0\\.0\\.0\\.0"

# Standing Orders
post_standing_order "Katy" "Grow Jay's X to 50K followers" "primary"
post_standing_order "Katy" "Build Jay's reputation as a tech builder and AI-first founder" "secondary"
post_standing_order "Burry" "Generate $500-1K/month from crypto trading" "primary"
post_standing_order "Jerry" "Find Jay a PM role at a well-funded startup with great product" "primary"
post_standing_order "Elon" "Ship products that generate $1-2K MRR" "primary"
post_standing_order "Mike" "Keep all infrastructure secure with zero breaches" "primary"
post_standing_order "Buddy" "Coordinate the team to maximize Jay's business growth" "primary"

echo "Seeded rules and standing orders."
