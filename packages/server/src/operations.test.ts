import { describe, expect, it, vi } from "vitest";
import type { BookingRepository } from "@apiary-dev/core";
import { ValidationError } from "@apiary-dev/core";
import {
  confirmBooking,
  createHold,
  getSlots,
  isRangeAvailable,
} from "./operations.js";

const at = (iso: string) => new Date(iso);

function makeRepository(
  overrides: Partial<Record<keyof BookingRepository, unknown>> = {},
): BookingRepository {
  return {
    getAvailableWindows: vi.fn().mockResolvedValue([]),
    getBookingsInRange: vi.fn().mockResolvedValue([]),
    createHold: vi.fn(),
    confirmBooking: vi.fn(),
    ...overrides,
  } as unknown as BookingRepository;
}

describe("getSlots", () => {
  it("fetches windows and bookings for the same range/provider and returns slots", async () => {
    const repository = makeRepository({
      getAvailableWindows: vi.fn().mockResolvedValue([
        { start: at("2026-01-05T09:00:00Z"), end: at("2026-01-05T10:00:00Z") },
      ]),
    });

    const slots = await getSlots(repository, {
      startDate: at("2026-01-05T00:00:00Z"),
      endDate: at("2026-01-06T00:00:00Z"),
      timeZone: "America/New_York",
      providerId: "provider-1",
      durationMinutes: 30,
      intervalMinutes: 30,
      now: at("2026-01-05T00:00:00Z"),
    });

    expect(slots.map((s) => s.start.toISOString())).toEqual([
      "2026-01-05T09:00:00.000Z",
      "2026-01-05T09:30:00.000Z",
    ]);
    expect(slots.every((s) => s.available)).toBe(true);

    expect(repository.getAvailableWindows).toHaveBeenCalledWith({
      startDate: at("2026-01-05T00:00:00Z"),
      endDate: at("2026-01-06T00:00:00Z"),
      providerId: "provider-1",
      mode: "dynamic",
      timeZone: "America/New_York",
    });
    expect(repository.getBookingsInRange).toHaveBeenCalledWith(
      at("2026-01-05T00:00:00Z"),
      at("2026-01-06T00:00:00Z"),
      "provider-1",
    );
  });

  it("blocks slots that collide with existing bookings", async () => {
    const repository = makeRepository({
      getAvailableWindows: vi.fn().mockResolvedValue([
        { start: at("2026-01-05T09:00:00Z"), end: at("2026-01-05T10:00:00Z") },
      ]),
      getBookingsInRange: vi.fn().mockResolvedValue([
        { start: at("2026-01-05T09:30:00Z"), end: at("2026-01-05T10:00:00Z") },
      ]),
    });

    const slots = await getSlots(repository, {
      startDate: at("2026-01-05T00:00:00Z"),
      endDate: at("2026-01-06T00:00:00Z"),
      timeZone: "UTC",
      durationMinutes: 30,
      intervalMinutes: 30,
      now: at("2026-01-05T00:00:00Z"),
    });

    expect(slots.map((s) => s.reason)).toEqual(["AVAILABLE", "COLLISION"]);
  });
});

describe("isRangeAvailable", () => {
  const range = {
    start: at("2026-01-05T09:00:00Z"),
    end: at("2026-01-05T09:30:00Z"),
  };

  it("returns true when the range is free and inside a window", async () => {
    const repository = makeRepository({
      getAvailableWindows: vi.fn().mockResolvedValue([
        { start: at("2026-01-05T09:00:00Z"), end: at("2026-01-05T17:00:00Z") },
      ]),
    });

    await expect(
      isRangeAvailable(repository, { range, timeZone: "UTC" }),
    ).resolves.toBe(true);
  });

  it("returns false when a booking collides", async () => {
    const repository = makeRepository({
      getBookingsInRange: vi.fn().mockResolvedValue([
        { start: at("2026-01-05T09:15:00Z"), end: at("2026-01-05T09:45:00Z") },
      ]),
    });

    await expect(
      isRangeAvailable(repository, { range, timeZone: "UTC" }),
    ).resolves.toBe(false);
  });

  it("returns false when the range is outside the windows", async () => {
    const repository = makeRepository({
      getAvailableWindows: vi.fn().mockResolvedValue([
        { start: at("2026-01-05T10:00:00Z"), end: at("2026-01-05T17:00:00Z") },
      ]),
    });

    await expect(
      isRangeAvailable(repository, { range, timeZone: "UTC" }),
    ).resolves.toBe(false);
  });

  it("skips the window check when checkWindows is false", async () => {
    const repository = makeRepository();

    await expect(
      isRangeAvailable(repository, { range, checkWindows: false }),
    ).resolves.toBe(true);
    expect(repository.getAvailableWindows).not.toHaveBeenCalled();
  });

  it("requires a timeZone when checking windows", async () => {
    const repository = makeRepository();

    await expect(isRangeAvailable(repository, { range })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe("createHold / confirmBooking", () => {
  it("delegates to the repository", async () => {
    const expiresAt = at("2026-01-05T09:40:00Z");
    const repository = makeRepository({
      createHold: vi.fn().mockResolvedValue({ holdToken: "hold-1", expiresAt }),
      confirmBooking: vi.fn().mockResolvedValue({ bookingId: "booking-1" }),
    });

    const hold = await createHold(repository, {
      serviceId: "svc-1",
      providerId: "provider-1",
      range: {
        start: at("2026-01-05T09:00:00Z"),
        end: at("2026-01-05T09:30:00Z"),
      },
    });
    expect(hold).toEqual({ holdToken: "hold-1", expiresAt });

    const confirmed = await confirmBooking(repository, {
      holdToken: "hold-1",
      customerDetails: { name: "Ada" },
    });
    expect(confirmed).toEqual({ bookingId: "booking-1" });
  });
});
