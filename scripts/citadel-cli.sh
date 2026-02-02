#!/usr/bin/env bash
# Citadel CLI - Helper for agents to interact with Citadel
# Usage:
#   citadel-cli.sh comment <agent> <taskId> "message"
#   citadel-cli.sh document <agent> <taskId> "title" "content" [type]
#   citadel-cli.sh status <agent> <taskId> <status>
#   citadel-cli.sh task <agent> "title" "description" "assignee1,assignee2" [priority] [tags]

set -euo pipefail

CONVEX_SITE_URL="${CONVEX_SITE_URL:-https://upbeat-caribou-155.convex.site}"
API_KEY="${CITADEL_API_KEY:-citadel-alliance-2026}"

post() {
  local endpoint="$1"
  local data="$2"
  curl -s -X POST "$CONVEX_SITE_URL/api/$endpoint" \
    -H "Content-Type: application/json" \
    -H "X-Citadel-Key: $API_KEY" \
    -d "$data"
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
  *)
    echo "Citadel CLI - Agent helper"
    echo "Commands:"
    echo "  comment  <agent> <taskId> \"message\""
    echo "  document <agent> <taskId> \"title\" \"content\" [type]"
    echo "  status   <agent> <taskId> <status>"
    echo "  task     <agent> \"title\" \"description\" \"assignee1,assignee2\" [priority] [tags]"
    echo ""
    echo "Document types: deliverable, research, protocol, report"
    echo "Task priorities: low, medium, high, urgent"
    echo "Task statuses: inbox, assigned, in_progress, review, done"
    ;;
esac
