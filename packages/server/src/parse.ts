import type { TimeRange, TimeSlot } from "@apiary-dev/core";
import { ValidationError } from "@apiary-dev/core";
import type { GetSlotsInput } from "./types.js";

type QueryInput = URLSearchParams | Record<string, string | undefined>;

const read = (input: QueryInput, key: string): string | undefined =>
  input instanceof URLSearchParams ? (input.get(key) ?? undefined) : input[key];

function parseDate(value: string | undefined, key: string): Date {
  if (!value) {
    throw new ValidationError(`Missing required query parameter "${key}"`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`Invalid date for "${key}": ${value}`);
  }
  return date;
}

function parseOptionalNumber(
  value: string | undefined,
  key: string,
): number | undefined {
  if (value === undefined || value === "") return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new ValidationError(`Invalid number for "${key}": ${value}`);
  }
  return num;
}

function parseRequiredNumber(value: string | undefined, key: string): number {
  const num = parseOptionalNumber(value, key);
  if (num === undefined) {
    throw new ValidationError(`Missing required query parameter "${key}"`);
  }
  return num;
}

/**
 * Parse and validate a slots query (URL search params or a plain object) into
 * typed {@link GetSlotsInput}. Throws {@link ValidationError} on bad input.
 */
export function parseSlotsQuery(input: QueryInput): GetSlotsInput {
  const timeZone = read(input, "timeZone");
  if (!timeZone) {
    throw new ValidationError('Missing required query parameter "timeZone"');
  }

  const rawMode = read(input, "mode");
  let mode: "dynamic" | "explicit" | undefined;
  if (rawMode !== undefined && rawMode !== "") {
    if (rawMode !== "dynamic" && rawMode !== "explicit") {
      throw new ValidationError(`Invalid "mode": ${rawMode}`);
    }
    mode = rawMode;
  }

  const beforeMinutes = parseOptionalNumber(
    read(input, "bufferBefore"),
    "bufferBefore",
  );
  const afterMinutes = parseOptionalNumber(
    read(input, "bufferAfter"),
    "bufferAfter",
  );

  return {
    startDate: parseDate(read(input, "start"), "start"),
    endDate: parseDate(read(input, "end"), "end"),
    timeZone,
    providerId: read(input, "providerId"),
    mode,
    durationMinutes: parseRequiredNumber(read(input, "duration"), "duration"),
    intervalMinutes: parseRequiredNumber(read(input, "interval"), "interval"),
    buffers:
      beforeMinutes !== undefined || afterMinutes !== undefined
        ? { beforeMinutes, afterMinutes }
        : undefined,
    minNoticeMinutes: parseOptionalNumber(read(input, "minNotice"), "minNotice"),
    maxHorizonMinutes: parseOptionalNumber(
      read(input, "maxHorizon"),
      "maxHorizon",
    ),
  };
}

/** Serialize a range's Dates to ISO strings for JSON transport. */
export function serializeTimeRange(range: TimeRange): {
  start: string;
  end: string;
} {
  return { start: range.start.toISOString(), end: range.end.toISOString() };
}

/** Serialize a slot (including availability metadata) for JSON transport. */
export function serializeSlot(slot: TimeSlot): {
  start: string;
  end: string;
  available: boolean;
  reason: string;
} {
  return {
    ...serializeTimeRange(slot),
    available: slot.available,
    reason: slot.reason,
  };
}
