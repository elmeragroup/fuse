/**
 * Unit under test: RangeCalendar's pure range rules. Oracles: React Aria's `useRangeCalendarState`
 * (`makeRange`, `nextUnavailableDate`, `previousAvailableDate`, `selectDate`, `commitSelection`,
 * `isInvalidSelection`) and the keyboard step of `useCalendarCell`, worked out by hand for each case
 * against a printed 2026 calendar and written as literal dates.
 */
import { describe, expect, it } from "vitest";

import "../../temporal-polyfill";
import { dayFlagState } from "../calendar/calendar-context";
import type { CalendarDayFlag, CalendarDayFlagState, CalendarDayFlags } from "../calendar/calendar-context";
import type { DayBounds } from "../calendar/calendar-dates";
import {
  anchoredBounds,
  commitRange,
  namesRange,
  orderedRange,
  pressDay,
  rangeDayFlags,
  rangeDayPlace,
  rangeValidationError,
  rangeView,
} from "./range-selection";
import type { DayRange, RangePress, RangeRules, RangeView } from "./range-selection";

const day = (iso: string) => Temporal.PlainDate.from(iso);
const NO_BOUNDS: DayBounds = { min: undefined, max: undefined };

function printed(range: DayRange | null): string | null {
  return range === null ? null : `${range.start.toString()}..${range.end.toString()}`;
}

function printedBounds(bounds: DayBounds): string {
  return `${bounds.min?.toString() ?? "-"}..${bounds.max?.toString() ?? "-"}`;
}

function printedPress(press: RangePress): string {
  switch (press.kind) {
    case "anchored":
      return `anchored ${press.anchor.toString()} focus ${press.focus.toString()} within ${printedBounds(press.bounds)}`;
    case "completed":
      return `completed ${String(printed(press.range))}`;
  }
}

/** October 2026 with the 10th, 17th and 24th unavailable (all Saturdays). */
const SATURDAYS = new Set(["2026-10-10", "2026-10-17", "2026-10-24"]);
const saturdaysUnavailable: RangeRules = {
  bounds: NO_BOUNDS,
  isDateUnavailable: (date) => SATURDAYS.has(date.toString()),
  visibleMonths: 1,
};
const plain: RangeRules = { bounds: NO_BOUNDS, isDateUnavailable: undefined, visibleMonths: 1 };
const OCTOBER_1 = day("2026-10-01");

describe("orderedRange", () => {
  it("orders a range chosen backwards earlier day first", () => {
    expect(printed(orderedRange(day("2026-10-14"), day("2026-10-12")))).toBe("2026-10-12..2026-10-14");
    expect(printed(orderedRange(day("2026-10-12"), day("2026-10-12")))).toBe("2026-10-12..2026-10-12");
  });
});

