#!/usr/bin/env bash
# Citadel CLI - Helper for agents to interact with Citadel
# Usage:
#   citadel-cli.sh comment <agent> <taskId> "message"
#   citadel-cli.sh document <agent> <taskId> "title" "content" [type]
#   citadel-cli.sh status <agent> <taskId> <status>
#   citadel-cli.sh task <agent> "title" "description" "assignee1,assignee2" [priority] [tags]
#   citadel-cli.sh decision <agent> <taskId> "title" "option1,option2"
#   citadel-cli.sh standing-order <agent> "goal" [priority]
#   citadel-cli.sh standing-orders <agent>
#   citadel-cli.sh rule <scope> <tier> "text" "why" [checkable] [checkPattern]
#   citadel-cli.sh rules [agentName]
#   citadel-cli.sh preflight <agent> "content"

set -euo pipefail

CONVEX_SITE_URL="${CONVEX_SITE_URL:-https://upbeat-caribou-155.convex.site}"
API_KEY="${CITADEL_API_KEY:-citadel-alliance-2026}"
BASE_URL="${BASE_URL:-$CONVEX_SITE_URL}"

post() {
  local endpoint="$1"
  local data="$2"
  curl -s -X POST "$CONVEX_SITE_URL/api/$endpoint" \
    -H "Content-Type: application/json" \
    -H "X-Citadel-Key: $API_KEY" \
    -d "$data"
}

put() {
  local endpoint="$1"
  local data="$2"
  curl -s -X PUT "$CONVEX_SITE_URL/api/$endpoint" \
    -H "Content-Type: application/json" \
    -H "X-Citadel-Key: $API_KEY" \
    -d "$data"
}

get() {
  local endpoint="$1"
  curl -s "$CONVEX_SITE_URL/api/$endpoint" \
    -H "X-Citadel-Key: $API_KEY"
}

case "${1:-help}" in
  comment)
    agent="$2"; taskId="$3"; content="$4"
    post "comment" "{\"agent\":\"$agent\",\"taskId\":\"$taskId\",\"content\":$(echo "$content" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')}"
    ;;
  document)
    agent="$2"; taskId="$3"; title="$4"; content="$5"; dtype="${6:-deliverable}"
    post "document" "{\"agent\":\"$agent\",\"taskId\":\"$taskId\",\"title\":$(echo "$title" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'),\"content\":$(echo "$content" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'),\"type\":\"$dtype\"}"
    ;;
  status)
    agent="$2"; taskId="$3"; status="$4"
    post "task/status" "{\"agent\":\"$agent\",\"taskId\":\"$taskId\",\"status\":\"$status\"}"
    ;;
  assign)
    actor="$2"; taskId="$3"; assignee="$4"
    post "assign" "{\"actor\":\"$actor\",\"taskId\":\"$taskId\",\"assignee\":\"$assignee\"}"
    ;;
  decision)
    agent="$2"; taskId="$3"; title="$4"; options="$5"
    IFS=',' read -ra OPTS <<< "$options"
    opts_json=$(printf '%s\n' "${OPTS[@]}" | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin.read().strip().split("\n") if l.strip()]))')
    title_json=$(echo "$title" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')
    if [ -n "$taskId" ]; then
      post "decision" "{\"agent\":\"$agent\",\"taskId\":\"$taskId\",\"title\":$title_json,\"options\":$opts_json}"
    else
      post "decision" "{\"agent\":\"$agent\",\"title\":$title_json,\"options\":$opts_json}"
    fi
    ;;
  task)
    agent="$2"; title="$3"; desc="${4:-}"; assignees="${5:-}"; priority="${6:-medium}"; tags="${7:-}"
    IFS=',' read -ra NAMES <<< "$assignees"
    assignee_json=$(printf '%s\n' "${NAMES[@]}" | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin.read().strip().split("\n") if l.strip()]))')
    tags_json="[]"
    if [ -n "$tags" ]; then
      IFS=',' read -ra TAGS <<< "$tags"
      tags_json=$(printf '%s\n' "${TAGS[@]}" | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin.read().strip().split("\n") if l.strip()]))')
    fi
    post "task" "{\"agent\":\"$agent\",\"title\":$(echo "$title" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'),\"description\":$(echo "$desc" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'),\"assignees\":$assignee_json,\"priority\":\"$priority\",\"tags\":$tags_json}"
    ;;
  standing-order)
    agent="$2"; goal="$3"; priority="${4:-primary}"
    post "standing-orders" "{\"agentName\":\"$agent\",\"goal\":$(echo "$goal" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'),\"priority\":\"$priority\"}"
    ;;
  standing-orders)
    agent="$2"
    if [ -z "${agent:-}" ]; then
      echo "Missing agent name"
      exit 1
    fi
    get "standing-orders?agent=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$agent")" | jq .
    ;;
  rule)
    scope="$2"; tier="$3"; text="$4"; why="$5"; checkable="${6:-false}"; checkPattern="${7:-}"
    checkable_json=$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1].lower() in ["1","true","yes"]))' "$checkable")
    pattern_json="null"
    if [ -n "$checkPattern" ]; then
      pattern_json=$(echo "$checkPattern" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')
    fi
    post "rules" "{\"scope\":\"$scope\",\"tier\":\"$tier\",\"text\":$(echo "$text" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'),\"why\":$(echo "$why" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'),\"checkable\":$checkable_json,\"checkPattern\":$pattern_json}"
    ;;
  rules)
    agent="${2:-}"
    if [ -n "$agent" ]; then
      get "rules?agent=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$agent")" | jq .
    else
      get "rules/all" | jq .
    fi
    ;;
  preflight)
    agent="$2"; content="$3"
    post "preflight" "{\"agentName\":\"$agent\",\"content\":$(echo "$content" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')}"
    ;;
  inbox)
    curl -s "$BASE_URL/api/inbox" | jq .
    ;;
  *)
    echo "Citadel CLI - Agent helper"
    echo "Commands:"
    echo "  comment  <agent> <taskId> \"message\""
    echo "  document <agent> <taskId> \"title\" \"content\" [type]"
    echo "  status   <agent> <taskId> <status>"
    echo "  task     <agent> \"title\" \"description\" \"assignee1,assignee2\" [priority] [tags]"
    echo "  decision <agent> <taskId> \"title\" \"option1,option2\""
    echo "  standing-order <agent> \"goal\" [priority]"
    echo "  standing-orders <agent>"
    echo "  rule <scope> <tier> \"text\" \"why\" [checkable] [checkPattern]"
    echo "  rules [agentName]"
    echo "  preflight <agent> \"content\""
    echo "  inbox"
    echo ""
    echo "Document types: deliverable, research, protocol, report"
    echo "Task priorities: low, medium, high, urgent"
    echo "Task statuses: inbox, assigned, in_progress, review, done"
    ;;
esac
