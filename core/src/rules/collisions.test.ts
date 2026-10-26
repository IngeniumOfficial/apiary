import { describe, expect, it } from "vitest";
import { applyBufferToRange, rangesOverlap } from "./collisions.js";

const at = (iso: string) => new Date(iso);

describe("rangesOverlap", () => {
  it("returns false for non-overlapping ranges", () => {
    expect(
      rangesOverlap(
        { start: at("2026-01-01T09:00:00Z"), end: at("2026-01-01T10:00:00Z") },
        { start: at("2026-01-01T10:30:00Z"), end: at("2026-01-01T11:00:00Z") },
      ),
    ).toBe(false);
  });

  it("returns false for touching ranges (half-open [start, end))", () => {
    expect(
      rangesOverlap(
        { start: at("2026-01-01T09:00:00Z"), end: at("2026-01-01T10:00:00Z") },
        { start: at("2026-01-01T10:00:00Z"), end: at("2026-01-01T11:00:00Z") },
      ),
    ).toBe(false);
  });

  it("returns true for partially overlapping ranges", () => {
    expect(
      rangesOverlap(
        { start: at("2026-01-01T09:00:00Z"), end: at("2026-01-01T10:00:00Z") },
        { start: at("2026-01-01T09:30:00Z"), end: at("2026-01-01T10:30:00Z") },
      ),
    ).toBe(true);
  });

  it("returns true when one range contains the other", () => {
    expect(
      rangesOverlap(
        { start: at("2026-01-01T09:00:00Z"), end: at("2026-01-01T12:00:00Z") },
        { start: at("2026-01-01T10:00:00Z"), end: at("2026-01-01T11:00:00Z") },
      ),
    ).toBe(true);
  });

  it("returns true for identical ranges", () => {
    const range = { start: at("2026-01-01T09:00:00Z"), end: at("2026-01-01T10:00:00Z") };
    expect(rangesOverlap(range, { ...range })).toBe(true);
  });
});

describe("applyBufferToRange", () => {
  const range = { start: at("2026-01-01T09:00:00Z"), end: at("2026-01-01T10:00:00Z") };

  it("returns the same range when no buffer is provided", () => {
    const out = applyBufferToRange(range);
    expect(out.start.getTime()).toBe(range.start.getTime());
    expect(out.end.getTime()).toBe(range.end.getTime());
  });

  it("expands start by beforeMinutes and end by afterMinutes", () => {
    const out = applyBufferToRange(range, { beforeMinutes: 15, afterMinutes: 30 });
    expect(out.start.getTime()).toBe(range.start.getTime() - 15 * 60 * 1000);
    expect(out.end.getTime()).toBe(range.end.getTime() + 30 * 60 * 1000);
  });

  it("handles partial buffer configs", () => {
    const out = applyBufferToRange(range, { afterMinutes: 10 });
    expect(out.start.getTime()).toBe(range.start.getTime());
    expect(out.end.getTime()).toBe(range.end.getTime() + 10 * 60 * 1000);
  });

  it("does not mutate the input range", () => {
    applyBufferToRange(range, { beforeMinutes: 15 });
    expect(range.start.getTime()).toBe(at("2026-01-01T09:00:00Z").getTime());
    expect(range.end.getTime()).toBe(at("2026-01-01T10:00:00Z").getTime());
  });
});