describe("anchoredBounds", () => {
  it("narrows to the available run around the anchor", () => {
    expect(printedBounds(anchoredBounds(saturdaysUnavailable, day("2026-10-13")))).toBe(
      "2026-10-11..2026-10-16"
    );
  });

  it("keeps a Root bound tighter than the run", () => {
    const rules = { ...saturdaysUnavailable, bounds: { min: day("2026-10-12"), max: day("2026-10-15") } };
    expect(printedBounds(anchoredBounds(rules, day("2026-10-13")))).toBe("2026-10-12..2026-10-15");
  });

  it("looks only visibleMonths months each way, leaving a side open past that", () => {
    const rules: RangeRules = {
      bounds: NO_BOUNDS,
      isDateUnavailable: (date) => date.toString() === "2026-12-20",
      visibleMonths: 1,
    };
    // From November 20 the look runs to December 20, which is unavailable.
    expect(printedBounds(anchoredBounds(rules, day("2026-11-20")))).toBe("-..2026-12-19");
    // React Aria also tests the first day past the look: from November 19 that is December 20.
    expect(printedBounds(anchoredBounds(rules, day("2026-11-19")))).toBe("-..2026-12-19");
    // From November 18 the look ends December 18 and the day past it, December 19, is available.
    expect(printedBounds(anchoredBounds(rules, day("2026-11-18")))).toBe("-..-");
    expect(printedBounds(anchoredBounds({ ...rules, visibleMonths: 2 }, day("2026-11-18")))).toBe(
      "-..2026-12-19"
    );
  });

  it("asks isDateUnavailable with the anchor", () => {
    const asked: string[] = [];
    const rules: RangeRules = {
      bounds: NO_BOUNDS,
      isDateUnavailable: (date, anchor) => {
        asked.push(String(anchor?.toString()));
        return anchor !== null && Temporal.PlainDate.compare(date, anchor.add({ days: 3 })) > 0;
      },
      visibleMonths: 1,
    };
    expect(printedBounds(anchoredBounds(rules, day("2026-10-13")))).toBe("-..2026-10-16");
    expect(new Set(asked)).toEqual(new Set(["2026-10-13"]));
  });

  it("is the Root's bounds without isDateUnavailable", () => {
    const bounds = { min: day("2026-10-02"), max: day("2026-10-30") };
    expect(printedBounds(anchoredBounds({ ...plain, bounds }, day("2026-10-13")))).toBe(
      "2026-10-02..2026-10-30"
    );
  });
});

describe("pressDay", () => {
  it("anchors a pointer press on the pressed day", () => {
    expect(printedPress(pressDay(null, day("2026-10-12"), plain, false))).toBe(
      "anchored 2026-10-12 focus 2026-10-12 within -..-"
    );
  });

  it("anchors a key press and moves focus on a day, or back one before an unavailable day", () => {
    expect(printedPress(pressDay(null, day("2026-10-12"), plain, true))).toBe(
      "anchored 2026-10-12 focus 2026-10-13 within -..-"
    );
    expect(printedPress(pressDay(null, day("2026-10-16"), saturdaysUnavailable, true))).toBe(
      "anchored 2026-10-16 focus 2026-10-15 within 2026-10-11..2026-10-16"
    );
  });

  it("completes from the anchor, swapping a range chosen backwards", () => {
    expect(printedPress(pressDay(day("2026-10-12"), day("2026-10-14"), plain, false))).toBe(
      "completed 2026-10-12..2026-10-14"
    );
    expect(printedPress(pressDay(day("2026-10-14"), day("2026-10-12"), plain, true))).toBe(
      "completed 2026-10-12..2026-10-14"
    );
    expect(printedPress(pressDay(day("2026-10-12"), day("2026-10-12"), plain, false))).toBe(
      "completed 2026-10-12..2026-10-12"
    );
  });

  it("keeps a key anchor's focus on the day before at the upper bound, and on the anchor when both neighbours are out", () => {
    const upTo16: RangeRules = { ...plain, bounds: { min: undefined, max: day("2026-10-16") } };
    expect(printedPress(pressDay(null, day("2026-10-16"), upTo16, true))).toBe(
      "anchored 2026-10-16 focus 2026-10-15 within -..2026-10-16"
    );
    const only16: RangeRules = { ...plain, bounds: { min: day("2026-10-16"), max: day("2026-10-16") } };
    expect(printedPress(pressDay(null, day("2026-10-16"), only16, true))).toBe(
      "anchored 2026-10-16 focus 2026-10-16 within 2026-10-16..2026-10-16"
    );
  });
});

