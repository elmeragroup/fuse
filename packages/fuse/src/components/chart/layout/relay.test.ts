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

const rows = (count: number, value: (index: number) => number) =>
  Array.from({ length: count }, (_, index) => ({ name: `c${String(index)}`, p: value(index), q: 1 }));

describe("relaying the plot", () => {
  it("moves a category's arrival while the domain stays (B12-1)", () => {
    // a = 2, then a = 3 and b = 1: b mounts, and [0, 4] stays, so b's base is the baseline.
    const before = keyed([{ name: "a", p: 2, q: 1 }]);
    const after = keyed([
      { name: "a", p: 3, q: 1 },
      { name: "b", p: 1, q: 1 },
    ]);
    expect(relaysPlot(before, after, "vertical", false)).toBe(false);
  });

  it("relays a switch from paths to elements (B12-3)", () => {
    // 101 categories draw as paths and 100 as elements, on a vertical chart.
    const before = keyed(rows(101, (index) => (index === 100 ? -4 : 2)));
    const after = keyed(rows(100, () => 2));
    expect(relaysPlot(before, after, "vertical", false)).toBe(true);
    // A horizontal chart draws elements at any count, so the same update moves.
    expect(relaysPlot(before, after, "horizontal", false)).toBe(false);
  });

  it("relays a mark that mounts while the domain moves, and moves one that only leaves", () => {
    // b arrives at -3, which widens [0, 4] to [-4, 4]: the baseline moves under the new bar.
    const before = keyed([{ name: "a", p: 2, q: 1 }]);
    const widened = keyed([
      { name: "a", p: 2, q: 1 },
      { name: "b", p: -3, q: 1 },
    ]);
    expect(relaysPlot(before, widened, "vertical", false)).toBe(true);
    // b leaves again: nothing mounts, so the bars that stay move with the domain.
    expect(relaysPlot(widened, before, "vertical", false)).toBe(false);
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
      relaysPlot(before, after, "vertical", false),
      relaysPlot(before, after, "vertical", true),
    ]).toEqual([false, true]);
  });

  it("relays a stacked segment that mounts on one that stays, and moves a new stack", () => {
    // q appears at a, where p stays, so q's base is p's drawn tip.
    const lone = keyed([{ name: "a", p: 2, q: null }], true);
    const both = keyed([{ name: "a", p: 2, q: 1 }], true);
    expect(relaysPlot(lone, both, "vertical", false)).toBe(true);
    // A new slot whose segments both mount shares no edge with anything that stays.
    const grown = keyed(
      [
        { name: "a", p: 2, q: 1 },
        { name: "b", p: 1, q: 1 },
      ],
      true
    );
    expect(relaysPlot(both, grown, "vertical", false)).toBe(false);
  });
});
