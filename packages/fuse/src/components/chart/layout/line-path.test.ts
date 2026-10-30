// Path data for lines and areas. Unit under test: linePaths and areaPaths. Oracles: d3-shape's own
// curve assertions, frozen in fixtures/d3/d3-shape/ by
// .scratch/charts-v1/tools/l06-oracles/trim_curve_cases.py with the expected paths the d3 author
// wrote; the parity ledger's L17 to L19, which change d3's output where Fuse draws otherwise; and
// hand-written paths. Fuse forwards its curves to d3-shape, so the vectors check the forwarding
// with the vertex, gap and rounding wiring around it.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { ChartCurve } from "../chart-types";
import basis from "./fixtures/d3/d3-shape/curve-basis.json" with { type: "json" };
import linear from "./fixtures/d3/d3-shape/curve-linear.json" with { type: "json" };
import monotoneX from "./fixtures/d3/d3-shape/curve-monotoneX.json" with { type: "json" };
import natural from "./fixtures/d3/d3-shape/curve-natural.json" with { type: "json" };
import step from "./fixtures/d3/d3-shape/curve-step.json" with { type: "json" };
import stepAfter from "./fixtures/d3/d3-shape/curve-stepAfter.json" with { type: "json" };
import { areaPaths, linePaths } from "./line-path";
import type { PathPlacement, PathTopology } from "./line-path";
import type { VertexState } from "./series-path";

/** A placement that draws the numbers as they are. */
function placed(curve: ChartCurve, half = 0.5): PathPlacement {
  return {
    orientation: "vertical",
    curve,
    along: (at) => at,
    run: (centre) => [centre - half, centre + half],
    edge: (at) => at,
    across: (at) => at,
    digits: 3,
  };
}

/** A topology of readings and gaps, measured and unprojected unless told otherwise. */
function topologyOf(
  states: readonly VertexState[],
  options: {
    readonly missing?: "gap" | "connect";
    readonly estimated?: readonly number[];
    readonly projectedFrom?: number;
    readonly sides?: readonly ("positive" | "negative" | null)[];
  } = {}
): PathTopology {
  return {
    count: states.length,
    states,
    estimated: states.map((_, index) => options.estimated?.includes(index) ?? false),
    projectedFrom: options.projectedFrom ?? states.length,
    missing: options.missing ?? "gap",
    sides: options.sides ?? states.map(() => null),
  };
}

/**
 * d3-shape's own assertPathEqual normalisation, from test/asserts.js of the frozen d3-shape 3.2.0
 * tests: every number to 3 digits, or to an integer within 1e-6 of one, on both sides.
 */
function normalizePath(path: string): string {
  return path.replace(/[-+]?(?:\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][-]?\d+)?/gu, (text) => {
    const value = Number(text);
    return Math.abs(value - Math.round(value)) < 1e-6 ? String(Math.round(value)) : value.toFixed(3);
  });
}

type CurveCase = {
  readonly line: number;
  readonly points: readonly (readonly number[])[];
  readonly expected: string;
};

