---
title: Calendar Views
description: Headless month, week, and multi-range grids for building your own UI.
---

The calendar builders produce **headless grids** — plain 2D structures of
`CalendarDay` cells with all the metadata you need to render a calendar, with
zero styling and zero framework assumptions.

## The cell shape

```ts
interface CalendarDay {
  date: Date;              // local midnight of the day
  isoString: string;       // local "YYYY-MM-DD" lookup key
  dayOfMonth: number;      // 1–31
  dayOfWeek: number;       // 0 = Sunday … 6 = Saturday
  isCurrentMonth: boolean; // belongs to the rendered month
  isToday: boolean;        // matches the current local date
  isWeekend: boolean;
  isBlocked: boolean;      // padding or outside the view bounds
  blockReason?: "OUT_OF_BOUNDS" | "CUSTOM_EXCLUSION" | "PAST_DATE";
}
```

`isoString` uses **local** calendar dates (not UTC), so lookup keys line up
with what users see in their own timezone.

## Month grid

```ts
import { buildMonthMatrix } from "@apiary/core";

const grid = buildMonthMatrix({
  year: 2026,
  month: 1,          // 1-indexed: January
  weekStartsOn: 0,   // 0 = Sunday (default), 1 = Monday
});
// → CalendarDay[][], always 6 rows × 7 columns = 42 cells
```

Leading and trailing cells from adjacent months are included as padding and
flagged `isBlocked: true` with reason `OUT_OF_BOUNDS`. A fixed 6×7 layout keeps
grid heights consistent between months.

## Week grid

```ts
import { buildWeekMatrix } from "@apiary/core";

const week = buildWeekMatrix({
  targetDate: new Date(2026, 0, 14), // any date in the target week
  weekStartsOn: 1,
});
// → CalendarDay[], 7 days, starting on the Monday of that week
```

Days outside the target month are flagged `isBlocked` / `OUT_OF_BOUNDS`, so a
week spanning a month boundary renders honestly.

## Multi-week and multi-month ranges

```ts
import { buildMultiWeekMatrix, buildMultiMonthMatrix } from "@apiary/core";

const weeks = buildMultiWeekMatrix({
  startDate: new Date(2026, 0, 14),
  endDate: new Date(2026, 1, 1),
  maxWeeksAllowed: 12, // safety cap
  weekStartsOn: 0,
});

const months = buildMultiMonthMatrix({
  startDate: new Date(2026, 0, 14),
  endDate: new Date(2026, 2, 10),
  maxMonthsAllowed: 12,
});
// → MonthViewUnit[] = [{ year, month, grid }, ...]
```

Cells outside the requested date range are blocked, so boundary weeks and
months render partially-available ranges correctly.

## Composing with availability

The builders are deliberately storage- and logic-agnostic. Combine them with
your availability data in the component layer — for example, marking a day as
unavailable when it contains no open slots:

```ts
const grid = buildMonthMatrix({ year: 2026, month: 1 });

const cells = grid.flat().map((day) => {
  const daySlots = slotsByDate.get(day.isoString) ?? [];
  return { ...day, hasAvailability: daySlots.some((s) => s.available) };
});
```

Because the builders return plain data, they work in SolidJS, React, Vue,
Svelte, or plain server-rendered HTML.
