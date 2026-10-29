import { stack as d3Stack, stackOffsetExpand as d3Expand } from "d3-shape";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { runD3Cases } from "./fixtures/d3-cases";
import diverging from "./fixtures/d3/d3-shape/offset-diverging.json" with { type: "json" };
import expand from "./fixtures/d3/d3-shape/offset-expand.json" with { type: "json" };
import { stackSeries } from "./stack";
import type { StackOffset } from "./stack";

type Series = number[][];

/**
 * d3-shape's offset signature over Fuse's stack. Each upstream point's value is `y1 − y0`, the
 * order function picks the stack order, and the result is written back in place, as d3 does.
 */
function offsetFacade(offset: StackOffset) {
  return (series: Series[], order: readonly number[]): void => {
    if (series.some((points) => points.some(([y0 = 0, y1 = 0]) => Number.isNaN(y1 - y0)))) {
      // Section 8.1 reads a non-finite cell as no reading, where d3 keeps NaN in its output.
      throw new Error("Fuse reads NaN as no reading");
    }
    const ordered = order.map((index) => series[index] ?? []);
    const { extents } = stackSeries(
      ordered.map((points) => points.map(([y0 = 0, y1 = 0]) => y1 - y0)),
      offset
    );
    ordered.forEach((points, index) => {
      points.forEach((point, slot) => {
        const extent = extents[index]?.[slot];
        point[0] = extent?.[0] ?? 0;
        point[1] = extent?.[1] ?? 0;
      });
    });
  };
}

const BINDINGS = {
  stackOffsetDiverging: offsetFacade("diverging"),
  stackOffsetExpand: offsetFacade("expand"),
  stackOrderNone: (series: readonly unknown[]) => series.map((_, index) => index),
  stackOrderReverse: (series: readonly unknown[]) => series.map((_, index) => series.length - 1 - index),
};

describe("d3-shape offset vectors", () => {
  // Unit under test: stackSeries. Oracle: d3-shape 3.2.0's offset tests, frozen in the ground truth.
  it.each([
    ["offset-diverging.json", diverging, 5],
    ["offset-expand.json", expand, 2],
  ] as const)("passes %s", (_, file, passing) => {
    const outcomes = runD3Cases(file, BINDINGS);
    expect(outcomes.filter(({ outcome }) => outcome.kind === "fail")).toEqual([]);
    expect(outcomes.filter(({ outcome }) => outcome.kind === "pass")).toHaveLength(passing);
    const skipped = outcomes.filter(({ outcome }) => outcome.kind === "unsupported").map(({ test }) => test);
    expect(new Set(skipped)).toEqual(new Set(skipped.length > 0 ? [skipped[0]] : []));
    for (const test of skipped) expect(test).toMatch(/treats NaN as zero/u);
  });
});

describe("section 8.2 stacks, written by hand", () => {
  it("keeps a mixed-sign slot's signs apart under expand, over the sum of magnitudes", () => {
    const { extents, mixedSignSlots } = stackSeries([[3], [-1]], "expand");
    expect(extents).toEqual([[[0, 0.75]], [[-0.25, 0]]]);
    expect(mixedSignSlots).toEqual([0]);
  });

  it("differs from d3's expand on that slot, the negative control", () => {
    const [a, b] = d3Stack<{ a: number; b: number }>().keys(["a", "b"]).offset(d3Expand)([{ a: 3, b: -1 }]);
    expect([a?.[0]?.[0], a?.[0]?.[1], b?.[0]?.[0], b?.[0]?.[1]]).toEqual([0, 1.5, 1.5, 1]);
  });

  it("fills [−1, 0] downward in series order for a negative slot, which mixes no signs", () => {
    expect(stackSeries([[-2], [-2]], "expand")).toEqual({
      extents: [[[-0.5, 0]], [[-1, -0.5]]],
      mixedSignSlots: [],
    });
  });

  it("counts a zero part as neither sign", () => {
    expect(stackSeries([[0], [-1]], "expand").mixedSignSlots).toEqual([]);
    expect(stackSeries([[0], [1]], "expand").mixedSignSlots).toEqual([]);
  });

  it("stacks no series at all", () => {
    expect(stackSeries([], "diverging")).toEqual({ extents: [], mixedSignSlots: [] });
  });

  it("gives an all-zero slot zero-height parts under expand", () => {
    expect(stackSeries([[0], [0]], "expand").extents).toEqual([[[0, 0]], [[0, 0]]]);
  });

  it("draws nothing for a null part and keeps the other parts in place", () => {
    const { extents } = stackSeries(
      [
        [1, 2],
        [null, 3],
        [4, 5],
      ],
      "diverging"
    );
    expect(extents).toEqual([
      [
        [0, 1],
        [0, 2],
      ],
      [null, [2, 5]],
      [
        [1, 5],
        [5, 10],
      ],
    ]);
  });

  it("hangs a negative spot hour below zero while the charges stay above", () => {
    // S13's shape: a −12.40 øre spot hour under 95.10 øre of charges nets 82.70 øre.
    const { extents } = stackSeries([[-12.4], [95.1]], "diverging");
    expect(extents).toEqual([[[-12.4, 0]], [[0, 95.1]]]);
  });
});

describe("stack metamorphic relation", () => {
  it("moves no other part when an all-zero series joins the stack", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.array(fc.option(fc.integer({ min: -1000, max: 1000 }), { nil: null }), {
            minLength: 4,
            maxLength: 4,
          }),
          {
            minLength: 1,
            maxLength: 5,
          }
        ),
        fc.nat({ max: 5 }),
        fc.constantFrom<StackOffset>("diverging", "expand"),
        (series, at, offset) => {
          const position = Math.min(at, series.length);
          const zero = [0, 0, 0, 0];
          const withZero = [...series.slice(0, position), zero, ...series.slice(position)];
          const before = stackSeries(series, offset).extents;
          const after = stackSeries(withZero, offset).extents.filter((_, index) => index !== position);
          expect(after).toEqual(before);
        }
      ),
      { seed: 20261018, numRuns: 300 }
    );
  });
});
