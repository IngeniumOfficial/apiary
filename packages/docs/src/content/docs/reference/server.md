---
title: "@apiary-dev/server Reference"
description: "Transport-agnostic operations: facade, operations, and helpers."
---

`@apiary-dev/server` exports plain functions that combine a
[`BookingRepository`](reference/core/#bookingrepository) with the core engine.
It does not impose a router, HTTP layer, or framework.

## `createApiary`

```ts
function createApiary(options: ApiaryOptions): Apiary;

interface ApiaryOptions {
  repository: BookingRepository;
  defaults?: ApiaryDefaults;
}

interface ApiaryDefaults {
  timeZone?: string;
  mode?: "dynamic" | "explicit";
  durationMinutes?: number;
  intervalMinutes?: number;
  buffers?: BufferConfig;
  minNoticeMinutes?: number;
  maxHorizonMinutes?: number;
}
```

Binds a repository and defaults. `timeZone`, `durationMinutes`, and
`intervalMinutes` may be omitted per call if a default is configured; otherwise
a `ValidationError` is thrown.

### `apiary.getSlots(input)`

Same as the free [`getSlots`](#getslots), with defaults applied.

### `apiary.isRangeAvailable(input)`

Same as the free [`isRangeAvailable`](#israngeavailable), with `timeZone`, `mode`,
and `buffers` defaults applied.

### `apiary.createHold(input)` / `apiary.confirmBooking(input)`

Bound versions of the free operations.

## `getSlots`

```ts
function getSlots(
  repository: BookingRepository,
  input: GetSlotsInput,
): Promise<TimeSlot[]>;

interface GetSlotsInput {
  startDate: Date;
  endDate: Date;
  timeZone: string;
  providerId?: string;
  mode?: "dynamic" | "explicit"; // default "dynamic"
  durationMinutes: number;
  intervalMinutes: number;
  buffers?: BufferConfig;
  minNoticeMinutes?: number;
  maxHorizonMinutes?: number;
  now?: Date;
}
```

Fetches windows and bookings for the same range and provider, then runs
`generateTimeSlots`.

## `isRangeAvailable`

```ts
function isRangeAvailable(
  repository: BookingRepository,
  input: IsRangeAvailableInput,
): Promise<boolean>;

interface IsRangeAvailableInput {
  range: TimeRange;
  providerId?: string;
  mode?: "dynamic" | "explicit";
  timeZone?: string; // required when checkWindows !== false
  buffers?: BufferConfig;
  checkWindows?: boolean; // default true
}
```

Returns `true` when the range collides with no booking or hold and — unless
`checkWindows: false` — fits inside an availability window.

## `createHold`

```ts
function createHold(
  repository: BookingRepository,
  input: CreateHoldInput,
): Promise<{ holdToken: string; expiresAt: Date }>;

interface CreateHoldInput {
  serviceId: string;
  providerId: string;
  range: TimeRange;
  customerId?: string;
}
```

## `confirmBooking`

```ts
function confirmBooking(
  repository: BookingRepository,
  input: ConfirmBookingInput,
): Promise<{ bookingId: string }>;

interface ConfirmBookingInput {
  holdToken: string;
  customerDetails: Record<string, unknown>;
}
```

## Helpers

### `parseSlotsQuery`

```ts
function parseSlotsQuery(
  input: URLSearchParams | Record<string, string | undefined>,
): GetSlotsInput;
```

Validates query params (`start`, `end`, `timeZone`, `duration`, `interval`, plus
optional `providerId`, `mode`, `bufferBefore`, `bufferAfter`, `minNotice`,
`maxHorizon`). Throws `ValidationError`.

### `serializeSlot` / `serializeTimeRange`

```ts
function serializeSlot(slot: TimeSlot): {
  start: string;
  end: string;
  available: boolean;
  reason: string;
};

function serializeTimeRange(range: TimeRange): { start: string; end: string };
```

Convert `Date`s to ISO strings for JSON transport.

## Errors

Re-exported from `@apiary-dev/core`:

- `BookingConflictError`
- `ValidationError`
