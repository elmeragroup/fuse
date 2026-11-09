/**
 * Unit under test: the calendar's date arithmetic. Oracles: React Aria's `react-stately` calendar
 * rules (`alignCenter`, `alignStart`, `alignEnd`, `constrainStart`, the page and section moves),
 * worked out by hand for each case and written as literal dates, and printed 2026 calendars.
 */
import { describe, expect, it } from "vitest";

import "../../temporal-polyfill";
import {
  canPage,
  clampDay,
  dayStatus,
  dayValidationError,
  focusMoveForKey,
  initialVisibleMonths,
  monthsShowing,
  movedDay,
  openView,
  pageTarget,
  startAlignedMonths,
  visibleMonthCount,
} from "./calendar-dates";
import type { DayBounds, FocusMove, VisibleMonths } from "./calendar-dates";

const day = (iso: string) => Temporal.PlainDate.from(iso);
const months = (start: string, count: number): VisibleMonths => ({
  start: Temporal.PlainYearMonth.from(start),
  count,
});
const NO_BOUNDS: DayBounds = { min: undefined, max: undefined };
const OCTOBER_10_TO_20: DayBounds = { min: day("2026-10-10"), max: day("2026-10-20") };

function printed(visible: VisibleMonths): string {
  return `${visible.start.toString()}+${String(visible.count)}`;
}

describe("movedDay", () => {
  it.each<[FocusMove, string]>([
    ["previous-day", "2026-10-13"],
    ["next-day", "2026-10-15"],
    ["previous-week", "2026-10-07"],
    ["next-week", "2026-10-21"],
    ["month-start", "2026-10-01"],
    ["month-end", "2026-10-31"],
    ["previous-month", "2026-09-14"],
    ["next-month", "2026-11-14"],
    ["previous-year", "2025-10-14"],
    ["next-year", "2027-10-14"],
  ])("moves from October 14, 2026 with %s to %s", (move, expected) => {
    expect(movedDay(day("2026-10-14"), move).toString()).toBe(expected);
  });

  it("steps a month back from October 31 to September's last day", () => {
    expect(movedDay(day("2026-10-31"), "previous-month").toString()).toBe("2026-09-30");
  });

  it("steps a year on from a leap day to February 28", () => {
    expect(movedDay(day("2028-02-29"), "next-year").toString()).toBe("2029-02-28");
  });
});

describe("focusMoveForKey", () => {
  it.each([
    ["ArrowLeft", false, "ltr", "previous-day"],
    ["ArrowRight", false, "ltr", "next-day"],
    ["ArrowLeft", false, "rtl", "next-day"],
    ["ArrowRight", false, "rtl", "previous-day"],
    ["ArrowUp", false, "ltr", "previous-week"],
    ["ArrowDown", false, "rtl", "next-week"],
    ["Home", false, "ltr", "month-start"],
    ["End", false, "ltr", "month-end"],
    ["PageUp", false, "ltr", "previous-month"],
    ["PageUp", true, "ltr", "previous-year"],
    ["PageDown", false, "ltr", "next-month"],
    ["PageDown", true, "ltr", "next-year"],
    ["Tab", false, "ltr", undefined],
    ["ArrowLeft", true, "ltr", undefined],
    ["ArrowDown", true, "ltr", undefined],
    ["Home", true, "ltr", undefined],
    ["End", true, "rtl", undefined],
  ] as const)("reads %s (Shift %s, %s) as %s", (key, shift, direction, expected) => {
    expect(focusMoveForKey(key, shift, () => direction)).toBe(expected);
  });

  it("reads the writing direction only for Arrow Left and Right", () => {
    const asked: string[] = [];
    for (const key of ["ArrowUp", "Home", "PageDown", "Tab", "ArrowRight"]) {
      focusMoveForKey(key, false, () => {
        asked.push(key);
        return "ltr";
      });
    }
    expect(asked).toEqual(["ArrowRight"]);
  });
});

