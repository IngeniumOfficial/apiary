import { describe, expect, it } from "vitest";
import { generateTimeSlots } from "./generator.js";
import type { SlotGeneratorOptions } from "../types/index.js";

const at = (iso: string) => new Date(iso);
const NOW = at("2026-01-01T00:00:00Z");

const options = (
  overrides: Partial<SlotGeneratorOptions> = {},
): SlotGeneratorOptions => ({
  windows: [],
  existingBookings: [],
  durationMinutes: 60,
  intervalMinutes: 60,
  minNoticeMinutes: 0,
  ...overrides,
});

describe("generateTimeSlots", () => {
  it("returns an empty array when there are no windows", () => {
    expect(generateTimeSlots(options(), NOW)).toEqual([]);
  });

  it("subdivides a window into slots at the given interval", () => {
    const slots = generateTimeSlots(
      options({
        windows: [{ start: at("2026-01-01T09:00:00Z"), end: at("2026-01-01T10:30:00Z") }],
        durationMinutes: 30,
        intervalMinutes: 30,
      }),
      NOW,
    );
    expect(slots.map((s) => s.start.toISOString())).toEqual([
      "2026-01-01T09:00:00.000Z",
      "2026-01-01T09:30:00.000Z",
      "2026-01-01T10:00:00.000Z",
    ]);
    expect(slots.every((s) => s.available)).toBe(true);
    expect(slots.every((s) => s.reason === "AVAILABLE")).toBe(true);
  });

  it("produces overlapping slots when the interval is shorter than the duration", () => {
    const slots = generateTimeSlots(
      options({
        windows: [{ start: at("2026-01-01T09:00:00Z"), end: at("2026-01-01T10:00:00Z") }],
        durationMinutes: 30,
        intervalMinutes: 15,
      }),
      NOW,
    );
    expect(slots.map((s) => s.start.toISOString())).toEqual([
      "2026-01-01T09:00:00.000Z",
      "2026-01-01T09:15:00.000Z",
      "2026-01-01T09:30:00.000Z",
    ]);
  });

  it("never generates a slot that does not fit inside its window", () => {
    const slots = generateTimeSlots(
      options({
        windows: [{ start: at("2026-01-01T09:00:00Z"), end: at("2026-01-01T10:00:00Z") }],
        durationMinutes: 30,
        intervalMinutes: 15,
      }),
      NOW,
    );
    for (const s of slots) {
      expect(s.end.getTime()).toBeLessThanOrEqual(at("2026-01-01T10:00:00Z").getTime());
    }
  });

  it("marks slots before the minimum notice cutoff as MIN_NOTICE_VIOLATION", () => {
    const slots = generateTimeSlots(
      options({
        windows: [{ start: at("2026-01-01T09:00:00Z"), end: at("2026-01-01T11:00:00Z") }],
        durationMinutes: 60,
        intervalMinutes: 60,
        minNoticeMinutes: 30,
      }),
      at("2026-01-01T09:00:00Z"),
    );
    expect(slots.map((s) => s.reason)).toEqual(["MIN_NOTICE_VIOLATION", "AVAILABLE"]);
  });

  it("marks slots whose buffered footprint escapes the window as OUTSIDE_BOUNDS", () => {
    const slots = generateTimeSlots(
      options({
        windows: [{ start: at("2026-01-01T09:00:00Z"), end: at("2026-01-01T10:00:00Z") }],
        durationMinutes: 30,
        intervalMinutes: 15,
        buffers: { beforeMinutes: 15, afterMinutes: 15 },
      }),
      NOW,
    );
    expect(slots.map((s) => `${s.start.toISOString()}:${s.reason}`)).toEqual([
      "2026-01-01T09:00:00.000Z:OUTSIDE_BOUNDS",
      "2026-01-01T09:15:00.000Z:AVAILABLE",
      "2026-01-01T09:30:00.000Z:OUTSIDE_BOUNDS",
    ]);
  });

  it("marks slots overlapping existing bookings as COLLISION", () => {
    const slots = generateTimeSlots(
      options({
        windows: [{ start: at("2026-01-01T09:00:00Z"), end: at("2026-01-01T11:00:00Z") }],
        durationMinutes: 60,
        intervalMinutes: 30,
        existingBookings: [
          { start: at("2026-01-01T09:30:00Z"), end: at("2026-01-01T10:00:00Z") },
        ],
      }),
      NOW,
    );
    expect(slots.map((s) => s.reason)).toEqual(["COLLISION", "COLLISION", "AVAILABLE"]);
  });

  it("does not collide with a booking that only touches a slot boundary (half-open ranges)", () => {
    const slots = generateTimeSlots(
      options({
        windows: [{ start: at("2026-01-01T09:00:00Z"), end: at("2026-01-01T10:00:00Z") }],
        durationMinutes: 30,
        intervalMinutes: 30,
        existingBookings: [
          { start: at("2026-01-01T10:00:00Z"), end: at("2026-01-01T10:30:00Z") },
        ],
      }),
      NOW,
    );
    expect(slots.map((s) => s.reason)).toEqual(["AVAILABLE", "AVAILABLE"]);
  });

  it("enforces the combined buffer gap between adjacent appointments", () => {
    const slots = generateTimeSlots(
      options({
        windows: [{ start: at("2026-01-01T08:00:00Z"), end: at("2026-01-01T12:30:00Z") }],
        durationMinutes: 60,
        intervalMinutes: 30,
        buffers: { beforeMinutes: 30, afterMinutes: 30 },
        existingBookings: [
          { start: at("2026-01-01T09:00:00Z"), end: at("2026-01-01T10:00:00Z") },
        ],
      }),
      NOW,
    );
    const available = slots.filter((s) => s.available).map((s) => s.start.toISOString());
    expect(available).toEqual(["2026-01-01T11:00:00.000Z"]);
  });

  it("marks slots starting beyond the horizon as MAX_HORIZON_EXCEEDED", () => {
    const slots = generateTimeSlots(
      options({
        windows: [{ start: at("2026-01-01T09:00:00Z"), end: at("2026-01-01T11:00:00Z") }],
        durationMinutes: 60,
        intervalMinutes: 30,
        maxHorizonMinutes: 60,
      }),
      at("2026-01-01T08:00:00Z"),
    );
    expect(slots.map((s) => s.reason)).toEqual([
      "AVAILABLE",
      "MAX_HORIZON_EXCEEDED",
      "MAX_HORIZON_EXCEEDED",
    ]);
  });

  it("generates slots in the order the windows were provided", () => {
    const slots = generateTimeSlots(
      options({
        windows: [
          { start: at("2026-01-01T10:00:00Z"), end: at("2026-01-01T11:00:00Z") },
          { start: at("2026-01-01T09:00:00Z"), end: at("2026-01-01T10:00:00Z") },
        ],
        durationMinutes: 60,
      }),
      NOW,
    );
    expect(slots.map((s) => s.start.toISOString())).toEqual([
      "2026-01-01T10:00:00.000Z",
      "2026-01-01T09:00:00.000Z",
    ]);
  });
});
