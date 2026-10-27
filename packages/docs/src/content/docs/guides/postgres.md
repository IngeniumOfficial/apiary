---
title: PostgreSQL Adapter
description: Schema, holds, confirmation, and database-level race protection with @apiary-dev/postgres.
---

`@apiary-dev/postgres` implements the core `BookingRepository` port against
PostgreSQL, with double-booking prevention enforced **at the database level**
using GIST exclusion constraints.

## Install

```bash
pnpm add @apiary-dev/postgres pg
```

## Schema

Apply `src/migrations/001_init.sql` to your database. It creates three tables:

- **`scheduling_business_hours`** — weekly recurring rules for dynamic mode.
  `provider_id` may be `NULL` to act as a global fallback rule applying to all
  providers.
- **`scheduling_shifts`** — admin-stored shifts for explicit mode. Only rows
  with `is_published = true` generate availability.
- **`scheduling_bookings`** — holds and confirmed bookings, guarded by a
  per-provider exclusion constraint:

```sql
EXCLUDE USING GIST (
  provider_id WITH =,
  booking_window WITH &&
) WHERE (status IN ('hold', 'confirmed'))
```

This requires the `btree_gist` extension (created by the migration). It means
**overlapping holds or confirmations for the same provider are rejected by
Postgres itself** — no application-level locking, no race windows.

## Repository

```ts
import { Pool } from "pg";
import { PostgresBookingRepository } from "@apiary-dev/postgres";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const bookings = new PostgresBookingRepository(pool, {
  holdDurationMinutes: 10, // how long a hold reserves its slot (default 10)
});
```

### Querying availability

```ts
const windows = await bookings.getAvailableWindows({
  startDate: start,
  endDate: end,
  providerId,
  mode: "dynamic", // or "explicit"
  timeZone: "America/New_York", // IANA tz for the weekly rules
});
```

### Creating a hold

Holds are **atomic**: the INSERT either succeeds, or Postgres rejects it as an
exclusion violation, which the adapter surfaces as `BookingConflictError`:

```ts
try {
  const { holdToken, expiresAt } = await bookings.createHold({
    serviceId: "00000000-0000-0000-0000-000000000101",
    providerId,
    range: { start: slot.start, end: slot.end },
    customerId, // optional
  });
} catch (error) {
  if (error instanceof BookingConflictError) {
    // slot was taken between rendering and reservation
  }
}
```

### Confirming a hold

```ts
const { bookingId } = await bookings.confirmBooking({
  holdToken,
  customerDetails: { name: "Ada Lovelace", email: "ada@example.com" },
});
```

Confirmation only succeeds while the hold is still valid: the adapter checks
`status = 'hold'` and `hold_expires_at > now()` in the same `UPDATE`. An
expired or already-used hold throws `BookingConflictError`.

### Reading existing bookings

```ts
const existing = await bookings.getBookingsInRange(start, end, providerId);
```

Returns active holds and confirmed bookings that overlap the range. Expired
holds are excluded — they no longer block availability.

## Stale holds

An expired hold row remains `status = 'hold'`, and the exclusion constraint
does not know about expiry — so a stale hold would block its slot forever. To
avoid this, `createHold` first flips any expired holds to `status = 'expired'`
in the same call, making their windows bookable again. This happens
automatically; no cleanup job is required.

## Behavior notes

- **Per-provider isolation.** The same window held for two different providers
  succeeds for both — the exclusion is scoped by `provider_id`, not global.
- **Half-open ranges.** `booking_window` uses `'[)'` bounds, matching the
  core's `[start, end)` semantics.
- **Concurrency.** Fire N `createHold` calls at the same slot and exactly one
  succeeds; the rest throw `BookingConflictError`. This is verified by the
  package's integration test suite.
- **Errors.** Database errors that are not exclusion violations are rethrown
  unchanged, so you can distinguish "slot taken" from "database down".

## Integration tests

The package ships both unit tests (mocked `pg` pool) and integration tests
against a real PostgreSQL. Integration tests read `TEST_DB_*` environment
variables and skip themselves when absent:

```bash
TEST_DB_DATABASE=... TEST_DB_USER=... TEST_DB_PASS=... TEST_DB_HOSTNAME=... \
  pnpm test:integration
```
