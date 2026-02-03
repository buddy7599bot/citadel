#!/usr/bin/env bash
# Verify all agent crons that use browser specify profile="clawd"

echo "Checking all crons for browser usage..."

# Get all cron jobs and check for browser mentions
clawdbot cron list --json | jq -r '.jobs[] | select(.payload.message | contains("browser")) | {name: .name, agentId: .agentId, hasProfile: (.payload.message | contains("profile=\"clawd\"") or contains("profile=clawd"))}' 

echo ""
echo "✓ All browser-using crons should specify profile=\"clawd\""
echo "✓ Chrome extension relay (default) requires attached tab"
echo "✓ Clawd profile works automatically"
