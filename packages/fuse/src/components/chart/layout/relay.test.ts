// Unit under test: whether a data update relays the plot. Oracle: section 8.15's band layout and the
// zero rule, worked by hand per case: an update relays when it switches the bars' form, mounts a
// mark while the value domain moves or the baseline still glides, or mounts a stacked segment
// beside a segment that stays.
import { describe, expect, it } from "vitest";

import { buildCartesianModel } from "./cartesian-model";
import { relaysPlot } from "./relay";

type Row = { readonly name: string; readonly p?: number | null; readonly q?: number | null };

/** A model of rows over [0, 4] at least, its slots keyed by name. */
function keyed(rows: readonly Row[], stacked = false) {
  const model = buildCartesianModel({
    rows,
    series: [
      ["p", stacked ? { stack: "s" } : {}],
      ["q", stacked ? { stack: "s" } : {}],
    ],
    xKey: "name",
    stackOffset: "diverging",
    baseline: "zero",
    include: [0, 4],
  });
  return { model, keys: rows.map((row) => row.name) };
}

/** Both series draw as bars. */
const BARS = new Set(["p", "q"]);

const rows = (count: number, value: (index: number) => number) =>
  Array.from({ length: count }, (_, index) => ({ name: `c${String(index)}`, p: value(index), q: 1 }));

describe("relaying the plot", () => {
  it("never relays a chart whose series no Bar draws, as a line's arriving reading widens the domain (B1-4)", () => {
    // The update demo's third press: 4.1 arrives after a maximum of 3.8, and [0, 4] widens to
    // [0, 5]. Bars would relay, and a Line routes the arriving vertex, so nothing snaps.
    const line = (values: readonly number[]) => {
      const rows = values.map((p, index) => ({ name: `r${String(index)}`, p }));
      const model = buildCartesianModel({
        rows,
        series: [["p", {}]],
        xKey: "name",
        stackOffset: "diverging",
        baseline: "zero",
        include: [],
      });
      return { model, keys: rows.map((row) => row.name) };
    };
    const before = line([2.4, 3.1, 3.8]);
    const after = line([2.4, 3.1, 3.8, 4.1]);
    expect([before.model.y.domain, after.model.y.domain]).toEqual([
      [0, 4],
      [0, 5],
    ]);
    expect(relaysPlot(before, after, "vertical", false, new Set())).toBe(false);
    expect(relaysPlot(before, after, "vertical", false, new Set(["p"]))).toBe(true);
  });

  it("moves a category's arrival while the domain stays (B12-1)", () => {
    // a = 2, then a = 3 and b = 1: b mounts, and [0, 4] stays, so b's base is the baseline.
    const before = keyed([{ name: "a", p: 2, q: 1 }]);
    const after = keyed([
      { name: "a", p: 3, q: 1 },
      { name: "b", p: 1, q: 1 },
    ]);
    expect(relaysPlot(before, after, "vertical", false, BARS)).toBe(false);
  });

  it("routes path-form columns that mount while the domain moves (B2-6, Q2-4)", () => {
    /** One series over named readings, its domain from the readings and 0 alone. */
    const loose = (values: readonly (number | null)[], from = 0) => {
      const named = values.map((p, index) => ({ name: `c${String(from + index)}`, p }));
      const model = buildCartesianModel({
        rows: named,
        series: [["p", {}]],
        xKey: "name",
        stackOffset: "diverging",
        baseline: "zero",
        include: [],
      });
      return { model, keys: named.map((row) => row.name) };
    };
    const ones = Array.from({ length: 365 }, () => 1);
    // Q2-4: 364 readings of 1 and a last null, then the last turns 20, so [0, 1] widens to [0, 20].
    const lastNull = loose([...ones.slice(1), null]);
    const lastTwenty = loose([...ones.slice(1), 20]);
    expect([lastNull.model.y.domain, lastTwenty.model.y.domain]).toEqual([
      [0, 1],
      [0, 20],
    ]);
    expect(relaysPlot(lastNull, lastTwenty, "vertical", false, new Set(["p"]))).toBe(false);
    // B2-6: 365 readings of 1, then a 2 appended and the first dropped, so [0, 1] widens to [0, 2].
    const appended = loose([...ones.slice(1), 2], 1);
    expect(appended.model.y.domain).toEqual([0, 2]);
    expect(relaysPlot(loose(ones), appended, "vertical", false, new Set(["p"]))).toBe(false);
    // Horizontal bars draw as elements at any count, so the same mount still relays there.
    expect(relaysPlot(lastNull, lastTwenty, "horizontal", false, new Set(["p"]))).toBe(true);
  });

  it("relays a switch from paths to elements (B12-3)", () => {
    // 101 categories draw as paths and 100 as elements, on a vertical chart.
    const before = keyed(rows(101, (index) => (index === 100 ? -4 : 2)));
    const after = keyed(rows(100, () => 2));
    expect(relaysPlot(before, after, "vertical", false, BARS)).toBe(true);
    // A horizontal chart draws elements at any count, so the same update moves.
    expect(relaysPlot(before, after, "horizontal", false, BARS)).toBe(false);
  });

  it("relays a mark that mounts while the domain moves, and moves one that only leaves", () => {
    // b arrives at -3, which widens [0, 4] to [-4, 4]: the baseline moves under the new bar.
    const before = keyed([{ name: "a", p: 2, q: 1 }]);
    const widened = keyed([
      { name: "a", p: 2, q: 1 },
      { name: "b", p: -3, q: 1 },
    ]);
    expect(relaysPlot(before, widened, "vertical", false, BARS)).toBe(true);
    // b leaves again: nothing mounts, so the bars that stay move with the domain.
    expect(relaysPlot(widened, before, "vertical", false, BARS)).toBe(false);
  });

  it("relays a mark that mounts while the baseline still glides from another domain", () => {
    // a's reading moved the domain a moment ago, and its tween runs on: b mounts at its target
    // while the baseline is still between the two domains. With no such glide, b moves.
    const before = keyed([{ name: "a", p: 2, q: 1 }]);
    const after = keyed([
      { name: "a", p: 2, q: 1 },
      { name: "b", p: 1, q: 1 },
    ]);
    expect([
      relaysPlot(before, after, "vertical", false, BARS),
      relaysPlot(before, after, "vertical", true, BARS),
    ]).toEqual([false, true]);
  });

  it("relays a stacked segment that mounts on one that stays, and moves a new stack", () => {
    // q appears at a, where p stays, so q's base is p's drawn tip.
    const lone = keyed([{ name: "a", p: 2, q: null }], true);
    const both = keyed([{ name: "a", p: 2, q: 1 }], true);
    expect(relaysPlot(lone, both, "vertical", false, BARS)).toBe(true);
    // A new slot whose segments both mount shares no edge with anything that stays.
    const grown = keyed(
      [
        { name: "a", p: 2, q: 1 },
        { name: "b", p: 1, q: 1 },
      ],
      true
    );
    expect(relaysPlot(both, grown, "vertical", false, BARS)).toBe(false);
  });
});
