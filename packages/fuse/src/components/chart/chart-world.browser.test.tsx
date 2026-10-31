// One world of a bar chart's marks, in Chromium, after review rounds 11 and 12. Unit under test:
// every placed mark of phase 1, and a Line with its Dots on the bars' series, through random data
// updates, sign flips, categories added, removed
// and reordered, value domains that move, x range windows, resizes to fractional sizes,
// orientation turns, form switches across the path limit, activation, and references that change
// value or axis, at 1x, 1.25x, 1.5x and 2x.
//
// Oracle at rest and after every commit that snaps: `expected`, a model written in this file from
// the contract, which imports no production layout. From the world's inputs and the measured plot
// it computes each mark's visibility, `data-outside`, label membership and resting device pixels:
// the zero rule and d3's nice rule for the value domain (sections 8.3 and 8.11), the window
// (8.12), bands with a 25 % gap (8.15), the path form's columns past 100 categories, the pixel
// floor, the browser's snap, hairlines, the missing tick, and each line vertex and dot on its slot's
// crosshair column at its bar's tip, the vertex half a device pixel further along the value axis
// where the line's 2 px stroke covers an odd number of device pixels, so the stroke covers whole
// ones. Above 2,000 categories the line keeps, by a brute-force scan, each pixel column's first,
// last, lowest and highest reading and both slots of every change between a reading and a missing
// one (section 8.12), and the columns are the 500 buckets' own, so a world of 2,400 categories
// checks its columns, line, dots, ticks, followers and references. Every mark must match it exactly.
//
// Oracles in every sampled frame: marks on one data coordinate emit one device pixel, a bar draws
// on the side its tip lies, every dot sits on a line vertex, a hidden reference holds no label
// place, and a commit that does not
// snap leaves every mark within a device pixel of its last frame, a resize's mapped into the new
// box.
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import type { Area, Datum, Line, Reading, World } from "../../../test/chart/world-model";
import { clearRatio, frame, run, setRatio, view } from "../../../test/chart/world-runner";
import type { Step } from "../../../test/chart/world-runner";
import { renderThemed } from "../../../test/themed-browser-render";
import "./chart.css";

afterEach(async () => {
  await clearRatio();
});

// The worlds.

/** Readings of every magnitude, missing only at odd places, so every window holds one. */
const reading: fc.Arbitrary<number> = fc.oneof(
  { weight: 1, arbitrary: fc.constant(0) },
  {
    weight: 2,
    arbitrary: fc.double({ min: 0.01, max: 0.2, noNaN: true }).chain((size) => fc.constantFrom(size, -size)),
  },
  { weight: 6, arbitrary: fc.integer({ min: -9, max: 9 }) }
);
const readings = fc
  .array(fc.tuple(reading, fc.boolean()), { minLength: 101, maxLength: 101 })
  .map((list) => list.map(([value, missing], index): Reading => (missing && index % 2 === 1 ? null : value)));

/** Category names c0, c1, … for a list of readings. */
const namedFrom = (list: readonly Reading[]): readonly Datum[] =>
  list.map((v, index) => ({ name: `c${String(index)}`, v }));

const line: fc.Arbitrary<Line> = fc.oneof(
  fc.constantFrom(10.015, 9.99, -10.01, 0, 2.5, 4).map((at): Line => ({ axis: "value", at })),
  fc.integer({ min: 0, max: 5 }).map((index): Line => ({ axis: "slot", name: `c${String(index)}` }))
);
const area: fc.Arbitrary<Area> = fc.oneof(
  fc
    .constantFrom([0.001, 0.005], [9.999, 10.02], [-10.02, -10.01], [-3, 4])
    .map(([from = 0, to = 0]): Area => ({ axis: "value", from, to })),
  fc
    .integer({ min: 0, max: 3 })
    .map((index): Area => ({ axis: "slot", first: `c${String(index)}`, last: `c${String(index + 1)}` }))
);

