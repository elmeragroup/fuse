// Unit under test: the bar geometry of layout/bar-geometry.ts, and the path form's columns up to
// 2,000 slots through their production owner, layoutColumns and columnsDrawing. Oracles: section
// 8.12's form threshold and M4 buckets, brute-forced over E13's committed hourly year; evilcharts'
// getBarGrowAnimation step formulas for a 5-bar fixture, written by hand; stacked extents read off
// the rows by hand; and pixel rectangles worked by hand from section 8.15's band layout on plots
// of whole pixels, so snapping changes nothing.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { columnsDrawing, layoutColumns } from "../chart-bar-columns";
import year from "../format/fixtures/elhub/no1-household-hourly-2025-10_2026-09.json" with { type: "json" };
import {
  barCells,
  barForm,
  barRect,
  barTip,
  bucketColumns,
  geometryRect,
  hangs,
  introStep,
  isNegative,
  isStackTop,
  rectsPath,
} from "./bar-geometry";
import { buildCartesianModel } from "./cartesian-model";
import type { CartesianModel, SeriesModel } from "./cartesian-model";
import { WHOLE_BAND, optionBand, plotFrame } from "./plot-frame";
import type { BarMetrics, PlotBox, PlotFrame, PlotRect, SubBand } from "./plot-frame";

/** A plot of whole pixels, at 1x unless a ratio is given. */
function box(width: number, height: number, dpr = 1): PlotBox {
  return { width, height, dpr, left: 0, top: 0 };
}

/** The first cell of a model's first series. */
function firstCell(model: ReturnType<typeof buildCartesianModel>) {
  const series = model.series[0];
  const cell = series === undefined ? undefined : barCells(model, series)[0];
  if (cell === undefined) throw new Error("no cell");
  return cell;
}

/** The contract's default spacing: a 25 % band gap and 2 px bar gap and seam. */
const METRICS: BarMetrics = { bandGap: 0.25, barGap: 2, seam: 2 };

/** The rectangles of one path's `d`, each an `M x y H x V y H x Z` subpath. */
function rectsOf(d: string): PlotRect[] {
  return [...d.matchAll(/M(-?[\d.]+) (-?[\d.]+)H(-?[\d.]+)V(-?[\d.]+)/gu)].map(([, x, y, right, bottom]) => ({
    x: Number(x),
    y: Number(y),
    width: Number(right) - Number(x),
    height: Number(bottom) - Number(y),
  }));
}

/**
 * A series' path-form columns as the production owner lays them out and draws them: the entries
 * and the drawn fill, one rectangle per reading with length, in slot order.
 */
function pathForm(chart: CartesianModel, series: SeriesModel, frame: PlotFrame, sub: SubBand = WHOLE_BAND) {
  const paint = { key: series.key, color: "chart-1", bins: undefined, base: "", stops: undefined } as const;
  const update = {
    kind: "initial",
    keys: [],
    relays: false,
    from: new Map<string, readonly [number, number]>(),
    mounted: new Set<string>(),
    gliding: new Set<string>(),
    layouts: { relays: false, moved: new Set<string>() },
  } as const;
  const layout = layoutColumns({ model: chart, update }, series, frame, METRICS, sub, paint, new Set());
  const drawing = columnsDrawing(frame, layout.topology, layout.values);
  return { layout, fill: drawing.fills[0] ?? "", rects: rectsOf(drawing.fills[0] ?? "") };
}

function categories(count: number) {
  return buildCartesianModel({
    rows: Array.from({ length: count }, (_, index) => ({ name: `c${String(index)}`, v: index + 1 })),
    series: [["v", {}]],
    xKey: "name",
    stackOffset: "diverging",
    baseline: "zero",
    include: [],
  });
}

describe("the bar form", () => {
  it("draws one element per bar up to 100 slots and paths above", () => {
    expect(barForm(categories(100), "vertical")).toBe("bars");
    expect(barForm(categories(101), "vertical")).toBe("path");
  });

  it("keeps horizontal bars one element each at any count", () => {
    // Section 8.12: each horizontal category takes a row of its own, so the rows never grow dense.
    expect(barForm(categories(101), "horizontal")).toBe("bars");
  });
});

