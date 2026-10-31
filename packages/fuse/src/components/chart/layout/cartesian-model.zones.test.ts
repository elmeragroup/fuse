import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { ChartRow } from "../chart-types";
import { buildCartesianModel, layoutDomain } from "./cartesian-model";
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
      { rule: "mixed-sign-expand", slot: 0, stack: "s" },
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

describe("layout domains for Panels (section 8.3, P2 and P11)", () => {
  const rows = [
    { x: day(1), a: 1, b: 200 },
    { x: day(2), a: 4, b: 120 },
    { x: day(3), a: 2, b: 80 },
  ];

  it("gives each Panel its own series' domain, the zero rule and its yInclude", () => {
    const model = { ...buildCartesianModel(base(rows)), stackOffset: "diverging" as const };
    expect(layoutDomain(model, { keys: ["a"], baseline: "zero", include: [] }).domain).toEqual([0, 4]);
    expect(layoutDomain(model, { keys: ["b"], baseline: "zero", include: [] }).domain).toEqual([0, 200]);
    expect(layoutDomain(model, { keys: ["b"], baseline: "none", include: [] }).domain).toEqual([80, 200]);
    expect(layoutDomain(model, { keys: ["a"], baseline: "zero", include: [10] }).domain).toEqual([0, 10]);
    // Root's default layout covers every key.
    expect(model.y.domain).toEqual([0, 200]);
  });

  it("covers a Panel's rows inside the effective window only", () => {
    // From 2 to 3 October a peaks at 4, and from 3 October alone at 2.
    const windowed = buildCartesianModel(base(rows, { xRange: [day(3), day(3)] }));
    const model = { ...windowed, stackOffset: "diverging" as const };
    expect(layoutDomain(model, { keys: ["a"], baseline: "zero", include: [] }).domain).toEqual([0, 2]);
  });

  it("draws a Panel with no reading on [0, 1], and an all-zero Panel flat on [0, 1]", () => {
    const quiet = [
      { x: day(1), a: 3, b: null },
      { x: day(2), a: 1, b: null },
    ];
    const model = { ...buildCartesianModel(base(quiet)), stackOffset: "diverging" as const };
    expect(layoutDomain(model, { keys: ["b"], baseline: "zero", include: [] })).toEqual({
      domain: [0, 1],
      ticks: [0, 0.2, 0.4, 0.6, 0.8, 1],
    });
    const night = [
      { x: day(1), a: 3, b: 0 },
      { x: day(2), a: 1, b: 0 },
    ];
    const solar = { ...buildCartesianModel(base(night)), stackOffset: "diverging" as const };
    expect(layoutDomain(solar, { keys: ["b"], baseline: "zero", include: [] })).toEqual({
      domain: [0, 1],
      ticks: [0],
    });
  });

  it("holds each Panel's extent, 0 under the zero rule and every yInclude value, for any data", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.double({ min: -1e6, max: 1e6, noNaN: true }),
            fc.double({ min: -1e6, max: 1e6, noNaN: true })
          ),
          {
            minLength: 1,
            maxLength: 12,
          }
        ),
        fc.array(fc.double({ min: -1e6, max: 1e6, noNaN: true }), { maxLength: 2 }),
        fc.constantFrom<"zero" | "none">("zero", "none"),
        (pairs, include, baseline) => {
          const generated = pairs.map(([a, b], index) => ({ x: day(index + 1), a, b }));
          const model = { ...buildCartesianModel(base(generated)), stackOffset: "diverging" as const };
          const [low, high] = layoutDomain(model, { keys: ["a"], baseline, include }).domain;
          const must = [...pairs.map(([a]) => a), ...include, ...(baseline === "zero" ? [0] : [])];
          for (const value of must) expect(low <= value + 1e-9 && value - 1e-9 <= high).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("leaves one Panel's domain alone when another Panel's data scales by 10", () => {
    const scaled = rows.map((row) => ({ ...row, b: row.b * 10 }));
    const before = { ...buildCartesianModel(base(rows)), stackOffset: "diverging" as const };
    const after = { ...buildCartesianModel(base(scaled)), stackOffset: "diverging" as const };
    const a = { keys: ["a"], baseline: "zero" as const, include: [] };
    expect(layoutDomain(after, a)).toEqual(layoutDomain(before, a));
    expect(layoutDomain(after, { ...a, keys: ["b"] }).domain).toEqual([0, 2000]);
  });
});

