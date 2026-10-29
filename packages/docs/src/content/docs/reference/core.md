---
title: "@apiary-dev/core Reference"
description: Every type and function exported by @apiary-dev/core, with examples.
---

The core package is a zero-dependency module of pure domain logic. All ranges
are half-open `[start, end)` intervals. Everything here is synchronous and
I/O-free, so it runs anywhere — server, edge, or browser.

## Types

### `TimeRange`

```ts
interface TimeRange {
  start: Date;
  end: Date;
}
```

### `BufferConfig`

```ts
interface BufferConfig {
  beforeMinutes?: number;
  afterMinutes?: number;
}
```

### `AvailabilityReason`

```ts
type AvailabilityReason =
  | "AVAILABLE"
  | "COLLISION"
  | "OUTSIDE_BOUNDS"
  | "MIN_NOTICE_VIOLATION"
  | "MAX_HORIZON_EXCEEDED";
```

### `TimeSlot`

```ts
interface TimeSlot extends TimeRange {
  available: boolean;
  reason: AvailabilityReason;
}
```

### `AvailableWindow`

```ts
interface AvailableWindow extends TimeRange {
  id?: string;
  providerId?: string;
}
```

### `SlotGeneratorOptions`

```ts
interface SlotGeneratorOptions {
  windows: AvailableWindow[];
  existingBookings: TimeRange[];
  durationMinutes: number;
  intervalMinutes: number;
  buffers?: BufferConfig;
  minNoticeMinutes?: number;
  maxHorizonMinutes?: number;
}
```

See the [Slots, Buffers & Rules guide](guides/slots-and-buffers/) for how each
field is evaluated.

### `DayOfWeek`

```ts
type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday … 6 = Saturday
```

### `WeeklyRule`

```ts
interface WeeklyRule {
  dayOfWeek: DayOfWeek;
  startTime: string; // 24-hour "HH:mm", local wall-clock
  endTime: string;   // 24-hour "HH:mm", strictly after startTime
}
```

### `WeeklyAvailabilityOptions`

```ts
interface WeeklyAvailabilityOptions {
  rules: WeeklyRule[];
  startDate: Date; // query range start (inclusive), UTC
  endDate: Date;   // query range end (exclusive), UTC
  timeZone: string; // IANA timezone the rules are expressed in
}
```

### `WallClockTime`

```ts
interface WallClockTime {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
}
```

### `BookingRepository`

The persistence port implemented by adapters such as
[`@apiary-dev/postgres`](reference/postgres/). You rarely call it directly —
the [`@apiary-dev/server`](reference/server/) operations do — but it is the
extension point for any storage backend.

```ts
interface BookingRepository {
  getAvailableWindows(params: {
    startDate: Date;
    endDate: Date;
    providerId?: string;
    mode: "dynamic" | "explicit";
    timeZone: string;
  }): Promise<AvailableWindow[]>;

  getBookingsInRange(
    startDate: Date,
    endDate: Date,
    providerId?: string,
  ): Promise<TimeRange[]>;

  createHold(params: {
    serviceId: string;
    providerId: string;
    range: TimeRange;
    customerId?: string;
  }): Promise<{ holdToken: string; expiresAt: Date }>;

  confirmBooking(params: {
    holdToken: string;
    customerDetails: Record<string, unknown>;
  }): Promise<{ bookingId: string }>;
}
```

## Domain errors

```ts
class BookingConflictError extends Error;
class ValidationError extends Error;
```

`BookingConflictError` is thrown by adapters (such as `@apiary-dev/postgres`)
when a hold or confirmation overlaps an existing booking or hold.
`ValidationError` is thrown by helpers (such as `parseSlotsQuery`) on invalid
input.

## Functions

### `generateTimeSlots`

```ts
function generateTimeSlots(
  options: SlotGeneratorOptions,
  now?: Date,
): TimeSlot[];
```

Carves `windows` into candidate slots of `durationMinutes` at `intervalMinutes`
steps and evaluates each against buffers, min notice, horizon, and bookings.
`now` defaults to the current time and controls the notice/horizon cutoffs.

**Example — a day of 30-minute appointments every 15 minutes:**

