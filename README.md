# Apiary

Zero-dependency, framework-agnostic scheduling primitives for the web.

[![CI](https://github.com/IngeniumOfficial/apiary/actions/workflows/ci.yml/badge.svg)](https://github.com/IngeniumOfficial/apiary/actions/workflows/ci.yml)

Apiary provides the hard parts of building a booking system - slot generation,
collision and buffer math, timezone-safe weekly rules, and race-proof database
reservation - as small, tested, framework-agnostic TypeScript packages.

- **Zero runtime dependencies** in the core. Built on `Date`, `Intl`, and other
  Web Standard APIs; runs on Node.js, Deno, Bun, and Cloudflare Workers.
- **Two availability models**: Calendly-style _dynamic rules_ and
  shift-based _explicit availability_, unified behind one slot generator.
- **Race-proof by default**: the PostgreSQL adapter enforces double-booking
  prevention with GIST exclusion constraints at the database level.
- **Typed ESM/CJS**: bundled ESM and CJS with type declarations on npm.

## Packages

| Package                                     | Description                                                                                                   | Status     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------- |
| [`@apiary-dev/core`](packages/core)         | Pure domain logic: slot generation, buffers, collisions, timezone math, weekly rule expansion, calendar grids | ✅         |
| [`@apiary-dev/postgres`](packages/postgres) | PostgreSQL adapter implementing the core `BookingRepository` port                                             | ✅         |
| [`@apiary-dev/server`](packages/server)     | Transport-agnostic scheduling operations (slots, holds, confirmations)                                        | ✅         |
| `@apiary-dev/client`                        | Typed fetch SDK                                                                                               | 🚧 planned |
| `@apiary-dev/solid`                         | SolidJS calendar & booking widgets                                                                            | 🚧 planned |

## Quick start

Install the core package:

```bash
pnpm add @apiary-dev/core
```

Generate bookable slots from an operating window:

```ts
import { generateTimeSlots } from "@apiary-dev/core";

const slots = generateTimeSlots(
  {
    windows: [
      {
        start: new Date("2026-01-05T09:00:00Z"),
        end: new Date("2026-01-05T17:00:00Z"),
      },
    ],
    existingBookings: [
      {
        start: new Date("2026-01-05T11:30:00Z"),
        end: new Date("2026-01-05T12:00:00Z"),
      },
    ],
    durationMinutes: 30,
    intervalMinutes: 15,
    buffers: { beforeMinutes: 5, afterMinutes: 5 },
    minNoticeMinutes: 30,
  },
  new Date(),
);

const open = slots.filter((s) => s.available);
```

Turn weekly rules into windows, then into slots:

```ts
import { expandWeeklyRules, generateTimeSlots } from "@apiary-dev/core";

const windows = expandWeeklyRules({
  rules: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
  startDate: new Date("2026-01-05T00:00:00Z"),
  endDate: new Date("2026-01-12T00:00:00Z"),
  timeZone: "America/New_York",
});

const slots = generateTimeSlots({
  windows,
  existingBookings: [],
  durationMinutes: 30,
  intervalMinutes: 15,
});
```

## Documentation

Full documentation - guides, API reference, and examples - is available at
**[apiary-f4n.pages.dev](https://apiary-f4n.pages.dev/)**.

- [Quickstart](https://apiary-f4n.pages.dev/getting-started/quickstart/)
- [The Dual Availability Model](https://apiary-f4n.pages.dev/guides/dual-model/)
- [Slots, Buffers & Rules](https://apiary-f4n.pages.dev/guides/slots-and-buffers/)
- [Timezones & DST](https://apiary-f4n.pages.dev/guides/timezones/)
- [PostgreSQL adapter](https://apiary-f4n.pages.dev/guides/postgres/)
- [`@apiary-dev/core` reference](https://apiary-f4n.pages.dev/reference/core/)
- [`@apiary-dev/postgres` reference](https://apiary-f4n.pages.dev/reference/postgres/)

## Development

This is a pnpm workspace:

```bash
pnpm install              # install all packages
pnpm build                # build core + postgres + server
pnpm test                 # unit tests
pnpm test:integration     # integration tests (needs a configured Postgres)
pnpm typecheck            # typecheck all packages
pnpm --filter packages-docs dev   # run the docs site locally
```

The integration tests read `TEST_DB_*` environment variables (see
[`.env.example`](.env.example)) and skip themselves when the database is not
configured.

## Status

The core engine, the PostgreSQL adapter, and the transport-agnostic server
operations are implemented, tested, and documented. The client SDK and SolidJS
widgets are planned. Contributions toward any of these are welcome.

## Contributing

Bug reports and pull requests are welcome. Please make sure `pnpm test`,
`pnpm test:integration`, and `pnpm typecheck` pass before submitting.

## License

[ISC](LICENSE)
