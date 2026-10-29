---
title: "@apiary-dev/core Reference"
description: Every type and function exported by @apiary-dev/core.
---

The core package is a zero-dependency module of pure domain logic. All ranges
are half-open `[start, end)` intervals.

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
[`@apiary-dev/postgres`](reference/postgres/):

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
See the [Slots, Buffers & Rules guide](guides/slots-and-buffers/).

### `expandWeeklyRules`

```ts
function expandWeeklyRules(options: WeeklyAvailabilityOptions): AvailableWindow[];
```

Expands weekly wall-clock rules into clipped, sorted, deduplicated UTC windows
within `[startDate, endDate)`. Throws on invalid time strings and overnight
spans (`endTime <= startTime`). See the [Dual Availability
Model guide](guides/dual-model/).

### `rangesOverlap`

```ts
function rangesOverlap(a: TimeRange, b: TimeRange): boolean;
```

Returns `true` if two half-open ranges intersect. Touch points
(`a.end === b.start`) do **not** overlap.

### `applyBufferToRange`

```ts
function applyBufferToRange(
  range: TimeRange,
  buffer?: BufferConfig,
): TimeRange;
```

Expands a range's start by `beforeMinutes` and its end by `afterMinutes`.
Does not mutate the input.

### `wallClockToUTC`

```ts
function wallClockToUTC(
  wallClock: WallClockTime,
  timeZone: string,
): Date;
```

Converts a local wall-clock time in an IANA timezone to an exact UTC `Date`.
See the [Timezones & DST guide](guides/timezones/).

### `utcToWallClock`

```ts
function utcToWallClock(date: Date, timeZone: string): WallClockTime;
```

Converts a UTC `Date` to local wall-clock components. The inverse of
`wallClockToUTC`.

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
