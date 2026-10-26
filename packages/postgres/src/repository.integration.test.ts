import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  BookingConflictError,
  PostgresBookingRepository,
} from "./repository.js";

const database = process.env.TEST_DB_DATABASE;
const user = process.env.TEST_DB_USER;
const password = process.env.TEST_DB_PASS;
const hostname = process.env.TEST_DB_HOSTNAME;
const port = process.env.TEST_DB_PORT ?? "5432";

const hasTestDb = Boolean(database && user && password && hostname);

const connectionString = hasTestDb
  ? `postgres://${encodeURIComponent(user!)}:${encodeURIComponent(password!)}@${hostname}:${port}/${database}`
  : "";

// Entire suite skips when the TEST_DB_* environment is not configured.
const describeDb = hasTestDb ? describe : describe.skip;

const PROVIDER_A = "00000000-0000-0000-0000-000000000001";
const PROVIDER_B = "00000000-0000-0000-0000-000000000002";
const SERVICE_A = "10000000-0000-0000-0000-000000000001";

const at = (iso: string) => new Date(iso);

describeDb("PostgresBookingRepository (integration)", () => {
  let pool: Pool;
  let repository: PostgresBookingRepository;

  beforeAll(async () => {
    pool = new Pool({ connectionString });

    // Re-run the migration from scratch for a clean, repeatable suite.
    await pool.query(
      "DROP TABLE IF EXISTS scheduling_bookings, scheduling_shifts, scheduling_business_hours CASCADE",
    );
    const migration = readFileSync(
      fileURLToPath(new URL("./migrations/001_init.sql", import.meta.url)),
      "utf8",
    );
    await pool.query(migration);

    repository = new PostgresBookingRepository(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query(
      "TRUNCATE scheduling_bookings, scheduling_shifts, scheduling_business_hours CASCADE",
    );
  });

  describe("dynamic availability", () => {
    it("expands weekly business hours into windows in the provider timezone", async () => {
      await pool.query(
        `INSERT INTO scheduling_business_hours (day_of_week, start_time, end_time)
         VALUES (1, '09:00', '17:00')`,
      );

      const windows = await repository.getAvailableWindows({
        startDate: at("2026-01-05T00:00:00Z"),
        endDate: at("2026-01-06T00:00:00Z"),
        mode: "dynamic",
        timeZone: "America/New_York",
      });

      expect(windows).toEqual([
        { start: at("2026-01-05T14:00:00Z"), end: at("2026-01-05T22:00:00Z") },
      ]);
    });

    it("combines provider-scoped rules with global fallback rules", async () => {
      await pool.query(
        `INSERT INTO scheduling_business_hours (provider_id, day_of_week, start_time, end_time)
         VALUES ($1, 1, '09:00', '12:00'), (NULL, 1, '13:00', '17:00')`,
        [PROVIDER_A],
      );

      const windows = await repository.getAvailableWindows({
        startDate: at("2026-01-05T00:00:00Z"),
        endDate: at("2026-01-06T00:00:00Z"),
        providerId: PROVIDER_A,
        mode: "dynamic",
        timeZone: "UTC",
      });

      expect(windows.map((w) => [w.start.toISOString(), w.end.toISOString()])).toEqual([
        ["2026-01-05T09:00:00.000Z", "2026-01-05T12:00:00.000Z"],
        ["2026-01-05T13:00:00.000Z", "2026-01-05T17:00:00.000Z"],
      ]);
    });
  });

  describe("explicit availability", () => {
    it("returns only published shifts, clipped to the range", async () => {
      await pool.query(
        `INSERT INTO scheduling_shifts (provider_id, shift_window, is_published)
         VALUES
           ($1, tstzrange($2::timestamptz, $3::timestamptz, '[)'), true),
           ($1, tstzrange($4::timestamptz, $5::timestamptz, '[)'), false)`,
        [
          PROVIDER_A,
          "2026-01-05T09:00:00Z",
          "2026-01-05T17:00:00Z",
          "2026-01-05T10:00:00Z",
          "2026-01-05T11:00:00Z",
        ],
      );

      const windows = await repository.getAvailableWindows({
        startDate: at("2026-01-05T00:00:00Z"),
        endDate: at("2026-01-05T12:00:00Z"),
        providerId: PROVIDER_A,
        mode: "explicit",
        timeZone: "UTC",
      });

      expect(windows).toEqual([
        { start: at("2026-01-05T09:00:00Z"), end: at("2026-01-05T12:00:00Z") },
      ]);
    });
  });

  describe("bookings in range", () => {
    it("includes confirmed bookings and active holds, excludes expired holds", async () => {
      await pool.query(
        `INSERT INTO scheduling_bookings
           (service_id, provider_id, booking_window, status, hold_expires_at)
         VALUES
           ($1, $2, tstzrange($3::timestamptz, $4::timestamptz, '[)'), 'confirmed', NULL),
           ($1, $2, tstzrange($5::timestamptz, $6::timestamptz, '[)'), 'hold', now() + interval '10 minutes'),
           ($1, $2, tstzrange($7::timestamptz, $8::timestamptz, '[)'), 'hold', now() - interval '1 minute')`,
        [
          SERVICE_A,
          PROVIDER_A,
          "2026-01-05T09:00:00Z",
          "2026-01-05T10:00:00Z",
          "2026-01-05T11:00:00Z",
          "2026-01-05T12:00:00Z",
          "2026-01-05T13:00:00Z",
          "2026-01-05T14:00:00Z",
        ],
      );

      const bookings = await repository.getBookingsInRange(
        at("2026-01-05T00:00:00Z"),
        at("2026-01-06T00:00:00Z"),
        PROVIDER_A,
      );

      expect(bookings).toEqual([
        { start: at("2026-01-05T09:00:00Z"), end: at("2026-01-05T10:00:00Z") },
        { start: at("2026-01-05T11:00:00Z"), end: at("2026-01-05T12:00:00Z") },
      ]);
    });
  });

  describe("createHold", () => {
    it("rejects an overlapping hold via the exclusion constraint", async () => {
      const range = {
        start: at("2026-01-05T10:00:00Z"),
        end: at("2026-01-05T10:30:00Z"),
      };
      await repository.createHold({
        serviceId: SERVICE_A,
        providerId: PROVIDER_A,
        range,
      });

      await expect(
        repository.createHold({
          serviceId: SERVICE_A,
          providerId: PROVIDER_A,
          range,
        }),
      ).rejects.toBeInstanceOf(BookingConflictError);
    });

    it("allows the same window for a different provider", async () => {
      const range = {
        start: at("2026-01-05T10:00:00Z"),
        end: at("2026-01-05T10:30:00Z"),
      };
      await repository.createHold({
        serviceId: SERVICE_A,
        providerId: PROVIDER_A,
        range,
      });

      const second = await repository.createHold({
        serviceId: SERVICE_A,
        providerId: PROVIDER_B,
        range,
      });

      expect(second.holdToken).toBeTruthy();
    });

    it("allows a new hold once a previous hold has expired", async () => {
      const range = {
        start: at("2026-01-05T10:00:00Z"),
        end: at("2026-01-05T10:30:00Z"),
      };
      await pool.query(
        `INSERT INTO scheduling_bookings
           (service_id, provider_id, booking_window, status, hold_expires_at)
         VALUES ($1, $2, tstzrange($3::timestamptz, $4::timestamptz, '[)'), 'hold', now() - interval '1 minute')`,
        [SERVICE_A, PROVIDER_A, range.start.toISOString(), range.end.toISOString()],
      );

      const result = await repository.createHold({
        serviceId: SERVICE_A,
        providerId: PROVIDER_A,
        range,
      });

      expect(result.holdToken).toBeTruthy();
    });

    it("allows exactly one concurrent hold on the same slot", async () => {
      const range = {
        start: at("2026-01-05T10:00:00Z"),
        end: at("2026-01-05T10:30:00Z"),
      };

      const attempts = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          repository.createHold({
            serviceId: SERVICE_A,
            providerId: PROVIDER_A,
            range,
          }),
        ),
      );

      const fulfilled = attempts.filter((r) => r.status === "fulfilled");
      const rejected = attempts.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(4);
      for (const r of rejected) {
        expect((r as PromiseRejectedResult).reason).toBeInstanceOf(
          BookingConflictError,
        );
      }
    });
  });

  describe("confirmBooking", () => {
    it("confirms a hold and persists customer details", async () => {
      const { holdToken } = await repository.createHold({
        serviceId: SERVICE_A,
        providerId: PROVIDER_A,
        range: {
          start: at("2026-01-05T10:00:00Z"),
          end: at("2026-01-05T10:30:00Z"),
        },
      });

      const { bookingId } = await repository.confirmBooking({
        holdToken,
        customerDetails: { name: "Ada" },
      });

      expect(bookingId).toBe(holdToken);

      const row = await pool.query(
        "SELECT status, customer_details FROM scheduling_bookings WHERE id = $1",
        [bookingId],
      );
      expect(row.rows[0].status).toBe("confirmed");
      expect(row.rows[0].customer_details).toEqual({ name: "Ada" });
    });

    it("rejects confirming an expired hold", async () => {
      const expired = await pool.query(
        `INSERT INTO scheduling_bookings
           (service_id, provider_id, booking_window, status, hold_expires_at)
         VALUES ($1, $2, tstzrange($3::timestamptz, $4::timestamptz, '[)'), 'hold', now() - interval '1 minute')
         RETURNING id`,
        [SERVICE_A, PROVIDER_A, "2026-01-05T10:00:00Z", "2026-01-05T10:30:00Z"],
      );

      await expect(
        repository.confirmBooking({
          holdToken: expired.rows[0].id,
          customerDetails: {},
        }),
      ).rejects.toBeInstanceOf(BookingConflictError);
    });
  });
});
