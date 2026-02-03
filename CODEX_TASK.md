# Citadel - Clickable Activity Items + Hydration Fix

## Task 1: Clickable Activity Items
In src/app/page.tsx, in the Activity/Live Feed section:
- Each activity item that has a `targetId` (linked to a task) should be clickable
- When clicked, it should open the task detail panel by calling `setSelectedTaskId(activity.targetId)`
- Add `cursor-pointer hover:bg-warm-50` to make it visually clickable
- Activities without a targetId should not be clickable

## Task 2: Fix Hydration Error
The clock in the header causes a hydration mismatch because Date.now() differs between server and client.
Fix: Only render the time after the component mounts on the client.
- Add a `const [mounted, setMounted] = useState(false)` 
- `useEffect(() => setMounted(true), [])`
- Show a placeholder (like "-- : -- : --") until mounted, then show the real time
- This prevents the server/client mismatch

## Rules
- Don't break existing functionality
- Keep existing styles
- Both tasks are in src/app/page.tsx only
