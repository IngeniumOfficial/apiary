import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import {
  BookingConflictError,
  PostgresBookingRepository,
} from "./repository.js";

type FakePool = Pool & { query: ReturnType<typeof vi.fn> };

const fakePool = (): FakePool =>
  ({ query: vi.fn() }) as unknown as FakePool;

const repo = (pool: FakePool, holdDurationMinutes?: number) =>
  new PostgresBookingRepository(
    pool,
    holdDurationMinutes === undefined ? {} : { holdDurationMinutes },
  );

const queryArgs = (pool: FakePool): [string, unknown[]] =>
  pool.query.mock.calls[0] as [string, unknown[]];

describe("PostgresBookingRepository", () => {
  describe("getAvailableWindows (dynamic)", () => {
    it("expands weekly business hours into windows using the provided timezone", async () => {
      const pool = fakePool();
      pool.query.mockResolvedValue({
        rows: [
          { day_of_week: 1, start_time: "09:00:00", end_time: "17:00:00" },
        ],
      });
      const repository = repo(pool);

      const windows = await repository.getAvailableWindows({
        startDate: new Date("2026-01-05T00:00:00Z"),
        endDate: new Date("2026-01-06T00:00:00Z"),
        mode: "dynamic",
        timeZone: "America/New_York",
      });

      expect(windows).toEqual([
        {
          start: new Date("2026-01-05T14:00:00Z"),
          end: new Date("2026-01-05T22:00:00Z"),
        },
      ]);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("scheduling_business_hours"),
        [null],
      );
    });

    it("passes the providerId filter for scoped business hours", async () => {
      const pool = fakePool();
      pool.query.mockResolvedValue({ rows: [] });
      const repository = repo(pool);

      await repository.getAvailableWindows({
        startDate: new Date("2026-01-05T00:00:00Z"),
        endDate: new Date("2026-01-06T00:00:00Z"),
        providerId: "provider-1",
        mode: "dynamic",
        timeZone: "UTC",
      });

      const [, params] = queryArgs(pool);
      expect(params).toEqual(["provider-1"]);
    });

    it("throws a BookingConflictError when a business hour is overnight", async () => {
      const pool = fakePool();
      pool.query.mockResolvedValue({
        rows: [
          { day_of_week: 1, start_time: "22:00:00", end_time: "02:00:00" },
        ],
      });
      const repository = repo(pool);

      await expect(
        repository.getAvailableWindows({
          startDate: new Date("2026-01-05T00:00:00Z"),
          endDate: new Date("2026-01-06T00:00:00Z"),
          mode: "dynamic",
          timeZone: "UTC",
        }),
      ).rejects.toThrow(/overnight/);
    });
  });

  describe("getAvailableWindows (explicit)", () => {
    it("returns published shifts clipped to the requested range", async () => {
      const pool = fakePool();
      pool.query.mockResolvedValue({
        rows: [
          {
            start_ts: new Date("2026-01-05T10:00:00Z"),
            end_ts: new Date("2026-01-05T18:00:00Z"),
          },
        ],
      });
      const repository = repo(pool);

      const windows = await repository.getAvailableWindows({
        startDate: new Date("2026-01-05T00:00:00Z"),
        endDate: new Date("2026-01-05T12:00:00Z"),
        mode: "explicit",
        timeZone: "UTC",
      });

      expect(windows).toEqual([
        {
          start: new Date("2026-01-05T10:00:00Z"),
          end: new Date("2026-01-05T12:00:00Z"),
        },
      ]);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("scheduling_shifts"),
        expect.arrayContaining([
          new Date("2026-01-05T00:00:00Z"),
          new Date("2026-01-05T12:00:00Z"),
        ]),
      );
    });

    it("drops shifts entirely outside the requested range", async () => {
      const pool = fakePool();
      pool.query.mockResolvedValue({
        rows: [
          {
            start_ts: new Date("2026-01-06T00:00:00Z"),
            end_ts: new Date("2026-01-06T08:00:00Z"),
          },
        ],
      });
      const repository = repo(pool);

      const windows = await repository.getAvailableWindows({
        startDate: new Date("2026-01-05T00:00:00Z"),
        endDate: new Date("2026-01-05T23:00:00Z"),
        mode: "explicit",
        timeZone: "UTC",
      });

      expect(windows).toEqual([]);
    });
  });

  describe("getBookingsInRange", () => {
    it("maps overlapping hold/confirmed rows to TimeRange", async () => {
      const pool = fakePool();
      pool.query.mockResolvedValue({
        rows: [
          {
            start_ts: new Date("2026-01-05T09:30:00Z"),
            end_ts: new Date("2026-01-05T10:00:00Z"),
          },
        ],
      });
      const repository = repo(pool);

      const bookings = await repository.getBookingsInRange(
        new Date("2026-01-05T00:00:00Z"),
        new Date("2026-01-06T00:00:00Z"),
        "provider-1",
      );

      expect(bookings).toEqual([
        {
          start: new Date("2026-01-05T09:30:00Z"),
          end: new Date("2026-01-05T10:00:00Z"),
        },
      ]);
      const [, params] = queryArgs(pool);
      expect(params).toEqual([
        "provider-1",
        new Date("2026-01-05T00:00:00Z"),
        new Date("2026-01-06T00:00:00Z"),
      ]);
    });

    it("excludes expired holds via the SQL predicate", async () => {
      const pool = fakePool();
      pool.query.mockResolvedValue({ rows: [] });
      const repository = repo(pool);

      await repository.getBookingsInRange(
        new Date("2026-01-05T00:00:00Z"),
        new Date("2026-01-06T00:00:00Z"),
      );

      const [sql] = queryArgs(pool);
      expect(sql).toContain("hold_expires_at > now()");
    });
  });

  describe("createHold", () => {
    it("creates a hold and returns the token and expiry", async () => {
      const pool = fakePool();
      const expiresAt = new Date("2026-01-05T10:10:00Z");
      pool.query.mockResolvedValue({
        rows: [{ id: "hold-1", hold_expires_at: expiresAt }],
      });
      const repository = repo(pool, 10);

      const result = await repository.createHold({
        serviceId: "svc-1",
        providerId: "provider-1",
        range: {
          start: new Date("2026-01-05T10:00:00Z"),
          end: new Date("2026-01-05T10:30:00Z"),
        },
      });

      expect(result).toEqual({ holdToken: "hold-1", expiresAt });
      const [, params] = queryArgs(pool);
      expect(params[0]).toBe("svc-1");
      expect(params[1]).toBe("provider-1");
      expect(params[2]).toEqual(new Date("2026-01-05T10:00:00Z"));
      expect(params[3]).toEqual(new Date("2026-01-05T10:30:00Z"));
    });

    it("throws BookingConflictError on an exclusion violation", async () => {
      const pool = fakePool();
      const violation = new Error("conflicting key value violates exclusion");
      (violation as { code?: string }).code = "23P01";
      pool.query.mockRejectedValue(violation);
      const repository = repo(pool);

      await expect(
        repository.createHold({
          serviceId: "svc-1",
          providerId: "provider-1",
          range: {
            start: new Date("2026-01-05T10:00:00Z"),
            end: new Date("2026-01-05T10:30:00Z"),
          },
        }),
      ).rejects.toBeInstanceOf(BookingConflictError);
    });

    it("rethrows unrelated database errors", async () => {
      const pool = fakePool();
      const dbError = new Error("connection refused");
      pool.query.mockRejectedValue(dbError);
      const repository = repo(pool);

      await expect(
        repository.createHold({
          serviceId: "svc-1",
          providerId: "provider-1",
          range: {
            start: new Date("2026-01-05T10:00:00Z"),
            end: new Date("2026-01-05T10:30:00Z"),
          },
        }),
      ).rejects.toBe(dbError);
    });
  });

  describe("confirmBooking", () => {
    it("confirms a valid hold and returns the booking id", async () => {
      const pool = fakePool();
      pool.query.mockResolvedValue({
        rows: [{ id: "booking-1" }],
        rowCount: 1,
      });
      const repository = repo(pool);

      const result = await repository.confirmBooking({
        holdToken: "hold-1",
        customerDetails: { name: "Ada" },
      });

      expect(result).toEqual({ bookingId: "booking-1" });
      const [, params] = queryArgs(pool);
      expect(params[1]).toEqual({ name: "Ada" });
    });

    it("throws when the hold is missing or expired", async () => {
      const pool = fakePool();
      pool.query.mockResolvedValue({ rows: [], rowCount: 0 });
      const repository = repo(pool);

      await expect(
        repository.confirmBooking({
          holdToken: "hold-1",
          customerDetails: {},
        }),
      ).rejects.toBeInstanceOf(BookingConflictError);
    });
  });
});
