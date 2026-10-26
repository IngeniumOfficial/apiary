import type { TimeRange, AvailableWindow } from "./index.js";

export interface BookingRepository {
  /** Fetch active windows: supporting both Dynamic rules and Explicit shifts */
  getAvailableWindows(params: {
    startDate: Date;
    endDate: Date;
    providerId?: string;
    mode: "dynamic" | "explicit";
  }): Promise<AvailableWindow[]>;

  /** Fetch confirmed bookings and active holds in target window */
  getBookingsInRange(
    startDate: Date,
    endDate: Date,
    providerId?: string,
  ): Promise<TimeRange[]>;

  /** Create an atomic 10-minute slot hold */
  createHold(params: {
    serviceId: string;
    range: TimeRange;
    customerId?: string;
  }): Promise<{ holdToken: string; expiresAt: Date }>;

  /** Confirm a hold into a permanent booking */
  confirmBooking(params: {
    holdToken: string;
    customerDetails: Record<string, unknown>;
  }): Promise<{ bookingId: string }>;
}
