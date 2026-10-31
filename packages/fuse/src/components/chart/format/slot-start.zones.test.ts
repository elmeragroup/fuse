/**
 * Unit under test: `slotStart`, `nextSlotStart` and the `formatSlot` error. Oracle: slot starts worked out by hand
 * from the EU summer-time rule, where Oslo is UTC+2 from the last Sunday of March at 01:00 UTC to
 * the last Sunday of October at 01:00 UTC and UTC+1 otherwise, ISO 8601 weeks that start on Monday,
 * and the error the contract names. The labels of these slots run in every engine as the shared
 * judges in `fixtures/judges.ts`.
 */
import { describe, expect, it } from "vitest";

import type { FormattedText } from "./formatted-text";
import { formatSlot, nextSlotStart, slotStart } from "./time-format";
import type { Interval } from "./time-format";

const OSLO = "Europe/Oslo";

describe("slotStart in Europe/Oslo", () => {
  it.each<readonly [string, Interval, string, string]>([
    ["an hour mid-slot", "hour", "2026-10-17T15:30:00Z", "2026-10-17T15:00:00Z"],
    ["the first repeated hour", "hour", "2025-10-26T00:40:00Z", "2025-10-26T00:00:00Z"],
    ["the second repeated hour", "hour", "2025-10-26T01:20:00Z", "2025-10-26T01:00:00Z"],
    ["a day in summer time", "day", "2026-10-17T15:30:00Z", "2026-10-16T22:00:00Z"],
    ["the 25-hour day, after the fall-back", "day", "2025-10-26T22:30:00Z", "2025-10-25T22:00:00Z"],
    ["the 23-hour day, after the spring-forward", "day", "2026-03-29T20:00:00Z", "2026-03-28T23:00:00Z"],
    ["a Saturday's week", "week", "2026-10-17T15:30:00Z", "2026-10-11T22:00:00Z"],
    ["a week across the fall-back Sunday", "week", "2025-10-26T12:00:00Z", "2025-10-19T22:00:00Z"],
    ["a month", "month", "2026-10-17T15:30:00Z", "2026-09-30T22:00:00Z"],
    ["a month that starts in winter time", "month", "2025-11-20T12:00:00Z", "2025-10-31T23:00:00Z"],
    ["a year", "year", "2026-10-17T15:30:00Z", "2025-12-31T23:00:00Z"],
    ["a quarter hour", "quarter-hour", "2026-10-17T15:37:12Z", "2026-10-17T15:30:00Z"],
  ])("finds the start of %s", (_, interval, at, start) => {
    expect(new Date(slotStart(Date.parse(at), interval, OSLO)).toISOString()).toBe(
      new Date(start).toISOString()
    );
  });

  // zoneinfo 2025: Santiago goes from 23:59:59-04 to 01:00-03 at 2025-09-07T04:00Z, Havana from
  // 23:59:59-05 to 01:00-04 at 2025-03-09T05:00Z, and Beirut from 23:59:59+02 to 01:00+03 at
  // 2025-03-29T22:00Z. Each skips a local midnight, so the day starts at the transition. Havana falls
  // back from 00:59:59-04 to 00:00-05 at 2025-11-02T05:00Z, so its midnight repeats and the day starts
  // at the first one. No zone skips a Monday midnight in 2025 or 2026, so no week case exists.
  it.each<readonly [string, string, Interval, string, string]>([
    [
      "Santiago's skipped midnight",
      "America/Santiago",
      "day",
      "2025-09-07T12:00:00Z",
      "2025-09-07T04:00:00Z",
    ],
    ["Havana's skipped midnight", "America/Havana", "day", "2025-03-09T12:00:00Z", "2025-03-09T05:00:00Z"],
    ["Beirut's skipped midnight", "Asia/Beirut", "day", "2025-03-30T12:00:00Z", "2025-03-29T22:00:00Z"],
    ["Havana's repeated midnight", "America/Havana", "day", "2025-11-02T12:00:00Z", "2025-11-02T04:00:00Z"],
    [
      "the week of Santiago's skipped midnight",
      "America/Santiago",
      "week",
      "2025-09-07T12:00:00Z",
      "2025-09-01T04:00:00Z",
    ],
  ])("finds %s", (_, zone, interval, at, start) => {
    expect(new Date(slotStart(Date.parse(at), interval, zone)).toISOString()).toBe(
      new Date(start).toISOString()
    );
  });

  it("starts an hour at the zone's top of the hour where the offset is not whole hours", () => {
    // Asia/Kolkata is UTC+5:30, so 10:00 there is 04:30 UTC.
    expect(
      new Date(slotStart(Date.parse("2026-10-17T04:45:00Z"), "hour", "Asia/Kolkata")).toISOString()
    ).toBe("2026-10-17T04:30:00.000Z");
  });
});

describe("formatSlot with the time-seconds preset", () => {
  it("prints the slot's start to the second in fi-FI's dotted Hms (F1)", () => {
    const label: FormattedText = formatSlot(
      "fi-FI",
      OSLO,
      Date.UTC(2026, 9, 17, 11, 42, 4, 317),
      "second",
      "time-seconds",
      "full"
    );
    expect(label).toEqual({ text: "13.42.04", spoken: "klo\u00a013.42.04" });
  });
});

describe("nextSlotStart in Europe/Oslo", () => {
  it.each<readonly [string, Interval, string, string]>([
    ["a second", "second", "2026-10-17T15:30:59Z", "2026-10-17T15:31:00Z"],
    ["a minute", "minute", "2026-10-17T15:30:00Z", "2026-10-17T15:31:00Z"],
    ["an hour", "hour", "2026-10-17T15:00:00Z", "2026-10-17T16:00:00Z"],
    // The week of 20 October 2025 starts at 00:00 CEST and the next at 00:00 CET, 7 days and 1 hour on.
    ["the week across the fall-back Sunday", "week", "2025-10-19T22:00:00Z", "2025-10-26T23:00:00Z"],
    ["a month", "month", "2025-09-30T22:00:00Z", "2025-10-31T23:00:00Z"],
  ])("ends %s at the next slot's start", (_, interval, start, next) => {
    expect(nextSlotStart(Date.parse(start), interval, OSLO)).toBe(Date.parse(next));
  });
});
