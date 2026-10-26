import type { TimeRange, BufferConfig } from "../types/index.js";

/**
 * Checks if two half-open time ranges [start, end) overlap.
 * Touch points (RangeA.end === RangeB.start) do NOT overlap.
 */
/**
 *
 * @param {TimeRange} a - First range
 * @param {TimeRange} b - Second range
 * @returns - True if the ranges overlap, false otherwise
 */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && a.end > b.start;
}

/**
 * Expands a target range by applying pre and post buffer padding.
 */
export function applyBufferToRange(
  range: TimeRange,
  buffer?: BufferConfig,
): TimeRange {
  const beforeMs = (buffer?.beforeMinutes ?? 0) * 60 * 1000;
  const afterMs = (buffer?.afterMinutes ?? 0) * 60 * 1000;

  return {
    start: new Date(range.start.getTime() - beforeMs),
    end: new Date(range.end.getTime() + afterMs),
  };
}
