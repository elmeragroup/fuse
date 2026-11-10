// The clock model on the DST days, in each zone project. Unit under test: clockModel over the
// cartesian model a ClockChart.Root builds for one cycle. Oracles: the zoneinfo slot lists in
// format/fixtures/slots.json for the 23-, 24- and 25-hour days in Europe/Oslo, their quarter-hours,
// the ISO weeks around both 2025 changes and the months of 2025; calendar counts written by hand,
// 365 and 366 days and 8,760 and 8,784 hours, from 1 January 00:00 CET; D11's equal slots,
// 360/n degrees each; the hour labels written by hand, one per wall hour, so the repeated fall-back
// hour labels once; "06" at slot 7's start on the 25-hour day, 7 × 14.4 = 100.8°; and PageDown's one
// label unit, six wall hours, which lands on 06:00 at slot 7 of the 25-hour day and slot 5 of the
// 23-hour day. The dial reads the market's zone, so the result must not change with the process's.
import { describe, expect, it } from "vitest";

import { clockModel } from "./chart-polar-clock";
import type { ClockDrawing } from "./chart-polar-context";
import slots from "./format/fixtures/slots.json" with { type: "json" };
import { buildCartesianModel } from "./layout/cartesian-model";

const OSLO = "Europe/Oslo";

/** The model of one day dial over the fixture's hours, a reading on each. */
function dayModel(day: "2026-03-29" | "2025-10-25" | "2025-10-26") {
  const starts = slots.hour[OSLO][day].utc_start.map((start) => Date.parse(start));
  const first = starts[0] ?? 0;
  const last = starts.at(-1) ?? 0;
  const rows = starts.map((start, index) => ({ start, kwh: 1 + (index % 3) }));
  const model = buildCartesianModel({
    rows,
    series: [["kwh", {}]],
    xKey: "start",
    time: { interval: "hour", timeZone: OSLO, period: [first, last + 3_600_000] },
    stackOffset: "diverging",
    baseline: "zero",
    include: [],
  });
  const polar = clockModel({
    model,
    config: { kwh: { label: "kWh", color: "chart-1" } },
    rows,
    locale: "nb-NO",
    timeZone: OSLO,
    cycle: "day",
    inner: 0.3,
    scale: "radial",
    now: undefined,
    xFormat: undefined,
    name: "Dag",
    issues: [],
    stackOffset: "diverging",
    baseline: "zero",
  });
  if (polar.drawing.kind !== "clock") throw new Error("a clock model draws a clock");
  return { polar, clock: polar.drawing.clock, starts };
}

/**
 * The model of one cycle over a period, as the Root builds it, with one reading at the period's
 * start, which is the cycle's first slot.
 */
function cycleModel(
  cycle: "day" | "week" | "year",
  interval: "quarter-hour" | "hour" | "day" | "month",
  period: readonly [number, number]
): ClockDrawing {
  const rows = [{ start: period[0], kwh: 1 }];
  const model = buildCartesianModel({
    rows,
    series: [["kwh", {}]],
    xKey: "start",
    time: { interval, timeZone: OSLO, period },
    stackOffset: "diverging",
    baseline: "zero",
    include: [],
  });
  const polar = clockModel({
    model,
    config: { kwh: { label: "kWh", color: "chart-1" } },
    rows,
    locale: "nb-NO",
    timeZone: OSLO,
    cycle,
    inner: 0.3,
    scale: "radial",
    now: undefined,
    xFormat: undefined,
    name: "Syklus",
    issues: [],
    stackOffset: "diverging",
    baseline: "zero",
  });
  if (polar.drawing.kind !== "clock") throw new Error("a clock model draws a clock");
  return polar.drawing.clock;
}

/** Each label's text and angle, rounded to a thousandth of a degree. */
function labels(clock: ClockDrawing): [string, number][] {
  return clock.labels.map(({ text, angle }) => [text.text, Math.round(angle * 1000) / 1000]);
}

