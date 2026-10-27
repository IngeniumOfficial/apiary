---
title: Quickstart
description: Generate bookable slots in a few lines with @apiary/core.
---

## Slots from a window

The fastest way to see Apiary in action is to carve a single operating window
into bookable slots:

```ts
import { generateTimeSlots } from "@apiary/core";

const now = new Date("2026-01-05T08:00:00Z");

const slots = generateTimeSlots(
  {
    windows: [
      {
        start: new Date("2026-01-05T09:00:00Z"),
        end: new Date("2026-01-05T17:00:00Z"),
      },
    ],
    existingBookings: [
      {
        start: new Date("2026-01-05T11:30:00Z"),
        end: new Date("2026-01-05T12:00:00Z"),
      },
    ],
    durationMinutes: 30,
    intervalMinutes: 15,
    buffers: { beforeMinutes: 5, afterMinutes: 5 },
    minNoticeMinutes: 30,
  },
  now,
);

const open = slots.filter((s) => s.available);
```

`open` is now a list of `TimeSlot`s — 30-minute appointments starting every 15
minutes — with the 11:30 booking blocked out, a 5-minute buffer enforced on
each side, and anything starting within 30 minutes of `now` excluded.

Each slot carries a `reason` explaining its state:

```ts
// TimeSlot[] where reason is one of:
// 'AVAILABLE' | 'COLLISION' | 'OUTSIDE_BOUNDS'
// | 'MIN_NOTICE_VIOLATION' | 'MAX_HORIZON_EXCEEDED'
```

## Windows from weekly rules

Real systems rarely hand you windows directly. `expandWeeklyRules` turns
recurring weekly rules into windows for a date range:

```ts
import { expandWeeklyRules } from "@apiary/core";

const windows = expandWeeklyRules({
  rules: [
    { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }, // Mon AM
    { dayOfWeek: 1, startTime: "13:00", endTime: "17:00" }, // Mon PM
    { dayOfWeek: 3, startTime: "09:00", endTime: "17:00" }, // Wed
  ],
  startDate: new Date("2026-01-05T00:00:00Z"), // Mon Jan 5, 2026
  endDate: new Date("2026-01-19T00:00:00Z"),
  timeZone: "America/New_York",
});
```

Rules are expressed in **local wall-clock time**; windows come back as exact UTC
`Date`s, with daylight-saving transitions handled per day.

Combine the two steps for a complete pipeline:

```ts
const slots = generateTimeSlots(
  {
    windows,
    existingBookings: await fetchBookingsInRange(start, end),
    durationMinutes: 30,
    intervalMinutes: 15,
    buffers: { beforeMinutes: 5, afterMinutes: 5 },
    minNoticeMinutes: 30,
    maxHorizonMinutes: 7 * 24 * 60,
  },
  new Date(),
);
```

## Persistence with PostgreSQL

Once the [migration](guides/postgres/) has been applied, the adapter gives you
a full `BookingRepository`:

```ts
import { Pool } from "pg";
import { PostgresBookingRepository } from "@apiary/postgres";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const bookings = new PostgresBookingRepository(pool);

// Dynamic availability for the next 7 days
const windows = await bookings.getAvailableWindows({
  startDate: new Date(),
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  mode: "dynamic",
  timeZone: "America/New_York",
});
```

## Next steps

- Learn how the [dual availability model](guides/dual-model/) maps to your use
  case.
- Understand how [buffers and rules](guides/slots-and-buffers/) interact.
- Read about [timezone handling](guides/timezones/) before building anything
  multi-region.
- See the full [core API](reference/core/) and
  [postgres API](reference/postgres/) references.