describe("coarse series (section 8.8)", () => {
  /** Oslo midnight on 1 October 2025 is 22:00 UTC the day before. */
  const quarter = (index: number) => new Date(Date.UTC(2025, 8, 30, 22, index * 15));
  const input = (rows: readonly ChartRow[]): ModelInput => ({
    rows,
    series: [
      ["price", {}],
      ["kwh", { interval: "hour" }],
    ],
    xKey: "x",
    time: { interval: "quarter-hour", timeZone: "Europe/Oslo" },
    stackOffset: "diverging",
    baseline: "zero",
    include: [],
  });

  it("reads an hourly value from the :00 row and holds it at the hour's 4 quarters", () => {
    const rows: ChartRow[] = Array.from({ length: 8 }, (_, index) => ({ x: quarter(index), price: index }));
    rows[0] = { ...rows[0], kwh: 0.35 };
    rows[4] = { ...rows[4], kwh: 0.5 };
    const model = buildCartesianModel(input(rows));
    const kwh = model.series[1];
    expect(
      kwh?.readings.map((reading) => (reading.kind === "reading" ? reading.value : reading.kind))
    ).toEqual([0.35, 0.35, 0.35, 0.35, 0.5, 0.5, 0.5, 0.5]);
    expect(kwh?.coarse?.first).toEqual([0, 0, 0, 0, 4, 4, 4, 4]);
    expect(model.issues).toEqual([]);
  });

  it("reads the absent quarters of an hour as no reading at all, and an hour with no value as missing", () => {
    // Hour 1 has no consumption row, between two hours that have one.
    const rows: ChartRow[] = Array.from({ length: 12 }, (_, index) => ({ x: quarter(index), price: 1 }));
    rows[0] = { ...rows[0], kwh: 1 };
    rows[8] = { ...rows[8], kwh: 1 };
    const kinds = buildCartesianModel(input(rows)).series[1]?.readings.map((reading) => reading.kind);
    const four = (kind: string) => [kind, kind, kind, kind];
    expect(kinds).toEqual([...four("reading"), ...four("missing"), ...four("reading")]);
  });

  it("flags an hourly value on a :15 row as off-grid-x and moves it to its hour", () => {
    const rows: ChartRow[] = [0, 1, 2, 3].map((index) => ({ x: quarter(index), price: 1 }));
    rows[1] = { ...rows[1], kwh: 0.4 };
    const model = buildCartesianModel(input(rows));
    expect(model.issues).toEqual([{ rule: "off-grid-x", row: 1 }]);
    expect(model.series[1]?.readings[0]).toEqual({ kind: "reading", value: 0.4, quality: "measured" });
  });

  it("never sums quarters: an hour keeps its :00 value whatever the quarters around it hold", () => {
    const rows: ChartRow[] = [0, 1, 2, 3].map((index) => ({ x: quarter(index), price: 1 }));
    rows[0] = { ...rows[0], kwh: 0.2 };
    const more = [...rows, ...[4, 5].map((index) => ({ x: quarter(index), price: 9 }))];
    const value = (list: readonly ChartRow[]) => {
      const reading = buildCartesianModel(input(list)).series[1]?.readings[0];
      return reading?.kind === "reading" ? reading.value : null;
    };
    expect([value(rows), value(more)]).toEqual([0.2, 0.2]);
  });

  it("flags an hourly value on the first row of a domain that starts inside the hour (W3, Q1-3)", () => {
    // The domain starts at 00:15, so its first row is no hour's start: 0,4 there is off the grid,
    // and in production it moves to the hour that holds it.
    const rows: ChartRow[] = [1, 2, 3].map((index) => ({ x: quarter(index), price: 1 }));
    rows[0] = { ...rows[0], kwh: 0.4 };
    const model = buildCartesianModel(input(rows));
    expect(model.issues).toEqual([{ rule: "off-grid-x", row: 0 }]);
    expect(model.series[1]?.readings[0]).toEqual({ kind: "reading", value: 0.4, quality: "measured" });
  });

  it("keeps an unfinished hour pending until its own end, past the domain's last row (W3, B1-3)", () => {
    // Quarters 00:00 and 00:15 with no consumption, now at 00:45: the hour ends at 01:00, after
    // now, so it is pending, though the domain's last row ends at 00:30.
    const rows: ChartRow[] = [0, 1].map((index) => ({ x: quarter(index), price: 1, kwh: null }));
    const time = { interval: "quarter-hour" as const, timeZone: "Europe/Oslo", now: quarter(3).getTime() };
    const model = buildCartesianModel({ ...input(rows), time });
    expect(model.series[1]?.readings.map((reading) => reading.kind)).toEqual(["pending", "pending"]);
    expect(model.series[1]?.coarse?.end).toEqual([quarter(4).getTime(), quarter(4).getTime()]);
  });

  it("reads an hour that ended before now as missing, even when the domain ends inside it", () => {
    // The same two quarters with now at 01:15, after the hour's end: the hour is missing.
    const rows: ChartRow[] = [0, 1].map((index) => ({ x: quarter(index), price: 1, kwh: null }));
    const time = { interval: "quarter-hour" as const, timeZone: "Europe/Oslo", now: quarter(5).getTime() };
    const model = buildCartesianModel({ ...input(rows), time });
    expect(model.series[1]?.readings.map((reading) => reading.kind)).toEqual(["missing", "missing"]);
  });
});
