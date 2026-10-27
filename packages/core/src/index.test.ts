import { describe, expect, it } from "vitest";
import * as apiary from "./index.js";

describe("@apiary-dev/core public API", () => {
  it("exports the collision rules", () => {
    expect(typeof apiary.rangesOverlap).toBe("function");
    expect(typeof apiary.applyBufferToRange).toBe("function");
  });

  it("exports the slot generator", () => {
    expect(typeof apiary.generateTimeSlots).toBe("function");
  });

  it("exports the calendar builders", () => {
    expect(typeof apiary.buildMonthMatrix).toBe("function");
    expect(typeof apiary.buildWeekMatrix).toBe("function");
    expect(typeof apiary.buildMultiWeekMatrix).toBe("function");
    expect(typeof apiary.buildMultiMonthMatrix).toBe("function");
  });

  it("exports timezone utilities", () => {
    expect(typeof apiary.wallClockToUTC).toBe("function");
    expect(typeof apiary.utcToWallClock).toBe("function");
  });

  it("exports the weekly rules expansion", () => {
    expect(typeof apiary.expandWeeklyRules).toBe("function");
  });
});
