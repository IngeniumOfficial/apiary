import { describe, expect, it } from "vitest";
import { ValidationError } from "@apiary-dev/core";
import { parseSlotsQuery, serializeSlot } from "./parse.js";

describe("parseSlotsQuery", () => {
  it("parses valid search params into typed input", () => {
    const params = new URLSearchParams({
      start: "2026-01-05T00:00:00Z",
      end: "2026-01-06T00:00:00Z",
      timeZone: "America/New_York",
      duration: "30",
      interval: "15",
      providerId: "p1",
      mode: "explicit",
      bufferBefore: "5",
      minNotice: "30",
    });

    const input = parseSlotsQuery(params);

    expect(input.startDate.toISOString()).toBe("2026-01-05T00:00:00.000Z");
    expect(input.endDate.toISOString()).toBe("2026-01-06T00:00:00.000Z");
    expect(input.timeZone).toBe("America/New_York");
    expect(input.providerId).toBe("p1");
    expect(input.mode).toBe("explicit");
    expect(input.durationMinutes).toBe(30);
    expect(input.intervalMinutes).toBe(15);
    expect(input.buffers).toEqual({ beforeMinutes: 5, afterMinutes: undefined });
    expect(input.minNoticeMinutes).toBe(30);
  });

  it("throws when required params are missing", () => {
    expect(() =>
      parseSlotsQuery(new URLSearchParams({ start: "2026-01-05T00:00:00Z" })),
    ).toThrow(ValidationError);
  });

  it("throws on invalid dates and numbers", () => {
    const base = {
      end: "2026-01-06T00:00:00Z",
      timeZone: "UTC",
      duration: "30",
      interval: "15",
    };
    expect(() => parseSlotsQuery({ ...base, start: "not-a-date" })).toThrow(
      /Invalid date/,
    );
    expect(() =>
      parseSlotsQuery({ ...base, start: "2026-01-05T00:00:00Z", duration: "abc" }),
    ).toThrow(/Invalid number/);
  });

  it("rejects an invalid mode", () => {
    expect(() =>
      parseSlotsQuery({
        start: "2026-01-05T00:00:00Z",
        end: "2026-01-06T00:00:00Z",
        timeZone: "UTC",
        duration: "30",
        interval: "15",
        mode: "sometimes",
      }),
    ).toThrow(/Invalid "mode"/);
  });
});

describe("serializeSlot", () => {
  it("serializes dates to ISO strings", () => {
    const slot = {
      start: new Date("2026-01-05T09:00:00Z"),
      end: new Date("2026-01-05T09:30:00Z"),
      available: true,
      reason: "AVAILABLE" as const,
    };

    expect(serializeSlot(slot)).toEqual({
      start: "2026-01-05T09:00:00.000Z",
      end: "2026-01-05T09:30:00.000Z",
      available: true,
      reason: "AVAILABLE",
    });
  });
});