describe("stacked cells", () => {
  it("places each segment by hand under the niced domain", () => {
    // Totals 3 + 5 = 8 and 2 + 2 = 4 under a domain niced from [0, 8] to [0, 8] in steps of 2.
    const model = buildCartesianModel({
      rows: [
        { name: "a", p: 3, q: 5 },
        { name: "b", p: 2, q: 2 },
      ],
      series: [
        ["p", { stack: "s" }],
        ["q", { stack: "s" }],
      ],
      xKey: "name",
      stackOffset: "diverging",
      baseline: "zero",
      include: [],
    });
    const [p, q] = model.series;
    if (p === undefined || q === undefined) throw new Error("no series");
    expect(barCells(model, p)).toEqual([
      { slot: 0, position: 0, span: 1, extent: [0, 3], negative: false, stackTop: false },
      { slot: 1, position: 1, span: 1, extent: [0, 2], negative: false, stackTop: false },
    ]);
    expect(barCells(model, q)).toEqual([
      { slot: 0, position: 0, span: 1, extent: [3, 8], negative: false, stackTop: true },
      { slot: 1, position: 1, span: 1, extent: [2, 4], negative: false, stackTop: true },
    ]);
  });

  it("ends an inner segment a seam short of the next one, and keeps the outer one whole", () => {
    // Two 80 px bands on a 160 x 80 plot over [0, 8], so 10 px per unit. Slot a's bar spans
    // 10 to 70 px after the 25 % gap. p fills 0 to 3, 50 to 80 px down, less the 2 px seam at its
    // top, and q fills 3 to 8, 0 to 50 px down.
    const model = buildCartesianModel({
      rows: [{ name: "a", p: 3, q: 5 }],
      series: [
        ["p", { stack: "s" }],
        ["q", { stack: "s" }],
      ],
      xKey: "name",
      stackOffset: "diverging",
      baseline: "zero",
      include: [],
    });
    const [p, q] = model.series;
    if (p === undefined || q === undefined) throw new Error("no series");
    const frame = plotFrame(box(80, 80), "vertical", 1, [0, 8]);
    const [inner] = barCells(model, p);
    const [outer] = barCells(model, q);
    if (inner === undefined || outer === undefined) throw new Error("no cells");
    expect(barRect(frame, inner, METRICS, WHOLE_BAND, "cut")).toEqual({
      x: 10,
      y: 52,
      width: 60,
      height: 28,
    });
    expect(barRect(frame, inner, METRICS, WHOLE_BAND, "whole")).toEqual({
      x: 10,
      y: 50,
      width: 60,
      height: 30,
    });
    expect(barRect(frame, outer, METRICS, WHOLE_BAND, "cut")).toEqual({ x: 10, y: 0, width: 60, height: 50 });
  });
});

describe("bar rectangles in pixels", () => {
  /** Two keys, one row, so the band is the whole plot width. */
  function pair(a: number, b: number) {
    return buildCartesianModel({
      rows: [{ name: "x", a, b }],
      series: [
        ["a", {}],
        ["b", {}],
      ],
      xKey: "name",
      stackOffset: "diverging",
      baseline: "zero",
      include: [],
    });
  }

  it("draws a two-key group's bars 14 px wide at 5 and 21 px of a 40 px band", () => {
    // Section 8.15: a 40 px band less 25 % leaves 30 px, and a 2 px gap halves the rest to 14 px.
    const model = pair(4, 2);
    const frame = plotFrame(box(40, 100), "vertical", 1, [0, 4]);
    const [a, b] = model.series.map((series) => barCells(model, series)[0]);
    if (a === undefined || b === undefined) throw new Error("no cells");
    expect(barRect(frame, a, METRICS, { index: 0, count: 2 }, "cut")).toEqual({
      x: 5,
      y: 0,
      width: 14,
      height: 100,
    });
    expect(barRect(frame, b, METRICS, { index: 1, count: 2 }, "cut")).toEqual({
      x: 21,
      y: 50,
      width: 14,
      height: 50,
    });
  });

  it("runs a horizontal bar from the zero line to the right, its row narrowed by the band gap", () => {
    // A 40 px tall row and a 200 px wide plot over [-2, 8], so zero sits at 40 px and 6 at 160 px.
    const model = pair(6, 0);
    const frame = plotFrame(box(200, 40), "horizontal", 1, [-2, 8]);
    expect(barRect(frame, firstCell(model), METRICS, WHOLE_BAND, "cut")).toEqual({
      x: 40,
      y: 5,
      width: 120,
      height: 30,
    });
  });

  it("hangs a negative bar below zero and puts its tip at its low end", () => {
    // A [-4, 4] domain on 80 px puts zero at 40 px and -3 at 70 px.
    const model = pair(-3, 1);
    const frame = plotFrame(box(40, 80), "vertical", 1, [-4, 4]);
    const cell = firstCell(model);
    expect(barRect(frame, cell, METRICS, WHOLE_BAND, "cut")).toEqual({ x: 5, y: 40, width: 30, height: 30 });
    expect(barTip(frame, cell)).toBe(70);
  });

  it("tweens a bar's tip unsnapped, and draws its far edge on the device pixel the browser gives it", () => {
    // 2 of [0, 3] on 80 px lies 26.67 px down, the tip a follower tweens, which the browser draws
    // on pixel 27.
    const frame = plotFrame(box(40, 80), "vertical", 1, [0, 3]);
    const cell = firstCell(pair(2, 1));
    expect(barTip(frame, cell)).toBeCloseTo(80 - (2 / 3) * 80, 12);
    expect(barRect(frame, cell, METRICS, WHOLE_BAND, "whole").y).toBe(27);
  });

  it("snaps every edge to whole device pixels of the plot", () => {
    // Three bands on a 50 px plot are 16.67 px wide, so the second bar spans 18.75 to 31.25 px,
    // which round to 18.5 and 31 at 2x, the edge at 18.75 lying half way and rounding left.
    const rows = ["a", "b", "c"].map((name) => ({ name, v: 2 }));
    const three = buildCartesianModel({
      rows,
      series: [["v", {}]],
      xKey: "name",
      stackOffset: "diverging",
      baseline: "zero",
      include: [],
    });
    const [, second] = three.series[0] === undefined ? [] : barCells(three, three.series[0]);
    if (second === undefined) throw new Error("no cell");
    const rect = barRect(
      plotFrame(box(50, 100, 2), "vertical", 3, [0, 2]),
      second,
      METRICS,
      WHOLE_BAND,
      "cut"
    );
    expect([rect.x, rect.x + rect.width]).toEqual([18.5, 31]);
  });
});

