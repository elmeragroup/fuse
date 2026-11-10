/**
 * Unit under test: the calendar's day and month text in each unit project's process zone (Oslo,
 * New York, Tokyo). Oracle: printed calendars, written out by hand: the text names the day it was
 * given whatever the zone, since a day at UTC midnight a zone formatted locally would name the day
 * before in New York.
 */
import { describe, expect, inject, it } from "vitest";

import "../../temporal-polyfill";
import { formatDayName, formatDayNumber, formatMonth } from "./calendar-format";

describe(`calendar text in ${inject("timeZone")}`, () => {
  it.each([
    ["2026-10-12", "Monday, October 12, 2026"],
    ["2026-01-01", "Thursday, January 1, 2026"],
    ["2026-12-31", "Thursday, December 31, 2026"],
    // A two-digit year stays in the first century, where `Date.UTC` would read it as 1950.
    ["0050-03-01", "Tuesday, March 1, 50"],
  ])("names %s as %s", (iso, name) => {
    expect(formatDayName("en-US", Temporal.PlainDate.from(iso))).toBe(name);
  });

  it("writes the first and last day of a month as their own numbers", () => {
    expect(formatDayNumber("en-US", Temporal.PlainDate.from("2026-03-01"))).toBe("1");
    expect(formatDayNumber("en-US", Temporal.PlainDate.from("2026-03-31"))).toBe("31");
  });

  it("names the month a first day belongs to", () => {
    expect(formatMonth("en-US", Temporal.PlainYearMonth.from("2026-01"))).toBe("January 2026");
  });
});
