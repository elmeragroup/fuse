// The clock dial's cycles in their zone. Unit under test: cycleSlots and slotAngles. Oracles: the
// zoneinfo slot lists in ../format/fixtures/slots.json for the 23-, 24- and 25-hour days, their
// quarter-hours, the ISO weeks around both 2025 changes and the months of 2025; and calendar counts
// written by hand, 365 and 366 days and 8,760 and 8,784 hours. The dial reads the market's zone, so
// the unit project runs this file in Europe/Oslo and the zone projects again in New York and Tokyo,
// and every count must hold in each.
import { describe, expect, it } from "vitest";

import slots from "../format/fixtures/slots.json" with { type: "json" };
import { cycleSlots, slotAngles } from "./clock";

const OSLO = "Europe/Oslo";
const instants = (list: readonly string[]) => list.map((start) => Date.parse(start));
const noon = (day: string) => Date.parse(`${day}T10:00:00Z`);

describe("a day dial", () => {
  it.each([
    ["the 23-hour 29 March 2026", "2026-03-29", 23],
    ["the 24-hour 25 October 2025", "2025-10-25", 24],
    ["the 25-hour 26 October 2025", "2025-10-26", 25],
  ] as const)("holds %s's hours, as zoneinfo lists them", (_, day, count) => {
    const expected = instants(slots.hour[OSLO][day].utc_start);
    expect(expected).toHaveLength(count);
    expect(cycleSlots(noon(day), "day", "hour", OSLO)).toEqual(expected);
  });

  it.each([
    ["2026-03-29", 92],
    ["2025-10-25", 96],
    ["2025-10-26", 100],
  ] as const)("holds %s's quarter-hours", (day, count) => {
    const expected = instants(slots["quarter-hour"][OSLO][day].utc_start);
    expect(expected).toHaveLength(count);
    expect(cycleSlots(noon(day), "day", "quarter-hour", OSLO)).toEqual(expected);
  });

  it("sets 06 at 100.8° on the 25-hour day, where its slot starts", () => {
    // 06:00 CET on 26 October 2025 is 05:00 UTC, the 8th hour of the day after 02:00 repeats.
    const hours = cycleSlots(noon("2025-10-26"), "day", "hour", OSLO);
    const six = hours.indexOf(Date.parse("2025-10-26T05:00:00Z"));
    expect(six).toBe(7);
    expect(slotAngles(six, hours.length).start).toBe(100.8);
  });
});

describe("a week dial", () => {
  // Consecutive Monday starts from zoneinfo, in UTC.
  const mondays = instants(slots.week[OSLO].utc_start);

  it.each([
    ["the week of the spring change", "2025-03-26", 167],
    ["an ordinary week", "2025-03-19", 168],
  ] as const)("holds %s's hours from Monday 00:00", (_, inside, count) => {
    const hours = cycleSlots(noon(inside), "week", "hour", OSLO);
    const monday = mondays.findLast((start) => start <= noon(inside)) ?? Number.NaN;
    const next = mondays.find((start) => start > monday) ?? Number.NaN;
    expect(hours[0]).toBe(monday);
    expect((next - monday) / 3_600_000).toBe(count);
    expect(hours).toHaveLength(count);
  });

  it("holds the 169 hours of the week of the autumn change", () => {
    // Monday 20 October 2025 00:00 CEST is 19 October 22:00 UTC, and the week ends on Monday 27
    // October 00:00 CET, 26 October 23:00 UTC, 169 hours later.
    const hours = cycleSlots(noon("2025-10-22"), "week", "hour", OSLO);
    expect(hours[0]).toBe(Date.parse("2025-10-19T22:00:00Z"));
    expect(hours).toHaveLength(169);
  });
});

describe("a year dial", () => {
  it("holds 2025's months from 1 January 00:00, as zoneinfo lists them", () => {
    expect(cycleSlots(noon("2025-06-15"), "year", "month", OSLO)).toEqual(
      instants(slots.month[OSLO]["2025"].utc_start)
    );
  });

  it.each([
    ["2025", "2025-06-15", 365, 8760],
    ["leap 2024", "2024-06-15", 366, 8784],
  ] as const)("holds %s's days and hours", (_, inside, days, hours) => {
    expect(cycleSlots(noon(inside), "year", "day", OSLO)).toHaveLength(days);
    expect(cycleSlots(noon(inside), "year", "hour", OSLO)).toHaveLength(hours);
  });
});
