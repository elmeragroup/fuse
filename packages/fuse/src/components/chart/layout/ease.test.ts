// Unit under test: cubicBezier, the JS twin of CSS cubic-bezier(). Oracles: the eased progress at
// a quarter, a half and three quarters of 480 ms on cubic-bezier(0, 0.7, 0.5, 1), which
// .scratch/charts-v1/tools/l05-oracles/motion_fixture.py solves by bisection of its own and writes
// to test/chart/motion-frames.json, and the identity of any curve whose controls lie on the
// diagonal, which CSS Easing 1 defines as linear.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import frames from "../../../../test/chart/motion-frames.json" with { type: "json" };
import { cubicBezier } from "./ease";

describe("cubicBezier", () => {
  it("eases cubic-bezier(0, 0.7, 0.5, 1) as the motion oracle does", () => {
    const ease = cubicBezier([0, 0.7, 0.5, 1]);
    const { from, to, at } = frames.references.line;
    for (const [ms, value] of [
      [120, at["120"]],
      [240, at["240"]],
      [360, at["360"]],
    ] as const) {
      expect(ease(ms / 480), String(ms)).toBeCloseTo((value - from) / (to - from), 6);
    }
  });

  it("starts at 0 and ends at 1, and clamps outside", () => {
    const ease = cubicBezier([0, 0.7, 0.5, 1]);
    expect([ease(-1), ease(0), ease(1), ease(2)]).toEqual([0, 0, 1, 1]);
  });

  it("is the identity for controls on the diagonal", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (a, b, progress) => {
          expect(cubicBezier([a, a, b, b])(progress)).toBeCloseTo(progress, 5);
        }
      )
    );
  });
});
