export interface WallClockTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

// Converts a wall-clock target in a specific IANA timezone into an exact UTC Date
/**
 *
 * @param {WallClockTime} wallClock - Wall clock target
 * @param {string} timeZone - IANA timezone
 * @returns - Exact UTC Date
 */
export const wallClockToUTC = (
  wallClock: WallClockTime,
  timeZone: string,
): Date => {
  const pad = (n: number) => String(n).padStart(2, "0");

  // Format into ISO format without offset
  const isoStr = `${wallClock.year}-${pad(wallClock.month)}-${pad(wallClock.day)}T${pad(wallClock.hour)}:${pad(wallClock.minute)}:00`;

  // Create a formatter pinned to the target timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // Target date estimation loop to resolve exact UTC timestamp
  const utcGuess = new Date(`${isoStr}Z`);
  const parts = Object.fromEntries(
    formatter.formatToParts(utcGuess).map((p) => [p.type, p.value]),
  );

  const localHeader = `${parts.year}-${parts.month}-${parts.day}T${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}:${parts.second}`;
  const diffMs =
    new Date(`${isoStr}Z`).getTime() - new Date(`${localHeader}Z`).getTime();

  return new Date(utcGuess.getTime() + diffMs);
};
