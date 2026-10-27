---
title: Timezones & DST
description: Wall-clock rules, UTC instants, and daylight-saving safety.
---

Scheduling across timezones is where most calendar code goes wrong. Apiary
makes a clean split: **rules are wall-clock, windows are UTC instants**, and
the conversions go through `Intl` so daylight-saving transitions are handled by
the platform rather than by hand-rolled offset tables.

## The two conversions

```ts
import { wallClockToUTC, utcToWallClock } from "@apiary/core";
```

- `wallClockToUTC({ year, month, day, hour, minute }, timeZone)` — an exact
  local wall-clock time in an IANA timezone becomes an exact UTC `Date`.
- `utcToWallClock(date, timeZone)` — the inverse: a UTC `Date` becomes local
  wall-clock components.

```ts
// 12:00 in New York during standard time is 17:00 UTC
wallClockToUTC({ year: 2024, month: 1, day: 15, hour: 12, minute: 0 }, "America/New_York");
// → 2024-01-15T17:00:00Z

// ...but during daylight saving it's only 16:00 UTC
wallClockToUTC({ year: 2024, month: 7, day: 15, hour: 12, minute: 0 }, "America/New_York");
// → 2024-07-15T16:00:00Z
```

The pair round-trips exactly for unambiguous times, so you can safely store UTC
and display local:

```ts
const local = utcToWallClock(date, "Europe/London");
const back = wallClockToUTC(local, "Europe/London");
back.getTime() === date.getTime(); // true
```

## Weekly rules are wall-clock

`expandWeeklyRules` accepts rules in **local time** and returns windows as UTC:

```ts
const windows = expandWeeklyRules({
  rules: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
  startDate: new Date("2026-01-05T00:00:00Z"),
  endDate: new Date("2026-01-06T00:00:00Z"),
  timeZone: "America/New_York",
});

// Windows come back converted to UTC — 09:00 EST on Jan 5 is 14:00 UTC:
// [{ start: 2026-01-05T14:00:00Z, end: 2026-01-05T22:00:00Z }]
```

Because the conversion happens per rule and per day, a DST transition that
falls inside the queried range is handled correctly: a Monday before the US
spring-forward produces a 14:00 UTC window while the Monday after produces a
13:00 UTC window, both from the same `"09:00"` rule.

## Who owns the timezone?

The repository port takes `timeZone` as a **caller-supplied parameter** on
`getAvailableWindows`. This keeps the storage schema simple (rules store bare
times, not offsets) and pushes the timezone decision to the layer that knows
it — typically the server, which knows each provider's region.

For a single-timezone deployment this is just a constant. For multi-region,
you would resolve the provider's IANA timezone before calling the repository:

```ts
const windows = await bookings.getAvailableWindows({
  startDate,
  endDate,
  providerId,
  mode: "dynamic",
  timeZone: getProviderTimezone(providerId), // "America/Los_Angeles", etc.
});
```

## Daylight-saving edge cases

Wall-clock times that don't exist or occur twice during a transition (e.g.,
02:30 on a spring-forward day) resolve to a single UTC instant using the
platform's `Intl` rules. For a scheduling library this is the pragmatic,
standards-compliant behavior — the alternative (rejecting or duplicating) would
leak complexity into every caller. If your product needs to surface ambiguous
times to users, compare `utcToWallClock(wallClockToUTC(t, tz), tz)` against the
original wall-clock value to detect them.
