---
title: Slots, Buffers & Rules
description: How generateTimeSlots evaluates a candidate slot, in rule order.
---

`generateTimeSlots` is a pure function: given windows, existing bookings, and
configuration, it returns every candidate slot with a deterministic
`available` flag and a `reason`.

## The options

```ts
interface SlotGeneratorOptions {
  windows: AvailableWindow[];        // source operating windows
  existingBookings: TimeRange[];     // confirmed bookings, holds, or blackouts
  durationMinutes: number;           // appointment length
  intervalMinutes: number;           // step between slot start times
  buffers?: BufferConfig;            // pre/post service buffer
  minNoticeMinutes?: number;         // minimum advance notice
  maxHorizonMinutes?: number;        // furthest-out bookable start time
}
```

The optional `now` parameter defaults to the current time and is used for the
min-notice and horizon cutoffs — pass an explicit `Date` for deterministic
tests and previews.

## How a slot is evaluated

For each candidate `[start, start + duration)`, the generator applies rules in
order. The **first failing rule** determines the slot's reason:

1. **Minimum notice** — `start < now + minNoticeMinutes` →
   `MIN_NOTICE_VIOLATION`
2. **Booking horizon** — if `maxHorizonMinutes` is set and
   `start > now + maxHorizonMinutes` → `MAX_HORIZON_EXCEEDED`
3. **Window bounds** — the slot *plus* its buffers must fit inside its window →
   `OUTSIDE_BOUNDS`
4. **Collisions** — the buffered slot must not overlap any buffered existing
   booking → `COLLISION`

A slot that passes all four rules is `AVAILABLE`.

## Buffer semantics

Buffers are applied symmetrically:

```ts
import { applyBufferToRange } from "@apiary-dev/core";

const buffered = applyBufferToRange(
  { start: new Date("2026-01-05T10:00:00Z"), end: new Date("2026-01-05T10:30:00Z") },
  { beforeMinutes: 5, afterMinutes: 5 },
);
// buffered = { start: 09:55, end: 10:35 }
```

The generator buffers **both** the candidate slot and the existing bookings.
The practical effect: two adjacent appointments must be separated by
`beforeMinutes + afterMinutes` total. With `{ before: 5, after: 5 }`, a booking
ending at 10:30 and a slot starting at 10:30 **collide** — the appointment
before needs its 5-minute cleanup time, and the next one needs its 5-minute
setup time.

```ts
const slots = generateTimeSlots({
  windows: [{ start: at("09:00"), end: at("12:00") }],
  existingBookings: [{ start: at("10:00"), end: at("11:00") }],
  durationMinutes: 30,
  intervalMinutes: 30,
  buffers: { beforeMinutes: 15, afterMinutes: 15 },
});
```

With 15-minute buffers on both sides, a 60-minute booking at 10:00 occupies an
effective footprint of **09:45 → 11:15**, so slots at 09:30 and 11:30 are the
earliest bookable neighbors — a 30-minute combined buffer between appointments.

## Half-open intervals

All ranges are half-open `[start, end)`: a booking ending at exactly 10:00 and a
slot starting at exactly 10:00 do **not** collide. `rangesOverlap` encodes this:

```ts
import { rangesOverlap } from "@apiary-dev/core";

rangesOverlap(
  { start: at("09:00"), end: at("10:00") },
  { start: at("10:00"), end: at("11:00") },
); // false — touch points don't collide
```

## Overlapping slots

When `intervalMinutes` is smaller than `durationMinutes`, candidates overlap
each other (for example, 60-minute appointments starting every 15 minutes).
Each candidate is still evaluated independently against bookings — this is what
enables "next available" style UIs.

## Empty and degenerate inputs

- No windows → `[]`.
- A booking entirely outside every window simply never collides.
- Zero-length or negative-length windows generate no slots.