describe("M4 decimation of path-form bars", () => {
  it("draws every bucket's maximum and its base over the hourly year", () => {
    const start = Date.parse(year.start);
    const rows = year.values.map((value, index) => ({ at: start + index * 3_600_000, kwh: value }));
    // The year holds 8,760 hours as instants an hour apart, so slot starts follow the instants.
    const model = buildCartesianModel({
      rows,
      series: [["kwh", {}]],
      xKey: "at",
      time: { interval: "hour", timeZone: "Europe/Oslo" },
      stackOffset: "diverging",
      baseline: "zero",
      include: [],
    });
    const series = model.series[0];
    if (series === undefined) throw new Error("no series");
    const columns = bucketColumns(model, series, [0, 4]);
    // Brute force: bucket i of 500 holds the slots whose floor(slot × 500 / n) is i.
    const n = year.values.length;
    const maxima = new Map<number, number>();
    year.values.forEach((value, slot) => {
      const bucket = Math.floor((slot * 500) / n);
      maxima.set(bucket, Math.max(maxima.get(bucket) ?? Number.NEGATIVE_INFINITY, value));
    });
    expect(columns).toHaveLength(500);
    columns.forEach((column, bucket) => {
      expect(column.top, String(bucket)).toBeCloseTo(100 - ((maxima.get(bucket) ?? 0) / 4) * 100, 9);
      expect(column.bottom).toBe(100);
    });
  });

  it("projects a column into the plot and writes it as one closed rectangle", () => {
    // Two slots on a 200 x 80 plot over [0, 4], so 100 px per slot. The second slot's 3 reaches
    // 20 px down, and its column keeps 1.125 to 1.875 slots, 112.5 to 187.5 px, whose edges lie
    // half way between two pixels and round toward the left. The first slot's 0 draws nothing.
    const two = model(
      [
        { name: "a", v: 0 },
        { name: "b", v: 3 },
      ],
      ["v"],
      false
    );
    const series = two.series[0];
    if (series === undefined) throw new Error("no series");
    expect(pathForm(two, series, plotFrame(box(200, 80), "vertical", 2, [0, 4])).fill).toBe(
      "M112 20H187V80H112Z"
    );
  });
});

describe("the entrance wipe", () => {
  it.each([
    ["left", [0, 1, 2, 3, 4]],
    ["right", [4, 3, 2, 1, 0]],
    ["center", [2, 1, 0, 1, 2]],
    ["edges", [0, 1, 2, 1, 0]],
  ] as const)("delays a 5-bar %s wipe by these steps of 16 ms", (intro, steps) => {
    expect([0, 1, 2, 3, 4].map((position) => introStep(intro, position, 5))).toEqual(steps);
  });
});

/** A category model with stacked or loose keys, in config order. */
function model(
  rows: readonly { readonly [key: string]: number | string | null }[],
  keys: readonly string[],
  stacked: boolean,
  xRange?: readonly [string, string]
) {
  return buildCartesianModel({
    rows,
    series: keys.map((key) => [key, stacked ? { stack: "s" } : {}] as const),
    xKey: "name",
    stackOffset: "diverging",
    baseline: "zero",
    include: [],
    xRange,
  });
}

