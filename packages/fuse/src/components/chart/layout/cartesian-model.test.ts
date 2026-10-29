import { describe, expect, it } from "vitest";

import type { ChartRow } from "../chart-types";
import { buildCartesianModel } from "./cartesian-model";
import type { ModelInput } from "./cartesian-model";

// Every expectation below is written by hand from CONTRACT sections 8.2, 8.3, 8.6 and 8.12.

const day = (n: number): Date => new Date(Date.UTC(2025, 9, n - 1, 22));

const base = (rows: readonly ChartRow[], overrides: Partial<ModelInput> = {}): ModelInput => ({
  rows,
  series: [
    ["a", {}],
    ["b", {}],
  ],
  xKey: "x",
  time: { interval: "day", timeZone: "Europe/Oslo" },
  stackOffset: "diverging",
  baseline: "zero",
  include: [],
  ...overrides,
});

describe("buildCartesianModel", () => {
  const rows = [
    { x: day(1), a: 1, b: 2 },
    { x: day(2), a: 10, b: -3 },
    { x: day(3), a: 2, b: 4 },
  ];

  it("draws unstacked keys from 0 to their value and nices the domain over every key", () => {
    const model = buildCartesianModel(base(rows));
    expect(model.series.map(({ extents }) => extents)).toEqual([
      [
        [0, 1],
        [0, 10],
        [0, 2],
      ],
      [
        [0, 2],
        [-3, 0],
        [0, 4],
      ],
    ]);
    expect(model.y.domain).toEqual([-4, 10]);
    expect(model.stacks).toEqual([]);
  });

  it("stacks keys that share a stack id, in config order", () => {
    const model = buildCartesianModel(
      base(rows, {
        series: [
          ["a", { stack: "total" }],
          ["b", { stack: "total" }],
        ],
      })
    );
    expect(model.stacks).toEqual([{ id: "total", keys: ["a", "b"] }]);
    expect(model.series[1]?.extents).toEqual([
      [1, 3],
      [-3, 0],
      [2, 6],
    ]);
    expect(model.series.map(({ stack }) => stack)).toEqual(["total", "total"]);
  });

  it("reaches a stack's total in the domain, beyond any single part", () => {
    const model = buildCartesianModel(
      base([{ x: day(1), a: 5, b: 6 }], {
        series: [
          ["a", { stack: "total" }],
          ["b", { stack: "total" }],
        ],
      })
    );
    expect(model.y.domain).toEqual([0, 12]);
  });

  it("measures expanded keys by their fractions, never their raw values", () => {
    const model = buildCartesianModel(base([{ x: day(1), a: 5, b: -3 }], { stackOffset: "expand" }));
    expect(model.y.domain).toEqual([-1, 1]);
  });

  it("draws no extent where a key has no reading", () => {
    const model = buildCartesianModel(base([{ x: day(1), a: null, b: 2 }]));
    expect(model.series[0]?.extents).toEqual([null]);
  });

  it("keeps an empty layout at [0, 1] whatever yInclude asks", () => {
    const model = buildCartesianModel(base([{ x: day(1), a: null, b: null }], { include: [200] }));
    expect(model.y.domain).toEqual([0, 1]);
  });

  it("is not empty while one key holds one reading", () => {
    const model = buildCartesianModel(
      base([
        { x: day(1), a: null, b: null },
        { x: day(2), a: null, b: 4 },
      ])
    );
    expect(model.empty).toBe(false);
  });

  it("leaves a key with a stack of its own unstacked", () => {
    const model = buildCartesianModel(
      base(rows, {
        series: [
          ["a", { stack: "alone" }],
          ["b", {}],
        ],
      })
    );
    expect(model.stacks).toEqual([]);
    expect(model.series[0]?.stack).toBeUndefined();
  });

  it("measures the domain over the effective window only", () => {
    const model = buildCartesianModel(base(rows, { xRange: [day(3), day(3)] }));
    expect(model.window).toEqual({ first: 2, last: 2 });
    expect(model.y.domain).toEqual([0, 4]);
  });

  it("leaves 0 out of a none-baseline domain of unstacked values", () => {
    const model = buildCartesianModel(
      base(
        [
          { x: day(1), a: 5, b: 6 },
          { x: day(2), a: 5.5, b: 5.2 },
        ],
        { baseline: "none" }
      )
    );
    expect(model.y.domain).toEqual([5, 6]);
  });

  it("reaches a yInclude value", () => {
    expect(buildCartesianModel(base(rows, { include: [40] })).y.domain).toEqual([-10, 40]);
  });

  it("is empty when no slot holds a reading, with a [0, 1] domain", () => {
    const model = buildCartesianModel(
      base([
        { x: day(1), a: null, b: null },
        { x: day(2), a: null, b: null },
      ])
    );
    expect(model.empty).toBe(true);
    expect(model.y.domain).toEqual([0, 1]);
  });

  it("reads each key's quality column", () => {
    const model = buildCartesianModel(
      base([{ x: day(1), a: 1, b: 2, q: "estimated" }], {
        series: [
          ["a", { qualityKey: "q" }],
          ["b", {}],
        ],
      })
    );
    expect(model.series.map(({ readings }) => readings[0])).toEqual([
      { kind: "reading", value: 1, quality: "estimated" },
      { kind: "reading", value: 2, quality: "measured" },
    ]);
  });

  it("collects the row, cell and stack issues with their fallbacks applied", () => {
    const model = buildCartesianModel(
      base(
        [
          { x: day(1), a: 3, b: -1 },
          { x: day(1), a: 1, b: 1 },
          { x: day(2), a: Number.NaN, b: 1 },
        ],
        {
          stackOffset: "expand",
          series: [
            ["a", { stack: "s" }],
            ["b", { stack: "s" }],
          ],
        }
      )
    );
    expect(model.issues).toEqual([
      { rule: "duplicate-x", row: 1 },
      { rule: "non-finite-value", slot: 1, key: "a" },
      { rule: "mixed-sign-expand", slot: 0 },
    ]);
    expect(model.series[0]?.extents[0]).toEqual([0, 0.75]);
  });

  it("places category rows in data order", () => {
    const model = buildCartesianModel(
      base(
        [
          { x: "Jan", a: 1, b: 2 },
          { x: "Feb", a: 3, b: 4 },
        ],
        { time: undefined }
      )
    );
    expect(model.domain).toEqual({ kind: "category", names: ["Jan", "Feb"] });
    expect(model.rowAt).toEqual([0, 1]);
  });

  it("keeps a period's slots with no rows pending before now and missing after", () => {
    const model = buildCartesianModel(
      base([{ x: day(1), a: 1, b: 1 }], {
        time: {
          interval: "day",
          timeZone: "Europe/Oslo",
          period: [day(1).getTime(), day(4).getTime()],
          now: day(2).getTime() + 3_600_000,
        },
      })
    );
    expect(model.series[0]?.readings.map(({ kind }) => kind)).toEqual(["reading", "pending", "pending"]);
  });
});
