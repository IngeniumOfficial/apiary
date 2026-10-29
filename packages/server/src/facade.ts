import type { BookingRepository, BufferConfig, TimeSlot } from "@apiary-dev/core";
import { ValidationError } from "@apiary-dev/core";
import {
  confirmBooking,
  createHold,
  getSlots,
  isRangeAvailable,
} from "./operations.js";
import type {
  ConfirmBookingInput,
  CreateHoldInput,
  GetSlotsInput,
  IsRangeAvailableInput,
} from "./types.js";

/** Defaults applied by the facade when an operation omits a value. */
export interface ApiaryDefaults {
  timeZone?: string;
  mode?: "dynamic" | "explicit";
  durationMinutes?: number;
  intervalMinutes?: number;
  buffers?: BufferConfig;
  minNoticeMinutes?: number;
  maxHorizonMinutes?: number;
}

export interface ApiaryOptions {
  repository: BookingRepository;
  defaults?: ApiaryDefaults;
}

type WithDefaults<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** A repository-bound set of Apiary operations. */
export interface Apiary {
  getSlots(
    input: WithDefaults<
      GetSlotsInput,
      "timeZone" | "durationMinutes" | "intervalMinutes"
    >,
  ): Promise<TimeSlot[]>;
  isRangeAvailable(
    input: WithDefaults<IsRangeAvailableInput, "timeZone">,
  ): Promise<boolean>;
  createHold(
    input: CreateHoldInput,
  ): Promise<{ holdToken: string; expiresAt: Date }>;
  confirmBooking(input: ConfirmBookingInput): Promise<{ bookingId: string }>;
}

function resolveRequired<T>(
  value: T | undefined,
  fallback: T | undefined,
  name: string,
): T {
  const resolved = value ?? fallback;
  if (resolved === undefined) {
    throw new ValidationError(`Missing required option "${name}"`);
  }
  return resolved;
}

/**
 * Bind a repository and defaults to the Apiary operations.
 *
 * ```ts
 * const apiary = createApiary({
 *   repository,
 *   defaults: { timeZone: "America/New_York", durationMinutes: 30, intervalMinutes: 15 },
 * });
 * const slots = await apiary.getSlots({ startDate, endDate });
 * ```
 */
export function createApiary(options: ApiaryOptions): Apiary {
  const { repository, defaults = {} } = options;

  return {
    async getSlots(input) {
      return getSlots(repository, {
        ...input,
        timeZone: resolveRequired(input.timeZone, defaults.timeZone, "timeZone"),
        durationMinutes: resolveRequired(
          input.durationMinutes,
          defaults.durationMinutes,
          "durationMinutes",
        ),
        intervalMinutes: resolveRequired(
          input.intervalMinutes,
          defaults.intervalMinutes,
          "intervalMinutes",
        ),
        buffers: input.buffers ?? defaults.buffers,
        minNoticeMinutes: input.minNoticeMinutes ?? defaults.minNoticeMinutes,
        maxHorizonMinutes: input.maxHorizonMinutes ?? defaults.maxHorizonMinutes,
        mode: input.mode ?? defaults.mode,
      });
    },
    isRangeAvailable(input) {
      return isRangeAvailable(repository, {
        ...input,
        timeZone: input.timeZone ?? defaults.timeZone,
        mode: input.mode ?? defaults.mode,
        buffers: input.buffers ?? defaults.buffers,
      });
    },
    createHold(input) {
      return createHold(repository, input);
    },
    confirmBooking(input) {
      return confirmBooking(repository, input);
    },
  };
}
