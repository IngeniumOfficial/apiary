import type {
  SlotGeneratorOptions,
  TimeSlot,
  TimeRange,
} from "../types/index.js";
import { rangesOverlap, applyBufferToRange } from "../rules/collisions.js";

/**
 *
 * @param {SlotGeneratorOptions} options
 * @param {Date} now
 * @returns - Generated time slots
 */
export function generateTimeSlots(
  options: SlotGeneratorOptions,
  now: Date = new Date(),
): TimeSlot[] {
  const {
    windows,
    existingBookings,
    durationMinutes,
    intervalMinutes,
    buffers = {},
    minNoticeMinutes = 0,
    maxHorizonMinutes,
  } = options;

  if (windows.length === 0) return [];

  const slotDurationMs = durationMinutes * 60 * 1000;
  const stepIntervalMs = intervalMinutes * 60 * 1000;
  const bufferBeforeMs = (buffers.beforeMinutes ?? 0) * 60 * 1000;
  const bufferAfterMs = (buffers.afterMinutes ?? 0) * 60 * 1000;
  const minNoticeCutoff = new Date(
    now.getTime() + minNoticeMinutes * 60 * 1000,
  );
  const maxHorizonCutoff =
    maxHorizonMinutes !== undefined
      ? new Date(now.getTime() + maxHorizonMinutes * 60 * 1000)
      : null;

  // Apply service buffer padding to existing bookings
  const bufferedBookings: TimeRange[] = existingBookings.map((b) =>
    applyBufferToRange(b, buffers),
  );

  const candidateSlots: TimeSlot[] = [];

  for (const window of windows) {
    let currentStartMs = window.start.getTime();
    const windowEndMs = window.end.getTime();

    while (currentStartMs + slotDurationMs <= windowEndMs) {
      const slotStart = new Date(currentStartMs);
      const slotEnd = new Date(currentStartMs + slotDurationMs);

      // Total footprint required including pre/post buffers
      const bufferedStartMs = currentStartMs - bufferBeforeMs;
      const bufferedEndMs = currentStartMs + slotDurationMs + bufferAfterMs;

      let available = true;
      let reason: TimeSlot["reason"] = "AVAILABLE";

      // Rule 1: Minimum advance notice check
      if (slotStart < minNoticeCutoff) {
        available = false;
        reason = "MIN_NOTICE_VIOLATION";
      }

      // Rule 2: Maximum booking horizon check
      if (
        available &&
        maxHorizonCutoff !== null &&
        slotStart.getTime() > maxHorizonCutoff.getTime()
      ) {
        available = false;
        reason = "MAX_HORIZON_EXCEEDED";
      }

      // Rule 3: Ensure total buffered slot fits inside the host window
      if (
        available &&
        (bufferedStartMs < window.start.getTime() ||
          bufferedEndMs > windowEndMs)
      ) {
        available = false;
        reason = "OUTSIDE_BOUNDS";
      }

      // Rule 4: Check collisions with existing bookings (including buffers)
      if (available) {
        const candidateRange: TimeRange = { start: slotStart, end: slotEnd };
        const bufferedCandidate = applyBufferToRange(candidateRange, buffers);

        const hasCollision = bufferedBookings.some((booking) =>
          rangesOverlap(bufferedCandidate, booking),
        );

        if (hasCollision) {
          available = false;
          reason = "COLLISION";
        }
      }

      candidateSlots.push({
        start: slotStart,
        end: slotEnd,
        available,
        reason,
      });

      currentStartMs += stepIntervalMs;
    }
  }

  return candidateSlots;
}