describe("commitRange", () => {
  it("selects the anchor to the focused day, or drops the anchor on reset", () => {
    expect(printed(commitRange(day("2026-10-12"), day("2026-10-09"), plain, OCTOBER_1, "select"))).toBe(
      "2026-10-09..2026-10-12"
    );
    expect(commitRange(day("2026-10-12"), day("2026-10-09"), plain, OCTOBER_1, "reset")).toBeNull();
  });

  it("selects no further than the anchor's available run", () => {
    expect(
      printed(commitRange(day("2026-10-13"), day("2026-10-28"), saturdaysUnavailable, OCTOBER_1, "select"))
    ).toBe("2026-10-13..2026-10-16");
  });

  it("pulls a focused day past the Root's bounds in to the nearest bound", () => {
    const rules: RangeRules = { ...plain, bounds: { min: undefined, max: day("2026-10-25") } };
    expect(printed(commitRange(day("2026-10-20"), day("2026-10-31"), rules, OCTOBER_1, "select"))).toBe(
      "2026-10-20..2026-10-25"
    );
  });

  it("walks a focused unavailable day past the anchored look back to the first available one", () => {
    // From October 1 one month's look ends November 1, so December 24 does not narrow the range.
    const rules: RangeRules = {
      bounds: NO_BOUNDS,
      isDateUnavailable: (date) => date.toString() === "2026-12-24",
      visibleMonths: 1,
    };
    expect(printed(commitRange(OCTOBER_1, day("2026-12-24"), rules, day("2026-12-01"), "select"))).toBe(
      "2026-10-01..2026-12-23"
    );
  });

  it("drops the anchor when every day back to the first visible day is unavailable", () => {
    const rules: RangeRules = { ...plain, isDateUnavailable: () => true };
    expect(commitRange(day("2026-10-12"), day("2026-10-14"), rules, day("2026-10-12"), "select")).toBeNull();
  });
});

describe("rangeDayPlace", () => {
  const range = { start: day("2026-10-05"), end: day("2026-10-09") };

  it("places each day in a range", () => {
    expect(
      ["2026-10-04", "2026-10-05", "2026-10-07", "2026-10-09", "2026-10-10"].map((iso) =>
        rangeDayPlace(day(iso), range)
      )
    ).toEqual(["none", "start", "middle", "end", "none"]);
  });

  it("places a one-day range's day at both ends, and every day outside no range", () => {
    expect(rangeDayPlace(day("2026-10-05"), { start: day("2026-10-05"), end: day("2026-10-05") })).toBe(
      "start-end"
    );
    expect(rangeDayPlace(day("2026-10-05"), null)).toBe("none");
  });
});

describe("rangeView", () => {
  const value = { start: day("2026-10-05"), end: day("2026-10-09") };
  const bounded: RangeRules = { ...plain, bounds: { min: day("2026-10-06"), max: undefined } };

  it("shows the range being chosen while an anchor stands, never invalid", () => {
    const view = rangeView({ anchor: day("2026-10-14"), focused: day("2026-10-12"), value }, bounded);
    expect(printed(view.range)).toBe("2026-10-12..2026-10-14");
    expect([view.choosing, view.invalid]).toEqual([true, false]);
  });

  it("shows the anchor alone while an anchor stands with no focused day", () => {
    const view = rangeView({ anchor: day("2026-10-12"), focused: null, value }, plain);
    expect(printed(view.range)).toBe("2026-10-12..2026-10-12");
    expect(view.choosing).toBe(true);
  });

  it("shows the value with no anchor, invalid when it fails the rules", () => {
    const valid = rangeView({ anchor: null, focused: day("2026-10-20"), value }, plain);
    expect(printed(valid.range)).toBe("2026-10-05..2026-10-09");
    expect([valid.choosing, valid.invalid]).toEqual([false, false]);
    expect(rangeView({ anchor: null, focused: day("2026-10-20"), value }, bounded).invalid).toBe(true);
    expect(rangeView({ anchor: null, focused: null, value: null }, bounded)).toEqual({
      range: null,
      choosing: false,
      invalid: false,
    });
  });
});

