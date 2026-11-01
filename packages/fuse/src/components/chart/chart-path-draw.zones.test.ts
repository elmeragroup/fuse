// How a data update moves a series path. Unit under test: pathStep. Oracles: the review round 1
// scenarios B1-9 and B1-11, with every route vertex's start and end worked out by hand on a plot
// where a slot's centre lies at its window position and a value draws at itself, and F10's rule
// that an update which keeps every slot moves no vertex along the slot axis.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { pathStep, seriesPathKind } from "./chart-path-draw";
import type { PathMemory } from "./chart-path-draw";
import { buildCartesianModel } from "./layout/cartesian-model";
import { LINE_STRIDE, pathValues, topologyOf } from "./layout/line-path";
import type { PathTopology } from "./layout/line-path";
import { seriesPath } from "./layout/series-path";
import type { SeriesPath } from "./layout/series-path";
import { pairSlotKeys } from "./layout/slot-keys";
import type { SlotKeys } from "./layout/slot-keys";

/** A Line's kind on a plot whose slots lie one pixel apart. */
const KIND = seriesPathKind(LINE_STRIDE, 1);

/** A category line over `values`, decimated into `columns` pixel columns. */
function line(values: readonly (number | null)[], columns: number) {
  const model = buildCartesianModel({
    rows: values.map((v, index) => ({ name: `s${String(index)}`, v })),
    series: [["v", {}]],
    xKey: "name",
    stackOffset: "diverging",
    baseline: "zero",
    include: [],
  });
  const [series] = model.series;
  if (series === undefined) throw new Error("no series");
  const path = seriesPath(model, series, [], columns);
  const topology = topologyOf(path.vertices, "gap");
  const rest = pathValues(
    path.vertices,
    LINE_STRIDE,
    (position) => position,
    (value) => value
  );
  return { path, topology, rest };
}

/** What a path keeps after it rests on `path`. */
function restingOn(path: SeriesPath, topology: PathTopology): PathMemory {
  return { keys: path.keys, positions: path.positions, window: path.window, topology, route: null };
}

/** A topology of readings only. */
function readings(count: number): PathTopology {
  return {
    count,
    states: Array.from({ length: count }, () => "reading"),
    estimated: Array.from({ length: count }, () => false),
    projectedFrom: count,
    missing: "gap",
    cells: Array.from({ length: count }, () => 1),
    sides: Array.from({ length: count }, () => null),
  };
}

/** The route's [key, from, to] for each vertex, from a step. */
function vertices(step: ReturnType<typeof pathStep>): [string, number[], number[]][] {
  if (step.kind !== "route") return [];
  return step.route.keys.map((key, index) => [
    key,
    [step.via.from[index * 2] ?? Number.NaN, step.via.from[index * 2 + 1] ?? Number.NaN],
    [step.via.to[index * 2] ?? Number.NaN, step.via.to[index * 2 + 1] ?? Number.NaN],
  ]);
}

