# Citadel UI Fix - Shared Borders Layout

## Task
Update the Citadel dashboard layout so the three main columns (Agents sidebar, Mission Queue, Live Feed) share single borders instead of having gaps/padding between them. Like cells in a table - everything flush, single 1px divider lines between sections.

## Reference
See `reference-ui.jpg` in this directory. Notice how:
- Agents panel, Mission Queue columns, and Live Feed are all flush against each other
- Single shared border lines between sections (no gaps)
- Everything feels like one connected grid/table
- No floating card effect between the main sections

## Current Problem
Our layout has margins/gaps between the main panels making them feel like separate floating cards. We need them touching with shared borders.

## What to Change
File: `src/app/page.tsx`

1. **Remove gaps between main layout columns** - the Agents sidebar, Mission Queue, and Live Feed should have zero gap between them
2. **Use shared borders** - border-right on Agents panel, border-right on Mission Queue. Single 1px border lines as dividers.
3. **Keep the overall container** but make inner sections flush
4. **Task cards inside columns should still have padding** - the cards themselves are fine, it's the column-to-column spacing that needs fixing
5. **The header/stats bar at top can stay as is**

## Rules
- Only modify layout/spacing CSS, don't change functionality
- Keep all existing features working
- Use Tailwind classes
- The goal is a tight, professional, Bloomberg-terminal-like feel where everything is connected