describe("rangeDayFlags", () => {
  const ALL: readonly (readonly [CalendarDayFlag, keyof CalendarDayFlagState])[] = [
    ["selected", "selected"],
    ["selection-start", "selectionStart"],
    ["selection-end", "selectionEnd"],
    ["in-range", "inRange"],
    ["highlighted", "highlighted"],
    ["invalid", "invalid"],
  ];
  const held = (flags: CalendarDayFlags) => {
    const state = dayFlagState(flags);
    return ALL.filter(([, field]) => state[field]).map(([flag]) => flag);
  };
  const view = (start: string, end: string, choosing: boolean, invalid: boolean): RangeView => ({
    range: { start: day(start), end: day(end) },
    choosing,
    invalid,
  });
  const saturday = (date: Temporal.PlainDate) => date.dayOfWeek === 6;

  it("marks a value's days selected and in range, and its ends", () => {
    const value = view("2026-10-05", "2026-10-09", false, false);
    expect(held(rangeDayFlags(value, day("2026-10-04"), undefined))).toEqual([]);
    expect(held(rangeDayFlags(value, day("2026-10-05"), undefined))).toEqual([
      "selected",
      "selection-start",
      "in-range",
    ]);
    expect(held(rangeDayFlags(value, day("2026-10-07"), undefined))).toEqual(["selected", "in-range"]);
    expect(held(rangeDayFlags(value, day("2026-10-09"), undefined))).toEqual([
      "selected",
      "selection-end",
      "in-range",
    ]);
    expect(
      held(rangeDayFlags(view("2026-10-05", "2026-10-05", false, false), day("2026-10-05"), undefined))
    ).toEqual(["selected", "selection-start", "selection-end", "in-range"]);
  });

  it("highlights a range being chosen and marks every day of an invalid value", () => {
    expect(
      held(rangeDayFlags(view("2026-10-05", "2026-10-09", true, false), day("2026-10-07"), undefined))
    ).toEqual(["selected", "in-range", "highlighted"]);
    expect(
      held(rangeDayFlags(view("2026-10-05", "2026-10-09", false, true), day("2026-10-09"), undefined))
    ).toEqual(["selected", "selection-end", "in-range", "invalid"]);
  });

  it("leaves an unavailable day of a valid range unselected, and keeps it in an invalid one", () => {
    // October 10, 2026 is a Saturday.
    expect(
      held(rangeDayFlags(view("2026-10-05", "2026-10-12", false, false), day("2026-10-10"), saturday))
    ).toEqual([]);
    expect(
      held(rangeDayFlags(view("2026-10-05", "2026-10-12", false, true), day("2026-10-10"), saturday))
    ).toEqual(["selected", "in-range", "invalid"]);
  });
});

describe("namesRange", () => {
  it("names the range on a value's ends only, and on no day of a range being chosen", () => {
    const value: RangeView = {
      range: { start: day("2026-10-05"), end: day("2026-10-09") },
      choosing: false,
      invalid: false,
    };
    expect(["2026-10-05", "2026-10-07", "2026-10-09"].map((iso) => namesRange(value, day(iso)))).toEqual([
      true,
      false,
      true,
    ]);
    expect(namesRange({ ...value, choosing: true }, day("2026-10-05"))).toBe(false);
  });
});

describe("rangeValidationError", () => {
  it("checks each end against the bounds and isDateUnavailable without an anchor", () => {
    const bounds = { min: day("2026-10-05"), max: day("2026-10-20") };
    const rules: RangeRules = { ...saturdaysUnavailable, bounds };
    const range = (start: string, end: string) => ({ start: day(start), end: day(end) });
    expect(rangeValidationError(range("2026-10-04", "2026-10-08"), rules)).toBe("rangeUnderflow");
    expect(rangeValidationError(range("2026-10-12", "2026-10-21"), rules)).toBe("rangeOverflow");
    expect(rangeValidationError(range("2026-10-12", "2026-10-17"), rules)).toBe("unavailable");
    // React Aria checks only the ends: a range spanning an unavailable day passes.
    expect(rangeValidationError(range("2026-10-09", "2026-10-12"), rules)).toBeNull();
  });
});