describe("a bar drawn from its geometry", () => {
  // A 200 px tall plot. A bar from 10 to 30 px along, with its base on the baseline at 100 px.
  const vertical = plotFrame(box(40, 200), "vertical", 1, [-4, 4]);
  const horizontal = plotFrame(box(200, 40), "horizontal", 1, [-4, 4]);

  it("spans its base to its tip on either side, and nothing where its tip meets its base", () => {
    // A tip at 50 px draws up from the base, one at 150 px down from it, one at 100 px nothing.
    expect(geometryRect(vertical, [10, 30, 100, 50, 0, 1])).toEqual({ x: 10, width: 20, y: 50, height: 50 });
    expect(geometryRect(vertical, [10, 30, 100, 150, 0, 1])).toEqual({
      x: 10,
      width: 20,
      y: 100,
      height: 50,
    });
    expect(geometryRect(vertical, [10, 30, 100, 100, 0, 1]).height).toBe(0);
  });

  it("stops its drawn seam short of its tip, toward its base, and keeps no more than its length", () => {
    // A 2 px seam ends the 50 px bar at 52 px above the base, or at 148 px below it, a bar 1 px
    // long keeps nothing, and a seam halfway open in a tween frame, 1 px, ends it at 51 px.
    expect(geometryRect(vertical, [10, 30, 100, 50, 2, 1])).toEqual({ x: 10, width: 20, y: 52, height: 48 });
    expect(geometryRect(vertical, [10, 30, 100, 150, 2, 1])).toEqual({
      x: 10,
      width: 20,
      y: 100,
      height: 48,
    });
    expect(geometryRect(vertical, [10, 30, 100, 99, 2, 1]).height).toBe(0);
    expect(geometryRect(vertical, [10, 30, 100, 50, 1, 0.5])).toEqual({
      x: 10,
      width: 20,
      y: 51,
      height: 49,
    });
  });

  it("hangs below its base once its tip passes it: down a vertical plot and left along a horizontal one", () => {
    expect([50, 100, 150].map((tip) => hangs(vertical, [10, 30, 100, tip, 0, 1]))).toEqual([
      false,
      false,
      true,
    ]);
    expect([50, 100, 150].map((tip) => hangs(horizontal, [10, 30, 100, tip, 0, 1]))).toEqual([
      true,
      false,
      false,
    ]);
  });
});

describe("isNegative", () => {
  it.each([
    [[-3, 0], true],
    [[-3, -1], true],
    [[0, 3], false],
    [[0, 0], false],
    [[-2, 1], false],
  ] as const)("reads %j as %s", (extent, negative) => {
    expect(isNegative(extent)).toBe(negative);
  });
});

describe("isStackTop", () => {
  it("marks each side's outer segment of a diverging stack", () => {
    // p = 3 fills [0, 3], q = -2 fills [-2, 0] and r = -1 fills [-3, -2], below q.
    const stack = model([{ name: "x", p: 3, q: -2, r: -1 }], ["p", "q", "r"], true);
    expect(stack.series.map((series) => isStackTop(stack, series, 0))).toEqual([true, false, true]);
  });

  it("marks the upper of two positive segments, and neither a zero segment nor a missing one", () => {
    // d3's diverging offset puts a zero at [0, 0], under the positive segments, per offset-diverging.json.
    const stack = model([{ name: "x", p: 3, q: 2, z: 0, m: null }], ["p", "q", "z", "m"], true);
    expect(stack.series.map((series) => isStackTop(stack, series, 0))).toEqual([false, true, false, false]);
  });

  it("marks every bar of a loose series", () => {
    const loose = model([{ name: "x", p: 3, q: 5 }], ["p", "q"], false);
    expect(loose.series.map((series) => isStackTop(loose, series, 0))).toEqual([true, true]);
  });
});

describe("barCells of a window", () => {
  it("counts positions from the window's first slot and marks a negative bar", () => {
    const rows = [
      { name: "x", v: 1 },
      { name: "y", v: 4 },
      { name: "z", v: -4 },
    ];
    const windowed = model(rows, ["v"], false, ["y", "z"]);
    const series = windowed.series[0];
    if (series === undefined) throw new Error("no series");
    expect(barCells(windowed, series)).toEqual([
      { slot: 1, position: 0, span: 1, extent: [0, 4], negative: false, stackTop: true },
      { slot: 2, position: 1, span: 1, extent: [-4, 0], negative: true, stackTop: true },
    ]);
  });
});

describe("path columns up to 2,000 slots", () => {
  it("draws one column per drawn slot of the window, a quarter slot narrower, and none for zero", () => {
    const rows = [
      { name: "x", v: 2 },
      { name: "y", v: 0 },
      { name: "z", v: 4 },
    ];
    // The window y to z on 200 x 100 px over [0, 4]: y's 0 draws nothing, and z's 4 at the
    // window's second slot spans 112.5 to 187.5 px, snapped left, from the top to the baseline.
    const windowed = model(rows, ["v"], false, ["y", "z"]);
    const series = windowed.series[0];
    if (series === undefined) throw new Error("no series");
    expect(pathForm(windowed, series, plotFrame(box(200, 100), "vertical", 2, [0, 4])).fill).toBe(
      "M112 0H187V100H112Z"
    );
  });

  it("joins rectangles into one path", () => {
    expect(
      rectsPath([
        { x: 0, y: 10, width: 1, height: 10 },
        { x: 2, y: 30, width: 1, height: 10 },
      ])
    ).toBe("M0 10H1V20H0ZM2 30H3V40H2Z");
  });
});

