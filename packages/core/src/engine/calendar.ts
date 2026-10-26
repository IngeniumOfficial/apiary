export interface CalendarDay {
  /** JavaScript Date object representing the day at 00:00:00 local time */
  date: Date;
  /** Local date key formatted as YYYY-MM-DD for easy lookup */
  isoString: string;
  /** Day of the month (1-31) */
  dayOfMonth: number;
  /** Day of the week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday */
  dayOfWeek: number;
  /** Indicates whether the day belongs to the target month being rendered */
  isCurrentMonth: boolean;
  /** Indicates whether this day matches the current local system date */
  isToday: boolean;
  /** Indicates Saturday or Sunday */
  isWeekend: boolean;
  /** Flagged true if outside explicit view boundaries or explicitly blocked */
  isBlocked: boolean;
  /** Reason why the cell is blocked, if applicable */
  blockReason?: "OUT_OF_BOUNDS" | "CUSTOM_EXCLUSION" | "PAST_DATE";
}

export type MonthGrid = CalendarDay[][]; // Array of week rows, each week is 7 days
export type WeekGrid = CalendarDay[]; // Single week of 7 days

export interface MonthGridOptions {
  year: number;
  month: number; // 1-indexed (1 = Jan, 12 = Dec)
  weekStartsOn?: 0 | 1; // 0 = Sunday (default), 1 = Monday
}

export interface WeekGridOptions {
  targetDate: Date;
  weekStartsOn?: 0 | 1;
}

export interface MultiWeekViewOptions {
  startDate: Date;
  endDate: Date;
  maxWeeksAllowed?: number;
  weekStartsOn?: 0 | 1;
}

export interface MultiMonthViewOptions {
  startDate: Date;
  endDate: Date;
  maxMonthsAllowed?: number;
  weekStartsOn?: 0 | 1;
}

export interface MonthViewUnit {
  year: number;
  month: number; // 1-indexed
  grid: MonthGrid;
}

/**
 * Formats a date as a local YYYY-MM-DD key.
 */
const toDateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Builds a month grid matrix (6 weeks x 7 days) including leading
 * and trailing padding days from adjacent months.
 */
