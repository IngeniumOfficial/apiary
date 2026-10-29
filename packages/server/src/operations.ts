import type {
  AvailableWindow,
  BookingRepository,
  TimeRange,
  TimeSlot,
} from "@apiary-dev/core";
import {
  ValidationError,
  applyBufferToRange,
  generateTimeSlots,
  rangesOverlap,
} from "@apiary-dev/core";
import type {
  ConfirmBookingInput,
  CreateHoldInput,
  GetSlotsInput,
  IsRangeAvailableInput,
} from "./types.js";

interface AvailabilityData {
  windows: AvailableWindow[];
  bookings: TimeRange[];
}

async function fetchAvailability(
  repository: BookingRepository,
  params: {
    startDate: Date;
    endDate: Date;
    timeZone: string;
    providerId?: string;
    mode?: "dynamic" | "explicit";
  },
): Promise<AvailabilityData> {
  const [windows, bookings] = await Promise.all([
    repository.getAvailableWindows({
      startDate: params.startDate,
      endDate: params.endDate,
      providerId: params.providerId,
      mode: params.mode ?? "dynamic",
      timeZone: params.timeZone,
    }),
    repository.getBookingsInRange(
      params.startDate,
      params.endDate,
      params.providerId,
    ),
  ]);

  return { windows, bookings };
}

/**
 * Fetch availability for a range and carve it into candidate slots.
 *
 * Both repository reads use the same range/provider, so windows and existing
 * bookings can never drift apart.
 */
export async function getSlots(
  repository: BookingRepository,
  input: GetSlotsInput,
): Promise<TimeSlot[]> {
  const { windows, bookings } = await fetchAvailability(repository, input);

  return generateTimeSlots(
    {
      windows,
      existingBookings: bookings,
      durationMinutes: input.durationMinutes,
      intervalMinutes: input.intervalMinutes,
      buffers: input.buffers,
      minNoticeMinutes: input.minNoticeMinutes,
      maxHorizonMinutes: input.maxHorizonMinutes,
    },
    input.now,
  );
}

/**
 * Determine whether an exact range is bookable: no overlapping booking/hold
 * and (by default) fully inside an availability window.
 */
export async function isRangeAvailable(
  repository: BookingRepository,
  input: IsRangeAvailableInput,
): Promise<boolean> {
  const candidate = applyBufferToRange(input.range, input.buffers);

  const bookings = await repository.getBookingsInRange(
    input.range.start,
    input.range.end,
    input.providerId,
  );

  const collides = bookings
    .map((booking) => applyBufferToRange(booking, input.buffers))
    .some((booking) => rangesOverlap(candidate, booking));

  if (collides) return false;
  if (input.checkWindows === false) return true;

  if (!input.timeZone) {
    throw new ValidationError(
      'timeZone is required when checkWindows is enabled (pass checkWindows: false to skip window checks)',
    );
  }

  const windows = await repository.getAvailableWindows({
    startDate: input.range.start,
    endDate: input.range.end,
    providerId: input.providerId,
    mode: input.mode ?? "dynamic",
    timeZone: input.timeZone,
  });

  return windows.some(
    (window) =>
      window.start.getTime() <= candidate.start.getTime() &&
      window.end.getTime() >= candidate.end.getTime(),
  );
}

/** Create an atomic hold through the repository. */
export async function createHold(
  repository: BookingRepository,
  input: CreateHoldInput,
): Promise<{ holdToken: string; expiresAt: Date }> {
  return repository.createHold(input);
}

/** Confirm a hold into a booking through the repository. */
export async function confirmBooking(
  repository: BookingRepository,
  input: ConfirmBookingInput,
): Promise<{ bookingId: string }> {
  return repository.confirmBooking(input);
}
