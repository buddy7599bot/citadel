# Task: Add Document Panel to Citadel Dashboard

## Context
Citadel is a dashboard at `/home/ubuntu/clawd/projects/citadel/`. The main page is `src/app/page.tsx`. It has a three-column layout: left sidebar (agents), center (kanban + activity), right (agent detail panel).

The Convex schema already has a `documents` table with fields: title, content, type (deliverable/research/protocol/report), taskId, authorId, createdAt, updatedAt. Queries exist in `convex/documents.ts`.

## What to Build

Add a "Documents" tab/section to the dashboard. Two approaches (pick whichever fits better with existing UI):

### Option A: Tab in the right panel
When no agent is selected, show a documents list in the right column. Each document shows title, type badge, author name, and creation date. Clicking expands to show full content.

### Option B: Toggle in the center column
Add a small tab bar above the kanban: "Tasks" | "Documents". When "Documents" is selected, show a list of all documents instead of the kanban board.

## Requirements
1. Use existing `documents.ts` queries (or add new ones if needed)
2. Match the warm editorial aesthetic: off-white #FAFAF8, amber #D97706 accent
3. Type badges with colors:
   - deliverable: green bg
   - research: blue bg
   - protocol: amber bg
   - report: gray bg
4. Show author name (resolve from agents table)
5. Sort by createdAt descending
6. If no documents exist, show a tasteful empty state

## Existing files to reference
- `src/app/page.tsx` - main dashboard (1600+ lines)
- `convex/documents.ts` - existing queries
- `convex/schema.ts` - DO NOT modify

## After building
1. Run: `cd /home/ubuntu/clawd/projects/citadel && CONVEX_DEPLOY_KEY="dev:upbeat-caribou-155|eyJ2MiI6IjYxZGY3NWFjZmU4OTQ5OTQ5NDE2ZjY1YTczNDNhNDQwIn0=" npx convex deploy --cmd 'echo ok'`
2. Git add, commit "feat: add document panel to dashboard", push
3. Run: `clawdbot gateway wake --text "Done: Document panel added to Citadel dashboard" --mode now`