```ts
import { generateTimeSlots } from "@apiary-dev/core";

const slots = generateTimeSlots(
  {
    windows: [
      {
        start: new Date("2026-01-05T09:00:00Z"),
        end: new Date("2026-01-05T12:00:00Z"),
      },
    ],
    existingBookings: [
      {
        start: new Date("2026-01-05T10:00:00Z"),
        end: new Date("2026-01-05T10:30:00Z"),
      },
    ],
    durationMinutes: 30,
    intervalMinutes: 15,
    buffers: { beforeMinutes: 5, afterMinutes: 5 },
    minNoticeMinutes: 60,
  },
  new Date("2026-01-05T08:00:00Z"),
);

const bookable = slots.filter((slot) => slot.available);
// -> [{ start: 09:00, ... }, { start: 09:15, ... }, ...]
```

Each returned slot carries `available` and a `reason`
(`AVAILABLE`, `COLLISION`, `OUTSIDE_BOUNDS`, `MIN_NOTICE_VIOLATION`,
`MAX_HORIZON_EXCEEDED`). See the
[Slots, Buffers & Rules guide](guides/slots-and-buffers/).

### `expandWeeklyRules`

```ts
function expandWeeklyRules(options: WeeklyAvailabilityOptions): AvailableWindow[];
```

Expands weekly wall-clock rules into clipped, sorted, deduplicated UTC windows
within `[startDate, endDate)`. Throws on invalid time strings and overnight
spans (`endTime <= startTime`).

**Example — Mon/Wed/Fri business hours in New York:**

```ts
import { expandWeeklyRules } from "@apiary-dev/core";

const windows = expandWeeklyRules({
  rules: [
    { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }, // Monday AM
    { dayOfWeek: 1, startTime: "13:00", endTime: "17:00" }, // Monday PM
    { dayOfWeek: 3, startTime: "09:00", endTime: "17:00" }, // Wednesday
    { dayOfWeek: 5, startTime: "09:00", endTime: "14:00" }, // Friday
  ],
  startDate: new Date("2026-01-05T00:00:00Z"),
  endDate: new Date("2026-01-12T00:00:00Z"),
  timeZone: "America/New_York",
});
// -> windows are UTC Dates, DST-aware
```

See the [Dual Availability Model guide](guides/dual-model/).

### `rangesOverlap`

```ts
function rangesOverlap(a: TimeRange, b: TimeRange): boolean;
```

Returns `true` if two half-open ranges intersect. Touch points
(`a.end === b.start`) do **not** overlap.

**Example — the pre-check behind every collision test:**

```ts
import { rangesOverlap } from "@apiary-dev/core";

const booking = {
  start: new Date("2026-01-05T10:00:00Z"),
  end: new Date("2026-01-05T11:00:00Z"),
};

rangesOverlap(booking, {
  start: new Date("2026-01-05T11:00:00Z"),
  end: new Date("2026-01-05T11:30:00Z"),
}); // false — touching at 11:00 is not a collision

rangesOverlap(booking, {
  start: new Date("2026-01-05T10:30:00Z"),
  end: new Date("2026-01-05T11:30:00Z"),
}); // true
```

### `applyBufferToRange`

```ts
function applyBufferToRange(
  range: TimeRange,
  buffer?: BufferConfig,
): TimeRange;
```

Expands a range's start by `beforeMinutes` and its end by `afterMinutes`.
Does not mutate the input.

**Example — a booking plus cleanup/setup time:**

```ts
import { applyBufferToRange } from "@apiary-dev/core";

const booking = {
  start: new Date("2026-01-05T10:00:00Z"),
  end: new Date("2026-01-05T10:30:00Z"),
};

applyBufferToRange(booking, { beforeMinutes: 5, afterMinutes: 10 });
// { start: 09:55, end: 10:40 }
```

### `wallClockToUTC`

```ts
function wallClockToUTC(
  wallClock: WallClockTime,
  timeZone: string,
): Date;
```

Converts a local wall-clock time in an IANA timezone to an exact UTC `Date`.

**Example — "9:00 in New York" as a UTC instant:**

```ts
import { wallClockToUTC } from "@apiary-dev/core";

wallClockToUTC(
  { year: 2026, month: 1, day: 5, hour: 9, minute: 0 },
  "America/New_York",
); // 2026-01-05T14:00:00Z (EST, UTC-5)

wallClockToUTC(
  { year: 2026, month: 7, day: 6, hour: 9, minute: 0 },
  "America/New_York",
); // 2026-07-06T13:00:00Z (EDT, UTC-4)
```

