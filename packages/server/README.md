# @apiary-dev/server

Transport-agnostic scheduling operations for Apiary. These functions sit
between your framework and a `BookingRepository`, turning repository reads and
core math into ready-to-use results — without imposing a router, HTTP layer, or
framework.

- Works with SolidStart server functions, Astro actions, Express/Hono routes,
  Node, Bun, Deno, and Cloudflare Workers
- Full control over every option (buffers, notice, horizon, mode, timezone)
- Typed domain errors (`BookingConflictError`, `ValidationError`)

## Install

```bash
pnpm add @apiary-dev/server @apiary-dev/core
```

Pair it with an adapter such as `@apiary-dev/postgres` for persistence.

## Usage

```ts
import { createApiary } from "@apiary-dev/server";

const apiary = createApiary({
  repository,
  defaults: { timeZone: "America/New_York", durationMinutes: 30, intervalMinutes: 15 },
});

const slots = await apiary.getSlots({
  startDate,
  endDate,
  providerId,
});

const free = await apiary.isRangeAvailable({
  range: { start, end },
  providerId,
});

const { holdToken } = await apiary.createHold({ serviceId, providerId, range });
const { bookingId } = await apiary.confirmBooking({ holdToken, customerDetails });
```

Or use the free functions directly:

```ts
import { getSlots } from "@apiary-dev/server";

const slots = await getSlots(repository, { startDate, endDate, timeZone, durationMinutes, intervalMinutes });
```

## Framework integration

Because these are plain functions, each framework wires them its own way:

```ts
// SolidStart server function
"use server";
export const loadSlots = (input) => apiary.getSlots(input);

// Astro action
export const server = {
  getSlots: defineAction({ handler: (input) => apiary.getSlots(input) }),
};

// Express route
app.get("/api/slots", async (req, res) => {
  res.json(await apiary.getSlots(parseSlotsQuery(req.query)));
});
```

## Documentation

Full guides and API reference: [apiary-f4n.pages.dev](https://apiary-f4n.pages.dev/).

## License

ISC
