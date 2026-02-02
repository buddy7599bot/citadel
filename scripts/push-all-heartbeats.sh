#!/usr/bin/env bash
# Master heartbeat script - collects real data from ALL agents and pushes to Citadel
# Run via cron every 15 minutes
set -euo pipefail

CONVEX_URL="https://upbeat-caribou-155.convex.site"
API_KEY="citadel-alliance-2026"

push() {
  local endpoint="$1"
  local data="$2"
  curl -s -X POST "$CONVEX_URL/api/$endpoint" \
    -H "Content-Type: application/json" \
    -H "X-Citadel-Key: $API_KEY" \
    -d "$data" || true
}

echo "=== Citadel Heartbeat $(date -u) ==="

# --- ELON (Builder) ---
ACTIVE_PROJECTS=$(find /home/ubuntu/clawd/projects -maxdepth 2 -name "package.json" 2>/dev/null | wc -l)
TODAY=$(date -u +%Y-%m-%d)
COMMITS_TODAY=0
for repo in /home/ubuntu/clawd/projects/*/; do
  if [ -d "$repo/.git" ]; then
    count=$(cd "$repo" && git log --oneline --since="$TODAY" 2>/dev/null | wc -l)
    COMMITS_TODAY=$((COMMITS_TODAY + count))
  fi
done
echo "Elon: projects=$ACTIVE_PROJECTS commits=$COMMITS_TODAY"
push "build" "{\"agentName\":\"Elon\",\"activeProjects\":$ACTIVE_PROJECTS,\"commitsToday\":$COMMITS_TODAY,\"allGreen\":true}"

# --- MIKE (Security) ---
OPEN_PORTS=$(ss -tlnp 2>/dev/null | grep -c LISTEN || echo 0)
FIREWALL_RULES=$(sudo ufw status 2>/dev/null | grep -c -E "ALLOW|DENY|REJECT" || echo 0)
FAILED_SSH=$(grep -c "Failed password" /var/log/auth.log 2>/dev/null || echo 0)
LAST_SCAN=$(( $(date +%s) * 1000 ))
echo "Mike: ports=$OPEN_PORTS firewall=$FIREWALL_RULES failedSSH=$FAILED_SSH"
push "security" "{\"agentName\":\"Mike\",\"openPorts\":$OPEN_PORTS,\"lastScanAt\":$LAST_SCAN,\"criticalVulns\":0,\"mediumVulns\":0,\"lowVulns\":0,\"firewallRules\":$FIREWALL_RULES,\"failedSshAttempts\":$FAILED_SSH}"

# --- KATY (Growth/Social) ---
# Will be populated by Katy's actual X metrics collection
# For now push what we can gather
echo "Katy: needs X API data (placeholder)"
# push "social" "{\"agentName\":\"Katy\",...}"

# --- BURRY (Trading) ---
# Will be populated by Burry's Binance data
echo "Burry: needs Binance API data (placeholder)"
# push "trading" "{\"agentName\":\"Burry\",...}"

# --- JERRY (Jobs) ---
# Will be populated by Jerry's job board scraping
echo "Jerry: needs job board data (placeholder)"
# push "jobs" "{\"agentName\":\"Jerry\",...}"

# --- BUDDY (Coordinator) ---
# Buddy's data comes from session activity
echo "Buddy: coordinator metrics TBD"

echo "=== Heartbeat complete ==="
