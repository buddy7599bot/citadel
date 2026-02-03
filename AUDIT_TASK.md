# Citadel Frontend-Backend Audit

## Task
Audit every user-editable field in `src/app/page.tsx` and verify that changes are actually persisted to the Convex backend. Check that:

1. **Title edit** (contentEditable h2, onBlur calls `updateTask`) - verify the `api.tasks.update` mutation in `convex/tasks.ts` handles `title`
2. **Description edit** (contentEditable p, onBlur calls `updateTask`) - verify `description` field
3. **Assignees add/remove** (onClick and select onChange call `updateTask` with `assigneeIds`) - verify `assigneeIds` field
4. **Tags add/remove** (onClick and onKeyDown call `updateTask` with `tags`) - verify `tags` field  
5. **Subscribers add** (select onChange calls `subscribeAgent` via `api.subscriptions.subscribe`) - verify mutation exists and inserts to `subscriptions` table
6. **Subscribers remove** (onClick calls `unsubscribeAgent` via `api.subscriptions.unsubscribe`) - verify mutation exists and deletes from `subscriptions` table
7. **Status change** (select onChange calls `updateTaskStatus` via `api.tasks.updateStatus`) - verify mutation
8. **Task creation** (form onSubmit calls `createTask`) - verify all fields passed through
9. **Task deletion** (calls `removeTask`) - verify

## Files to check
- `src/app/page.tsx` - all useMutation hooks and where they're called
- `convex/tasks.ts` - update, updateStatus, create, remove, assign mutations
- `convex/subscriptions.ts` - subscribe, unsubscribe mutations
- `convex/schema.ts` - verify table schemas match

## What to fix
If any mutation is missing a field or not properly saving, fix it. If any frontend call is not passing the right args, fix it.

## When done
Run: `clawdbot gateway wake --text "Done: Citadel backend audit complete - all mutations verified" --mode now`