See the [Timezones & DST guide](guides/timezones/).

### `utcToWallClock`

```ts
function utcToWallClock(date: Date, timeZone: string): WallClockTime;
```

Converts a UTC `Date` to local wall-clock components. The inverse of
`wallClockToUTC`.

**Example — displaying a stored instant in a provider's timezone:**

```ts
import { utcToWallClock } from "@apiary-dev/core";

utcToWallClock(new Date("2026-01-05T14:00:00Z"), "America/New_York");
// { year: 2026, month: 1, day: 5, hour: 9, minute: 0 }
```

### `buildMonthMatrix`

```ts
interface MonthGridOptions {
  year: number;
  month: number; // 1-indexed
  weekStartsOn?: 0 | 1; // default 0 (Sunday)
}

function buildMonthMatrix(options: MonthGridOptions): CalendarDay[][];
```

Returns a fixed 6×7 grid with leading/trailing padding from adjacent months.

**Example — render a month, then mark days with availability:**

```ts
import { buildMonthMatrix } from "@apiary-dev/core";

const grid = buildMonthMatrix({ year: 2026, month: 1, weekStartsOn: 1 });
const cells = grid.flat().map((day) => ({
  ...day,
  hasSlots: (slotsByDate.get(day.isoString) ?? []).some((s) => s.available),
}));
```

See the [Calendar Views guide](guides/calendar-views/).

### `buildWeekMatrix`

```ts
interface WeekGridOptions {
  targetDate: Date;
  weekStartsOn?: 0 | 1;
}

function buildWeekMatrix(options: WeekGridOptions): CalendarDay[];
```

Returns the 7-day week containing `targetDate`. Days outside the target month
are blocked.

**Example — the week around a selected date:**

```ts
import { buildWeekMatrix } from "@apiary-dev/core";

const week = buildWeekMatrix({
  targetDate: new Date(2026, 0, 14),
  weekStartsOn: 1,
});
// 7 CalendarDay entries, Monday → Sunday
```

### `buildMultiWeekMatrix`

```ts
interface MultiWeekViewOptions {
  startDate: Date;
  endDate: Date;
  maxWeeksAllowed?: number; // default 12
  weekStartsOn?: 0 | 1;
}

function buildMultiWeekMatrix(options: MultiWeekViewOptions): CalendarDay[][];
```

Returns week rows covering `[startDate, endDate]`, with out-of-range days
blocked.

**Example — a two-week agenda view:**

```ts
import { buildMultiWeekMatrix } from "@apiary-dev/core";

const weeks = buildMultiWeekMatrix({
  startDate: new Date(2026, 0, 5),
  endDate: new Date(2026, 0, 18),
  weekStartsOn: 0,
});
// CalendarDay[][] — one row per week, out-of-range days blocked
```

### `buildMultiMonthMatrix`

```ts
interface MultiMonthViewOptions {
  startDate: Date;
  endDate: Date;
  maxMonthsAllowed?: number; // default 12
  weekStartsOn?: 0 | 1;
}

interface MonthViewUnit {
  year: number;
  month: number; // 1-indexed
  grid: CalendarDay[][];
}

function buildMultiMonthMatrix(options: MultiMonthViewOptions): MonthViewUnit[];
```

Returns one month unit per month in the range, with out-of-range and padding
cells blocked.

**Example — a scrolling quarter view:**

```ts
import { buildMultiMonthMatrix } from "@apiary-dev/core";

const months = buildMultiMonthMatrix({
  startDate: new Date(2026, 0, 1),
  endDate: new Date(2026, 2, 31),
});
// [{ year: 2026, month: 1, grid }, { month: 2, ... }, { month: 3, ... }]
```

### `CalendarDay`

```ts
interface CalendarDay {
  date: Date;
  isoString: string; // local "YYYY-MM-DD"
  dayOfMonth: number;
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  isBlocked: boolean;
  blockReason?: "OUT_OF_BOUNDS" | "CUSTOM_EXCLUSION" | "PAST_DATE";
}
```