describe("decimated stacked path columns", () => {
  it("draws each bucket's column of the slot with the largest total on each side", () => {
    // 2,500 slots. p rises and q falls in a sawtooth, and every 7th slot q turns negative.
    const count = 2500;
    const rows = Array.from({ length: count }, (_, index) => ({
      name: `c${String(index)}`,
      p: 1 + (index % 11),
      q: index % 7 === 0 ? -(1 + (index % 5)) : 1 + ((index * 3) % 13),
    }));
    const stack = model(rows, ["p", "q"], true);
    const [p, q] = stack.series;
    if (p === undefined || q === undefined) throw new Error("no series");
    const domain: readonly [number, number] = [-6, 24];
    // Brute force: for each bucket, the slot with the largest positive and negative stack totals.
    const expected = (series: typeof q) => {
      const columns: { slot: number; negative: boolean }[] = [];
      for (let bucket = 0; bucket < 500; bucket += 1) {
        const slots = Array.from({ length: count }, (_, slot) => slot).filter(
          (slot) => Math.floor((slot * 500) / count) === bucket
        );
        for (const negative of [false, true]) {
          let best = -1;
          let size = 0;
          for (const slot of slots) {
            const values = [rows[slot]?.p ?? 0, rows[slot]?.q ?? 0];
            const total = negative
              ? values.filter((v) => v < 0).reduce((a, b) => a + b, 0)
              : values.filter((v) => v > 0).reduce((a, b) => a + b, 0);
            if (Math.abs(total) > size) {
              size = Math.abs(total);
              best = slot;
            }
          }
          const value = best === -1 ? 0 : ((series.key === "p" ? rows[best]?.p : rows[best]?.q) ?? 0);
          if (best !== -1 && value !== 0 && value < 0 === negative) columns.push({ slot: best, negative });
        }
      }
      return columns;
    };
    for (const series of [p, q]) {
      const drawn = bucketColumns(stack, series, domain).map((column) => ({
        slot: column.slot,
        negative: column.bottom > 100 * (24 / 30) + 1e-9,
      }));
      expect(drawn, series.key).toEqual(expected(series));
    }
  });
});

