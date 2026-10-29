---
title: "@apiary-dev/postgres Reference"
description: "The PostgreSQL adapter: repository, options, and error types — with examples."
---

`@apiary-dev/postgres` implements the core [`BookingRepository`](reference/core/#bookingrepository)
port using `node-postgres`. See the [PostgreSQL guide](guides/postgres/) for
setup, the schema, and behavior notes. In most apps you pass this repository to
`createApiary` rather than calling it directly — see
[Using Apiary in an App](guides/using-apiary-in-an-app/).

## `PostgresBookingRepository`

```ts
class PostgresBookingRepository implements BookingRepository {
  constructor(pool: Pool, options?: PostgresBookingRepositoryOptions);
}
```

Takes a `pg.Pool` instance — you own its lifecycle (create, configure, and
`pool.end()` it yourself).

**Example — construct the repository:**

```ts
import { Pool } from "pg";
import { PostgresBookingRepository } from "@apiary-dev/postgres";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const repository = new PostgresBookingRepository(pool, {
  holdDurationMinutes: 10, // optional, default 10
});
```

### `getAvailableWindows`

```ts
getAvailableWindows(params: {
  startDate: Date;
  endDate: Date;
  providerId?: string;
  mode: "dynamic" | "explicit";
  timeZone: string;
}): Promise<AvailableWindow[]>;
```

- **`mode: "dynamic"`** — reads `scheduling_business_hours` and expands them
  with core's `expandWeeklyRules`, using the supplied `timeZone`.
  `provider_id IS NULL` rows act as global fallback rules; a non-null
  `providerId` matches both the provider's rules and the global ones.
- **`mode: "explicit"`** — reads `scheduling_shifts` where `is_published =
  true`, overlapping the requested range, clipped to it, and sorted.

**Example — dynamic business hours:**

```ts
const windows = await repository.getAvailableWindows({
  startDate: new Date("2026-01-05T00:00:00Z"),
  endDate: new Date("2026-01-12T00:00:00Z"),
  providerId,
  mode: "dynamic",
  timeZone: "America/New_York",
});
// -> AvailableWindow[] (UTC Dates)
```

**Example — explicit published shifts:**

```ts
const windows = await repository.getAvailableWindows({
  startDate,
  endDate,
  providerId,
  mode: "explicit",
  timeZone: "America/New_York",
});
```

### `getBookingsInRange`

```ts
getBookingsInRange(
  startDate: Date,
  endDate: Date,
  providerId?: string,
): Promise<TimeRange[]>;
```

Returns confirmed bookings and **active** holds overlapping the range. Expired
holds (`hold_expires_at <= now()`) are excluded.

**Example — feed existing bookings into the slot generator:**

```ts
import { generateTimeSlots } from "@apiary-dev/core";

const bookings = await repository.getBookingsInRange(startDate, endDate, providerId);

const slots = generateTimeSlots({
  windows,
  existingBookings: bookings,
  durationMinutes: 30,
  intervalMinutes: 15,
});
```

### `createHold`

```ts
createHold(params: {
  serviceId: string;
  providerId: string;
  range: TimeRange;
  customerId?: string;
}): Promise<{ holdToken: string; expiresAt: Date }>;
```

Atomically inserts a hold for `range` (half-open `'[)'`). Overlapping holds or
confirmations for the same provider are rejected by the exclusion constraint
and surfaced as [`BookingConflictError`](#bookingconflicterror). Before
inserting, expired holds are marked `'expired'` so stale rows never block
slots. `holdToken` is the booking row's UUID.

**Example — reserve a slot:**

```ts
import { BookingConflictError } from "@apiary-dev/postgres";

try {
  const { holdToken, expiresAt } = await repository.createHold({
    serviceId,
    providerId,
    range: { start: slot.start, end: slot.end },
    customerId,
  });
} catch (error) {
  if (error instanceof BookingConflictError) {
    // the slot was taken by another hold/booking
  }
}
```

### `confirmBooking`

```ts
confirmBooking(params: {
  holdToken: string;
  customerDetails: Record<string, unknown>;
}): Promise<{ bookingId: string }>;
```

Transitions a hold to `confirmed`, storing `customerDetails` in the
`customer_details` JSONB column. Fails with `BookingConflictError` when the
hold is missing or expired. `bookingId` equals the original `holdToken`.

**Example — turn a hold into a booking:**

```ts
const { bookingId } = await repository.confirmBooking({
  holdToken,
  customerDetails: { name: "Ada Lovelace", email: "ada@example.com" },
});
```

## `PostgresBookingRepositoryOptions`

```ts
interface PostgresBookingRepositoryOptions {
  holdDurationMinutes?: number; // default 10
}
```

Controls how long `createHold` reserves a slot before it is considered
expired.

## `BookingConflictError`

```ts
class BookingConflictError extends Error;
```

Thrown when an operation conflicts with an existing booking or hold:

- `createHold` overlapping an existing hold/confirmation (PostgreSQL exclusion
  violation, SQLSTATE `23P01`)
- `confirmBooking` with a missing or expired hold

It is defined in `@apiary-dev/core` and re-exported here for convenience.

It is the single, typed signal for "that slot is no longer available" and maps
naturally to a `409 Conflict` in an HTTP layer. Unrelated database errors are
rethrown unchanged.

## Schema

The migration (`src/migrations/001_init.sql`) creates:

| Table | Purpose | Notable constraints |
| --- | --- | --- |
| `scheduling_business_hours` | Weekly rules (dynamic mode) | `day_of_week` 0–6, `end_time > start_time`, nullable `provider_id` (global fallback) |
| `scheduling_shifts` | Admin shifts (explicit mode) | `shift_window TSTZRANGE`, `is_published` gates availability |
| `scheduling_bookings` | Holds + confirmed bookings | `EXCLUDE USING GIST (provider_id WITH =, booking_window WITH &&) WHERE status IN ('hold','confirmed')` |

Requires the `btree_gist` extension, created by the migration itself.