describe("pathStep", () => {
  it("tweens a decimated line whose one interior value changes, from the old line (B1-9)", () => {
    // 2,400 slots on 300 px, every value 1. Slot 1234 changes to 2, so M4 now keeps it, and it
    // starts on the old flat line at 1.
    const before = line(
      Array.from({ length: 2400 }, () => 1),
      300
    );
    const after = line(
      Array.from({ length: 2400 }, (_, index) => (index === 1234 ? 2 : 1)),
      300
    );
    const step = pathStep(
      restingOn(before.path, before.topology),
      after.path,
      after.topology,
      after.rest,
      before.rest,
      KIND
    );
    expect(step.kind).toBe("route");
    expect(vertices(step).find(([key]) => key === "s1234")).toEqual(["s1234", [1234, 1], [1234, 2]]);
  });

  it("moves no vertex along the slot axis when a decimated update keeps every slot", () => {
    fc.assert(
      fc.property(
        fc.array(fc.option(fc.integer({ min: -100, max: 100 }), { freq: 9 }), {
          minLength: 2001,
          maxLength: 2600,
        }),
        fc.nat(),
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: 50, max: 400 }),
        (values, pick, value, columns) => {
          const at = values.findIndex((entry, index) => entry !== null && index >= pick % values.length);
          if (at === -1) return;
          const before = line(values, columns);
          const after = line(
            values.map((entry, index) => (index === at ? value : entry)),
            columns
          );
          const step = pathStep(
            restingOn(before.path, before.topology),
            after.path,
            after.topology,
            after.rest,
            before.rest,
            KIND
          );
          expect(step.kind).toBe("route");
          for (const [, from, to] of vertices(step)) expect(from[0]).toBe(to[0]);
        }
      ),
      { numRuns: 15 }
    );
  });

  it("keeps sliding a vertex an interrupted slide was taking out (B1-11)", () => {
    // Seven point slots a to g slide to b to h. Halfway, a has slid from 0 to -0.5 and h from 7 to
    // 6.5, every value 1, and c to i arrive. The window slides one more slot, so a goes on to -1.5
    // and b to -0.5, and the segment from a to b still reaches the plot's left edge.
    const names = (from: number) =>
      Array.from({ length: 7 }, (_, index) => String.fromCodePoint(97 + from + index));
    const window = { keys: names(1), ids: names(1) };
    const memory: PathMemory = {
      keys: window.keys,
      positions: [0, 1, 2, 3, 4, 5, 6],
      window,
      topology: readings(7),
      route: { keys: names(0).concat("h"), positions: [-1, 0, 1, 2, 3, 4, 5, 6], topology: readings(8) },
    };
    const drawn = [-0.5, 0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5].flatMap((along) => [along, 1]);
    const next = names(2);
    const step = pathStep(
      memory,
      { keys: next, positions: [0, 1, 2, 3, 4, 5, 6], window: { keys: next, ids: next } },
      readings(7),
      [0, 1, 2, 3, 4, 5, 6].flatMap((along) => [along, 1]),
      drawn,
      KIND
    );
    expect(vertices(step)).toEqual([
      ["a", [-0.5, 1], [-1.5, 1]],
      ["b", [0.5, 1], [-0.5, 1]],
      ["c", [1.5, 1], [0, 1]],
      ["d", [2.5, 1], [1, 1]],
      ["e", [3.5, 1], [2, 1]],
      ["f", [4.5, 1], [3, 1]],
      ["g", [5.5, 1], [4, 1]],
      ["h", [6.5, 1], [5, 1]],
      ["i", [7, 1], [6, 1]],
    ]);
  });

  describe("a coarse series on Root's grid (W5, Q1-4 and B1-5)", () => {
    const QUARTER = 15 * 60 * 1000;
    /** Oslo midnight on 1 October 2025, under summer time. */
    const START = Date.UTC(2025, 8, 30, 22);

    /**
     * An hourly line on a quarter-hour grid: quarters from `from` on, one hourly value on each
     * hour's first quarter, keyed after `previous` as Root keys a data update.
     */
    function hourly(from: number, hours: readonly number[], previous: SlotKeys | null) {
      const rows = Array.from({ length: hours.length * 4 }, (_, index) => {
        const x = new Date(from + index * QUARTER);
        const value = hours[index / 4];
        return index % 4 === 0 && value !== undefined ? { x, kwh: value } : { x };
      });
      const model = buildCartesianModel({
        rows,
        series: [["kwh", { interval: "hour" }]],
        xKey: "x",
        time: { interval: "quarter-hour", timeZone: "Europe/Oslo" },
        stackOffset: "diverging",
        baseline: "zero",
        include: [],
      });
      const [series] = model.series;
      if (series === undefined) throw new Error("no series");
      const keys = pairSlotKeys(previous, model.domain);
      const path = seriesPath(model, series, keys.keys);
      const topology = topologyOf(path.vertices, "gap");
      const rest = pathValues(
        path.vertices,
        LINE_STRIDE,
        (position) => position,
        (value) => value
      );
      return { path, topology, rest, keys };
    }

    it("keeps the path's motion window on Root's full grid", () => {
      // Three hours draw three vertices at quarters 1.5, 5.5 and 9.5, over 12 Root slots.
      const { path } = hourly(START, [1, 2, 3], null);
      expect(path.positions).toEqual([1.5, 5.5, 9.5]);
      expect(path.window.keys).toHaveLength(12);
    });

    it("slides three hours by one hour as 4 Root slots", () => {
      // The window moves one hour later. Hour 0 leaves from 1.5 to -2.5, hours 1 and 2 move left
      // by 4 to 1.5 and 5.5, and hour 3 arrives from 13.5 to 9.5 at its own value, 4.
      const before = hourly(START, [1, 2, 3], null);
      const after = hourly(START + 4 * QUARTER, [2, 3, 4], before.keys);
      const step = pathStep(
        restingOn(before.path, before.topology),
        after.path,
        after.topology,
        after.rest,
        before.rest,
        KIND
      );
      expect(vertices(step).map(([, from, to]) => [from, to])).toEqual([
        [
          [1.5, 1],
          [-2.5, 1],
        ],
        [
          [5.5, 2],
          [1.5, 2],
        ],
        [
          [9.5, 3],
          [5.5, 3],
        ],
        [
          [13.5, 4],
          [9.5, 4],
        ],
      ]);
    });

    it("grows a fourth hour out of the old last hour when no slot is shared", () => {
      // The next day pairs by position: hours at 1.5, 5.5 and 9.5 tween in place to their new
      // values, and the fourth, at 13.5, grows out of the old last vertex, at 9.5 and 3.
      const before = hourly(START, [1, 2, 3], null);
      const after = hourly(START + 24 * 4 * QUARTER, [4, 5, 6, 7], before.keys);
      const step = pathStep(
        restingOn(before.path, before.topology),
        after.path,
        after.topology,
        after.rest,
        before.rest,
        KIND
      );
      expect(vertices(step).map(([, from, to]) => [from, to])).toEqual([
        [
          [1.5, 1],
          [1.5, 4],
        ],
        [
          [5.5, 2],
          [5.5, 5],
        ],
        [
          [9.5, 3],
          [9.5, 6],
        ],
        [
          [9.5, 3],
          [13.5, 7],
        ],
      ]);
    });
  });
});