describe("grouped path columns", () => {
  it("splits each band into the group's sub-bands as the bars form does", () => {
    // 101 categories on 1,010 x 100 px, 10 px a slot. The band of slot 0 runs from 1.25 to
    // 8.75 px after the 25 % gap, and two sub-bands halve its 7.5 px: a from 1.25 to 5 px at 2 of
    // [0, 4], halfway down, and b from 5 to 8.75 px at 4, from the top. The fill snaps them to
    // whole pixels inside the band's.
    const rows = Array.from({ length: 101 }, (_, index) => ({ name: `c${String(index)}`, a: 2, b: 4 }));
    const grouped = model(rows, ["a", "b"], false);
    const [a, b] = grouped.series;
    if (a === undefined || b === undefined) throw new Error("no series");
    const frame = plotFrame(box(1010, 100), "vertical", 101, [0, 4]);
    const first = pathForm(grouped, a, frame, { index: 0, count: 2 });
    const second = pathForm(grouped, b, frame, { index: 1, count: 2 });
    // An entry's numbers: its middle, tip, span, base, tick span and emphasis span.
    expect(first.layout.values.slice(1, 5)).toEqual([50, 1.25, 5, 100]);
    expect(second.layout.values.slice(1, 5)).toEqual([0, 5, 8.75, 100]);
    expect([first.rects[0], second.rects[0]]).toEqual([
      { x: 1, y: 50, width: 4, height: 50 },
      { x: 5, y: 0, width: 4, height: 100 },
    ]);
  });

  /** The second series' column at a category, drawn on a plot of a width at 1x. */
  function secondColumn(categories: number, width: number, category: number) {
    const rows = Array.from({ length: categories }, (_, index) => ({
      name: `c${String(index)}`,
      a: 2,
      b: 4,
    }));
    const grouped = model(rows, ["a", "b"], false);
    const second = grouped.series[1];
    if (second === undefined) throw new Error("no series");
    const frame = plotFrame(box(width, 100), "vertical", categories, [0, 4]);
    const rect = pathForm(grouped, second, frame, { index: 1, count: 2 }).rects[category];
    if (rect === undefined) throw new Error("no column");
    return [rect.x, rect.x + rect.width];
  }

  it("keeps category 1's second column of 400 on 240 px in its band's pixel [0, 1]", () => {
    // Q5-1: category 1's band [0.6, 1.2] snaps both edges to 1 and keeps the pixel before, [0, 1].
    // Its second column [0.9, 1.125] snaps both edges to 1 too, and keeps that pixel, not [1, 2].
    expect(secondColumn(400, 240, 1)).toEqual([0, 1]);
  });

  it("keeps the fourth category's second column of 365 on 200 px in its band's pixel [1, 2]", () => {
    // B5-1: the fourth band [1.64, 2.19] keeps [1, 2], and its second column [1.92, 2.12], whose
    // middle lies past 2, keeps the band's pixel, not [2, 3].
    expect(secondColumn(365, 200, 3)).toEqual([1, 2]);
  });

  it("keeps every grouped column of one slot inside the band its interaction marks use", () => {
    // Expectation: each column's drawn pixels lie within its slot's option band, the band the
    // overlay, the focused option, the crosshair and the tooltip anchor draw, and keep at least
    // one device pixel.
    fc.assert(
      fc.property(
        fc.integer({ min: 101, max: 400 }),
        fc.double({ min: 40, max: 2000, noNaN: true }),
        fc.double({ min: 1, max: 3, noNaN: true }),
        fc.double({ min: -300, max: 300, noNaN: true }),
        fc.integer({ min: 1, max: 4 }),
        fc.nat(),
        (categories, width, dpr, left, group, index) => {
          const keys = Array.from({ length: group }, (_, key) => `s${String(key)}`);
          const rows = Array.from({ length: categories }, (_, slot) => ({
            name: `c${String(slot)}`,
            ...Object.fromEntries(keys.map((key) => [key, 2])),
          }));
          const grouped = model(rows, keys, false);
          const series = grouped.series[index % group];
          if (series === undefined) throw new Error("no series");
          const frame = plotFrame({ width, height: 100, dpr, left, top: 0 }, "vertical", categories, [0, 4]);
          // Every reading is 2, so the fill draws one rectangle per slot, in slot order.
          const { rects } = pathForm(grouped, series, frame, { index: index % group, count: group });
          expect(rects).toHaveLength(categories);
          for (const [position, rect] of rects.entries()) {
            const [start, end] = optionBand(frame, position, "band");
            expect(rect.x).toBeGreaterThanOrEqual(start - 1e-9);
            expect(rect.x + rect.width).toBeLessThanOrEqual(end + 1e-9);
            expect(rect.width).toBeGreaterThanOrEqual(1 / dpr - 1e-9);
          }
        }
      ),
      { numRuns: 60 }
    );
  });
});

