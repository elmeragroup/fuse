import { describe, expect, it } from "vitest";

import type { ChartRow } from "../chart-types";
import { buildScatterModel, carryWalk, focusPoint, pointOf, stepPoint, walkPosition } from "./scatter-model";
import type { ScatterModel, ScatterModelInput } from "./scatter-model";

/** A model over `t`, `v` and `s`, with the given config keys and no includes. */
function model(rows: readonly ChartRow[], keys: readonly string[], extra: Partial<ScatterModelInput> = {}) {
  return buildScatterModel({
    rows,
    xKey: "t",
    yKey: "v",
    seriesKey: "s",
    keys,
    xInclude: [],
    yInclude: [],
    ...extra,
  });
}

/** Every point of a model in walk order, as `key x y row`. */
function walkOrder(scatter: ScatterModel): string[] {
  return Array.from(scatter.order, (id) => {
    const point = pointOf(scatter, id);
    return `${point.key} ${String(point.x)} ${String(point.y)} r${String(point.row)}`;
  });
}

/** The id of a series' first point at (x, y), found by reading every id in turn. */
function idAt(scatter: ScatterModel, key: string, x: number, y: number): number {
  for (let id = 0; id < scatter.count; id += 1) {
    const point = pointOf(scatter, id);
    if (point.key === key && point.x === x && point.y === y) return id;
  }
  throw new Error(`no point of ${key} at (${String(x)}, ${String(y)})`);
}

