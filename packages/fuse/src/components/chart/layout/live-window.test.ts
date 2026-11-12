// A live line chart's window geometry. Unit under test: parseLiveSeries, visibleSpan,
// nearestIndex, liveDomain, tickStep, timeTicks, edgeFade, liveVertices, liveLinePath and
// liveAreaPath. Oracles:
// readings, indices, domains, tick instants and pixels worked out by hand, on a 30 s window over a
// 300 by 100 px plot, where one second is 10 px.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  edgeFade,
  liveDomain,
  liveAreaPath,
  liveLinePath,
  liveVertices,
  nearestIndex,
  parseLiveSeries,
  tickStep,
  timeTicks,
  visibleSpan,
  windowEndingAt,
} from "./live-window";

/** 12:00:00 UTC on 16 October 2026. */
const NOON = Date.UTC(2026, 9, 16, 12);
const SECOND = 1_000;

describe("parseLiveSeries", () => {
  it("reads Date and epoch times, skips and reports a bad time or value, and sorts by time", () => {
    const series = parseLiveSeries([
      { time: NOON + 2 * SECOND, value: 3 },
      { time: new Date(NOON), value: 1 },
      { time: Number.NaN, value: 9 },
      { time: NOON + SECOND, value: Number.POSITIVE_INFINITY },
      { time: NOON + SECOND, value: 2 },
      { time: NOON + 3 * SECOND, value: 2e15 },
    ]);
    expect(series.points).toEqual([
      { time: NOON, value: 1 },
      { time: NOON + SECOND, value: 2 },
      { time: NOON + 2 * SECOND, value: 3 },
    ]);
    expect(series.issues).toEqual([
      { rule: "invalid-x", row: 2, subject: "time" },
      { rule: "non-finite-value", row: 3, subject: "value" },
      { rule: "non-finite-value", row: 5, subject: "value" },
    ]);
  });

  it("holds Root's value to the readings' bound, reporting one past it and showing the latest reading's", () => {
    const rows = [
      { time: NOON, value: 1 },
      { time: NOON + SECOND, value: 2 },
    ];
    expect(parseLiveSeries(rows, 7).latest).toBe(7);
    for (const value of [1.7e308, -2e15, Number.NaN]) {
      const series = parseLiveSeries(rows, value);
      expect(series.latest).toBe(2);
      expect(series.issues).toEqual([{ rule: "non-finite-live-value", subject: "value" }]);
    }
  });

  it("keeps one reading per instant, the last in row order", () => {
    expect(
      parseLiveSeries([
        { time: NOON + SECOND, value: 5 },
        { time: NOON, value: 1 },
        { time: NOON + SECOND, value: 6 },
        { time: NOON, value: 2 },
      ]).points
    ).toEqual([
      { time: NOON, value: 2 },
      { time: NOON + SECOND, value: 6 },
    ]);
  });
});

describe("visibleSpan and nearestIndex", () => {
  // Readings at 0, 10, 20 and 30 s past noon.
  const points = [0, 10, 20, 30].map((at) => ({ time: NOON + at * SECOND, value: at }));

  it("holds the readings inside the window, both ends included", () => {
    expect(visibleSpan(points, windowEndingAt(NOON + 30 * SECOND, 20 * SECOND))).toEqual({
      first: 1,
      end: 4,
    });
    expect(visibleSpan(points, windowEndingAt(NOON + 25 * SECOND, 10 * SECOND))).toEqual({
      first: 2,
      end: 3,
    });
    expect(visibleSpan(points, windowEndingAt(NOON - SECOND, 10 * SECOND))).toEqual({ first: 0, end: 0 });
  });

  it("picks the reading nearest an instant within the span, the earlier one on a tie", () => {
    const span = { first: 1, end: 4 };
    expect(nearestIndex(points, span, NOON + 14 * SECOND)).toBe(1);
    expect(nearestIndex(points, span, NOON + 16 * SECOND)).toBe(2);
    expect(nearestIndex(points, span, NOON + 15 * SECOND)).toBe(1);
    // An instant before the span's first reading takes that reading, never one outside the span.
    expect(nearestIndex(points, span, NOON)).toBe(1);
    expect(nearestIndex(points, span, NOON + 99 * SECOND)).toBe(3);
    expect(nearestIndex(points, { first: 2, end: 2 }, NOON)).toBe(-1);
  });
});