describe("decimated column identity", () => {
  it("gives each bucket's column the slot of its maximum, so its value and step are the maximum's", () => {
    // 2,500 slots repeat [1, 7, 1, 1, 1], so each bucket of 5 holds its 7 at its second slot.
    const rows = Array.from({ length: 2500 }, (_, index) => ({
      name: `c${String(index)}`,
      v: index % 5 === 1 ? 7 : 1,
    }));
    const many = model(rows, ["v"], false);
    const series = many.series[0];
    if (series === undefined) throw new Error("no series");
    const columns = bucketColumns(many, series, [0, 8]);
    expect(columns).toHaveLength(500);
    for (const [bucket, column] of columns.entries()) {
      expect(column.slot).toBe(bucket * 5 + 1);
      const reading = series.readings[column.slot];
      expect(reading?.kind === "reading" ? reading.value : null).toBe(7);
    }
  });

  it("keeps the first of two tied maxima, as section 8.12's M4 rule keeps the first occurrence", () => {
    // Each bucket of 5 holds 7 at its second and fourth slots.
    const rows = Array.from({ length: 2500 }, (_, index) => ({
      name: `c${String(index)}`,
      v: index % 5 === 1 || index % 5 === 3 ? 7 : 1,
    }));
    const many = model(rows, ["v"], false);
    const series = many.series[0];
    if (series === undefined) throw new Error("no series");
    expect(bucketColumns(many, series, [0, 8]).map(({ slot }) => slot % 5)).toEqual(
      Array.from({ length: 500 }, () => 1)
    );
  });

  it("gives a column whose extremes tie in size the slot of its positive one", () => {
    // Each bucket of 5 holds -2 at its first slot and 2 at its third.
    const rows = Array.from({ length: 2500 }, (_, index) => ({
      name: `c${String(index)}`,
      v: index % 5 === 0 ? -2 : index % 5 === 2 ? 2 : 1,
    }));
    const many = model(rows, ["v"], false);
    const series = many.series[0];
    if (series === undefined) throw new Error("no series");
    expect(bucketColumns(many, series, [-2, 2]).map(({ slot }) => slot % 5)).toEqual(
      Array.from({ length: 500 }, () => 2)
    );
  });

  it("reads each bucket's own slots only, and draws none for a bucket with no reading", () => {
    // Slot 1 holds -10 and every other slot holds 1, so only bucket 0 reaches below zero. The
    // second bucket, slots 5 to 9, holds no reading at all.
    const rows = Array.from({ length: 2500 }, (_, index) => ({
      name: `c${String(index)}`,
      v: index === 1 ? -10 : index >= 5 && index < 10 ? null : 1,
    }));
    const many = model(rows, ["v"], false);
    const series = many.series[0];
    if (series === undefined) throw new Error("no series");
    const columns = bucketColumns(many, series, [-10, 10]);
    // 499 buckets draw, bucket 1 none. Under [-10, 10], 0 lands at 50 % and 1 at 45 %.
    expect(columns).toHaveLength(499);
    expect(columns[0]?.slot).toBe(1);
    expect(columns[0]?.top).toBeCloseTo(45, 9);
    expect(columns[0]?.bottom).toBeCloseTo(100, 9);
    for (const column of columns.slice(1)) {
      expect(column.top).toBeCloseTo(45, 9);
      expect(column.bottom).toBeCloseTo(50, 9);
    }
  });

  it("keeps a bucket whose last slot holds no reading, and the first of two tied minima", () => {
    // Each bucket of 5 holds -3 at its first and third slots and no reading at its last.
    const rows = Array.from({ length: 2500 }, (_, index) => ({
      name: `c${String(index)}`,
      v: index % 5 === 4 ? null : index % 5 === 0 || index % 5 === 2 ? -3 : 1,
    }));
    const many = model(rows, ["v"], false);
    const series = many.series[0];
    if (series === undefined) throw new Error("no series");
    const columns = bucketColumns(many, series, [-4, 4]);
    expect(columns).toHaveLength(500);
    expect(columns.map(({ slot }) => slot % 5)).toEqual(Array.from({ length: 500 }, () => 0));
  });

  it("buckets the window's slots only, from its first slot", () => {
    // 2,600 rows and a window from c100 to c2599, so 2,500 slots fall into 500 buckets of 5 and
    // the last column ends at slot 2,500 of the window.
    const rows = Array.from({ length: 2600 }, (_, index) => ({ name: `c${String(index)}`, v: 2 }));
    const windowed = model(rows, ["v"], false, ["c100", "c2599"]);
    const series = windowed.series[0];
    if (series === undefined) throw new Error("no series");
    const columns = bucketColumns(windowed, series, [0, 2]);
    expect(columns).toHaveLength(500);
    expect(columns[0]?.slot).toBe(100);
    expect(columns.at(-1)?.x1).toBe(2500);
  });

  it("gives a mixed-sign column the slot of its larger extreme", () => {
    // Each bucket of 5 holds -3 at its first slot and 2 at its second, so -3 is the larger extreme.
    const rows = Array.from({ length: 2500 }, (_, index) => ({
      name: `c${String(index)}`,
      v: index % 5 === 0 ? -3 : index % 5 === 1 ? 2 : 1,
    }));
    const many = model(rows, ["v"], false);
    const series = many.series[0];
    if (series === undefined) throw new Error("no series");
    expect(bucketColumns(many, series, [-4, 4]).map(({ slot }) => slot % 5)).toEqual(
      Array.from({ length: 500 }, () => 0)
    );
  });
});

describe("edge cases of the forms", () => {
  it("draws nothing for a chart with no rows", () => {
    const empty = model([], ["v"], false);
    const series = empty.series[0];
    if (series === undefined) throw new Error("no series");
    expect(barCells(empty, series)).toEqual([]);
    expect(bucketColumns(empty, series, [0, 1])).toEqual([]);
  });

  it("draws exactly 2,000 slots one column each, the last count before M4", () => {
    // 2,000 slots lay out one entry per slot, and 2,001 one per M4 bucket, 500 on any plot.
    const entries = (count: number) => {
      const rows = Array.from({ length: count }, (_, index) => ({
        name: `c${String(index)}`,
        v: 1 + (index % 3),
      }));
      const many = model(rows, ["v"], false);
      const series = many.series[0];
      if (series === undefined) throw new Error("no series");
      return pathForm(many, series, plotFrame(box(1000, 100), "vertical", count, [0, 3])).layout.keys.length;
    };
    expect([entries(2000), entries(2001)]).toEqual([2000, 500]);
  });

  it("reaches each decimated bucket's lowest negative extent for a loose series", () => {
    // 2,500 slots, so 5 per bucket, each bucket holding -3 at its first slot and 2 at its second.
    const rows = Array.from({ length: 2500 }, (_, index) => ({
      name: `c${String(index)}`,
      v: index % 5 === 0 ? -3 : index % 5 === 1 ? 2 : 1,
    }));
    const many = model(rows, ["v"], false);
    const series = many.series[0];
    if (series === undefined) throw new Error("no series");
    const columns = bucketColumns(many, series, [-4, 4]);
    expect(columns).toHaveLength(500);
    // -3 lands 87.5 % down a [-4, 4] plot and 2 lands 25 % down.
    for (const column of columns) expect([column.top, column.bottom]).toEqual([25, 87.5]);
  });

  it("compares a stacked segment with its own stack only", () => {
    // p and q stack to 5, and the loose r at 9 belongs to no stack, so q stays the stack's top.
    const mixed = buildCartesianModel({
      rows: [{ name: "x", p: 3, q: 2, r: 9 }],
      series: [
        ["p", { stack: "s" }],
        ["q", { stack: "s" }],
        ["r", {}],
      ],
      xKey: "name",
      stackOffset: "diverging",
      baseline: "zero",
      include: [],
    });
    expect(mixed.series.map((series) => isStackTop(mixed, series, 0))).toEqual([false, true, true]);
  });
});

