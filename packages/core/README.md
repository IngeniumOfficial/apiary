# @apiary/core

Zero-dependency, framework-agnostic scheduling domain logic: slot generation,
collision and buffer math, timezone-safe weekly rules, and headless calendar
grids.

- No runtime dependencies; built on `Date` and `Intl`
- TypeScript-first: bundled ESM/CJS with types on npm, native source on JSR
- Runs on Node.js, Deno, Bun, and Cloudflare Workers

## Install

```bash
pnpm add @apiary/core
# or, from the JSR registry:
pnpm dlx jsr add @apiary/core
```

## Example

Carve an operating window into bookable slots:

```ts
import { generateTimeSlots } from "@apiary/core";

const slots = generateTimeSlots({
  windows: [
    {
      start: new Date("2026-01-05T09:00:00Z"),
      end: new Date("2026-01-05T17:00:00Z"),
    },
  ],
  existingBookings: [],
  durationMinutes: 30,
  intervalMinutes: 15,
  buffers: { beforeMinutes: 5, afterMinutes: 5 },
  minNoticeMinutes: 30,
  maxHorizonMinutes: 7 * 24 * 60,
});
```

Expand weekly recurring rules into windows:

```ts
import { expandWeeklyRules } from "@apiary/core";

const windows = expandWeeklyRules({
  rules: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
  startDate: new Date("2026-01-05T00:00:00Z"),
  endDate: new Date("2026-01-12T00:00:00Z"),
  timeZone: "America/New_York",
});
```

## Documentation

Full API reference and guides are available at
[apiary-f4n.pages.dev/reference/core/](https://apiary-f4n.pages.dev/reference/core/).

## License

ISC