describe("linePaths against d3-shape's own curve tests", () => {
  const files: readonly (readonly [ChartCurve, { readonly cases: readonly CurveCase[] }])[] = [
    ["linear", linear],
    ["monotone", monotoneX],
    ["natural", natural],
    ["step", step],
    ["basis", basis],
  ];
  const cases = files.flatMap(([curve, file]) =>
    file.cases.filter(({ points }) => points.length > 1).map((entry) => [curve, entry] as const)
  );

  it.each(cases)("draws %s like d3 at line %#", (curve, { points, expected }) => {
    const values = points.flatMap(([x = 0, y = 0]) => [x, y]);
    const topology = topologyOf(points.map(() => "reading"));
    expect(normalizePath(linePaths(values, topology, placed(curve)).line)).toBe(normalizePath(expected));
  });

  it("draws one point as a dot where d3 draws a path of no length (L18)", () => {
    // d3 gives "M0,1Z" for one point, which paints nothing. The dot is two arcs of 2.5 px.
    expect(monotoneX.cases.find(({ points }) => points.length === 1)?.expected).toBe("M0,1Z");
    expect(linePaths([0, 1], topologyOf(["reading"]), placed("monotone")).line).toBe(
      "M-2.5,1a2.5,2.5 0 1,0 5,0a2.5,2.5 0 1,0 -5,0"
    );
  });

  it("runs step-after from cell edge to cell edge, which adds d3's missing last run (L19)", () => {
    // d3's stepAfter through the cell starts 0 and 2 ends at the last start, 2. Fuse's vertices
    // sit at the cell centres 1 and 3, half a cell of 1 from each edge, and keep the last run to 4.
    const d3 = stepAfter.cases.find(({ points }) => JSON.stringify(points) === "[[0,1],[2,3]]")?.expected;
    expect(d3).toBe("M0,1L2,1L2,3");
    expect(linePaths([1, 1, 3, 3], topologyOf(["reading", "reading"]), placed("step-after", 1)).line).toBe(
      `${d3 ?? ""}L4,3`
    );
  });
});

describe("linePaths topology", () => {
  it("dashes the segments that touch an estimated reading", () => {
    const { dashed } = linePaths(
      [0, 0, 10, 0, 20, 0, 30, 0],
      topologyOf(["reading", "reading", "reading", "reading"], { estimated: [2] }),
      placed("linear")
    );
    expect(dashed).toEqual([[10, 30]]);
  });

  it("dashes an estimated step run over its own cell only", () => {
    const { dashed } = linePaths(
      [5, 0, 15, 0, 25, 0],
      topologyOf(["reading", "reading", "reading"], { estimated: [1] }),
      placed("step-after", 5)
    );
    expect(dashed).toEqual([[10, 20]]);
  });

  it("dashes the projected tail from its first vertex to the end", () => {
    const { dashed } = linePaths(
      [0, 0, 10, 0, 20, 0],
      topologyOf(["reading", "reading", "reading"], { projectedFrom: 1 }),
      placed("linear")
    );
    expect(dashed).toEqual([[10, Number.POSITIVE_INFINITY]]);
  });

  it("never bridges a slot still to come", () => {
    const { line, dashed } = linePaths(
      [0, 0, 10, 0, 20, 0],
      topologyOf(["reading", "pending", "reading"], { missing: "connect" }),
      placed("linear")
    );
    expect(line.match(/M/gu)).toHaveLength(2);
    expect(dashed).toEqual([]);
  });

  const states = fc.array(fc.constantFrom<VertexState>("reading", "reading", "missing", "pending"), {
    minLength: 1,
    maxLength: 40,
  });

  /** The runs of readings a list of states holds, as a hand-written scan. */
  function runs(list: readonly VertexState[], connect: boolean): number[][] {
    const out: number[][] = [];
    let run: number[] = [];
    list.forEach((state, index) => {
      if (state === "reading") run.push(index);
      else if (!(connect && state === "missing") && run.length > 0) {
        out.push(run);
        run = [];
      }
    });
    if (run.length > 0) out.push(run);
    return out;
  }

  it("draws one subpath per run of readings, and a run of one as a dot", () => {
    fc.assert(
      fc.property(states, (list) => {
        const values = list.flatMap((_, index) => [index * 10, 50]);
        const { line } = linePaths(values, topologyOf(list), placed("linear"));
        const expected = runs(list, false);
        expect(line.match(/M/gu)?.length ?? 0).toBe(expected.length);
        expect(line.match(/a2\.5,2\.5/gu)?.length ?? 0).toBe(
          2 * expected.filter((run) => run.length === 1).length
        );
      })
    );
  });

  it("bridges every inner run of missing readings once under connect, dashed", () => {
    fc.assert(
      fc.property(states, (list) => {
        const values = list.flatMap((_, index) => [index * 10, 50]);
        const { dashed } = linePaths(values, topologyOf(list, { missing: "connect" }), placed("linear"));
        // A bridge joins two readings of one run that have a missing reading between them.
        const bridges = runs(list, true).flatMap((run) =>
          run.slice(1).flatMap((index, at) => {
            const before = run[at] ?? 0;
            return list.slice(before + 1, index).includes("missing") ? [[before * 10, index * 10]] : [];
          })
        );
        // Bridges that meet at a reading draw as one dashed span.
        const joined = bridges.reduce<number[][]>((spans, [start = 0, end = 0]) => {
          const last = spans.at(-1);
          if (last?.[1] === start) last[1] = end;
          else spans.push([start, end]);
          return spans;
        }, []);
        expect(dashed).toEqual(joined);
      })
    );
  });
});

