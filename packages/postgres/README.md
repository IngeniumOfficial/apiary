# @apiary-dev/postgres

PostgreSQL adapter implementing Apiary's `BookingRepository` port, with
double-booking prevention enforced at the database level.

- **Atomic holds** via per-provider GIST exclusion constraints
- **Dynamic** (weekly business hours) and **explicit** (published shifts)
  availability modes
- Half-open `[start, end)` range semantics throughout

## Install

```bash
pnpm add @apiary-dev/postgres pg
```

## Setup

Apply the migration before using the repository:

```bash
psql "$DATABASE_URL" -f node_modules/@apiary-dev/postgres/src/migrations/001_init.sql
```

The migration creates `scheduling_business_hours`, `scheduling_shifts`, and
`scheduling_bookings` (with the exclusion constraint), and requires the
`btree_gist` extension, which it creates itself.

## Example

```ts
import { Pool } from "pg";
import { PostgresBookingRepository } from "@apiary-dev/postgres";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const bookings = new PostgresBookingRepository(pool, {
  holdDurationMinutes: 10,
});

// Dynamic availability for the next 7 days
const windows = await bookings.getAvailableWindows({
  startDate: new Date(),
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  mode: "dynamic",
  timeZone: "America/New_York",
});

// Reserve a slot (atomic - rejects overlaps with BookingConflictError)
const { holdToken, expiresAt } = await bookings.createHold({
  serviceId: "00000000-0000-0000-0000-000000000101",
  providerId,
  range: { start: windows[0].start, end: windows[0].end },
});

// Confirm the hold into a permanent booking
const { bookingId } = await bookings.confirmBooking({
  holdToken,
  customerDetails: { name: "Ada Lovelace" },
});
```

## Documentation

Full API reference and guides are available at
[apiary-f4n.pages.dev/reference/postgres/](https://apiary-f4n.pages.dev/reference/postgres/).

## License

ISC
