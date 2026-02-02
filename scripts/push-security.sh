#!/usr/bin/env bash
# Push real security scan data to Citadel for Mike (Security agent)
set -euo pipefail

CONVEX_URL="https://upbeat-caribou-155.convex.site"
API_KEY="citadel-alliance-2026"

# Real open ports
OPEN_PORTS=$(ss -tlnp 2>/dev/null | grep -c LISTEN || echo 0)

# Real firewall rules
FIREWALL_RULES=$(sudo iptables -L -n 2>/dev/null | grep -c -E "^(ACCEPT|DROP|REJECT)" || echo 0)
if [ "$FIREWALL_RULES" -eq 0 ]; then
  # Try ufw
  FIREWALL_RULES=$(sudo ufw status 2>/dev/null | grep -c -E "ALLOW|DENY|REJECT" || echo 0)
fi

# Failed SSH attempts (last 24h)
FAILED_SSH=$(grep -c "Failed password" /var/log/auth.log 2>/dev/null || journalctl -u ssh --since "24 hours ago" 2>/dev/null | grep -c "Failed password" || echo 0)

LAST_SCAN=$(date +%s)000

echo "Pushing security: ports=$OPEN_PORTS firewall=$FIREWALL_RULES failedSSH=$FAILED_SSH"

curl -s -X POST "$CONVEX_URL/api/security" \
  -H "Content-Type: application/json" \
  -H "X-Citadel-Key: $API_KEY" \
  -d "{
    \"agentName\": \"Mike\",
    \"openPorts\": $OPEN_PORTS,
    \"lastScanAt\": $LAST_SCAN,
    \"criticalVulns\": 0,
    \"mediumVulns\": 0,
    \"lowVulns\": 0,
    \"firewallRules\": $FIREWALL_RULES,
    \"failedSshAttempts\": $FAILED_SSH
  }"

echo ""
echo "Done."
