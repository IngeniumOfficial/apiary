---
title: The Dual Availability Model
description: Dynamic rules vs explicit shifts, and how they unify behind one core generator.
---

Apiary supports two operational scheduling strategies through a single,
unified slot generator. Both produce the same `AvailableWindow[]` shape, so the
engine never needs to know which model you use.

## Dynamic rules — "availability by exception"

Time is **open by default**, described by weekly recurring rules such as
"Mon–Fri, 09:00–17:00". Available slots are what remains after subtracting
buffers, blackouts, and existing bookings.

This is the Calendly-style model, and it is implemented by two pieces working
together:

1. `expandWeeklyRules` expands stored rules into `AvailableWindow[]` for a date
   range:

```ts
import { expandWeeklyRules } from "@apiary-dev/core";

const windows = expandWeeklyRules({
  rules: [
    { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
    { dayOfWeek: 1, startTime: "13:00", endTime: "17:00" },
    { dayOfWeek: 4, startTime: "09:00", endTime: "17:00" }, // Thu
    { dayOfWeek: 5, startTime: "09:00", endTime: "14:00" }, // Fri
  ],
  startDate: new Date("2026-01-05T00:00:00Z"),
  endDate: new Date("2026-01-12T00:00:00Z"),
  timeZone: "Europe/London",
});
```

2. `generateTimeSlots` subtracts bookings, buffers, and policy from those
   windows:

```ts
const slots = generateTimeSlots({
  windows,
  existingBookings,
  durationMinutes: 30,
  intervalMinutes: 15,
  buffers: { beforeMinutes: 5, afterMinutes: 5 },
});
```

## Explicit shifts — "availability by grant"

Time is **blocked by default**. Slots are generated exclusively inside
admin-approved shift records. This suits medical and fitness practices, where a
provider's calendar is defined by published shifts rather than recurring rules.

In the PostgreSQL adapter, shifts live in `scheduling_shifts` and are gated by
`is_published`:

```ts
const windows = await bookings.getAvailableWindows({
  startDate: start,
  endDate: end,
  providerId,
  mode: "explicit", // only published shifts are returned
  timeZone: "America/New_York",
});
```

Only rows where `is_published = true` contribute windows; draft shifts are
ignored until an administrator publishes them.

## Why a unified core matters

Because both modes collapse to `AvailableWindow[]`, everything downstream — the
slot generator, the calendar builders, and future UI layers — works identically
for either model. Switching a provider from rules to shifts (or a hybrid of
both) does not change your rendering or booking logic.

## Mixed availability

The repository port deliberately keeps `mode` per call, so you can compose a
single provider's availability from both sources if you want — expand rules and
published shifts separately, then merge and deduplicate the windows before
generating slots:

```ts
const [ruleWindows, shiftWindows] = await Promise.all([
  bookings.getAvailableWindows({ startDate, endDate, mode: "dynamic", timeZone }),
  bookings.getAvailableWindows({ startDate, endDate, providerId, mode: "explicit", timeZone }),
]);

const windows = [...ruleWindows, ...shiftWindows].sort((a, b) => a.start - b.start);
```
