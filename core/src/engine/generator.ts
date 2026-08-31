export interface SimpleRange {
  start: Date;
  end: Date;
}

export interface BufferConfig {
  beforeMinutes?: number;
  afterMinutes?: number;
}

export interface SubdivideWindowOptions {
  buffer?: BufferConfig;
}

/**
 * Subdivide the window into slots of the specified duration
 * @param {Date} windowStart - Start of the window
 * @param {Date} windowEnd - End of the window
 * @param {number} durationMinutes - Duration of each slot
 * @param {number} intervalMinutes - Interval between slots
 * @param {SubdivideWindowOptions} options - Optional options for subdivision
 * @returns {SimpleRange[]} - Array of slots
 */
export const subdivideWindow = (
  windowStart: Date,
  windowEnd: Date,
  durationMinutes: number,
  intervalMinutes: number,
  options?: SubdivideWindowOptions,
): SimpleRange[] => {
  const slots: SimpleRange[] = [];
  const durationMs = durationMinutes * 60 * 1000;
  const intervalMs = intervalMinutes * 60 * 1000;

  // Extract buggers in ms
  const bufferBeforeMs = (options?.buffer?.beforeMinutes ?? 0) * 60 * 1000;
  const bufferAfterMs = (options?.buffer?.afterMinutes ?? 0) * 60 * 1000;

  const windowStartMs = windowStart.getTime();
  const windowEndMs = windowEnd.getTime();

  let currentStartMs = windowStartMs;

  // Keep generating while the slot gits inside the window
  while (currentStartMs + durationMs <= windowEndMs) {
    const candidateAppointmentStart = currentStartMs;
    const candidateAppointmentEnd = currentStartMs + durationMs;

    // Calculate total footprint including buffers
    const bufferedStartMs = candidateAppointmentStart - bufferBeforeMs;
    const bufferedEndMs = candidateAppointmentEnd + bufferAfterMs;

    // Verify the slot + buffers fit within the operating window bounds
    if (bufferedStartMs >= windowStartMs && bufferedEndMs <= windowEndMs) {
      slots.push({
        start: new Date(candidateAppointmentStart),
        end: new Date(candidateAppointmentEnd),
      });
    }

    currentStartMs += intervalMs;
  }

  return slots;
};

/**
 *
 * @param {SimpleRange} a - First range
 * @param {SimpleRange} b - Second range
 * @returns - True if the ranges overlap, false otherwise
 */
export const rangesOverlap = (a: SimpleRange, b: SimpleRange): boolean => {
  return a.start < b.end && b.start < a.end;
};

export const applyBufferToRange = (
  range: SimpleRange,
  buffer: BufferConfig,
): SimpleRange => {
  const beforeMs = buffer.beforeMinutes! * 60 * 1000;
  const afterMs = buffer.afterMinutes! * 60 * 1000;
  return {
    // expand start backwards and end forwards
    start: new Date(range.start.getTime() - beforeMs),
    end: new Date(range.end.getTime() + afterMs),
  };
};
