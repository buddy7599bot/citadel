#!/usr/bin/env bash

curl -s https://upbeat-caribou-155.convex.cloud/api/mutation \
  -H 'Content-Type: application/json' \
  -d '{"path":"agents:heartbeat","args":{"sessionKey":"gamma","status":"working","currentTask":"Building Citadel"}}'
