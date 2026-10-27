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
| [`@apiary/core`](reference/core/) | ✅ Implemented | Pure domain logic: types, slot generation, collision and buffer math, weekly rule expansion, timezone conversions, calendar grids. Zero runtime dependencies. |
| [`@apiary/postgres`](reference/postgres/) | ✅ Implemented | PostgreSQL adapter implementing the core `BookingRepository` port with database-level race protection. |
| `@apiary/server` | Planned | Web-standard `Request` → `Response` dispatcher for `/slots`, `/holds`, `/bookings`. |
| `@apiary/client` | Planned | Typed fetch SDK for the server endpoints. |
| `@apiary/solid` | Planned | Unstyled SolidJS calendar and booking widgets. |

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

Apiary relies only on standard APIs: `Date`, `Intl`, and — for the planned
server layer — `Request`, `Response`, and `fetch`. It works in Node.js, Deno,
Bun, Cloudflare Workers, and any framework that speaks HTTP: Next.js, Astro,
SolidStart, Hono, and more.
