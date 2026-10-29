import type { BufferConfig, TimeRange } from "@apiary-dev/core";

/** Input for {@link getSlots}. */
export interface GetSlotsInput {
  /** Query range start (inclusive), UTC */
  startDate: Date;
  /** Query range end (exclusive), UTC */
  endDate: Date;
  /** IANA timezone the dynamic weekly rules are expressed in */
  timeZone: string;
  providerId?: string;
  /** Availability model (default: "dynamic") */
  mode?: "dynamic" | "explicit";
  durationMinutes: number;
  intervalMinutes: number;
  buffers?: BufferConfig;
  minNoticeMinutes?: number;
  maxHorizonMinutes?: number;
  /** Reference time for min-notice/horizon checks (default: now) */
  now?: Date;
}

/** Input for {@link isRangeAvailable}. */
export interface IsRangeAvailableInput {
  range: TimeRange;
  providerId?: string;
  /** Availability model (default: "dynamic") */
  mode?: "dynamic" | "explicit";
  /** Required when `checkWindows` is not `false` */
  timeZone?: string;
  buffers?: BufferConfig;
  /**
   * Also verify the range fits inside an availability window.
   * Defaults to `true`; set `false` to check only for booking collisions.
   */
  checkWindows?: boolean;
}

/** Input for {@link createHold}. */
export interface CreateHoldInput {
  serviceId: string;
  providerId: string;
  range: TimeRange;
  customerId?: string;
}

/** Input for {@link confirmBooking}. */
export interface ConfirmBookingInput {
  holdToken: string;
  customerDetails: Record<string, unknown>;
}