describe("liveDomain", () => {
  it("leaves 12 % of the span free at each end", () => {
    expect(liveDomain([100, 200])).toEqual([88, 212]);
  });

  it("widens a flat extent by a tenth of its value, or to −1 and 1 at 0", () => {
    expect(liveDomain([50, 50])).toEqual([45, 55]);
    expect(liveDomain([-50, -50])).toEqual([-55, -45]);
    expect(liveDomain([0, 0])).toEqual([-1, 1]);
  });

  it("always holds the extent strictly inside", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e9, max: 1e9, noNaN: true }),
        fc.double({ min: 0, max: 1e9, noNaN: true }),
        (low, span) => {
          const [from, to] = liveDomain([low, low + span]);
          expect(from).toBeLessThan(low);
          expect(to).toBeGreaterThan(low + span);
        }
      )
    );
  });
});

describe("time ticks", () => {
  it("picks the finest round step that fits the room", () => {
    // 30 s in 6 ticks: 5 s steps. In 3 ticks: 10 s. 10 minutes in 5 ticks: 2 minutes.
    expect(tickStep(30 * SECOND, 6)).toBe(5 * SECOND);
    expect(tickStep(30 * SECOND, 3)).toBe(10 * SECOND);
    expect(tickStep(600 * SECOND, 5)).toBe(120 * SECOND);
  });

  it("lands every tick on a round wall-clock time in the zone", () => {
    // 11:59:52 to 12:00:22 UTC in 10 s steps.
    const window = windowEndingAt(NOON + 22 * SECOND, 30 * SECOND);
    expect(timeTicks(window, 10 * SECOND, 0)).toEqual([NOON, NOON + 10 * SECOND, NOON + 20 * SECOND]);
    // Half-hour steps in India's +05:30 fall on :00 and :30 there, which is :30 and :00 in UTC.
    const hours = windowEndingAt(NOON + 3_600_000, 3_600_000);
    expect(timeTicks(hours, 1_800_000, 19_800_000)).toEqual([NOON, NOON + 1_800_000, NOON + 3_600_000]);
    // Hour steps in +05:30 fall at :30 past the UTC hour.
    expect(timeTicks(hours, 3_600_000, 19_800_000)).toEqual([NOON + 1_800_000]);
  });

  it("fades a tick out over the fade share at either edge", () => {
    expect([0, 0.125, 0.25, 0.5, 0.875, 1].map((share) => edgeFade(share, 0.25))).toEqual([
      0, 0.5, 1, 1, 0.5, 0,
    ]);
    expect(edgeFade(-0.2, 0.25)).toBe(0);
  });
});

describe("liveVertices and the live paths", () => {
  // Readings at 0, 10 and 20 s past noon, the latest of them the live one.
  const points = [
    { time: NOON, value: 0 },
    { time: NOON + 10 * SECOND, value: 50 },
    { time: NOON + 20 * SECOND, value: 100 },
  ];

  it("leads with the reading before the window, draws a held reading at its shown value and runs on to the clock", () => {
    const now = NOON + 25 * SECOND;
    const span = visibleSpan(points, windowEndingAt(now, 20 * SECOND));
    const held = new Map([[NOON + 20 * SECOND, 80]]);
    expect(liveVertices(points, span, now, { target: 100, shown: 80 }, held)).toEqual([
      { time: NOON, value: 0 },
      { time: NOON + 10 * SECOND, value: 50 },
      { time: NOON + 20 * SECOND, value: 80 },
      { time: now, value: 80 },
    ]);
  });

  it("ends the line on the live dot when the latest reading sits on the clock, with no second vertex there", () => {
    // A paused chart's first frame ends at the latest reading, 100, while the tip shows 110: the
    // reading is the line's end, so it draws at 110, and the earlier readings keep their own.
    const now = NOON + 20 * SECOND;
    const span = visibleSpan(points, windowEndingAt(now, 30 * SECOND));
    expect(liveVertices(points, span, now, { target: 120, shown: 110 }, new Map())).toEqual([
      { time: NOON, value: 0 },
      { time: NOON + 10 * SECOND, value: 50 },
      { time: NOON + 20 * SECOND, value: 110 },
    ]);
  });

  it("draws the line in plot pixels and closes the area along the bottom edge", () => {
    // 30 s over 300 px: noon sits at 100 px and 20 s past at 300 px. [0, 100] over 100 px.
    const geometry = {
      width: 300,
      height: 100,
      window: windowEndingAt(NOON + 20 * SECOND, 30 * SECOND),
      domain: [0, 100] as const,
    };
    const vertices = [
      { time: NOON, value: 0 },
      { time: NOON + 10 * SECOND, value: 50 },
      { time: NOON + 20 * SECOND, value: 100 },
    ];
    expect(liveLinePath(geometry, vertices, "linear")).toBe("M100,100L200,50L300,0");
    expect(liveAreaPath(geometry, vertices, "linear")).toBe("M100,100L200,50L300,0L300,100L200,100L100,100Z");
    expect(liveLinePath(geometry, vertices.slice(0, 1), "linear")).toBe("");
    expect(liveAreaPath(geometry, vertices.slice(0, 1), "linear")).toBe("");
  });
});
