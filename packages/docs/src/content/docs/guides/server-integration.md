---
title: Server Operations
description: Transport-agnostic scheduling operations you can call from any framework.
---

`@apiary-dev/server` sits between your framework and a
[`BookingRepository`](reference/core/#bookingrepository). It is **not** a router
or an HTTP server: it exports plain functions that fetch data from a repository,
run the core engine, and return typed results. You call them from whatever
transport you use.

## Why functions, not a server

- **No routing to duplicate.** Your framework already owns routing, middleware,
  and authentication.
- **Framework-native.** SolidStart server functions, Astro actions, Express
  routes, Hono, Bun/Deno/Workers — they all call the same functions.
- **Fully controllable.** Every core option (buffers, notice, horizon, mode,
  timezone) is exposed.

## The facade

`createApiary` binds a repository and optional defaults:

```ts
import { createApiary } from "@apiary-dev/server";

const apiary = createApiary({
  repository,
  defaults: {
    timeZone: "America/New_York",
    durationMinutes: 30,
    intervalMinutes: 15,
    buffers: { beforeMinutes: 5, afterMinutes: 5 },
  },
});
```

Each call can override any default.

## Operations

### `getSlots`

Fetches availability windows and existing bookings for the same range and
provider, then runs `generateTimeSlots`:

```ts
const slots = await apiary.getSlots({
  startDate: new Date("2026-01-05T00:00:00Z"),
  endDate: new Date("2026-01-06T00:00:00Z"),
  providerId,
});
```

### `isRangeAvailable`

Checks a specific range for collisions and, by default, window containment:

```ts
const free = await apiary.isRangeAvailable({
  range: { start, end },
  providerId,
});
```

Pass `checkWindows: false` to skip the window lookup and check collisions only.

### `createHold` / `confirmBooking`

```ts
const { holdToken, expiresAt } = await apiary.createHold({
  serviceId,
  providerId,
  range,
});

const { bookingId } = await apiary.confirmBooking({
  holdToken,
  customerDetails: { name: "Ada Lovelace" },
});
```

## Framework integration

Because these are plain functions, each framework wires them its own way.

### SolidStart (server function)

```ts
// src/server/apiary.ts
"use server";
export function loadSlots(input: GetSlotsInput) {
  return apiary.getSlots(input);
}
```

### Astro (action)

```ts
// src/actions/index.ts
export const server = {
  getSlots: defineAction({
    input: z.object({
      /* ... */
    }),
    handler: (input) => apiary.getSlots(input),
  }),
};
```

### Express

```ts
import { parseSlotsQuery, serializeSlot } from "@apiary-dev/server";

app.get("/api/slots", async (req, res) => {
  const slots = await apiary.getSlots(parseSlotsQuery(req.query));
  res.json({ slots: slots.map(serializeSlot) });
});
```

### Hono / Node / Workers

```ts
app.get("/slots", async (c) => {
  const slots = await apiary.getSlots(parseSlotsQuery(c.req.query()));
  return c.json({ slots: slots.map(serializeSlot) });
});
```

## Errors

Operations throw typed errors from `@apiary-dev/core`:

- `BookingConflictError` — a hold or confirmation overlaps another.
- `ValidationError` — missing or invalid input.

Map them in your transport:

```ts
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

## Parsing and serialization

- `parseSlotsQuery(searchParams)` — validate query strings into `GetSlotsInput`.
- `serializeSlot(slot)` / `serializeTimeRange(range)` — `Date` to ISO strings
  for JSON transport.

See the [`@apiary-dev/server` reference](reference/server/) for full signatures.
