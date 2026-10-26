export interface TimeRange {
  start: Date;
  end: Date;
}

export interface BufferConfig {
  beforeMinutes?: number;
  afterMinutes?: number;
}

export type AvailabilityReason =
  | "AVAILABLE"
  | "COLLISION"
  | "OUTSIDE_BOUNDS"
  | "MIN_NOTICE_VIOLATION"
  | "MAX_HORIZON_EXCEEDED";

export interface TimeSlot extends TimeRange {
  available: boolean;
  reason: AvailabilityReason;
}

/**
 * Represents an active window of available time.
 * Sourced either dynamically from weekly business hours or explicitly from DB shifts.
 */
export interface AvailableWindow extends TimeRange {
  id?: string;
  providerId?: string;
}

export interface SlotGeneratorOptions {
  /** Source operating windows (Dynamic business hours OR Explicit DB shifts) */
  windows: AvailableWindow[];
  /** Confirmed bookings, holds, or blackout windows to subtract */
  existingBookings: TimeRange[];
  /** Duration of the appointment in minutes */
  durationMinutes: number;
  /** Step interval between slot start times in minutes (e.g. 15 for slots every 15 mins) */
  intervalMinutes: number;
  /** Required pre/post service buffer rules */
  buffers?: BufferConfig;
  /** Minimum notice required before a booking (in minutes) */
  minNoticeMinutes?: number;
  /** Maximum booking horizon in minutes. Slots starting beyond now + this are excluded. */
  maxHorizonMinutes?: number;
}