describe("the scatter domains", () => {
  // Unit under test: buildScatterModel's x and y domains. Oracle: d3's 1-2-5 nice rule worked by
  // hand. The x axis aims for 10 ticks and the y axis for 5, and neither keeps 0 unless asked.
  it("nices the energy-temperature reference to −2..18 °C and 20 000..160 000 kWh", () => {
    // x spans −1 to 17.4: 18.4 / 10 = 1.84, between √2 and √10, so the step is 2 and the ends
    // widen to −2 and 18. y spans 36 500 to 153 000: 116 500 / 5 = 23 300, 2.33 × 10⁴, so the
    // step is 20 000 and the ends widen to 20 000 and 160 000. Neither domain reaches 0.
    const scatter = model(
      [
        { t: -1, v: 152_000, s: "normal" },
        { t: 17.4, v: 58_000, s: "normal" },
        { t: 11.6, v: 42_000, s: "2026" },
        { t: 15.2, v: 36_500, s: "2026" },
        { t: -0.8, v: 153_000, s: "2025" },
      ],
      ["2026", "2025", "normal"]
    );
    expect(scatter.x.domain).toEqual([-2, 18]);
    expect(scatter.x.ticks).toEqual([-2, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
    expect(scatter.y.domain).toEqual([20_000, 160_000]);
    expect(scatter.y.ticks).toEqual([20_000, 40_000, 60_000, 80_000, 100_000, 120_000, 140_000, 160_000]);
  });

  it("reaches every xInclude and yInclude value", () => {
    // x spans 5 to 10 and must reach 0: 10 / 10 = 1, so the step is 1 over 0..10. y spans 3 to 4
    // and must reach 0: 4 / 5 = 0.8, 8 tenths, over √50, so the step is 1 over 0..4.
    const scatter = model(
      [
        { t: 5, v: 3, s: "a" },
        { t: 10, v: 4, s: "a" },
      ],
      ["a"],
      { xInclude: [0], yInclude: [0] }
    );
    expect(scatter.x.domain).toEqual([0, 10]);
    expect(scatter.y.domain).toEqual([0, 4]);
  });

  it("widens one point by a tenth of its magnitude on each side", () => {
    // 50 ± 5 spans 45 to 55: 10 / 10 = 1, step 1. 200 ± 20 spans 180 to 220: 40 / 5 = 8, over
    // √50, step 10.
    const scatter = model([{ t: 50, v: 200, s: "a" }], ["a"]);
    expect(scatter.x.domain).toEqual([45, 55]);
    expect(scatter.y.domain).toEqual([180, 220]);
  });

  it("is empty over [0, 1] with no rows", () => {
    const scatter = model([], ["a"]);
    expect(scatter.empty).toBe(true);
    expect(scatter.count).toBe(0);
    expect(scatter.x.domain).toEqual([0, 1]);
    expect(scatter.y.domain).toEqual([0, 1]);
  });
});

describe("the scatter walk order", () => {
  // Unit under test: the per-series and all-series orders. Oracle: hand-sorted sequences of a
  // small dataset with repeated x values and a repeated point, ordered by x, then y, then series
  // in config order, then row.
  const rows = [
    { t: 2, v: 5, s: "a" },
    { t: 1, v: 3, s: "a" },
    { t: 2, v: 1, s: "b" },
    { t: 2, v: 1, s: "a" },
    { t: 1, v: 4, s: "b" },
    { t: 1, v: 3, s: "a" },
  ];

  it("keeps every repeated x and every repeated point", () => {
    const scatter = model(rows, ["a", "b"]);
    expect(scatter.count).toBe(6);
    expect(scatter.series.map(({ key, xs }) => [key, xs.length])).toEqual([
      ["a", 4],
      ["b", 2],
    ]);
  });

  it("walks every series by x, then y, then series, then row", () => {
    expect(walkOrder(model(rows, ["a", "b"]))).toEqual([
      "a 1 3 r1",
      "a 1 3 r5",
      "b 1 4 r4",
      "a 2 1 r3",
      "b 2 1 r2",
      "a 2 5 r0",
    ]);
  });

  it("puts the earlier config key first on a tie, whatever the row order", () => {
    expect(walkOrder(model(rows, ["b", "a"]))).toEqual([
      "a 1 3 r1",
      "a 1 3 r5",
      "b 1 4 r4",
      "b 2 1 r2",
      "a 2 1 r3",
      "a 2 5 r0",
    ]);
  });

  it("steps through one series, then every series, and stops at the ends", () => {
    const scatter = model(rows, ["a", "b"]);
    const at = (key: string, x: number, y: number) => idAt(scatter, key, x, y);
    const label = (id: number) => {
      const point = pointOf(scatter, id);
      return `${point.key} ${String(point.x)} ${String(point.y)}`;
    };
    const a = scatter.series.findIndex(({ key }) => key === "a");
    // Series a alone: (1,3) (1,3) (2,1) (2,5).
    expect(label(stepPoint(scatter, at("a", 2, 1), a, "next"))).toBe("a 2 5");
    expect(label(stepPoint(scatter, at("a", 2, 5), a, "next"))).toBe("a 2 5");
    expect(label(stepPoint(scatter, at("a", 2, 5), a, "first"))).toBe("a 1 3");
    // Every series: a(2,1) is followed by b(2,1).
    expect(label(stepPoint(scatter, at("a", 2, 1), -1, "next"))).toBe("b 2 1");
    expect(label(stepPoint(scatter, at("b", 1, 4), -1, "previous"))).toBe("a 1 3");
    expect(label(stepPoint(scatter, at("b", 1, 4), -1, "last"))).toBe("a 2 5");
  });

  it("numbers an option's place in the series it walks", () => {
    const scatter = model(rows, ["a", "b"]);
    const b = scatter.series.findIndex(({ key }) => key === "b");
    expect(walkPosition(scatter, idAt(scatter, "b", 2, 1), b)).toEqual({ position: 2, size: 2 });
    expect(walkPosition(scatter, idAt(scatter, "b", 2, 1), -1)).toEqual({ position: 5, size: 6 });
  });

  it("moves a series focus to the point with the nearest x, the nearer y on a tie", () => {
    const scatter = model(
      [
        { t: 0, v: 10, s: "a" },
        { t: 4, v: 10, s: "a" },
        { t: 3, v: 2, s: "b" },
        { t: 3, v: 8, s: "b" },
        { t: 9, v: 0, s: "b" },
      ],
      ["a", "b"]
    );
    const label = (id: number) => {
      const point = pointOf(scatter, id);
      return `${point.key} ${String(point.x)} ${String(point.y)}`;
    };
    // From a(4,10), b's nearest x is 3, and of its two points (3,8) lies nearer 10.
    expect(label(focusPoint(scatter, idAt(scatter, "a", 4, 10), 1))).toBe("b 3 8");
    // From b(9,0), a's nearest x is 4.
    expect(label(focusPoint(scatter, idAt(scatter, "b", 9, 0), 0))).toBe("a 4 10");
    // "All series" keeps the point.
    expect(label(focusPoint(scatter, idAt(scatter, "b", 9, 0), -1))).toBe("b 9 0");
  });
});

describe("the scatter data rules", () => {
  // Unit under test: which rows become points and which issues the model reports. Oracle: the
  // data rules of SPEC.md, applied by hand to each row.
  it("skips null cells quietly and reports broken cells and unknown series", () => {
    const scatter = model(
      [
        { t: 1, v: 1, s: "a" },
        { t: null, v: 2, s: "a" },
        { t: 3, v: undefined, s: "a" },
        { t: Number.NaN, v: 4, s: "a" },
        { t: 5, v: Number.POSITIVE_INFINITY, s: "a" },
        { t: "6", v: 6, s: "a" },
        { t: 7, v: 2e15, s: "a" },
        { t: 8, v: 8, s: "c" },
        { t: 9, v: 9, s: null },
        { t: 10, v: 10, s: "a" },
      ],
      ["a"]
    );
    expect(walkOrder(scatter)).toEqual(["a 1 1 r0", "a 10 10 r9"]);
    expect(scatter.issues).toEqual([
      { rule: "non-finite-x", row: 3, subject: "t" },
      { rule: "non-finite-y", row: 4, subject: "v" },
      { rule: "non-finite-x", row: 5, subject: "t" },
      { rule: "non-finite-y", row: 6, subject: "v" },
      { rule: "unknown-series", row: 7, subject: "s" },
      { rule: "unknown-series", row: 8, subject: "s" },
    ]);
  });
});

describe("the walk across a data update", () => {
  // Unit under test: carryWalk, the one transition of the active point, the keyboard's place, the
  // dismissed point and the series focus. Oracle: the review's scenarios and SPEC.md's identity
  // rule, worked by hand on small models.
  const before = model(
    [
      { t: 0, v: 0, s: "a" },
      { t: 1, v: 1, s: "a" },
      { t: 2, v: 2, s: "b" },
      { t: 3, v: 3, s: "b" },
    ],
    ["a", "b"]
  );

  it("gives a focus on a series that loses every point back to all series, at a point that exists", () => {
    // The review's crash: b keeps its config entry but loses its rows. The place falls back to
    // the walk's first point, a(0, 0), and the focus to all series.
    const after = model([{ t: 0, v: 0, s: "a" }], ["a", "b"]);
    const place = idAt(before, "b", 3, 3);
    const carried = carryWalk(before, after, { active: place, place, dismissed: null, focus: 1 });
    expect(carried).toEqual({ active: null, place: 0, dismissed: null, focus: -1 });
    // Home from there walks every series and stays inside the model.
    expect(pointOf(after, stepPoint(after, carried.place ?? -1, carried.focus, "first"))).toMatchObject({
      key: "a",
      x: 0,
    });
  });

  it("keeps a focus whose series still has points, and moves the place into it", () => {
    // b(3, 3) is gone and b(2.5, 9) is new: the nearest x in b is 2.5.
    const after = model(
      [
        { t: 0, v: 0, s: "a" },
        { t: 2.5, v: 9, s: "b" },
      ],
      ["a", "b"]
    );
    const place = idAt(before, "b", 3, 3);
    const carried = carryWalk(before, after, { active: null, place, dismissed: place, focus: 1 });
    expect(carried.focus).toBe(1);
    expect(pointOf(after, carried.place ?? -1)).toMatchObject({ key: "b", x: 2.5, y: 9 });
    // A dismissal holds only on the very point it closed.
    expect(carried.dismissed).toBeNull();
  });

  it("keeps a repeated point's rank among its twins, and takes the last twin when the rank is gone", () => {
    const twins = (count: number) =>
      model(
        [...Array.from({ length: count }, () => ({ t: 0, v: 0, s: "a" })), { t: 1, v: 1, s: "a" }],
        ["a"]
      );
    const three = twins(3);
    // The second of three twins, id 1, stays the second of three.
    expect(carryWalk(three, twins(3), { active: 1, place: 1, dismissed: 1, focus: -1 })).toEqual({
      active: 1,
      place: 1,
      dismissed: 1,
      focus: -1,
    });
    // The third of three, id 2, becomes the second and last of two, id 1.
    expect(carryWalk(three, twins(2), { active: 2, place: 2, dismissed: null, focus: -1 }).place).toBe(1);
  });

  it("empties the place for a model with no point", () => {
    expect(carryWalk(before, model([], ["a", "b"]), { active: 0, place: 0, dismissed: 0, focus: 0 })).toEqual(
      {
        active: null,
        place: null,
        dismissed: null,
        focus: -1,
      }
    );
  });
});

describe("the nearest point in a series", () => {
  // Unit under test: the one nearest-in-series rule that focus changes and data updates share.
  // Oracle: the rule written down in SPEC.md, nearest x, then nearer y, then the earlier point,
  // applied by hand to a point exactly between two others.
  it("gives a focus change the earlier of two points at the same distance", () => {
    // From a(0, 1), b's points (0, 0) and (0, 2) both lie 0 across and 1 up or down.
    const scatter = model(
      [
        { t: 0, v: 1, s: "a" },
        { t: 0, v: 0, s: "b" },
        { t: 0, v: 2, s: "b" },
      ],
      ["a", "b"]
    );
    expect(pointOf(scatter, focusPoint(scatter, idAt(scatter, "a", 0, 1), 1))).toMatchObject({
      x: 0,
      y: 0,
    });
  });

  it("gives a data update the same point as a focus change on that tie", () => {
    // b(0, 1) is replaced by b(0, 0) and b(0, 2), at the same distance either way.
    const before = model([{ t: 0, v: 1, s: "b" }], ["b"]);
    const after = model(
      [
        { t: 0, v: 0, s: "b" },
        { t: 0, v: 2, s: "b" },
      ],
      ["b"]
    );
    const carried = carryWalk(before, after, { active: 0, place: 0, dismissed: null, focus: -1 });
    expect(pointOf(after, carried.active ?? -1)).toMatchObject({ x: 0, y: 0 });
  });

  it("gives the earlier point on a tie in x on either side", () => {
    // From a(5, 0), b's points (4, 0) and (6, 0) both lie 1 across.
    const scatter = model(
      [
        { t: 5, v: 0, s: "a" },
        { t: 4, v: 0, s: "b" },
        { t: 6, v: 0, s: "b" },
      ],
      ["a", "b"]
    );
    expect(pointOf(scatter, focusPoint(scatter, idAt(scatter, "a", 5, 0), 1))).toMatchObject({ x: 4 });
  });
});