describe("a day dial across the DST changes", () => {
  it.each([
    ["the 23-hour 29 March 2026", "2026-03-29", 23],
    ["the 24-hour 25 October 2025", "2025-10-25", 24],
    ["the 25-hour 26 October 2025", "2025-10-26", 25],
  ] as const)("holds %s's hours, each an equal angle", (_, day, count) => {
    const { polar, clock, starts } = dayModel(day);
    expect(clock.count).toBe(count);
    expect(clock.starts).toEqual(starts);
    expect(polar.count).toBe(count);
    // The first slot's wedge spans 360/n degrees from 12 o'clock.
    expect(clock.series[0]?.rest.slice(1, 3)).toEqual([0, 360 / count]);
  });

  it("labels each wall hour once, and puts 06 at 100.8° on the 25-hour day", () => {
    const { clock } = dayModel("2025-10-26");
    const shown = labels(clock);
    expect(shown.map(([text]) => text)).toEqual([
      "00",
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "18",
      "19",
      "20",
      "21",
      "22",
      "23",
    ]);
    expect(shown.find(([text]) => text === "06")?.[1]).toBe(100.8);
  });

  it("skips the missing 02 on the 23-hour day", () => {
    const { clock } = dayModel("2026-03-29");
    expect(labels(clock).map(([text]) => text)).not.toContain("02");
    expect(clock.labels).toHaveLength(23);
  });

  it.each([
    ["2025-10-26", 7],
    ["2025-10-25", 6],
    ["2026-03-29", 5],
  ] as const)("moves PageDown from midnight to 06:00 on %s, slot %i", (day, six) => {
    const { polar } = dayModel(day);
    expect(polar.page?.(0, 1)).toBe(six);
    expect(polar.page?.(six, -1)).toBe(0);
    // PageUp from midnight wraps to 18:00, six wall hours back round the dial.
    expect(polar.page?.(0, -1)).toBe(polar.count - 6);
  });
});

describe("a day's quarter-hours, a week and a year (Q4)", () => {
  const instants = (list: readonly string[]) => list.map((start) => Date.parse(start));

  it.each([
    ["2026-03-29", 92],
    ["2025-10-25", 96],
    ["2025-10-26", 100],
  ] as const)("holds %s's quarter-hours, as zoneinfo lists them", (day, count) => {
    const expected = instants(slots["quarter-hour"][OSLO][day].utc_start);
    expect(expected).toHaveLength(count);
    const period = [expected[0] ?? 0, (expected.at(-1) ?? 0) + 900_000] as const;
    expect(cycleModel("day", "quarter-hour", period).starts).toEqual(expected);
  });

  // Consecutive Monday starts from zoneinfo, in UTC.
  const mondays = instants(slots.week[OSLO].utc_start);
  const weekOf = (day: string): readonly [number, number] => {
    const monday = mondays.findLast((start) => start <= Date.parse(`${day}T10:00:00Z`)) ?? Number.NaN;
    return [monday, mondays.find((start) => start > monday) ?? Number.NaN];
  };

  it.each([
    ["the week of the spring change", "2025-03-26", 167],
    ["an ordinary week", "2025-03-19", 168],
    ["the week of the autumn change", "2025-10-22", 169],
  ] as const)("holds %s's hours from Monday 00:00", (_, inside, count) => {
    const period = weekOf(inside);
    const clock = cycleModel("week", "hour", period);
    expect(clock.starts[0]).toBe(period[0]);
    expect(clock.count).toBe(count);
  });

  it("holds 2025's months from 1 January 00:00, as zoneinfo lists them", () => {
    const months = instants(slots.month[OSLO]["2025"].utc_start);
    // 1 January 2026 00:00 CET is 31 December 2025 23:00 UTC.
    const clock = cycleModel("year", "month", [months[0] ?? 0, Date.parse("2025-12-31T23:00:00Z")]);
    expect(clock.starts).toEqual(months);
  });

  it.each([
    ["2025", "2024-12-31T23:00:00Z", "2025-12-31T23:00:00Z", 365, 8760],
    ["leap 2024", "2023-12-31T23:00:00Z", "2024-12-31T23:00:00Z", 366, 8784],
  ] as const)("holds %s's days and hours", (_, start, end, days, hours) => {
    const period = [Date.parse(start), Date.parse(end)] as const;
    expect(cycleModel("year", "day", period).count).toBe(days);
    expect(cycleModel("year", "hour", period).count).toBe(hours);
  });
});