describe("dayValidationError", () => {
  const unavailableOn15th = (date: Temporal.PlainDate) => date.day === 15;

  it.each([
    ["2026-10-09", "rangeUnderflow"],
    ["2026-10-10", null],
    ["2026-10-15", "unavailable"],
    ["2026-10-20", null],
    ["2026-10-21", "rangeOverflow"],
  ] as const)("judges %s against October 10–20 with the 15th unavailable as %s", (input, expected) => {
    expect(
      dayValidationError(day(input), { bounds: OCTOBER_10_TO_20, isDateUnavailable: unavailableOn15th })
    ).toBe(expected);
  });

  it("asks isDateUnavailable only about days inside the bounds", () => {
    const asked: string[] = [];
    const rules = {
      bounds: OCTOBER_10_TO_20,
      isDateUnavailable: (date: Temporal.PlainDate) => {
        asked.push(date.toString());
        return true;
      },
    };
    expect(dayValidationError(day("2026-11-15"), rules)).toBe("rangeOverflow");
    expect(dayValidationError(day("2026-10-15"), rules)).toBe("unavailable");
    expect(asked).toEqual(["2026-10-15"]);
  });
});

describe("dayStatus", () => {
  const settings = {
    bounds: OCTOBER_10_TO_20,
    isDateUnavailable: (date: Temporal.PlainDate) => date.day === 15,
    disabled: false,
  };

  it.each([
    ["an out-of-bounds day", "2026-10-09", false, false, { disabled: true, unavailable: false }],
    ["an unavailable day", "2026-10-15", false, false, { disabled: false, unavailable: true }],
    ["a selectable day", "2026-10-14", false, false, { disabled: false, unavailable: false }],
    ["a neighbouring month's day", "2026-10-15", true, false, { disabled: true, unavailable: false }],
    ["a day of a disabled calendar", "2026-10-14", false, true, { disabled: true, unavailable: false }],
  ] as const)("marks %s", (_case, input, outsideMonth, disabled, expected) => {
    expect(dayStatus(day(input), outsideMonth, { ...settings, disabled })).toEqual(expected);
  });
});

describe("openView", () => {
  it("clamps the day to the bounds and ends the view on the maximum's month", () => {
    const opened = openView(day("2026-12-25"), 3, OCTOBER_10_TO_20);
    expect(opened.focused.toString()).toBe("2026-10-20");
    expect(printed(opened.visible)).toBe("2026-08+3");
  });

  it("centres three months on a day the bounds leave alone", () => {
    const opened = openView(day("2026-10-14"), 3, NO_BOUNDS);
    expect(opened.focused.toString()).toBe("2026-10-14");
    expect(printed(opened.visible)).toBe("2026-09+3");
  });
});

describe("clampDay", () => {
  it.each([
    ["2026-10-01", "2026-10-10"],
    ["2026-10-14", "2026-10-14"],
    ["2026-10-31", "2026-10-20"],
  ])("pulls %s into October 10–20 as %s", (input, expected) => {
    expect(clampDay(day(input), OCTOBER_10_TO_20).toString()).toBe(expected);
  });
});

describe("initialVisibleMonths", () => {
  it.each([
    [1, "2026-10+1"],
    [2, "2026-10+2"],
    [3, "2026-09+3"],
    [4, "2026-09+4"],
  ])("centres October with %i months as %s", (count, expected) => {
    expect(printed(initialVisibleMonths(day("2026-10-14"), count, NO_BOUNDS))).toBe(expected);
  });

  it("starts no earlier than the minimum's month", () => {
    const bounds: DayBounds = { min: day("2026-10-10"), max: undefined };
    expect(printed(initialVisibleMonths(day("2026-10-14"), 3, bounds))).toBe("2026-10+3");
  });

  it("ends no later than the maximum's month", () => {
    const bounds: DayBounds = { min: undefined, max: day("2026-11-05") };
    expect(printed(initialVisibleMonths(day("2026-11-01"), 3, bounds))).toBe("2026-09+3");
  });
});

