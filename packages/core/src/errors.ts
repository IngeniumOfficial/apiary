/**
 * Thrown when a requested time range overlaps an existing booking or hold.
 */
export class BookingConflictError extends Error {
  constructor(
    message = "Requested slot overlaps an existing booking or hold",
  ) {
    super(message);
    this.name = "BookingConflictError";
  }
}

/**
 * Thrown when operation input is missing or invalid.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
