import type { Pool } from "pg";
import type {
  AvailableWindow,
  BookingRepository,
  TimeRange,
  WeeklyRule,
} from "@apiary/core";
import { expandWeeklyRules } from "@apiary/core";

export class BookingConflictError extends Error {
  constructor(
    message = "Requested slot overlaps an existing booking or hold",
  ) {
    super(message);
    this.name = "BookingConflictError";
  }
}

export interface PostgresBookingRepositoryOptions {
  /** How long a created hold reserves a slot, in minutes (default: 10). */
  holdDurationMinutes?: number;
}

const EXCLUSION_VIOLATION = "23P01";

const isExclusionViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: string }).code === EXCLUSION_VIOLATION;

export class PostgresBookingRepository implements BookingRepository {
  private readonly pool: Pool;
  private readonly holdDurationMinutes: number;

  constructor(pool: Pool, options: PostgresBookingRepositoryOptions = {}) {
    this.pool = pool;
    this.holdDurationMinutes = options.holdDurationMinutes ?? 10;
  }

  async getAvailableWindows(params: {
    startDate: Date;
    endDate: Date;
    providerId?: string;
    mode: "dynamic" | "explicit";
    timeZone: string;
  }): Promise<AvailableWindow[]> {
    return params.mode === "explicit"
      ? this.getExplicitWindows(params)
      : this.getDynamicWindows(params);
  }

  private async getDynamicWindows(params: {
    startDate: Date;
    endDate: Date;
    providerId?: string;
    timeZone: string;
  }): Promise<AvailableWindow[]> {
    const result = await this.pool.query(
      `SELECT day_of_week, start_time, end_time
       FROM scheduling_business_hours
       WHERE $1::uuid IS NULL OR provider_id = $1 OR provider_id IS NULL`,
      [params.providerId ?? null],
    );

    const rules: WeeklyRule[] = result.rows.map((row) => ({
      dayOfWeek: Number(row.day_of_week) as WeeklyRule["dayOfWeek"],
      startTime: row.start_time.slice(0, 5),
      endTime: row.end_time.slice(0, 5),
    }));

    return expandWeeklyRules({
      rules,
      startDate: params.startDate,
      endDate: params.endDate,
      timeZone: params.timeZone,
    });
  }

  private async getExplicitWindows(params: {
    startDate: Date;
    endDate: Date;
    providerId?: string;
  }): Promise<AvailableWindow[]> {
    const result = await this.pool.query(
      `SELECT lower(shift_window) AS start_ts, upper(shift_window) AS end_ts
       FROM scheduling_shifts
       WHERE is_published = true
         AND ($1::uuid IS NULL OR provider_id = $1)
         AND shift_window && tstzrange($2::timestamptz, $3::timestamptz, '[)')`,
      [params.providerId ?? null, params.startDate, params.endDate],
    );

    const startMs = params.startDate.getTime();
    const endMs = params.endDate.getTime();
    const windows: AvailableWindow[] = [];

    for (const row of result.rows) {
      const clippedStart = Math.max(new Date(row.start_ts).getTime(), startMs);
      const clippedEnd = Math.min(new Date(row.end_ts).getTime(), endMs);
      if (clippedEnd > clippedStart) {
        windows.push({
          start: new Date(clippedStart),
          end: new Date(clippedEnd),
        });
      }
    }

    windows.sort(
      (a, b) =>
        a.start.getTime() - b.start.getTime() ||
        a.end.getTime() - b.end.getTime(),
    );

    return windows;
  }

  async getBookingsInRange(
    startDate: Date,
    endDate: Date,
    providerId?: string,
  ): Promise<TimeRange[]> {
    const result = await this.pool.query(
      `SELECT lower(booking_window) AS start_ts, upper(booking_window) AS end_ts
       FROM scheduling_bookings
       WHERE status IN ('hold', 'confirmed')
         AND (status = 'confirmed' OR hold_expires_at > now())
         AND ($1::uuid IS NULL OR provider_id = $1)
         AND booking_window && tstzrange($2::timestamptz, $3::timestamptz, '[)')`,
      [providerId ?? null, startDate, endDate],
    );

    return result.rows.map((row) => ({
      start: new Date(row.start_ts),
      end: new Date(row.end_ts),
    }));
  }

  async createHold(params: {
    serviceId: string;
    providerId: string;
    range: TimeRange;
    customerId?: string;
  }): Promise<{ holdToken: string; expiresAt: Date }> {
    const expiresAt = new Date(
      Date.now() + this.holdDurationMinutes * 60 * 1000,
    );

    // The exclusion constraint blocks any row with status IN ('hold', 'confirmed')
    // regardless of expiry, so expire stale holds first or they would block slots forever.
    await this.pool.query(
      `UPDATE scheduling_bookings
       SET status = 'expired'
       WHERE status = 'hold' AND hold_expires_at <= now()`,
      [],
    );

    try {
      const result = await this.pool.query(
        `INSERT INTO scheduling_bookings
           (service_id, provider_id, booking_window, status, customer_id, hold_expires_at)
         VALUES ($1, $2, tstzrange($3::timestamptz, $4::timestamptz, '[)'), 'hold', $5, $6)
         RETURNING id, hold_expires_at`,
        [
          params.serviceId,
          params.providerId,
          params.range.start,
          params.range.end,
          params.customerId ?? null,
          expiresAt,
        ],
      );

      return {
        holdToken: result.rows[0].id,
        expiresAt: new Date(result.rows[0].hold_expires_at),
      };
    } catch (error) {
      if (isExclusionViolation(error)) {
        throw new BookingConflictError();
      }
      throw error;
    }
  }

  async confirmBooking(params: {
    holdToken: string;
    customerDetails: Record<string, unknown>;
  }): Promise<{ bookingId: string }> {
    const result = await this.pool.query(
      `UPDATE scheduling_bookings
       SET status = 'confirmed', customer_details = $2
       WHERE id = $1::uuid
         AND status = 'hold'
         AND hold_expires_at > now()
       RETURNING id`,
      [params.holdToken, params.customerDetails],
    );

    if (result.rowCount === 0) {
      throw new BookingConflictError("Hold not found or already expired.");
    }

    return { bookingId: result.rows[0].id };
  }
}