export function buildMonthMatrix(options: MonthGridOptions): MonthGrid {
  const { year, month, weekStartsOn = 0 } = options;
  const todayStr = toDateKey(new Date());

  // First day of target month (month is 0-indexed in JS Date constructor)
  const firstDayOfMonth = new Date(year, month - 1, 1);

  // Calculate leading padding days from previous month
  let startOffset = firstDayOfMonth.getDay() - weekStartsOn;
  if (startOffset < 0) startOffset += 7;

  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(startDate.getDate() - startOffset);

  const grid: MonthGrid = [];
  const currentDate = new Date(startDate);

  // Build 6 complete weeks (42 days) to guarantee uniform month layout
  for (let week = 0; week < 6; week++) {
    const weekRow: CalendarDay[] = [];

    for (let day = 0; day < 7; day++) {
      const isoString = toDateKey(currentDate);
      const isCurrentMonth = currentDate.getMonth() === month - 1;
      const dayOfWeek = currentDate.getDay();

      weekRow.push({
        date: new Date(currentDate),
        isoString,
        dayOfMonth: currentDate.getDate(),
        dayOfWeek,
        isCurrentMonth,
        isToday: isoString === todayStr,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isBlocked: !isCurrentMonth,
        blockReason: !isCurrentMonth ? "OUT_OF_BOUNDS" : undefined,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    grid.push(weekRow);
  }

  return grid;
}

/**
 * Builds a single 7-day array matrix for a specific target week.
 */
export function buildWeekMatrix(options: WeekGridOptions): WeekGrid {
  const { targetDate, weekStartsOn = 0 } = options;
  const todayStr = toDateKey(new Date());

  const startOfWeek = new Date(targetDate);
  let dayOffset = startOfWeek.getDay() - weekStartsOn;
  if (dayOffset < 0) dayOffset += 7;

  startOfWeek.setDate(startOfWeek.getDate() - dayOffset);

  const week: WeekGrid = [];
  const currentDate = new Date(startOfWeek);

  for (let i = 0; i < 7; i++) {
    const isoString = toDateKey(currentDate);
    const dayOfWeek = currentDate.getDay();
    const isCurrentMonth =
      currentDate.getFullYear() === targetDate.getFullYear() &&
      currentDate.getMonth() === targetDate.getMonth();

    week.push({
      date: new Date(currentDate),
      isoString,
      dayOfMonth: currentDate.getDate(),
      dayOfWeek,
      isCurrentMonth,
      isToday: isoString === todayStr,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isBlocked: !isCurrentMonth,
      blockReason: !isCurrentMonth ? "OUT_OF_BOUNDS" : undefined,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return week;
}

/**
 * Builds a multi-week matrix across a range of dates.
 * Days outside [startDate, endDate] inside boundary weeks are marked as blocked.
 */
export function buildMultiWeekMatrix(options: MultiWeekViewOptions): MonthGrid {
  const {
    startDate,
    endDate,
    maxWeeksAllowed = 12,
    weekStartsOn = 0,
  } = options;
  const todayStr = toDateKey(new Date());

  const cursor = new Date(startDate);
  let dayOffset = cursor.getDay() - weekStartsOn;
  if (dayOffset < 0) dayOffset += 7;
  cursor.setDate(cursor.getDate() - dayOffset);

  const weeks: MonthGrid = [];
  let weekCount = 0;

  const startMs = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
  ).getTime();
  const endMs = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate(),
  ).getTime();

  while (cursor.getTime() <= endMs && weekCount < maxWeeksAllowed) {
    const weekRow: CalendarDay[] = [];

    for (let i = 0; i < 7; i++) {
      const currentMs = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate(),
      ).getTime();
      const isoString = toDateKey(cursor);
      const dayOfWeek = cursor.getDay();

      const isOutOfBounds = currentMs < startMs || currentMs > endMs;

      weekRow.push({
        date: new Date(cursor),
        isoString,
        dayOfMonth: cursor.getDate(),
        dayOfWeek,
        isCurrentMonth: true,
        isToday: isoString === todayStr,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isBlocked: isOutOfBounds,
        blockReason: isOutOfBounds ? "OUT_OF_BOUNDS" : undefined,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    weeks.push(weekRow);
    weekCount++;
  }

  return weeks;
}

/**
 * Builds a multi-month matrix across a date range.
 * Days outside [startDate, endDate] are tagged as blocked cells.
 */
export function buildMultiMonthMatrix(
  options: MultiMonthViewOptions,
): MonthViewUnit[] {
  const {
    startDate,
    endDate,
    maxMonthsAllowed = 12,
    weekStartsOn = 0,
  } = options;

  const startMs = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
  ).getTime();
  const endMs = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate(),
  ).getTime();

  const months: MonthViewUnit[] = [];

  let currentYear = startDate.getFullYear();
  let currentMonth = startDate.getMonth() + 1;
  let monthCount = 0;

  const targetEndYear = endDate.getFullYear();
  const targetEndMonth = endDate.getMonth() + 1;

  while (
    (currentYear < targetEndYear ||
      (currentYear === targetEndYear && currentMonth <= targetEndMonth)) &&
    monthCount < maxMonthsAllowed
  ) {
    const baseGrid = buildMonthMatrix({
      year: currentYear,
      month: currentMonth,
      weekStartsOn,
    });

    const scopedGrid: MonthGrid = baseGrid.map((weekRow) =>
      weekRow.map((cell) => {
        const cellMs = new Date(
          cell.date.getFullYear(),
          cell.date.getMonth(),
          cell.date.getDate(),
        ).getTime();
        const isOutOfBounds =
          cellMs < startMs || cellMs > endMs || !cell.isCurrentMonth;

        return {
          ...cell,
          isBlocked: isOutOfBounds,
          blockReason: isOutOfBounds ? "OUT_OF_BOUNDS" : undefined,
        };
      }),
    );

    months.push({
      year: currentYear,
      month: currentMonth,
      grid: scopedGrid,
    });

    monthCount++;
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }

  return months;
}
