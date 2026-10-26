import { describe, expect, it } from "vitest";
import { expandWeeklyRules } from "./weekly.js";

const at = (iso: string) => new Date(iso);

const asIso = (window: { start: Date; end: Date }) => [
  window.start.toISOString(),
  window.end.toISOString(),
];

describe("expandWeeklyRules", () => {
  it("returns an empty array for an empty range", () => {
    const windows = expandWeeklyRules({
      rules: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
      startDate: at("2026-01-05T00:00:00Z"),
      endDate: at("2026-01-05T00:00:00Z"),
      timeZone: "UTC",
    });
    expect(windows).toEqual([]);
  });

  it("returns an empty array when no rule matches any weekday in range", () => {
    const windows = expandWeeklyRules({
      rules: [{ dayOfWeek: 5, startTime: "09:00", endTime: "17:00" }], // Saturday
      startDate: at("2026-01-05T00:00:00Z"), // Mon Jan 5
      endDate: at("2026-01-08T00:00:00Z"), // Thu Jan 8
      timeZone: "UTC",
    });
    expect(windows).toEqual([]);
  });

  it("expands a weekly rule into a window per matching day", () => {
    const windows = expandWeeklyRules({
      rules: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }], // Monday
      startDate: at("2026-01-05T00:00:00Z"), // Mon Jan 5
      endDate: at("2026-01-08T00:00:00Z"), // Thu Jan 8
      timeZone: "UTC",
    });
    expect(windows.map(asIso)).toEqual([
      ["2026-01-05T09:00:00.000Z", "2026-01-05T17:00:00.000Z"],
    ]);
  });

  it("expands multiple weekday rules across a week", () => {
    const windows = expandWeeklyRules({
      rules: [
        { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }, // Mon
        { dayOfWeek: 3, startTime: "14:00", endTime: "16:00" }, // Wed
      ],
      startDate: at("2026-01-05T00:00:00Z"), // Mon Jan 5
      endDate: at("2026-01-12T00:00:00Z"), // Mon Jan 12 (exclusive)
      timeZone: "UTC",
    });
    expect(windows.map(asIso)).toEqual([
      ["2026-01-05T09:00:00.000Z", "2026-01-05T12:00:00.000Z"],
      ["2026-01-07T14:00:00.000Z", "2026-01-07T16:00:00.000Z"],
    ]);
  });

  it("clips windows to the requested range", () => {
    const windows = expandWeeklyRules({
      rules: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
      startDate: at("2026-01-05T10:00:00Z"),
      endDate: at("2026-01-05T16:00:00Z"),
      timeZone: "UTC",
    });
    expect(windows.map(asIso)).toEqual([
      ["2026-01-05T10:00:00.000Z", "2026-01-05T16:00:00.000Z"],
    ]);
  });

  it("converts rules in a non-UTC timezone", () => {
    const windows = expandWeeklyRules({
      rules: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }], // Monday
      startDate: at("2026-01-05T00:00:00Z"),
      endDate: at("2026-01-06T00:00:00Z"),
      timeZone: "America/New_York", // EST = UTC-5
    });
    expect(windows.map(asIso)).toEqual([
      ["2026-01-05T14:00:00.000Z", "2026-01-05T22:00:00.000Z"],
    ]);
  });

  it("handles daylight saving transitions", () => {
    const before = expandWeeklyRules({
      rules: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
      startDate: at("2024-03-04T00:00:00Z"), // Mon Mar 4, EST (UTC-5)
      endDate: at("2024-03-05T00:00:00Z"),
      timeZone: "America/New_York",
    });
    const after = expandWeeklyRules({
      rules: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
      startDate: at("2024-03-11T00:00:00Z"), // Mon Mar 11, EDT (UTC-4)
      endDate: at("2024-03-12T00:00:00Z"),
      timeZone: "America/New_York",
    });
    expect(before.map(asIso)).toEqual([
      ["2024-03-04T14:00:00.000Z", "2024-03-04T22:00:00.000Z"],
    ]);
    expect(after.map(asIso)).toEqual([
      ["2024-03-11T13:00:00.000Z", "2024-03-11T21:00:00.000Z"],
    ]);
  });

  it("resolves windows whose wall-clock day maps to the following UTC day", () => {
    const windows = expandWeeklyRules({
      rules: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }], // Monday
      startDate: at("2026-01-05T15:00:00Z"), // Mon 10:00 EST
      endDate: at("2026-01-05T22:00:00Z"), // Mon 17:00 EST
      timeZone: "America/New_York",
    });
    expect(windows.map(asIso)).toEqual([
      ["2026-01-05T15:00:00.000Z", "2026-01-05T22:00:00.000Z"],
    ]);
  });

  it("keeps multiple rules on the same weekday", () => {
    const windows = expandWeeklyRules({
      rules: [
        { dayOfWeek: 1, startTime: "09:00", endTime: "10:00" },
        { dayOfWeek: 1, startTime: "11:00", endTime: "12:00" },
      ],
      startDate: at("2026-01-05T00:00:00Z"),
      endDate: at("2026-01-06T00:00:00Z"),
      timeZone: "UTC",
    });
    expect(windows.map(asIso)).toEqual([
      ["2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"],
      ["2026-01-05T11:00:00.000Z", "2026-01-05T12:00:00.000Z"],
    ]);
  });

  it("collapses duplicate windows from identical rules", () => {
    const windows = expandWeeklyRules({
      rules: [
        { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
      ],
      startDate: at("2026-01-05T00:00:00Z"),
      endDate: at("2026-01-06T00:00:00Z"),
      timeZone: "UTC",
    });
    expect(windows).toHaveLength(1);
  });

  it("throws on an invalid time string", () => {
    expect(() =>
      expandWeeklyRules({
        rules: [{ dayOfWeek: 1, startTime: "9am", endTime: "17:00" }],
        startDate: at("2026-01-05T00:00:00Z"),
        endDate: at("2026-01-06T00:00:00Z"),
        timeZone: "UTC",
      }),
    ).toThrow(/Invalid time/);
  });

  it("throws on overnight rules (endTime before startTime)", () => {
    expect(() =>
      expandWeeklyRules({
        rules: [{ dayOfWeek: 1, startTime: "22:00", endTime: "02:00" }],
        startDate: at("2026-01-05T00:00:00Z"),
        endDate: at("2026-01-06T00:00:00Z"),
        timeZone: "UTC",
      }),
    ).toThrow(/overnight/);
  });
});
