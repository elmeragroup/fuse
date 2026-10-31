// The vertices a Line or an Area draws. Unit under test: seriesPath over buildCartesianModel.
// Oracles: hand-written readings and stacks; the review round 1 scenarios with their tops, bases,
// states and spans worked out by hand; and a brute-force scan over the raw rows of each M4
// bucket's extremes, a stack's sums included, and of every slot where what a vertex draws as
// changes, which must all be among a decimated window's vertices.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { buildCartesianModel } from "./cartesian-model";
import type { CartesianModel, ModelInput } from "./cartesian-model";
import { areaPaths, linePaths, pathValues, topologyOf } from "./line-path";
import type { PathPlacement } from "./line-path";
import { seriesPath } from "./series-path";
import type { PathVertex } from "./series-path";

/** A category model over one or two series, each value column named for its key. */
function model(
  rows: readonly Record<string, string | number | null>[],
  stack?: string,
  qualityKey?: (key: string) => string,
  projectedFrom?: string
): CartesianModel {
  const keys = Object.keys(rows[0] ?? {}).filter((key) => key !== "name" && !key.startsWith("q"));
  return buildCartesianModel({
    rows,
    series: keys.map((key) => [key, { stack, qualityKey: qualityKey?.(key), projectedFrom }] as const),
    xKey: "name",
    stackOffset: "diverging",
    baseline: "zero",
    include: [],
  });
}

