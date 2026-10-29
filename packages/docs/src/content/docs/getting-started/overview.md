---
title: Overview
description: The architecture and core concepts behind Apiary.
---

Apiary is a scheduling toolkit organized around one idea: **availability is the
intersection of intention and constraint, computed in two pure steps.**

## The pipeline

```
              ┌──────────────────────────────┐
              │    Availability windows      │
              │  (AvailableWindow[])         │
              └──────────────┬───────────────┘
                             │
                    generateTimeSlots()
                             │
                             ▼
              ┌──────────────────────────────┐
              │      Time slots              │
              │  (TimeSlot[], each marked    │
              │   available + reason)        │
              └──────────────────────────────┘
```

**Windows** are spans of time that *could* be bookable. **Slots** are concrete
candidate appointments carved from windows, each carrying an `available` flag
and a `reason` explaining why it is open or blocked.

## Packages

The repository is a pnpm workspace. Each package is published to npm as
bundled ESM/CJS with type declarations.

| Package | Status | Purpose |
| --- | --- | --- |
| [`@apiary-dev/core`](reference/core/) | ✅ Implemented | Pure domain logic: types, slot generation, collision and buffer math, weekly rule expansion, timezone conversions, calendar grids. Zero runtime dependencies. |
| [`@apiary-dev/postgres`](reference/postgres/) | ✅ Implemented | PostgreSQL adapter implementing the core `BookingRepository` port with database-level race protection. |
| [`@apiary-dev/server`](reference/server/) | ✅ Implemented | Transport-agnostic operations that bind a `BookingRepository` to the core engine: slot generation, availability checks, holds, and confirmations. |
| `@apiary-dev/client` | Planned | Typed fetch SDK for the server endpoints. |
| `@apiary-dev/solid` | Planned | Unstyled SolidJS calendar and booking widgets. |

## The dual availability model

Apiary natively supports two operational strategies, unified behind one core
generator:

- **Dynamic rules** — *availability by exception.* Time is open by default from
  weekly recurring rules (e.g., Mon–Fri 09:00–17:00); available slots are what
  remains after subtracting buffers, blackouts, and existing bookings.
- **Explicit shifts** — *availability by grant.* Time is blocked by default;
  slots are generated exclusively inside admin-approved, database-stored shift
  records.

Both modes produce the same `AvailableWindow[]` shape, so the slot generator
never needs to know which model you use. See the
[Dual Availability Model guide](guides/dual-model/) for details.

## Framework-agnostic and web-standard

Apiary relies only on standard APIs such as `Date` and `Intl`. The server
operations are plain functions, so they work in Node.js, Deno, Bun, Cloudflare
Workers, and inside any framework — Next.js, Astro, SolidStart, Hono, Express,
and more — without a router or adapter.
