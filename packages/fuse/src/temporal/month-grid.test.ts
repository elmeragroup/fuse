import { describe, expect, it } from "vitest";

/**
 * Unit under test: `monthWeeks`. Oracle: printed calendars for 2026 (February starts on a Sunday,
 * August on a Saturday), written out by hand.
 */
import "../temporal-polyfill";
import { monthWeeks } from "./month-grid";
import type { IsoWeekday } from "./week-info";

/** Each week as its first and last day. */
function weekSpans(month: string, firstDay: IsoWeekday): string[] {
  return monthWeeks(Temporal.PlainYearMonth.from(month), firstDay).map(
    (week) => `${week[0]?.toString()}..${week.at(-1)?.toString()} (${week.length})`
  );
}

describe("monthWeeks", () => {
  it("fills a month that starts on the first weekday in four whole weeks", () => {
    expect(weekSpans("2026-02", 7)).toEqual([
      "2026-02-01..2026-02-07 (7)",
      "2026-02-08..2026-02-14 (7)",
      "2026-02-15..2026-02-21 (7)",
      "2026-02-22..2026-02-28 (7)",
    ]);
  });

  it("borrows the neighbouring months' days that share the first and last week", () => {
    expect(weekSpans("2026-02", 1)).toEqual([
      "2026-01-26..2026-02-01 (7)",
      "2026-02-02..2026-02-08 (7)",
      "2026-02-09..2026-02-15 (7)",
      "2026-02-16..2026-02-22 (7)",
      "2026-02-23..2026-03-01 (7)",
    ]);
  });

  it("spans six weeks when the month reaches into them", () => {
    expect(weekSpans("2026-08", 1)).toEqual([
      "2026-07-27..2026-08-02 (7)",
      "2026-08-03..2026-08-09 (7)",
      "2026-08-10..2026-08-16 (7)",
      "2026-08-17..2026-08-23 (7)",
      "2026-08-24..2026-08-30 (7)",
      "2026-08-31..2026-09-06 (7)",
    ]);
  });

  it("lists consecutive days", () => {
    const days = monthWeeks(Temporal.PlainYearMonth.from("2026-08"), 7)
      .flat()
      .map((day) => day.day);
    expect(days.slice(0, 8)).toEqual([26, 27, 28, 29, 30, 31, 1, 2]);
    expect(days.slice(-6)).toEqual([31, 1, 2, 3, 4, 5]);
  });
});