describe("seriesPath", () => {
  it("keeps one vertex per window slot, and gives a missing reading the value between its neighbours", () => {
    const chart = model([
      { name: "a", v: 10 },
      { name: "b", v: null },
      { name: "c", v: 30 },
    ]);
    const [series] = chart.series;
    if (series === undefined) throw new Error("no series");
    const path = seriesPath(chart, series, ["ka", "kb", "kc"]);
    expect(path.keys).toEqual(["ka", "kb", "kc"]);
    expect(path.ids).toEqual(["a", "b", "c"]);
    expect(path.vertices.map(({ state, top, base }) => [state, top, base])).toEqual([
      ["reading", 10, 0],
      ["missing", 20, 0],
      ["reading", 30, 0],
    ]);
  });

  it("draws a stacked series on its stack's outer end, over the series below it", () => {
    const chart = model(
      [
        { name: "a", low: 10, high: 5 },
        { name: "b", low: -4, high: -6 },
      ],
      "s"
    );
    const high = chart.series[1];
    if (high === undefined) throw new Error("no series");
    // A negative part hangs below the part before it, so its outer end is its low one.
    expect(seriesPath(chart, high, ["a", "b"]).vertices.map(({ top, base }) => [top, base])).toEqual([
      [15, 10],
      [-10, -4],
    ]);
  });

  it("keeps every M4 bucket's lowest and highest reading among a decimated window's vertices", () => {
    fc.assert(
      fc.property(
        fc.array(fc.option(fc.integer({ min: -1000, max: 1000 }), { freq: 9 }), {
          minLength: 2001,
          maxLength: 3000,
        }),
        fc.integer({ min: 50, max: 400 }),
        (values, columns) => {
          const chart = model(values.map((v, index) => ({ name: `s${String(index)}`, v })));
          const [series] = chart.series;
          if (series === undefined) return;
          // The brute force: each bucket floor(i × columns / n) and its extremes, first ties first.
          const buckets = new Map<number, { low: number; high: number }>();
          values.forEach((value, index) => {
            if (value === null) return;
            const bucket = Math.floor((index * Math.round(columns)) / values.length);
            const entry = buckets.get(bucket);
            const read = (slot: number) => values[slot] ?? 0;
            if (entry === undefined) buckets.set(bucket, { low: index, high: index });
            else {
              if (value < read(entry.low)) entry.low = index;
              if (value > read(entry.high)) entry.high = index;
            }
          });
          const decimated = new Set(seriesPath(chart, series, [], columns).vertices.map(({ slot }) => slot));
          for (const { low, high } of buckets.values()) {
            expect(decimated.has(low) && decimated.has(high)).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it("keeps a gap in a decimated window where a run of slots has no reading, by both its ends", () => {
    const values = Array.from({ length: 2400 }, (_, index) =>
      index >= 1000 && index < 1300 ? null : index % 7
    );
    const chart = model(values.map((v, index) => ({ name: `s${String(index)}`, v })));
    const [series] = chart.series;
    if (series === undefined) throw new Error("no series");
    const states = seriesPath(chart, series, [], 200).vertices.map(({ state }) => state);
    // The 300 slots without a reading lie inside the series' span, so they are missing, and their
    // first and last slots stand for them, which breaks the line.
    expect(states.filter((state) => state === "missing")).toHaveLength(2);
  });
});

/** The slots and the top and base of each vertex, as [slot, top, base]. */
function tops(vertices: readonly PathVertex[]): [number, number, number][] {
  return vertices.map(({ slot, top, base }) => [slot, top, base]);
}

/** A placement that draws a vertex at its window position and its value as it is. */
const AS_IS: PathPlacement = {
  orientation: "vertical",
  curve: "linear",
  along: (at) => at,
  run: (centre) => [centre - 0.5, centre + 0.5],
  edge: (at) => at,
  across: (at) => at,
  digits: null,
};

describe("seriesPath in a decimated stack (review round 1, B1-1 and Q1-1)", () => {
  it("draws the upper series' top at the stack's sum over the lower series' peak", () => {
    // B1-1: 2,400 rows on 300 px, a = 1 except a[4] = 10, b = 1. The stack peaks at 10 + 1 = 11.
    const rows = Array.from({ length: 2400 }, (_, index) => ({
      name: `s${String(index)}`,
      a: index === 4 ? 10 : 1,
      b: 1,
    }));
    const chart = model(rows, "s");
    const [a, b] = chart.series;
    if (a === undefined || b === undefined) throw new Error("no series");
    const upper = seriesPath(chart, b, [], 300);
    expect(tops(upper.vertices).find(([slot]) => slot === 4)).toEqual([4, 11, 10]);
    expect(Math.max(...upper.vertices.map(({ top }) => top))).toBe(11);
    // Both members draw the same slots, so their shared boundary is one line.
    expect(seriesPath(chart, a, [], 300).vertices.map(({ slot }) => slot)).toEqual(
      upper.vertices.map(({ slot }) => slot)
    );
  });

  it("draws the upper series' base on the lower series' top at every vertex", () => {
    // Q1-1: 2,400 rows on 200 px, the lower series 1 except 100 at index 5, the upper 1.
    const rows = Array.from({ length: 2400 }, (_, index) => ({
      name: `s${String(index)}`,
      low: index === 5 ? 100 : 1,
      high: 1,
    }));
    const chart = model(rows, "s");
    const [low, high] = chart.series;
    if (low === undefined || high === undefined) throw new Error("no series");
    const lower = seriesPath(chart, low, [], 200).vertices;
    const upper = seriesPath(chart, high, [], 200).vertices;
    expect(tops(lower).find(([slot]) => slot === 5)).toEqual([5, 100, 0]);
    expect(tops(upper).find(([slot]) => slot === 5)).toEqual([5, 101, 100]);
    expect(upper.map(({ slot, base }) => [slot, base])).toEqual(lower.map(({ slot, top }) => [slot, top]));
  });
});

/** An hourly model from 1 October 2025 00:00 UTC, with `now` and a value column `v`. */
function hourly(values: readonly (number | null)[], now: number): CartesianModel {
  const start = Date.UTC(2025, 9, 1);
  const input: ModelInput = {
    rows: values.map((v, index) => ({ x: new Date(start + index * 3_600_000), v })),
    series: [["v", {}]],
    xKey: "x",
    time: { interval: "hour", timeZone: "UTC", now: start + now * 3_600_000 },
    stackOffset: "diverging",
    baseline: "zero",
    include: [],
  };
  return buildCartesianModel(input);
}

describe("seriesPath keeps what a decimated vertex draws as (review round 1, B1-2)", () => {
  it("keeps a pending slot between readings, so the line breaks there under connect", () => {
    // 2,400 hourly slots on 300 px: slot 0 reads 1, slot 1 is missing, slot 2 holds now with no
    // reading, so it is pending, and every later slot reads 1.
    const values = Array.from({ length: 2400 }, (_, index) => (index === 1 || index === 2 ? null : 1));
    const chart = hourly(values, 2.5);
    const [series] = chart.series;
    if (series === undefined) throw new Error("no series");
    const { vertices } = seriesPath(chart, series, [], 300);
    expect(vertices.slice(0, 4).map(({ slot, state }) => [slot, state])).toEqual([
      [0, "reading"],
      [1, "missing"],
      [2, "pending"],
      [3, "reading"],
    ]);
    // Under connect the bridge crosses slot 1, and slot 2 still breaks the line: slot 0 draws a
    // lone dot and the rest one subpath, two subpaths in all.
    const { line } = linePaths(
      pathValues(
        vertices,
        2,
        (position) => position,
        (value) => value
      ),
      topologyOf(vertices, "connect"),
      AS_IS
    );
    expect(line.match(/M/gu)).toHaveLength(2);
  });

  it("keeps an estimated reading in a flat run and both its neighbours, so its segments dash", () => {
    const rows = Array.from({ length: 2400 }, (_, index) => ({
      name: `s${String(index)}`,
      v: 1,
      qv: index === 1000 ? "estimated" : null,
    }));
    const chart = model(rows, undefined, (key) => `q${key}`);
    const [series] = chart.series;
    if (series === undefined) throw new Error("no series");
    const { vertices } = seriesPath(chart, series, [], 300);
    const { dashed } = linePaths(
      pathValues(
        vertices,
        2,
        (position) => position,
        (value) => value
      ),
      topologyOf(vertices, "gap"),
      AS_IS
    );
    // The segments from slot 999 to slot 1001 touch the estimated reading.
    expect(dashed).toEqual([[999, 1001]]);
  });
});

describe("seriesPath breaks a stacked series where it changes sign (review round 1, B1-3)", () => {
  it("draws b's positive band and its negative band as two subpaths", () => {
    // a = [10, 10, 10, 10] and b = [2, 2, -2, -2], stacked, linear. b's positive band runs from 10
    // to 12 over slots 0 and 1, and its negative band from 0 down to -2 over slots 2 and 3.
    const chart = model(
      [10, 10, 10, 10].map((a, index) => ({ name: `s${String(index)}`, a, b: index < 2 ? 2 : -2 })),
      "s"
    );
    const b = chart.series[1];
    if (b === undefined) throw new Error("no series");
    const { vertices } = seriesPath(chart, b, []);
    const { area } = areaPaths(
      vertices.flatMap((vertex) => [vertex.position, vertex.top, vertex.base]),
      topologyOf(vertices, "gap"),
      AS_IS
    );
    expect(area).toBe("M0,12L1,12L1,10L0,10ZM2,-2L3,-2L3,0L2,0Z");
  });
});

/** One slot of two stacked series, a and b, from fast-check's draws, and whether a is estimated. */
type Draw = { readonly a: number | null; readonly b: number | null; readonly estimated: boolean };

/**
 * The two ends each member's vertex draws at a slot, worked from the rows as d3's diverging offset
 * stacks them: positive parts upward from 0 and negative parts downward, a then b, a part below
 * zero hanging from its high end. Null where the member has no reading.
 */
function stackedEnds(draw: Draw) {
  let up = 0;
  let down = 0;
  const part = (value: number | null) => {
    if (value === null) return null;
    if (value > 0) {
      const end = { top: up + value, base: up };
      up += value;
      return end;
    }
    const end = { top: down + value, base: down };
    down += value;
    return end;
  };
  const a = part(draw.a);
  return { a, b: part(draw.b) };
}

describe("seriesPath decimation guard", () => {
  it("keeps a lower boundary's own peak where the stack's total peaks elsewhere (B2-10)", () => {
    // 2,400 rows on 300 px, 8 slots a column. In the first column a = [1, 1, 9, 1, 1, 1, 1, 1]
    // and b = [1, 19, 1, …]: the total peaks at slot 1, 1 + 19 = 20, and a's top and b's base
    // peak at slot 2, at 9. Both members draw slot 2, where b's base and a's top meet at 9.
    const rows = Array.from({ length: 2400 }, (_, index) => ({
      name: `s${String(index)}`,
      a: index === 2 ? 9 : 1,
      b: index === 1 ? 19 : 1,
    }));
    const chart = model(rows, "s");
    const [a, b] = chart.series;
    if (a === undefined || b === undefined) throw new Error("no series");
    expect(tops(seriesPath(chart, a, [], 300).vertices).find(([slot]) => slot === 2)).toEqual([2, 9, 0]);
    expect(tops(seriesPath(chart, b, [], 300).vertices).filter(([slot]) => slot <= 2)).toEqual([
      [0, 2, 1],
      [1, 20, 1],
      [2, 10, 9],
    ]);
  });

  it("keeps each member's top and base extremes in every column, and every change of what a vertex draws as", () => {
    // Mostly positive parts, a negative one now and then, so each change of side, state, quality
    // and projection stands alone and must keep its own two slots.
    const part = fc.oneof(
      { weight: 39, arbitrary: fc.integer({ min: 1, max: 50 }) },
      { weight: 1, arbitrary: fc.integer({ min: -50, max: -1 }) }
    );
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            a: fc.option(part, { freq: 40 }),
            b: fc.option(part, { freq: 40 }),
            estimated: fc.integer({ min: 0, max: 99 }).map((draw) => draw === 0),
          }),
          { minLength: 2001, maxLength: 2600 }
        ),
        fc.integer({ min: 50, max: 400 }),
        fc.nat(),
        (draws: readonly Draw[], columns, cut) => {
          // Every slot from `projected` on lies in the projected tail.
          const projected = cut % draws.length;
          const rows = draws.map(({ a, b, estimated }, index) => ({
            name: `s${String(index)}`,
            a,
            b,
            qa: estimated && a !== null ? "estimated" : null,
            qb: null,
          }));
          const chart = model(rows, "s", (key) => `q${key}`, `s${String(projected)}`);
          const [lower, upper] = chart.series;
          if (lower === undefined || upper === undefined) return;
          const drawn = new Set(seriesPath(chart, upper, [], columns).vertices.map(({ slot }) => slot));
          expect(seriesPath(chart, lower, [], columns).vertices.map(({ slot }) => slot)).toEqual([...drawn]);
          const ends = draws.map(stackedEnds);
          const edges = Array.from({ length: columns + 1 }, (_, bucket) =>
            Math.ceil((bucket * draws.length) / columns)
          );
          for (let bucket = 0; bucket < columns; bucket += 1) {
            const slots = Array.from(
              { length: (edges[bucket + 1] ?? 0) - (edges[bucket] ?? 0) },
              (_, offset) => (edges[bucket] ?? 0) + offset
            );
            for (const member of ["a", "b"] as const) {
              for (const end of ["top", "base"] as const) {
                const at = (list: readonly number[]) =>
                  list.flatMap((slot) => {
                    const value = ends[slot]?.[member]?.[end];
                    return value === undefined ? [] : [value];
                  });
                const raw = at(slots);
                if (raw.length === 0) continue;
                const kept = at(slots.filter((slot) => drawn.has(slot)));
                expect([Math.min(...kept), Math.max(...kept)], `${member} ${end} ${String(bucket)}`).toEqual([
                  Math.min(...raw),
                  Math.max(...raw),
                ]);
              }
            }
          }
          // A slot without a reading is missing between a series' first and last reading, else
          // pending; a reading sits on the side of zero its sign gives it.
          const spans = (["a", "b"] as const).map((key) => {
            const readings = draws.flatMap((draw, at) => (draw[key] === null ? [] : [at]));
            return { key, first: readings[0] ?? -1, last: readings.at(-1) ?? -1 };
          });
          const classOf = (index: number): string => {
            const draw = draws[index];
            const states = spans.map(({ key, first, last }) => {
              const value = draw?.[key] ?? null;
              if (value !== null) return value < 0 ? "negative" : "positive";
              return index > first && index < last ? "missing" : "pending";
            });
            const estimated = draw?.a !== null && draw?.estimated === true;
            return `${states.join(" ")} ${String(estimated)} ${String(index >= projected)}`;
          };
          for (let index = 1; index < draws.length; index += 1) {
            if (classOf(index - 1) !== classOf(index)) {
              expect([drawn.has(index - 1), drawn.has(index)], String(index)).toEqual([true, true]);
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});
