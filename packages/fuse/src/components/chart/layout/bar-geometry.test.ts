// Unit under test: the bar geometry of layout/bar-geometry.ts. Oracles: section 8.12's form
// threshold and M4 buckets, brute-forced over E13's committed hourly year; evilcharts'
// getBarGrowAnimation step formulas for a 5-bar fixture, written by hand; and stacked tops and
// heights written by hand under a niced domain.
import { describe, expect, it } from "vitest";

import year from "../format/fixtures/elhub/no1-household-hourly-2025-10_2026-09.json" with { type: "json" };
import {
  barCells,
  barForm,
  columnsPath,
  introStep,
  isNegative,
  isStackTop,
  pathColumns,
} from "./bar-geometry";
import { buildCartesianModel } from "./cartesian-model";

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
  it("draws HTML boxes up to 100 slots and paths above", () => {
    expect(barForm(categories(100), "vertical")).toBe("html");
    expect(barForm(categories(101), "vertical")).toBe("path");
  });

  it("keeps horizontal bars in the HTML form at any count", () => {
    // Section 8.12: each horizontal category takes a row of its own, so the rows never grow dense.
    expect(barForm(categories(101), "horizontal")).toBe("html");
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
    expect(barCells(model, p, model.y.domain)).toEqual([
      { slot: 0, position: 0, top: 62.5, height: 37.5, negative: false, stackTop: false },
      { slot: 1, position: 1, top: 75, height: 25, negative: false, stackTop: false },
    ]);
    expect(barCells(model, q, model.y.domain)).toEqual([
      { slot: 0, position: 0, top: 0, height: 62.5, negative: false, stackTop: true },
      { slot: 1, position: 1, top: 50, height: 25, negative: false, stackTop: true },
    ]);
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
    const columns = pathColumns(model, series, [0, 4]);
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

  it("writes one closed rectangle per column", () => {
    expect(columnsPath([{ x0: 0.125, x1: 0.875, top: 25, bottom: 100, slot: 0 }])).toBe(
      "M0.125 25H0.875V100H0.125Z"
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
  it("places a negative bar below zero and counts positions from the window's first slot", () => {
    // The window holds y and z. Values 4 and -4 nice to [-4, 4], so zero sits at 50 %.
    const rows = [
      { name: "x", v: 1 },
      { name: "y", v: 4 },
      { name: "z", v: -4 },
    ];
    const windowed = model(rows, ["v"], false, ["y", "z"]);
    const series = windowed.series[0];
    if (series === undefined) throw new Error("no series");
    expect(barCells(windowed, series, [-4, 4])).toEqual([
      { slot: 1, position: 0, top: 0, height: 50, negative: false, stackTop: true },
      { slot: 2, position: 1, top: 50, height: 50, negative: true, stackTop: true },
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
    const windowed = model(rows, ["v"], false, ["y", "z"]);
    const series = windowed.series[0];
    if (series === undefined) throw new Error("no series");
    expect(pathColumns(windowed, series, [0, 4])).toEqual([
      { x0: 1.125, x1: 1.875, top: 0, bottom: 100, slot: 2 },
    ]);
  });

  it("joins columns into one path", () => {
    expect(
      columnsPath([
        { x0: 0, x1: 1, top: 10, bottom: 20, slot: 0 },
        { x0: 2, x1: 3, top: 30, bottom: 40, slot: 1 },
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
      const drawn = pathColumns(stack, series, domain).map((column) => ({
        slot: column.slot,
        negative: column.bottom > 100 * (24 / 30) + 1e-9,
      }));
      expect(drawn, series.key).toEqual(expected(series));
    }
  });
});

describe("grouped path columns", () => {
  it("splits each band into the group's sub-bands as the HTML form does", () => {
    // 101 categories take the path form. The band of slot 0 runs from 0.125 to 0.875 after the
    // 25 % gap, and two sub-bands halve its 0.75 width.
    const rows = Array.from({ length: 101 }, (_, index) => ({ name: `c${String(index)}`, a: 2, b: 4 }));
    const grouped = model(rows, ["a", "b"], false);
    const [a, b] = grouped.series;
    if (a === undefined || b === undefined) throw new Error("no series");
    expect(pathColumns(grouped, a, [0, 4], { index: 0, count: 2 })[0]).toEqual({
      x0: 0.125,
      x1: 0.5,
      top: 50,
      bottom: 100,
      slot: 0,
    });
    expect(pathColumns(grouped, b, [0, 4], { index: 1, count: 2 })[0]).toEqual({
      x0: 0.5,
      x1: 0.875,
      top: 0,
      bottom: 100,
      slot: 0,
    });
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
    const columns = pathColumns(many, series, [0, 8]);
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
    expect(pathColumns(many, series, [0, 8]).map(({ slot }) => slot % 5)).toEqual(
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
    expect(pathColumns(many, series, [-2, 2]).map(({ slot }) => slot % 5)).toEqual(
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
    const columns = pathColumns(many, series, [-10, 10]);
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
    const columns = pathColumns(many, series, [-4, 4]);
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
    const columns = pathColumns(windowed, series, [0, 2]);
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
    expect(pathColumns(many, series, [-4, 4]).map(({ slot }) => slot % 5)).toEqual(
      Array.from({ length: 500 }, () => 0)
    );
  });
});

describe("edge cases of the forms", () => {
  it("draws nothing for a chart with no rows", () => {
    const empty = model([], ["v"], false);
    const series = empty.series[0];
    if (series === undefined) throw new Error("no series");
    expect(barCells(empty, series, [0, 1])).toEqual([]);
    expect(pathColumns(empty, series, [0, 1])).toEqual([]);
  });

  it("draws exactly 2,000 slots one column each, the last count before M4", () => {
    const rows = Array.from({ length: 2000 }, (_, index) => ({
      name: `c${String(index)}`,
      v: 1 + (index % 3),
    }));
    const many = model(rows, ["v"], false);
    const series = many.series[0];
    if (series === undefined) throw new Error("no series");
    expect(pathColumns(many, series, [0, 3])).toHaveLength(2000);
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
    const columns = pathColumns(many, series, [-4, 4]);
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

  it("draws no HTML bar for a missing reading", () => {
    const model = twoStacks([
      { name: "a", p: 1, q: 1, r: 1, t: 1 },
      { name: "b", p: null, q: 1, r: 1, t: 1 },
    ]);
    const p = model.series[0];
    if (p === undefined) throw new Error("no series");
    expect(barCells(model, p, [0, 2]).map(({ slot }) => slot)).toEqual([0]);
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
    const slots = (series: typeof p) => pathColumns(model, series, [-4, 8]).map(({ slot }) => slot);
    // p draws slot 0 above zero and slot 1 below in bucket 0, the first tie at slot 5, and every
    // later bucket's first slot, with no negative column where no slot holds a negative.
    expect(slots(p)).toEqual([0, 1, 5, ...firsts]);
    expect(slots(q)).toEqual([0, 5, ...firsts]);
    // r's own stack s2 tops at slot 2 with 6 + 1, where s1's totals would pick slot 0.
    expect(slots(r)).toEqual([2, 5, ...firsts]);
  });
});