const step: fc.Arbitrary<Step> = fc.oneof(
  { weight: 3, arbitrary: readings.map((list): Step => ({ kind: "update", readings: list })) },
  { weight: 1, arbitrary: fc.oneof(reading, fc.constant(null)).map((v): Step => ({ kind: "add", v })) },
  { weight: 1, arbitrary: fc.nat().map((at): Step => ({ kind: "remove", at })) },
  { weight: 1, arbitrary: fc.constant<Step>({ kind: "reorder" }) },
  { weight: 1, arbitrary: fc.constant<Step>({ kind: "swap" }) },
  {
    weight: 1,
    arbitrary: fc
      .record({ from: fc.nat(), span: fc.integer({ min: 0, max: 4 }) })
      .map(({ from, span }): Step => ({ kind: "window", from, span })),
  },
  {
    weight: 2,
    arbitrary: fc
      .record({
        width: fc.double({ min: 280, max: 520, noNaN: true }),
        height: fc.double({ min: 150, max: 320, noNaN: true }),
      })
      .map(({ width, height }): Step => ({
        kind: "resize",
        width: Math.round(width * 4) / 4,
        height: Math.round(height * 4) / 4,
      })),
  },
  { weight: 1, arbitrary: fc.constant<Step>({ kind: "turn" }) },
  {
    weight: 2,
    arbitrary: fc
      .constantFrom("{Home}", "{End}", "{ArrowRight}")
      .map((key): Step => ({ kind: "activate", key })),
  },
  {
    weight: 1,
    arbitrary: fc
      .record({ line, area })
      .map(({ line: l, area: a }): Step => ({ kind: "reference", line: l, area: a })),
  },
  {
    weight: 1,
    arbitrary: fc
      .record({
        end: fc.constantFrom("low" as const, "high" as const),
        past: fc.constantFrom(0, 1e-4, -1e-4),
      })
      .map(({ end, past }): Step => ({ kind: "edge", end, past })),
  },
  { weight: 1, arbitrary: fc.constant<Step>({ kind: "axis" }) },
  {
    weight: 4,
    arbitrary: fc
      .oneof(fc.integer({ min: 16, max: 60 }), fc.integer({ min: 150, max: 260 }), fc.constant(700))
      .map((ms): Step => ({ kind: "wait", ms })),
  }
);

/** A five-category world on 400 × 200 px over [-10, 10]. */
const FIVE: World = {
  orientation: "vertical",
  width: 400,
  height: 200,
  data: namedFrom([3, -2, null, 0.1, 7]),
  window: null,
  line: { axis: "value", at: 2.5 },
  area: { axis: "value", from: -3, to: 4 },
  variant: "default",
  include: [-10, 10],
};

/** The values `yInclude` holds: a fixed domain, one the data moves, and one off zero. */
const include = fc.constantFrom<readonly [number, number]>([-10, 10], [0, 1], [0, 4], [-2, 6]);

/** Readings for every category of a 101-category world, the rest at 1. */
const rest = (list: readonly Reading[]): readonly Reading[] => [
  ...list,
  ...Array.from({ length: 101 - list.length }, () => 1),
];

