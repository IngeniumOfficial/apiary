import type { AvailableWindow } from "../types/index.js";
import type { WallClockTime } from "./timezone.js";
import { utcToWallClock, wallClockToUTC } from "./timezone.js";

/**
 * Day of the week following JavaScript's Date#getDay() convention:
 * 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A single weekly recurring operating rule expressed in local wall-clock time. */
export interface WeeklyRule {
  dayOfWeek: DayOfWeek;
  /** Local wall-clock start, 24-hour "HH:mm" */
  startTime: string;
  /** Local wall-clock end, 24-hour "HH:mm". Must be strictly after startTime. */
  endTime: string;
}

export interface WeeklyAvailabilityOptions {
  /** Weekly rules to expand into windows */
  rules: WeeklyRule[];
  /** Query range start (inclusive), in UTC */
  startDate: Date;
  /** Query range end (exclusive), in UTC */
  endDate: Date;
  /** IANA timezone the rules are expressed in */
  timeZone: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const parseTime = (time: string): { hour: number; minute: number } => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) {
    throw new Error(`Invalid time "${time}" — expected 24-hour "HH:mm".`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new Error(`Invalid time "${time}" — hour/minute out of range.`);
  }
  return { hour, minute };
};

const weekdayOf = (wallClock: WallClockTime): number =>
  new Date(wallClock.year, wallClock.month - 1, wallClock.day).getDay();

/**
 * Expands weekly recurring rules into concrete windows within [startDate, endDate].
 *
 * Rules are expressed in local wall-clock time; windows are converted to UTC and
 * clipped to the requested range. DST transitions are handled per-day via Intl,
 * and duplicate windows (e.g. around a fall-back transition) are collapsed.
 *
 * @throws If a rule has an invalid time string or an overnight span (endTime <= startTime).
 */
export function expandWeeklyRules(
  options: WeeklyAvailabilityOptions,
): AvailableWindow[] {
  const { rules, startDate, endDate, timeZone } = options;

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  if (endMs <= startMs) return [];

  const parsedRules = rules.map((rule) => {
    const start = parseTime(rule.startTime);
    const end = parseTime(rule.endTime);
    if (end.hour * 60 + end.minute <= start.hour * 60 + start.minute) {
      throw new Error(
        `Rule on day ${rule.dayOfWeek} must have endTime strictly after startTime (overnight spans are not supported).`,
      );
    }
    return { dayOfWeek: rule.dayOfWeek, start, end };
  });

  // Iterate over UTC days covering the range. A rule's wall-clock date may map to
  // a different UTC day than the one it appears on (e.g. UTC midnight is the
  // previous evening in America/New_York), so walk one extra day and clip.
  const firstUtcDayMs = startMs - (startMs % DAY_MS);
  const lastUtcDayMs = endMs - (endMs % DAY_MS) + DAY_MS;

  const windows: AvailableWindow[] = [];

  for (let t = firstUtcDayMs; t <= lastUtcDayMs; t += DAY_MS) {
    const wallClock = utcToWallClock(new Date(t), timeZone);
    const weekday = weekdayOf(wallClock);

    for (const rule of parsedRules) {
      if (rule.dayOfWeek !== weekday) continue;

      const windowStart = wallClockToUTC(
        { ...wallClock, hour: rule.start.hour, minute: rule.start.minute },
        timeZone,
      );
      const windowEnd = wallClockToUTC(
        { ...wallClock, hour: rule.end.hour, minute: rule.end.minute },
        timeZone,
      );

      const clippedStart = Math.max(windowStart.getTime(), startMs);
      const clippedEnd = Math.min(windowEnd.getTime(), endMs);

      if (clippedEnd > clippedStart) {
        windows.push({
          start: new Date(clippedStart),
          end: new Date(clippedEnd),
        });
      }
    }
  }

  windows.sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime(),
  );

  const seen = new Set<string>();
  const result: AvailableWindow[] = [];
  for (const window of windows) {
    const key = `${window.start.getTime()}:${window.end.getTime()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(window);
  }

  return result;
}
