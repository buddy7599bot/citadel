# Citadel - Delete Task

## Task
Add ability to delete a task from the task detail side panel.

### Backend (convex/tasks.ts)
Add a `remove` mutation that deletes a task by ID.

### Frontend (src/app/page.tsx)
In the task detail side panel (the sliding panel that opens when you click a task):
- Add a "Delete" button at the bottom of the panel
- Style it with red text/border (destructive action)
- On click, show a confirmation (simple window.confirm is fine)
- If confirmed, call the remove mutation and close the panel (setSelectedTaskId(null))

### HTTP Endpoint (convex/http.ts)
Add `DELETE /api/task` that accepts `{ "taskId": "..." }` so agents can also delete tasks via API.

## Rules
- Keep it simple
- Use existing auth pattern
- Don't break anything
