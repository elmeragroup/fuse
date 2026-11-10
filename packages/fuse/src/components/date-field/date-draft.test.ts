import { describe, expect, it } from "vitest";

/**
 * Unit under test: the draft rules in `date-draft.ts`. Oracle: React Aria's `IncompleteDate`
 * (`@react-stately/datepicker`) and `cycleValue` (`@internationalized/date`), applied by hand to
 * each input: the segment lists of `useDateFieldState`, the hour-cycle conversion, the wrap and
 * round rules per segment, and the constrain on commit. Every expectation is written out.
 */
import "../../temporal-polyfill";
import {
  EMPTY_DRAFT,
  clearSegment,
  cycleSegment,
  draftOf,
  draftToValue,
  editableSegments,
  isCleared,
  isComplete,
  roundTrips,
  setSegment,
  toHourCycle,
} from "./date-draft";
import type { DateDraft } from "./date-draft";

const TODAY = Temporal.PlainDate.from("2030-06-15");
const MIDNIGHT = Temporal.PlainDateTime.from("2030-06-15T00:00");

function date(year: number, month: number, day: number): DateDraft {
  return { ...EMPTY_DRAFT, year, month, day };
}

describe("editableSegments", () => {
  it.each([
    ["day", "h12", ["year", "month", "day"]],
    ["hour", "h12", ["year", "month", "day", "hour", "dayPeriod"]],
    ["minute", "h12", ["year", "month", "day", "hour", "dayPeriod", "minute"]],
    ["minute", "h23", ["year", "month", "day", "hour", "minute"]],
    ["second", "h23", ["year", "month", "day", "hour", "minute", "second"]],
  ] as const)("lists %s at %s", (granularity, hourCycle, segments) => {
    expect(editableSegments(granularity, hourCycle)).toEqual(segments);
  });
});

describe("toHourCycle", () => {
  it.each([
    [0, "h12", [0, 12]],
    [11, "h12", [0, 11]],
    [12, "h12", [1, 12]],
    [13, "h12", [1, 1]],
    [23, "h12", [1, 11]],
    [13, "h23", [null, 13]],
  ] as const)("writes %i under %s as %j", (hour, cycle, expected) => {
    expect(toHourCycle(hour, cycle)).toEqual(expected);
  });
});

describe("draftOf", () => {
  it("holds a date-time's hour in the 12-hour cycle beside its day period", () => {
    expect(draftOf(Temporal.PlainDateTime.from("2026-10-12T14:30:05"), "h12")).toEqual({
      year: 2026,
      month: 10,
      day: 12,
      hour: 2,
      dayPeriod: 1,
      minute: 30,
      second: 5,
      offsetNanoseconds: null,
    });
  });

  it("keeps a zoned value's offset", () => {
    expect(
      draftOf(Temporal.ZonedDateTime.from("2026-10-12T14:30[Europe/Oslo]"), "h23").offsetNanoseconds
    ).toBe(7_200_000_000_000);
  });

  it("empties every segment for no value", () => {
    expect(draftOf(null, "h12")).toEqual({
      year: null,
      month: null,
      day: null,
      hour: null,
      dayPeriod: null,
      minute: null,
      second: null,
      offsetNanoseconds: null,
    });
  });
});

