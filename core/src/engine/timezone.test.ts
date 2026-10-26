import { describe, expect, it } from "vitest";
import { wallClockToUTC } from "./timezone.js";

describe("wallClockToUTC", () => {
  it("converts a wall-clock time in a UTC-offset timezone", () => {
    const utc = wallClockToUTC(
      { year: 2024, month: 1, day: 15, hour: 12, minute: 0 },
      "America/New_York",
    );
    expect(utc.toISOString()).toBe("2024-01-15T17:00:00.000Z"); // EST = UTC-5
  });

  it("accounts for daylight saving time", () => {
    const utc = wallClockToUTC(
      { year: 2024, month: 7, day: 15, hour: 12, minute: 0 },
      "America/New_York",
    );
    expect(utc.toISOString()).toBe("2024-07-15T16:00:00.000Z"); // EDT = UTC-4
  });

  it("returns the wall-clock time unchanged for UTC", () => {
    const utc = wallClockToUTC(
      { year: 2024, month: 1, day: 15, hour: 12, minute: 0 },
      "UTC",
    );
    expect(utc.toISOString()).toBe("2024-01-15T12:00:00.000Z");
  });

  it("handles timezones east of UTC", () => {
    const utc = wallClockToUTC(
      { year: 2024, month: 1, day: 15, hour: 12, minute: 0 },
      "Asia/Tokyo",
    );
    expect(utc.toISOString()).toBe("2024-01-15T03:00:00.000Z"); // JST = UTC+9
  });

  it("handles British Summer Time", () => {
    const utc = wallClockToUTC(
      { year: 2024, month: 7, day: 1, hour: 12, minute: 0 },
      "Europe/London",
    );
    expect(utc.toISOString()).toBe("2024-07-01T11:00:00.000Z"); // BST = UTC+1
  });

  it("zero-pads single-digit components", () => {
    const utc = wallClockToUTC(
      { year: 2024, month: 1, day: 5, hour: 9, minute: 5 },
      "UTC",
    );
    expect(utc.toISOString()).toBe("2024-01-05T09:05:00.000Z");
  });
});