describe("startAlignedMonths", () => {
  it.each([
    [1, "2026-10+1"],
    [2, "2026-10+2"],
    [3, "2026-10+3"],
  ])("puts October first with %i months as %s", (count, expected) => {
    expect(printed(startAlignedMonths(day("2026-10-14"), count, NO_BOUNDS))).toBe(expected);
  });

  it("ends no later than the maximum's month", () => {
    const bounds: DayBounds = { min: undefined, max: day("2026-11-05") };
    expect(printed(startAlignedMonths(day("2026-10-14"), 3, bounds))).toBe("2026-09+3");
  });
});

describe("monthsShowing", () => {
  const view = months("2026-09", 3);

  it("keeps the view while the day shows", () => {
    expect(monthsShowing(view, day("2026-11-30"), "visible", NO_BOUNDS)).toBe(view);
  });

  it.each([
    ["visible", "2026-12-01", "2026-12+3"],
    ["visible", "2026-08-31", "2026-06+3"],
    ["single", "2026-12-01", "2026-10+3"],
    ["single", "2026-08-31", "2026-08+3"],
  ] as const)("pages by %s to show %s as %s", (behavior, target, expected) => {
    expect(printed(monthsShowing(view, day(target), behavior, NO_BOUNDS))).toBe(expected);
  });
});

describe("canPage", () => {
  it.each([
    [1, "2026-10-31", false],
    [1, "2026-11-01", true],
  ] as const)("pages forward from October with a maximum of %s: %s", (step, max, expected) => {
    expect(canPage(months("2026-10", 1), step, { min: undefined, max: day(max) })).toBe(expected);
  });

  it.each([
    ["2026-10-01", false],
    ["2026-09-30", true],
  ])("pages back from October with a minimum of %s: %s", (min, expected) => {
    expect(canPage(months("2026-10", 1), -1, { min: day(min), max: undefined })).toBe(expected);
  });

  it("pages forward from a three-month view only when the month after its last has a selectable day", () => {
    const bounds: DayBounds = { min: undefined, max: day("2026-12-01") };
    expect(canPage(months("2026-09", 3), 1, bounds)).toBe(true);
    expect(canPage(months("2026-10", 3), 1, bounds)).toBe(false);
  });
});

describe("pageTarget", () => {
  it("moves one month and the focused day with it", () => {
    const target = pageTarget(months("2026-10", 1), day("2026-10-14"), 1, 1, NO_BOUNDS);
    expect([printed(target.visible), target.focused.toString()]).toEqual(["2026-11+1", "2026-11-14"]);
  });

  it("moves every visible month at once", () => {
    const target = pageTarget(months("2026-09", 3), day("2026-10-14"), -1, 3, NO_BOUNDS);
    expect([printed(target.visible), target.focused.toString()]).toEqual(["2026-06+3", "2026-07-14"]);
  });

  it("stops the view at the maximum's month and clamps the focused day to the maximum", () => {
    const bounds: DayBounds = { min: undefined, max: day("2026-11-15") };
    const target = pageTarget(months("2026-08", 3), day("2026-10-14"), 1, 3, bounds);
    expect([printed(target.visible), target.focused.toString()]).toEqual(["2026-09+3", "2026-11-15"]);
  });

  it("clamps the focused day to the minimum on a page into its month", () => {
    const bounds: DayBounds = { min: day("2026-09-20"), max: undefined };
    const target = pageTarget(months("2026-10", 1), day("2026-10-14"), -1, 1, bounds);
    expect([printed(target.visible), target.focused.toString()]).toEqual(["2026-09+1", "2026-09-20"]);
  });
});

describe("visibleMonthCount", () => {
  it.each([
    [1, 1],
    [3, 3],
    [2.9, 2],
    [1.5, 1],
    [0, 1],
    [-2, 1],
    [Number.NaN, 1],
    [Number.POSITIVE_INFINITY, 1],
  ])("shows %d as %i months", (requested, expected) => {
    expect(visibleMonthCount(requested)).toBe(expected);
  });
});
