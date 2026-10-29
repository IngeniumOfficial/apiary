---
title: Using Apiary in an App
description: How the packages fit together and where to use each one in a real application.
---

Apiary is split into layers on purpose. This guide explains what each layer
does, where it belongs in a real app, and how a booking request flows from a
user click to a confirmed row in the database.

## The mental model

| Layer | Package | Runs where | Responsibility |
| --- | --- | --- | --- |
| Engine | `@apiary-dev/core` | anywhere (pure) | slot math, buffers, collisions, timezones, calendar grids |
| Persistence | `@apiary-dev/postgres` | server only | reads/writes windows, shifts, holds, bookings |
| Use cases | `@apiary-dev/server` | server only | fetches data, runs the engine, returns typed results |
| Your app | your framework | server + browser | routes, UI, auth, payments |

The rule of thumb: **the browser never talks to the database and never needs
`@apiary-dev/postgres`.** Your app's server owns the repository and the
operations; the browser only calls your own endpoints or server functions.

```
Browser (UI)
   │  fetch / server function call
   ▼
Your server (Next.js, Astro, SolidStart, Express, Hono, Workers…)
   │
   ├── @apiary-dev/server   ← getSlots / createHold / confirmBooking
   │        │
   │        ├── @apiary-dev/core       (pure math)
   │        └── @apiary-dev/postgres   (SQL)
   │                 │
   ▼                 ▼
 JSON response   PostgreSQL
```

## Wire it once

Construct the repository and the facade **once** on the server, in a module your
routes or server functions import:

```ts
// src/server/apiary.ts
import { Pool } from "pg";
import { PostgresBookingRepository } from "@apiary-dev/postgres";
import { createApiary } from "@apiary-dev/server";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const apiary = createApiary({
  repository: new PostgresBookingRepository(pool),
  defaults: {
    timeZone: "America/New_York",
    durationMinutes: 30,
    intervalMinutes: 15,
    buffers: { beforeMinutes: 5, afterMinutes: 5 },
  },
});
```

Every operation reuses this instance. In serverless or edge runtimes, create the
pool per invocation or use the platform's connection helper — just never put it
in the browser.

## The booking flow, end to end

### 1. Show availability

The user picks a date; your server asks for slots:

```ts
import { serializeSlot } from "@apiary-dev/server";

const slots = await apiary.getSlots({
  startDate: new Date("2026-01-05T00:00:00Z"),
  endDate: new Date("2026-01-06T00:00:00Z"),
  providerId,
});

return slots.filter((slot) => slot.available).map(serializeSlot);
```

`serializeSlot` converts `Date`s to ISO strings so the JSON is safe to send to
the browser.

### 2. Reserve the chosen slot (hold)

When the user picks a slot, create a short-lived hold before collecting details:

```ts
import { BookingConflictError } from "@apiary-dev/server";

try {
  const { holdToken, expiresAt } = await apiary.createHold({
    serviceId,
    providerId,
    range: { start: slot.start, end: slot.end },
  });
  return { holdToken, expiresAt };
} catch (error) {
  if (error instanceof BookingConflictError) {
    return { error: "That slot was just taken. Please pick another." };
  }
  throw error;
}
```

The hold is atomic: if two users race for the same slot, only one gets a hold.

### 3. Confirm the booking

After the user submits their details, confirm within the hold window:

```ts
const { bookingId } = await apiary.confirmBooking({
  holdToken,
  customerDetails: { name, email },
});
```

If the hold expired, `confirmBooking` throws `BookingConflictError` — ask the
user to pick a slot again.

### 4. Guard a resubmission

Before creating a hold, you can double-check a specific range:

```ts
const free = await apiary.isRangeAvailable({ range, providerId });
if (!free) return { error: "Not available" };
```

## Where each framework puts this

- **SolidStart:** keep the facade in `src/server/apiary.ts` and call it from
  `"use server"` functions or `query`.
- **Astro (SSR):** call it from actions or endpoint code (`output: 'server'`).
- **Next.js:** call it from route handlers or server actions.
- **Express / Hono / Node:** call it from route handlers; use `parseSlotsQuery`
  for query strings.
- **Cloudflare Workers / Bun / Deno:** same as Node — construct the repository
  and call the operations.

See the [Server Operations guide](server-integration/) for framework snippets.

## What runs where

- `@apiary-dev/core` is pure — you can even use it in the browser to render
  calendar grids from data your server sends.
- `@apiary-dev/postgres` and `@apiary-dev/server` are server-only.
- Keep secrets (`DATABASE_URL`) and the `pg.Pool` on the server.
- Send only serialized data (`serializeSlot`, ISO dates) to the client.

## A minimal checklist

1. Run the Postgres migration
   (`packages/postgres/src/migrations/001_init.sql`).
2. Create the repository + `createApiary` facade in a server module.
3. Add routes or server functions for slots, holds, and confirmation.
4. Serialize dates before sending them to the browser.
5. Map `BookingConflictError` to a friendly "slot taken" response.
