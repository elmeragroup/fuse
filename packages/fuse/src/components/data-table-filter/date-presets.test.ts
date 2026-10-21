/**
 * Unit project. Every range below is written out by hand from a calendar.
 */
import { describe, expect, it } from "vitest";

import { DEFAULT_DATE_PRESETS, datePresetRange, isOneDayPreset } from "./date-presets";
import type { DatePresetKey } from "./date-presets";

// 2026-10-21 is a Wednesday.
const TODAY = "2026-10-21";

describe("datePresetRange", () => {
  it.each([
    ["today", "2026-10-21", "2026-10-21", "2026-10-21", "2026-10-21"],
    ["yesterday", "2026-10-20", "2026-10-20", "2026-10-20", "2026-10-20"],
    ["thisWeek", "2026-10-18", "2026-10-24", "2026-10-19", "2026-10-25"],
    ["lastWeek", "2026-10-11", "2026-10-17", "2026-10-12", "2026-10-18"],
    ["last7Days", "2026-10-15", "2026-10-21", "2026-10-15", "2026-10-21"],
    ["last30Days", "2026-09-22", "2026-10-21", "2026-09-22", "2026-10-21"],
    ["thisMonth", "2026-10-01", "2026-10-31", "2026-10-01", "2026-10-31"],
    ["lastMonth", "2026-09-01", "2026-09-30", "2026-09-01", "2026-09-30"],
    ["thisYear", "2026-01-01", "2026-12-31", "2026-01-01", "2026-12-31"],
    ["lastYear", "2025-01-01", "2025-12-31", "2025-01-01", "2025-12-31"],
  ] as const)("reads %s as %s to %s in en-US and %s to %s in nb-NO", (key, usFrom, usTo, nbFrom, nbTo) => {
    expect(datePresetRange(key, TODAY, "en-US")).toEqual([usFrom, usTo]);
    expect(datePresetRange(key, TODAY, "nb-NO")).toEqual([nbFrom, nbTo]);
  });

  it("starts the week on Monday in sv-SE and fi-FI too", () => {
    expect(datePresetRange("thisWeek", TODAY, "sv-SE")).toEqual(["2026-10-19", "2026-10-25"]);
    expect(datePresetRange("thisWeek", TODAY, "fi-FI")).toEqual(["2026-10-19", "2026-10-25"]);
  });

  it.each([
    ["a week across a new year", "thisWeek", "2026-01-01", "nb-NO", ["2025-12-29", "2026-01-04"]],
    ["last month across a new year", "lastMonth", "2026-01-15", "nb-NO", ["2025-12-01", "2025-12-31"]],
    ["last month in a leap year", "lastMonth", "2028-03-01", "nb-NO", ["2028-02-01", "2028-02-29"]],
    ["last month from a month's 31st", "lastMonth", "2026-03-31", "nb-NO", ["2026-02-01", "2026-02-28"]],
    ["yesterday across a month", "yesterday", "2026-03-01", "nb-NO", ["2026-02-28", "2026-02-28"]],
    ["last week across a month end", "lastWeek", "2026-11-04", "nb-NO", ["2026-10-26", "2026-11-01"]],
    ["last 7 days across a new year", "last7Days", "2027-01-03", "nb-NO", ["2026-12-28", "2027-01-03"]],
    ["last 30 days across a new year", "last30Days", "2027-01-15", "nb-NO", ["2026-12-17", "2027-01-15"]],
  ] as const)("reads %s", (_name, key, today, locale, expected) => {
    expect(datePresetRange(key, today, locale)).toEqual(expected);
  });
});

describe("the preset catalog", () => {
  it("offers Today, Last 7 days, Last 30 days, This month and This year by default", () => {
    expect(DEFAULT_DATE_PRESETS).toEqual(["today", "last7Days", "last30Days", "thisMonth", "thisYear"]);
  });

  it.each([
    ["today", true],
    ["yesterday", true],
    ["thisWeek", false],
    ["lastWeek", false],
    ["last7Days", false],
    ["last30Days", false],
    ["thisMonth", false],
    ["lastMonth", false],
    ["thisYear", false],
    ["lastYear", false],
  ] as const satisfies readonly (readonly [DatePresetKey, boolean])[])(
    "reads %s as one day: %s",
    (key, expected) => {
      expect(isOneDayPreset(key)).toBe(expected);
    }
  );
});