describe("one world of marks", () => {
  it("keeps every mark on the model at rest and coherent between, through any commits, at any ratio", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(1, 1.25, 1.5, 2),
        fc.record({
          orientation: fc.constantFrom("vertical" as const, "horizontal" as const),
          readings: readings.map((list) => list.slice(0, 5)),
          include,
          line,
          area,
          panelled: fc.boolean(),
        }),
        fc.array(step, { minLength: 2, maxLength: 7 }),
        async (dpr, start, steps) => {
          const { readings: list, panelled, ...others } = start;
          const world = { ...FIVE, ...others, data: namedFrom(list) };
          await run(dpr, { ...world, panelled: panelled && world.orientation === "vertical" }, steps);
        }
      ),
      {
        numRuns: 14,
        // Every run checks a resize, a key step and a path-form update while a data update runs, a
        // window that leaves a slot reference outside, and a resize while a slot line glides.
        examples: [
          // A window that keeps only an added missing slot, in a domain with readings, is not the
          // empty state, so its missing tick draws: fast-check's seed 876103951, shrunk.
          [
            1,
            {
              orientation: "vertical",
              readings: [0, 0, 0, 0.01, 0],
              include: [-10, 10],
              panelled: false,
              line: { axis: "slot", name: "c0" },
              area: { axis: "value", from: 0.001, to: 0.005 },
            },
            [
              { kind: "add", v: null },
              { kind: "window", from: 516722465, span: 1 },
              { kind: "add", v: null },
            ],
          ],
          // Every mark in a lower Panel, whose plot origin, domain, frame and labels are its own,
          // through an update, a resize while it tweens, a key step and a window.
          [
            1.5,
            {
              orientation: "vertical",
              readings: [3, -2, null, 0.1, 7],
              include: [0, 4],
              panelled: true,
              line: { axis: "value", at: 2.5 },
              area: { axis: "slot", first: "c1", last: "c2" },
            },
            [
              { kind: "update", readings: rest([-4, 2, null, -0.1, 7]) },
              { kind: "wait", ms: 150 },
              { kind: "resize", width: 410.25, height: 250.5 },
              { kind: "wait", ms: 60 },
              { kind: "activate", key: "{Home}" },
              { kind: "window", from: 1, span: 2 },
              { kind: "add", v: -6 },
            ],
          ],
          [
            1.5,
            {
              orientation: "vertical",
              readings: [3, -2, null, 0.1, 7],
              include: [-10, 10],
              panelled: false,
              line: { axis: "value", at: 0 },
              area: { axis: "value", from: 0.001, to: 0.005 },
            },
            [
              { kind: "update", readings: rest([-4, 2, null, -0.1, 7]) },
              { kind: "wait", ms: 150 },
              { kind: "resize", width: 410.25, height: 250.5 },
              { kind: "wait", ms: 60 },
              { kind: "activate", key: "{Home}" },
              { kind: "swap" },
              { kind: "update", readings: rest([6, null, 2]) },
              { kind: "wait", ms: 30 },
            ],
          ],
          [
            1.25,
            {
              orientation: "horizontal",
              readings: [2, null, -0.05, 4, -6],
              include: [0, 4],
              panelled: false,
              line: { axis: "slot", name: "c4" },
              area: { axis: "slot", first: "c0", last: "c1" },
            },
            [
              { kind: "activate", key: "{End}" },
              { kind: "window", from: 0, span: 2 },
              { kind: "update", readings: rest([-2, null, 0.05, -4, 6]) },
              { kind: "wait", ms: 200 },
              { kind: "axis" },
              { kind: "turn" },
            ],
          ],
          [
            2,
            {
              orientation: "vertical",
              readings: [2, null, 0.0149, null, 5],
              include: [-10, 10],
              panelled: false,
              line: { axis: "slot", name: "c2" },
              area: { axis: "slot", first: "c1", last: "c2" },
            },
            [
              { kind: "resize", width: 409.75, height: 318.75 },
              { kind: "add", v: -6 },
              { kind: "resize", width: 487.75, height: 174.75 },
            ],
          ],
          // A resize of path-form columns, which moves the span that names each column.
          [
            1,
            {
              orientation: "vertical",
              readings: [0.01, 0, 0, 0, 0],
              include: [-10, 10],
              panelled: false,
              line: { axis: "value", at: 10.015 },
              area: { axis: "value", from: 0.001, to: 0.005 },
            },
            [
              { kind: "swap" },
              { kind: "resize", width: 280, height: 150 },
              {
                kind: "update",
                readings: Array.from({ length: 101 }, (_, index) =>
                  [
                    3, 9, 10, 31, 36, 37, 40, 41, 42, 44, 45, 53, 59, 60, 64, 68, 70, 72, 78, 89, 91, 99,
                  ].includes(index)
                    ? 0.01
                    : 0
                ),
              },
              { kind: "reorder" },
            ],
          ],
          // A decimated world: 2,400 categories whose value-only updates tween the M4 vertices, one
          // with a run of missing readings that breaks the line and draws its ticks.
          [
            1.5,
            {
              orientation: "vertical",
              readings: [3, -2, null, 0.1, 7],
              include: [-10, 10],
              panelled: false,
              line: { axis: "value", at: 2.5 },
              area: { axis: "slot", first: "c1", last: "c2" },
            },
            [
              { kind: "dense", readings: rest([4, 1, -3, 2, 8, 0.1, 6]) },
              { kind: "wait", ms: 700 },
              { kind: "update", readings: rest([4, 1, -3, 9, 8, 0.1, 6]) },
              { kind: "wait", ms: 150 },
              { kind: "activate", key: "{Home}" },
              { kind: "update", readings: rest([4, null, -3, 9, 8, null, 6]) },
              { kind: "wait", ms: 700 },
            ],
          ],
          // The same decimated world with w stacked over v: both lines keep the vertices of every
          // boundary of the stack, and v's sides of zero, through value-only updates.
          [
            2,
            {
              orientation: "vertical",
              readings: [3, -2, null, 0.1, 7],
              include: [-10, 10],
              panelled: false,
              line: { axis: "value", at: 2.5 },
              area: { axis: "slot", first: "c1", last: "c2" },
            },
            [
              { kind: "dense", readings: rest([4, 1, -3, 2, 8, 0.1, 6]), stacked: true },
              { kind: "wait", ms: 700 },
              { kind: "update", readings: rest([4, 1, -3, 9, 8, 0.1, -6]) },
              { kind: "wait", ms: 700 },
            ],
          ],
        ],
      }
    );
  }, 600_000);

  it("keeps ActiveValue on its bar's middle in a Panel whose plot is a fraction wide", async () => {
    // The upper Panel's value axis leaves the plot column a fraction of a pixel wide, and the
    // ActiveValue's share of it must land on its bar's middle, which Root's measure keeps exact.
    await run(
      1,
      {
        ...FIVE,
        data: namedFrom([0, 0.01, 0.01, 0, 0]),
        line: { axis: "value", at: 10.015 },
        area: { axis: "slot", first: "c0", last: "c1" },
        panelled: true,
      },
      [
        { kind: "wait", ms: 700 },
        { kind: "add", v: -0.01942079285569428 },
      ]
    );
  });

  it("moves ActiveValue with its bar when a category joins (B12-1, Q12-1)", async () => {
    // 400 px over [0, 4] with a active: b joins, a slides from a centre of 200 to 100 px, and the
    // value over a slides with it rather than jumping.
    const world: World = { ...FIVE, include: [0, 4], data: [{ name: "a", v: 2 }] };
    await run(1, world, [
      { kind: "activate", key: "{Home}" },
      { kind: "update", readings: [3] },
      { kind: "wait", ms: 700 },
      { kind: "add", v: 1 },
      { kind: "wait", ms: 120 },
      { kind: "wait", ms: 600 },
    ]);
  });

  it("keeps a slot line outside an x range window outside (B12-2)", async () => {
    // 401 categories and a window of c0 to c399 on 200 px: c400's centre lies past the plot, so its
    // labelled line hides and holds no label place, though its band would floor onto 199–200.
    const data = Array.from({ length: 401 }, (_, index): Datum => ({ name: `c${String(index)}`, v: 1 }));
    const world: World = {
      ...FIVE,
      width: 200,
      data,
      window: ["c0", "c399"],
      line: { axis: "slot", name: "c400" },
    };
    const end = await run(1, world, []);
    expect(end.references.find(({ what }) => what === "line")?.outside).toBe(true);
  });

  it("snaps a reference at 0 with the bars when the path form switches to elements (B12-3)", async () => {
    // 101 categories over [0, 4], the last at -4, draw as paths over [-4, 4]. Dropping the last
    // draws elements over [0, 4]: the bars mount at their targets, and the reference at 0 and the
    // rest of the plot snap with them.
    const data = Array.from({ length: 101 }, (_, index): Datum => ({
      name: `c${String(index)}`,
      v: index === 100 ? -4 : 2,
    }));
    await run(1, { ...FIVE, include: [0, 4], data }, [
      { kind: "remove", at: 100 },
      { kind: "wait", ms: 60 },
    ]);
  });

  it("hides a value line just past the domain's trailing edge (Q12-3)", async () => {
    // -10.01 over [-10, 10] lies past the plot's bottom edge, so the line hides, as the model says,
    // and a line exactly on the edge shows.
    await run(1, { ...FIVE, line: { axis: "value", at: -10.01 } }, [
      { kind: "edge", end: "low", past: 0 },
      { kind: "edge", end: "high", past: 1e-4 },
    ]);
  });

  it("keeps a value line's width a size through a resize mid-tween (Q12-2)", async () => {
    // A resize maps a running tween's coordinates and leaves its sizes alone, so every width the
    // line writes in the commit that doubles the plot is the 1 px hairline.
    await setRatio(1);
    const world: World = {
      ...FIVE,
      include: [0, 1],
      data: namedFrom([1, 1, 1, 1, 1]),
      line: { axis: "value", at: 1 },
    };
    const moved = { ...world, data: namedFrom([4, 1, 1, 1, 1]) };
    const { host, rerender, unmount } = renderThemed(view(world));
    try {
      // DOM audit: the labelled line is the second reference.
      const reference = host.querySelectorAll<HTMLElement>('[data-slot="chart-reference-line"]')[1];
      if (reference === undefined) throw new Error("no line");
      rerender(view(moved));
      for (let count = 0; count < 6; count += 1) await frame();
      const styles: string[] = [];
      const observer = new MutationObserver((records) => {
        for (const record of records) styles.push(record.oldValue ?? "");
      });
      observer.observe(reference, { attributes: true, attributeFilter: ["style"], attributeOldValue: true });
      rerender(view({ ...moved, height: 400 }));
      styles.push(...observer.takeRecords().map((record) => record.oldValue ?? ""));
      styles.push(reference.getAttribute("style") ?? "");
      observer.disconnect();
      const widths = styles.flatMap((style) =>
        [...style.matchAll(/--_rule-width:\s*([\d.]+)px/gu)].map(([, px]) => Number(px))
      );
      expect(widths.length).toBeGreaterThan(0);
      expect(widths).toEqual(widths.map(() => 1));
    } finally {
      unmount();
    }
  });
});
