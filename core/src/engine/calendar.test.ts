import { describe, expect, it } from "vitest";
import {
  buildMonthMatrix,
  buildWeekMatrix,
  buildMultiWeekMatrix,
  buildMultiMonthMatrix,
} from "./calendar.js";

const toDateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("buildMonthMatrix", () => {
  it("always generates 6 weeks of 7 days (42 cells)", () => {
    const grid = buildMonthMatrix({ year: 2026, month: 1 });
    expect(grid).toHaveLength(6);
    for (const row of grid) expect(row).toHaveLength(7);
  });

  it("pads the leading days with the previous month", () => {
    // Jan 1 2026 is a Thursday; a Sunday-start week begins Dec 28 2025.
    const grid = buildMonthMatrix({ year: 2026, month: 1, weekStartsOn: 0 });
    expect(grid[0][0].isoString).toBe("2025-12-28");
    expect(grid[0][0].isCurrentMonth).toBe(false);
    expect(grid[0][0].isBlocked).toBe(true);
    expect(grid[0][0].blockReason).toBe("OUT_OF_BOUNDS");
  });

  it("supports a Monday-start week", () => {
    const grid = buildMonthMatrix({ year: 2026, month: 1, weekStartsOn: 1 });
    expect(grid[0][0].isoString).toBe("2025-12-29");
  });

  it("tags in-month cells as current month and unblocked", () => {
    const grid = buildMonthMatrix({ year: 2026, month: 1, weekStartsOn: 0 });
    const jan1 = grid[0][4];
    expect(jan1.isoString).toBe("2026-01-01");
    expect(jan1.isCurrentMonth).toBe(true);
    expect(jan1.isBlocked).toBe(false);
  });

  it("uses local date keys and marks today consistently", () => {
    const grid = buildMonthMatrix({ year: 2026, month: 1 });
    const todayKey = toDateKey(new Date());
    for (const cell of grid.flat()) {
      expect(cell.isoString).toBe(toDateKey(cell.date));
      expect(cell.isToday).toBe(cell.isoString === todayKey);
    }
  });
});

describe("buildWeekMatrix", () => {
  it("builds a Sunday-start week containing the target date", () => {
    // Jan 14 2026 is a Wednesday.
    const week = buildWeekMatrix({ targetDate: new Date(2026, 0, 14), weekStartsOn: 0 });
    expect(week).toHaveLength(7);
    expect(week[0].isoString).toBe("2026-01-11");
    expect(week[3].isoString).toBe("2026-01-14");
    for (const day of week) {
      expect(day.isCurrentMonth).toBe(true);
      expect(day.isBlocked).toBe(false);
    }
  });

  it("builds a Monday-start week when requested", () => {
    const week = buildWeekMatrix({ targetDate: new Date(2026, 0, 14), weekStartsOn: 1 });
    expect(week[0].isoString).toBe("2026-01-12");
  });

  it("flags days outside the target month as blocked", () => {
    // The week of Mon Nov 30 2026 spans into December.
    const week = buildWeekMatrix({ targetDate: new Date(2026, 10, 30), weekStartsOn: 1 });
    expect(week[0].isoString).toBe("2026-11-30");
    expect(week[0].isCurrentMonth).toBe(true);
    for (let i = 1; i < 7; i++) {
      expect(week[i].isCurrentMonth).toBe(false);
      expect(week[i].isBlocked).toBe(true);
      expect(week[i].blockReason).toBe("OUT_OF_BOUNDS");
    }
  });

  it("uses local date keys and marks today consistently", () => {
    const week = buildWeekMatrix({ targetDate: new Date(2026, 0, 14) });
    const todayKey = toDateKey(new Date());
    for (const day of week) {
      expect(day.isoString).toBe(toDateKey(day.date));
      expect(day.isToday).toBe(day.isoString === todayKey);
    }
  });
});

