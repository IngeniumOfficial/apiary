---
title: "@apiary-dev/server Reference"
description: "Transport-agnostic operations: facade, operations, and helpers — with examples."
---

`@apiary-dev/server` exports plain functions that combine a
[`BookingRepository`](reference/core/#bookingrepository) with the core engine.
It does not impose a router, HTTP layer, or framework. See
[Using Apiary in an App](guides/using-apiary-in-an-app/) for where these fit.

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

**Example — construct once, reuse everywhere:**

```ts
import { Pool } from "pg";
import { PostgresBookingRepository } from "@apiary-dev/postgres";
import { createApiary } from "@apiary-dev/server";

const repository = new PostgresBookingRepository(
  new Pool({ connectionString: process.env.DATABASE_URL }),
);

export const apiary = createApiary({
  repository,
  defaults: {
    timeZone: "America/New_York",
    durationMinutes: 30,
    intervalMinutes: 15,
    buffers: { beforeMinutes: 5, afterMinutes: 5 },
  },
});
```

### `apiary.getSlots(input)`

Same as the free [`getSlots`](#getslots), with defaults applied.

```ts
const slots = await apiary.getSlots({
  startDate: new Date("2026-01-05T00:00:00Z"),
  endDate: new Date("2026-01-06T00:00:00Z"),
  providerId,
});
```

### `apiary.isRangeAvailable(input)`

Same as the free [`isRangeAvailable`](#israngeavailable), with `timeZone`, `mode`,
and `buffers` defaults applied.

```ts
const free = await apiary.isRangeAvailable({
  range: { start, end },
  providerId,
});
```

### `apiary.createHold(input)` / `apiary.confirmBooking(input)`

Bound versions of the free operations.

```ts
const { holdToken } = await apiary.createHold({
  serviceId,
  providerId,
  range,
});

const { bookingId } = await apiary.confirmBooking({
  holdToken,
  customerDetails: { name: "Ada Lovelace" },
});
```

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
`generateTimeSlots`. Because both reads use the same range/provider, windows and
bookings can never drift apart.

**Example — availability for the next week:**

```ts
import { getSlots } from "@apiary-dev/server";

const start = new Date();
const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const slots = await getSlots(repository, {
  startDate: start,
  endDate: end,
  timeZone: "America/New_York",
  providerId,
  durationMinutes: 30,
  intervalMinutes: 15,
});

const bookable = slots.filter((slot) => slot.available);
```

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

**Example — validate a user-submitted time before holding it:**

```ts
import { isRangeAvailable } from "@apiary-dev/server";

const range = {
  start: new Date(req.body.start),
  end: new Date(req.body.end),
};

const free = await isRangeAvailable(repository, {
  range,
  providerId,
  timeZone: "America/New_York",
  buffers: { beforeMinutes: 5, afterMinutes: 5 },
});

if (!free) return res.status(409).json({ error: "Not available" });
```

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

Creates an atomic hold. Throws `BookingConflictError` if another hold or
confirmation already occupies the range.

**Example — reserve a slot while the user fills in details:**

```ts
import { createHold } from "@apiary-dev/server";

const { holdToken, expiresAt } = await createHold(repository, {
  serviceId,
  providerId,
  range: { start: slot.start, end: slot.end },
});
// show a countdown until expiresAt
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

Confirms a hold. Throws `BookingConflictError` if the hold is missing or
expired.

**Example — complete the booking:**

```ts
import { confirmBooking } from "@apiary-dev/server";

const { bookingId } = await confirmBooking(repository, {
  holdToken,
  customerDetails: { name, email },
});
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

**Example — turn a REST query string into typed input:**

```ts
import { parseSlotsQuery, serializeSlot } from "@apiary-dev/server";

app.get("/api/slots", async (req, res) => {
  try {
    const slots = await getSlots(repository, parseSlotsQuery(req.query));
    res.json({ slots: slots.map(serializeSlot) });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});
```

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

**Example — safe JSON for the browser:**

```ts
import { serializeSlot } from "@apiary-dev/server";

const payload = slots.map(serializeSlot);
// [{ start: "2026-01-05T09:00:00.000Z", end: "...", available: true, reason: "AVAILABLE" }]
```

## Errors

Re-exported from `@apiary-dev/core`:

- `BookingConflictError` — a hold or confirmation overlaps another.
- `ValidationError` — missing or invalid input.

```ts
import { BookingConflictError, ValidationError } from "@apiary-dev/server";

try {
  await apiary.createHold(input);
} catch (error) {
  if (error instanceof BookingConflictError) {
    return c.json({ error: "slot taken" }, 409);
  }
  if (error instanceof ValidationError) {
    return c.json({ error: error.message }, 400);
  }
  throw error;
}
```
