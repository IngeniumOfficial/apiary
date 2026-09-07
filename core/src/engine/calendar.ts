export interface CalendarDay {
  date: Date;
  isoString: string; // YYYY-MM-DD
  dayOfMonth: number;
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  isBlocked: boolean;
  blockReason?: 'OUT_OF_BOUNDS' | 'CUSTOM_EXCLUSION' | 'PAST_DATE';
}

export type MonthGrid = CalendarDay[][]; // Array of weeks, each week is 7 days
export type WeekGrid = CalendarDay[];    // Single week of 7 days


export interface MonthGridOptions {
  year: number;
  month: number; // 1-indexed (1 = Jan, 12 = Dec)
  weekStartsOn?: 0 | 1; // 0 = Sunday, 1 = Monday
}

export function buildMonthMatrix(options: MonthGridOptions): MonthGrid {
  const { year, month, weekStartsOn = 0 } = options;
  const todayStr = new Date().toISOString().split('T')[0];

  // First day of target month (month is 0-indexed in JS Date constructor)
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0);

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
      const isoString = currentDate.toISOString().split('T')[0];
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
        blockReason: !isCurrentMonth ? 'OUT_OF_BOUNDS' : undefined,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    grid.push(weekRow);
  }

  return grid;
}


export interface WeekGridOptions {
  targetDate: Date;
  weekStartsOn?: 0 | 1; // 0 = Sunday, 1 = Monday
}

export function buildWeekMatrix(options: WeekGridOptions): WeekGrid {
  const { targetDate, weekStartsOn = 0 } = options;
  const todayStr = new Date().toISOString().split('T')[0];

  const startOfWeek = new Date(targetDate);
  let dayOffset = startOfWeek.getDay() - weekStartsOn;
  if (dayOffset < 0) dayOffset += 7;

  startOfWeek.setDate(startOfWeek.getDate() - dayOffset);

  const week: WeekGrid = [];
  const currentDate = new Date(startOfWeek);

  for (let i = 0; i < 7; i++) {
    const isoString = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay();

    week.push({
      date: new Date(currentDate),
      isoString,
      dayOfMonth: currentDate.getDate(),
      dayOfWeek,
      isCurrentMonth: true,
      isToday: isoString === todayStr,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isBlocked: false,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return week;
}