describe("buildMultiWeekMatrix", () => {
  it("builds boundary-aligned weeks over the requested range", () => {
    const weeks = buildMultiWeekMatrix({
      startDate: new Date(2026, 0, 14), // Wed Jan 14
      endDate: new Date(2026, 0, 20), // Tue Jan 20
      weekStartsOn: 1,
    });
    expect(weeks).toHaveLength(2);
    expect(weeks[0][0].isoString).toBe("2026-01-12");
    expect(weeks[1][0].isoString).toBe("2026-01-19");
  });

  it("flags days outside the requested range as blocked", () => {
    const weeks = buildMultiWeekMatrix({
      startDate: new Date(2026, 0, 14),
      endDate: new Date(2026, 0, 20),
      weekStartsOn: 1,
    });
    expect(weeks[0][0].isBlocked).toBe(true); // Jan 12
    expect(weeks[0][1].isBlocked).toBe(true); // Jan 13
    expect(weeks[0][2].isBlocked).toBe(false); // Jan 14
    expect(weeks[0][6].isBlocked).toBe(false); // Jan 18
    expect(weeks[1][0].isBlocked).toBe(false); // Jan 19
    expect(weeks[1][1].isBlocked).toBe(false); // Jan 20
    expect(weeks[1][6].isBlocked).toBe(true); // Jan 25
  });

  it("respects maxWeeksAllowed", () => {
    const weeks = buildMultiWeekMatrix({
      startDate: new Date(2026, 0, 1),
      endDate: new Date(2026, 2, 1),
      maxWeeksAllowed: 3,
      weekStartsOn: 0,
    });
    expect(weeks).toHaveLength(3);
  });

  it("uses local date keys and marks today consistently", () => {
    const weeks = buildMultiWeekMatrix({
      startDate: new Date(2026, 0, 14),
      endDate: new Date(2026, 0, 20),
    });
    const todayKey = toDateKey(new Date());
    for (const row of weeks) {
      for (const day of row) {
        expect(day.isoString).toBe(toDateKey(day.date));
        expect(day.isToday).toBe(day.isoString === todayKey);
      }
    }
  });
});

describe("buildMultiMonthMatrix", () => {
  it("returns one unit per month in the range", () => {
    const months = buildMultiMonthMatrix({
      startDate: new Date(2026, 0, 14),
      endDate: new Date(2026, 1, 10),
    });
    expect(months).toHaveLength(2);
    expect(months[0]).toMatchObject({ year: 2026, month: 1 });
    expect(months[1]).toMatchObject({ year: 2026, month: 2 });
    for (const unit of months) {
      expect(unit.grid).toHaveLength(6);
      for (const row of unit.grid) expect(row).toHaveLength(7);
    }
  });

  it("flags days before startDate and after endDate as blocked", () => {
    const months = buildMultiMonthMatrix({
      startDate: new Date(2026, 0, 14),
      endDate: new Date(2026, 1, 10),
      weekStartsOn: 0,
    });
    const jan = months[0].grid.flat();
    const jan13 = jan.find((c) => c.isoString === "2026-01-13")!;
    const jan14 = jan.find((c) => c.isoString === "2026-01-14")!;
    expect(jan13.isBlocked).toBe(true);
    expect(jan14.isBlocked).toBe(false);

    const feb = months[1].grid.flat();
    const feb10 = feb.find((c) => c.isoString === "2026-02-10")!;
    const feb11 = feb.find((c) => c.isoString === "2026-02-11")!;
    expect(feb10.isBlocked).toBe(false);
    expect(feb11.isBlocked).toBe(true);
  });

  it("blocks padding cells from adjacent months", () => {
    const months = buildMultiMonthMatrix({
      startDate: new Date(2026, 0, 14),
      endDate: new Date(2026, 0, 20),
    });
    for (const cell of months[0].grid.flat().filter((c) => !c.isCurrentMonth)) {
      expect(cell.isBlocked).toBe(true);
    }
  });

  it("respects maxMonthsAllowed", () => {
    const months = buildMultiMonthMatrix({
      startDate: new Date(2026, 0, 1),
      endDate: new Date(2026, 11, 1),
      maxMonthsAllowed: 4,
    });
    expect(months).toHaveLength(4);
    expect(months[3].month).toBe(4);
  });

  it("uses local date keys and marks today consistently", () => {
    const months = buildMultiMonthMatrix({
      startDate: new Date(2026, 0, 14),
      endDate: new Date(2026, 1, 10),
    });
    const todayKey = toDateKey(new Date());
    for (const unit of months) {
      for (const row of unit.grid) {
        for (const cell of row) {
          expect(cell.isoString).toBe(toDateKey(cell.date));
          expect(cell.isToday).toBe(cell.isoString === todayKey);
        }
      }
    }
  });
});