describe("cycleSegment", () => {
  it.each([
    ["month", date(2026, 12, 5), 1, 1],
    ["month", date(2026, 1, 5), -1, 12],
    ["month", date(2026, 11, 5), 2, 1],
    ["day", date(2026, 2, 31), 1, 1],
    ["day", date(2026, 10, 28), 7, 4],
    ["day", date(2026, 10, 3), -7, 27],
    ["year", date(2026, 1, 1), 1, 2027],
    ["year", date(2026, 1, 1), 5, 2030],
    ["year", date(2026, 1, 1), -5, 2025],
    ["year", date(9999, 1, 1), 1, 1],
  ] as const)("steps %s of %j by %i to %i", (segment, draft, amount, expected) => {
    expect(cycleSegment(draft, segment, amount, TODAY, "h23")[segment]).toBe(expected);
  });

  it.each([
    [7, 15, 15],
    [50, 15, 0],
    [7, -15, 0],
    [0, -15, 45],
    [59, 1, 0],
  ])("rounds minute %i stepped by %i to %i", (minute, amount, expected) => {
    const draft = { ...date(2026, 1, 1), hour: 9, minute };
    expect(cycleSegment(draft, "minute", amount, MIDNIGHT, "h23").minute).toBe(expected);
  });

  it("wraps a 12-hour hour from 12 to 1 and keeps its day period", () => {
    const draft = { ...date(2026, 1, 1), hour: 12, dayPeriod: 1 as const, minute: 0 };
    expect(cycleSegment(draft, "hour", 1, MIDNIGHT, "h12")).toMatchObject({ hour: 1, dayPeriod: 1 });
  });

  it("wraps a 24-hour hour from 23 to 0", () => {
    const draft = { ...date(2026, 1, 1), hour: 23, minute: 0 };
    expect(cycleSegment(draft, "hour", 1, MIDNIGHT, "h23").hour).toBe(0);
  });

  it("fills an empty segment from the placeholder instead of stepping it", () => {
    expect(cycleSegment(EMPTY_DRAFT, "month", 1, TODAY, "h23").month).toBe(6);
    expect(cycleSegment(EMPTY_DRAFT, "year", -1, TODAY, "h23").year).toBe(2030);
    expect(cycleSegment(EMPTY_DRAFT, "hour", 1, MIDNIGHT, "h12")).toMatchObject({ hour: 12, dayPeriod: 0 });
  });

  it("steps an empty day period from AM to PM", () => {
    expect(cycleSegment(EMPTY_DRAFT, "dayPeriod", 1, MIDNIGHT, "h12").dayPeriod).toBe(1);
  });
});

describe("setSegment and clearSegment", () => {
  it("gives an hour typed into an empty day period the placeholder's, AM at midnight", () => {
    expect(setSegment(EMPTY_DRAFT, "hour", 9, MIDNIGHT, "h12")).toMatchObject({ hour: 9, dayPeriod: 0 });
  });

  it("drops the held offset on every edit but the second", () => {
    const zoned = draftOf(Temporal.ZonedDateTime.from("2026-10-12T14:30[Europe/Oslo]"), "h23");
    expect(setSegment(zoned, "second", 5, MIDNIGHT, "h23").offsetNanoseconds).toBe(7_200_000_000_000);
    expect(setSegment(zoned, "minute", 5, MIDNIGHT, "h23").offsetNanoseconds).toBeNull();
    expect(clearSegment(zoned, "day")).toMatchObject({ day: null, offsetNanoseconds: null });
  });

  it("tells a complete draft from a partial and an empty one", () => {
    const segments = editableSegments("day", "h23");
    expect(isComplete(date(2026, 1, 1), segments)).toBe(true);
    expect(isComplete({ ...date(2026, 1, 1), day: null }, segments)).toBe(false);
    expect(isCleared(EMPTY_DRAFT, segments)).toBe(true);
    expect(isCleared({ ...EMPTY_DRAFT, month: 3 }, segments)).toBe(false);
  });
});

describe("draftToValue and roundTrips", () => {
  it("constrains February 30 to February 28, which does not round-trip", () => {
    const draft = date(2026, 2, 30);
    const value = draftToValue(draft, TODAY, "h23");
    expect(value.toString()).toBe("2026-02-28");
    expect(roundTrips(draft, value, editableSegments("day", "h23"), "h23")).toBe(false);
  });

  it("reads a lone typed zero as the first month, keeping the draft's digit", () => {
    expect(draftToValue(date(2026, 0, 5), TODAY, "h23").toString()).toBe("2026-01-05");
  });

  it("fills a date-time's empty fields from the base and converts the 12-hour hour", () => {
    const draft = { ...date(2026, 10, 12), hour: 2, dayPeriod: 1 as const, minute: 30 };
    const value = draftToValue(draft, Temporal.PlainDateTime.from("2030-06-15T00:00:45"), "h12");
    expect(value.toString()).toBe("2026-10-12T14:30:45");
    expect(roundTrips(draft, value, editableSegments("minute", "h12"), "h12")).toBe(true);
  });

  it("reads an empty 12-hour hour as the start of its day period", () => {
    const draft = { ...date(2026, 10, 12), dayPeriod: 1 as const, minute: 30 };
    expect(draftToValue(draft, MIDNIGHT, "h12").toString()).toBe("2026-10-12T12:30:00");
  });
});
