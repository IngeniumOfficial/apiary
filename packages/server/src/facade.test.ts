import { describe, expect, it, vi } from "vitest";
import type { BookingRepository } from "@apiary-dev/core";
import { ValidationError } from "@apiary-dev/core";
import { createApiary } from "./facade.js";

const at = (iso: string) => new Date(iso);

function makeRepository(
  overrides: Partial<Record<keyof BookingRepository, unknown>> = {},
): BookingRepository {
  return {
    getAvailableWindows: vi.fn().mockResolvedValue([
      { start: at("2026-01-05T09:00:00Z"), end: at("2026-01-05T10:00:00Z") },
    ]),
    getBookingsInRange: vi.fn().mockResolvedValue([]),
    createHold: vi.fn().mockResolvedValue({
      holdToken: "hold-1",
      expiresAt: at("2026-01-05T09:10:00Z"),
    }),
    confirmBooking: vi.fn().mockResolvedValue({ bookingId: "booking-1" }),
    ...overrides,
  } as unknown as BookingRepository;
}

describe("createApiary", () => {
  it("applies defaults when inputs omit them", async () => {
    const repository = makeRepository();
    const apiary = createApiary({
      repository,
      defaults: { timeZone: "UTC", durationMinutes: 30, intervalMinutes: 30 },
    });

    const slots = await apiary.getSlots({
      startDate: at("2026-01-05T00:00:00Z"),
      endDate: at("2026-01-06T00:00:00Z"),
      now: at("2026-01-05T00:00:00Z"),
    });

    expect(slots).toHaveLength(2);
    expect(repository.getAvailableWindows).toHaveBeenCalledWith(
      expect.objectContaining({ timeZone: "UTC", mode: "dynamic" }),
    );
  });

  it("lets explicit inputs override defaults", async () => {
    const repository = makeRepository();
    const apiary = createApiary({
      repository,
      defaults: { timeZone: "UTC", durationMinutes: 30, intervalMinutes: 30 },
    });

    const slots = await apiary.getSlots({
      startDate: at("2026-01-05T00:00:00Z"),
      endDate: at("2026-01-06T00:00:00Z"),
      durationMinutes: 60,
      intervalMinutes: 60,
      now: at("2026-01-05T00:00:00Z"),
    });

    expect(slots).toHaveLength(1);
  });

  it("throws ValidationError when a required option has no default", async () => {
    const apiary = createApiary({ repository: makeRepository() });

    await expect(
      apiary.getSlots({
        startDate: at("2026-01-05T00:00:00Z"),
        endDate: at("2026-01-06T00:00:00Z"),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("binds hold and confirm operations", async () => {
    const repository = makeRepository();
    const apiary = createApiary({ repository });
    const range = {
      start: at("2026-01-05T09:00:00Z"),
      end: at("2026-01-05T09:30:00Z"),
    };

    const hold = await apiary.createHold({
      serviceId: "svc-1",
      providerId: "provider-1",
      range,
    });
    expect(hold.holdToken).toBe("hold-1");

    const confirmed = await apiary.confirmBooking({
      holdToken: "hold-1",
      customerDetails: {},
    });
    expect(confirmed.bookingId).toBe("booking-1");
  });
});
