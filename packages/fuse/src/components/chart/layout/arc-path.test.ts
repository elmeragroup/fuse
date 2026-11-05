// The polar path writers. Unit under test: arcPath, arcCentroid, radialLinePath, radialAreaPath
// and ringTrack. Oracles: d3-shape 3.2.0's own arc, lineRadial and areaRadial tests,
// frozen in fixtures/d3/d3-shape/ by .scratch/polar-charts/tools/trim_polar_cases.py with the
// expected values the d3 author wrote, replayed through a facade that turns their radians into
// Fuse's degrees; and hand-derived ring tracks. Fuse forwards its arcs to d3-shape, so
// the vectors check the degree conversion, the defaults and the rounding around the forwarding.
import { describe, expect, it } from "vitest";

import { arcPath, radialLinePath, ringTrack } from "./arc-path";
import { normalizePath, runD3Cases } from "./fixtures/d3-cases";
import { arc, areaRadial, lineRadial } from "./fixtures/d3-polar-facade";
import arcCases from "./fixtures/d3/d3-shape/arc.json" with { type: "json" };
import areaCases from "./fixtures/d3/d3-shape/areaRadial.json" with { type: "json" };
import lineCases from "./fixtures/d3/d3-shape/lineRadial.json" with { type: "json" };
import { sweepOf } from "./polar-angle";

const BINDINGS = { arc, lineRadial, areaRadial };

/** The lines whose cases a file leaves unrun, each with why. */
function unrun(file: Parameters<typeof runD3Cases>[0]) {
  return runD3Cases(file, BINDINGS, { tolerance: 1e-12 }).flatMap(({ line, outcome }) =>
    outcome.kind === "unsupported" ? [[line, outcome.reason] as const] : []
  );
}

describe("d3-shape's own tests", () => {
  it("draws every literal arc case as d3's author wrote it", () => {
    const outcomes = runD3Cases(arcCases, BINDINGS, { tolerance: 1e-12 });
    expect(outcomes.filter(({ outcome }) => outcome.kind === "fail")).toEqual([]);
    expect(outcomes.filter(({ outcome }) => outcome.kind === "pass")).toHaveLength(111);
    // The rest propagate a context and arguments to accessor functions, which Fuse does not take.
    expect(new Set(unrun(arcCases).map(([, reason]) => reason))).toEqual(
      new Set(["the expected value is not a literal"])
    );
  });

  it.each([
    ["lineRadial", lineCases, 12],
    ["areaRadial", areaCases, 14],
  ] as const)("draws %s's one literal path, d3's angle frame", (_, file, pathLine) => {
    const outcomes = runD3Cases(file, BINDINGS, { tolerance: 1e-12 });
    expect(outcomes.filter(({ outcome }) => outcome.kind === "fail")).toEqual([]);
    expect(outcomes.filter(({ outcome }) => outcome.kind === "pass").map(({ line }) => line)).toEqual([
      pathLine,
    ]);
    // Every other case reads an accessor or a non-literal binding Fuse has no counterpart for.
    for (const [, reason] of unrun(file)) {
      expect(reason).toMatch(/accessor|not a literal|ref curveLinear/u);
    }
  });
});

describe("arc conversions written by hand", () => {
  it("starts slice 0 of a default pie at 12 o'clock, (0, −R)", () => {
    expect(arcPath({ innerRadius: 0, outerRadius: 100, startAngle: 0, endAngle: 90 })).toBe(
      "M0,-100A100,100,0,0,1,100,0L0,0Z"
    );
  });

  it("keeps three digits, d3-shape's default", () => {
    // sin 30° · 100 = 50 and cos 30° · 100 = 86.6025…, which rounds to 86.603.
    expect(arcPath({ innerRadius: 0, outerRadius: 100, startAngle: 0, endAngle: 30 })).toBe(
      "M0,-100A100,100,0,0,1,50,-86.603L0,0Z"
    );
  });
});

describe("ringTrack", () => {
  it("draws a part sweep as one arc, its large-arc flag set past 180°", () => {
    // At ±135° a point sits below the centre: (±50·sin 135°, −50·cos 135°) = (±35.355, 35.355).
    expect(ringTrack(50, sweepOf(-135, 135))).toBe("M-35.355,35.355A50,50 0 1 1 35.355,35.355");
    expect(ringTrack(50, sweepOf(0, 90))).toBe("M0,-50A50,50 0 0 1 50,0");
  });

  it("draws a full turn as two half arcs, since one arc command cannot close a circle", () => {
    expect(ringTrack(50, sweepOf(0, 360))).toBe("M0,-50A50,50 0 0 1 0,50A50,50 0 0 1 0,-50");
  });

  it("draws a counter-clockwise sweep with the sweep flag cleared", () => {
    expect(ringTrack(50, sweepOf(0, -90))).toBe("M0,-50A50,50 0 0 0 -50,0");
  });
});

describe("radialLinePath", () => {
  it("closes back to its first vertex when told to", () => {
    expect(
      normalizePath(
        radialLinePath(
          [
            { angle: 0, radius: 10 },
            { angle: 90, radius: 10 },
            { angle: 180, radius: 10 },
          ],
          "closed"
        )
      )
    ).toBe("M0,-10L10,0L0,10Z");
  });

  it("breaks at a missing vertex", () => {
    expect(
      normalizePath(
        radialLinePath(
          [
            { angle: 0, radius: 10 },
            { angle: 90, radius: 10 },
            null,
            { angle: 270, radius: 10 },
            { angle: 0, radius: 20 },
          ],
          "open"
        )
      )
    ).toBe("M0,-10L10,0M-10,0L0,-20");
  });
});
