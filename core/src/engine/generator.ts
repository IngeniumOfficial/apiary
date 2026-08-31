export interface SimpleRange {
  start: Date;
  end: Date;
}

/**
 * Subdivide the window into slots of the specified duration
 * @param {Date} windowStart - Start of the window
 * @param {Date} windowEnd - End of the window
 * @param {number} durationMinutes - Duration of each slot
 * @param {number} intervalMinutes - Interval between slots
 * @returns {SimpleRange[]} - Array of slots
 */
export const subdivideWindow = (
  windowStart: Date,
  windowEnd: Date,
  durationMinutes: number,
  intervalMinutes: number,
): SimpleRange[] => {
  const slots: SimpleRange[] = [];
  const durationMs = durationMinutes * 60 * 1000;
  const intervalMs = intervalMinutes * 60 * 1000;

  let currentStartMs = windowStart.getTime();

  // Keep generating while the slot gits inside the window
  while (currentStartMs + durationMs <= windowEnd.getTime()) {
    slots.push({
      start: new Date(currentStartMs),
      end: new Date(currentStartMs + durationMs),
    });

    // Advance by the step interval (15 mins), not slot duration (30 mins)
    currentStartMs += intervalMs;
  }

  return slots;
};