describe("two stacks and a missing reading", () => {
  /** A model whose p and q share stack s1 and whose r and t share stack s2. */
  function twoStacks(rows: readonly { readonly [key: string]: number | string | null }[]) {
    return buildCartesianModel({
      rows,
      series: [
        ["p", { stack: "s1" }],
        ["q", { stack: "s1" }],
        ["r", { stack: "s2" }],
        ["t", { stack: "s2" }],
      ],
      xKey: "name",
      stackOffset: "diverging",
      baseline: "zero",
      include: [],
    });
  }

  it("marks a segment's top against its own stack, never the first stack", () => {
    // s1 stacks p to 1 and q to 2. s2 stacks r over [0, 5] and t over [5, 8], so r is no top even
    // though both of s1's segments end below 5.
    const model = buildCartesianModel({
      rows: [{ name: "x", p: 1, q: 1, r: 5, t: 3 }],
      series: [
        ["p", { stack: "s1" }],
        ["q", { stack: "s1" }],
        ["r", { stack: "s2" }],
        ["t", { stack: "s2" }],
      ],
      xKey: "name",
      stackOffset: "diverging",
      baseline: "zero",
      include: [],
    });
    expect(model.series.map((series) => isStackTop(model, series, 0))).toEqual([false, true, false, true]);
  });

  it("draws no bar for a missing reading", () => {
    const model = twoStacks([
      { name: "a", p: 1, q: 1, r: 1, t: 1 },
      { name: "b", p: null, q: 1, r: 1, t: 1 },
    ]);
    const p = model.series[0];
    if (p === undefined) throw new Error("no series");
    expect(barCells(model, p).map(({ slot }) => slot)).toEqual([0]);
  });

  it("picks each decimated column by its own stack's totals, first of ties, and skips an empty side", () => {
    // 2,500 slots make 500 buckets of 5. Every slot holds 1 in p, q, r and t, except these.
    // Bucket 0: slot 0 tops s1 at 2 + 2, slot 1 holds s1's only negative, p = -3, slot 2 tops s2
    // with r = 6, and q is missing at slot 3. Bucket 1: slots 5 and 6 tie s1 at 5 with p = 1 and 4.
    const pAt = new Map([
      [0, 2],
      [1, -3],
      [6, 4],
    ]);
    const qAt = new Map<number, number | null>([
      [0, 2],
      [3, null],
      [5, 4],
    ]);
    const rows = Array.from({ length: 2500 }, (_, index) => ({
      name: `c${String(index)}`,
      p: pAt.get(index) ?? 1,
      q: qAt.has(index) ? (qAt.get(index) ?? null) : 1,
      r: index === 2 ? 6 : 1,
      t: 1,
    }));
    const model = twoStacks(rows);
    const [p, q, r] = model.series;
    if (p === undefined || q === undefined || r === undefined) throw new Error("no series");
    const firsts = Array.from({ length: 498 }, (_, bucket) => (bucket + 2) * 5);
    const slots = (series: typeof p) => bucketColumns(model, series, [-4, 8]).map(({ slot }) => slot);
    // p draws slot 0 above zero and slot 1 below in bucket 0, the first tie at slot 5, and every
    // later bucket's first slot, with no negative column where no slot holds a negative.
    expect(slots(p)).toEqual([0, 1, 5, ...firsts]);
    expect(slots(q)).toEqual([0, 5, ...firsts]);
    // r's own stack s2 tops at slot 2 with 6 + 1, where s1's totals would pick slot 0.
    expect(slots(r)).toEqual([2, 5, ...firsts]);
  });
});