describe("areaPaths", () => {
  it("draws each lone reading as a dot for every non-step curve, and an estimated one hatched (B2-1)", () => {
    // [10, null, 20]: two runs of one reading each, which no fill can paint. Each draws L18's dot,
    // two arcs of 2.5 px around its vertex, and the estimated first one hatches 4.5 px either side.
    const values = [0, 10, 50, 10, 15, 50, 20, 20, 50];
    const dots = "M-2.5,10a2.5,2.5 0 1,0 5,0a2.5,2.5 0 1,0 -5,0M17.5,20a2.5,2.5 0 1,0 5,0a2.5,2.5 0 1,0 -5,0";
    for (const curve of ["linear", "monotone", "natural", "step", "bump", "basis"] as const) {
      const paths = areaPaths(
        values,
        topologyOf(["reading", "missing", "reading"], { estimated: [0] }),
        placed(curve)
      );
      expect(paths, curve).toEqual({ area: "", dots, hatched: [[-4.5, 4.5]] });
    }
  });

  it("places a plain step's riser through the placement, for a line and an area's top and base (B3-1)", () => {
    // Vertices at 1 and 3, values 10 and 30, bases 50: the riser lies halfway, at 2, which the
    // placement here moves to 2.25, as a stroke of odd width moves a riser off its cell edge.
    const placement = { ...placed("step"), edge: (at: number) => at + 0.25 };
    expect(linePaths([1, 10, 3, 30], topologyOf(["reading", "reading"]), placement).line).toBe(
      "M1,10L2.25,10L2.25,30L3,30"
    );
    expect(areaPaths([1, 10, 50, 3, 30, 50], topologyOf(["reading", "reading"]), placement).area).toBe(
      "M1,10L2.25,10L2.25,30L3,30L3,50L2.25,50L2.25,50L1,50Z"
    );
  });

  it("fills a step-after lone reading's cell and draws no dot", () => {
    const paths = areaPaths([1, 10, 50], topologyOf(["reading"]), placed("step-after", 1));
    expect([paths.area, paths.dots]).toEqual(["M0,10L2,10L2,50L0,50Z", ""]);
  });

  it("fills a linear run between its values and its bases, closed", () => {
    // Two vertices, each its place, value and base.
    const { area } = areaPaths([0, 10, 50, 20, 30, 50], topologyOf(["reading", "reading"]), placed("linear"));
    expect(area).toBe("M0,10L20,30L20,50L0,50Z");
  });

  it("fills a step-after run edge to edge", () => {
    const { area } = areaPaths(
      [5, 10, 50, 15, 30, 50],
      topologyOf(["reading", "reading"]),
      placed("step-after", 5)
    );
    expect(area).toBe("M0,10L10,10L10,30L20,30L20,50L10,50L10,50L0,50Z");
  });

  it("hatches an estimated reading's segments over the fill", () => {
    const { hatched } = areaPaths(
      [0, 10, 50, 20, 30, 50, 40, 20, 50],
      topologyOf(["reading", "reading", "reading"], { estimated: [0] }),
      placed("linear")
    );
    expect(hatched).toEqual([[0, 20]]);
  });
});
