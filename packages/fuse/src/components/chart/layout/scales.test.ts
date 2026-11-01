// Unit under test: Fuse's band, point and linear scales, through a d3-scale-shaped facade.
// Oracle: d3-scale 4.0.2's own test assertions, frozen in the charts ground truth and copied
// into fixtures/d3/ by .scratch/charts-v1/tools/l05-oracles/trim_d3_cases.py.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { bandScale, nearestIndex, pointScale } from "./band-scale";
import type { BandScale } from "./band-scale";
import { runD3Cases } from "./fixtures/d3-cases";
import type { D3CaseFile } from "./fixtures/d3-cases";
import { scaleBand, scaleLinear, scalePoint } from "./fixtures/d3-facade";
import band from "./fixtures/d3/d3-scale/band.json" with { type: "json" };
import linear from "./fixtures/d3/d3-scale/linear.json" with { type: "json" };
import point from "./fixtures/d3/d3-scale/point.json" with { type: "json" };

/** d3-scale's own test helper, `test/roundEpsilon.js`, copied unchanged. */
function roundEpsilon(x: number): number {
  return Math.round(x * 1e12) / 1e12;
}

const BINDINGS = { scaleBand, scalePoint, scaleLinear, roundEpsilon };

/**
 * The only reasons a case may skip. Each names a d3 feature Fuse's scales leave out on purpose,
 * because a chart's x scale counts slots and its value scale maps two numbers, or a case the
 * extraction could not make self-contained.
 */
const SKIP_REASONS = [
  /^the expected value is not a literal$/u,
  /^the case reads \w+, a local the extraction lost$/u,
  /^Fuse has no (unknown|interpolate|rangeRound|tickFormat)$/u,
  /^Fuse has no (domain|range) with [0-9] values$/u,
  /^Fuse has no (domain|range) of (object|colour strings)$/u,
];

function judge(name: string, file: D3CaseFile, passing: number): void {
  const outcomes = runD3Cases(file, BINDINGS);
  it(`passes every applicable ${name} case`, () => {
    expect(outcomes.filter(({ outcome }) => outcome.kind === "fail")).toEqual([]);
  });
  it(`skips ${name} cases only for a feature Fuse leaves out`, () => {
    const reasons = outcomes.flatMap(({ outcome }) =>
      outcome.kind === "unsupported" ? [outcome.reason] : []
    );
    expect(reasons.filter((reason) => !SKIP_REASONS.some((pattern) => pattern.test(reason)))).toEqual([]);
  });
  it(`runs ${String(passing)} ${name} cases`, () => {
    // The count is the coverage floor. A facade change that drops a case must change it on purpose.
    expect(outcomes.filter(({ outcome }) => outcome.kind === "pass")).toHaveLength(passing);
  });
}

describe("d3-scale band.json", () => judge("band", band, 97));
describe("d3-scale point.json", () => judge("point", point, 16));
describe("d3-scale linear.json", () => judge("linear", linear, 142));

describe("section 8.15 bands", () => {
  it("leaves a 25 % gap around each 40 px band, so each bar is 30 px wide and starts 5 px in", () => {
    // Hand-derived from section 8.15: a 40 px step less 25 % is 30 px, centred 5 px in.
    const scale = bandScale({ count: 3, range: [0, 120], paddingInner: 0.25, paddingOuter: 0.125 });
    expect(scale.step).toBe(40);
    expect(scale.bandwidth).toBe(30);
    expect(scale.starts).toEqual([5, 45, 85]);
  });

  it("leaves the step unrounded by default", () => {
    expect(bandScale({ count: 3, range: [0, 10] }).step).toBeCloseTo(10 / 3, 12);
  });

  it("pads, aligns and rounds a point scale", () => {
    // Hand-derived: 3 points with 1 step of padding each side split 10 into 4 steps of 2.5,
    // floored to 2. The points span 4, so 6 units are left over. Align 0 puts them all after the
    // points, and align 1 all before.
    expect(pointScale({ count: 3, range: [0, 10], padding: 1, align: 0, round: true }).starts).toEqual([
      0, 2, 4,
    ]);
    expect(pointScale({ count: 3, range: [0, 10], padding: 1, align: 1, round: true }).starts).toEqual([
      6, 8, 10,
    ]);
  });

  it("gives a point scale no bandwidth and reaches both range ends", () => {
    const scale = pointScale({ count: 5, range: [0, 1] });
    expect(scale.bandwidth).toBe(0);
    expect(scale.starts).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});

describe("nearestIndex", () => {
  const centre = (scale: BandScale, slot: number): number => (scale.starts[slot] ?? 0) + scale.bandwidth / 2;

  /** The brute-force oracle's distance, from the position to the nearest centre of any slot. */
  function nearestDistance(scale: BandScale, position: number): number {
    return Math.min(...scale.starts.map((_, slot) => Math.abs(position - centre(scale, slot))));
  }

  it("picks a slot whose centre is as near as any, on band and point scales", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 400 }),
        fc.double({ min: -0.2, max: 1.2, noNaN: true }),
        fc.boolean(),
        (count, position, isPoint) => {
          const scale = isPoint
            ? pointScale({ count, range: [0, 1] })
            : bandScale({ count, range: [0, 1], paddingInner: 0.25, paddingOuter: 0.125 });
          const picked = Math.abs(position - centre(scale, nearestIndex(scale, position)));
          expect(picked).toBeCloseTo(nearestDistance(scale, position), 12);
        }
      ),
      { seed: 20261018, numRuns: 2000 }
    );
  });

  it("picks the later slot exactly between two centres, because cells are half-open", () => {
    const scale = bandScale({ count: 4, range: [0, 4] });
    expect(nearestIndex(scale, 1)).toBe(1);
    expect(nearestIndex(scale, 2)).toBe(2);
    expect(nearestIndex(scale, -5)).toBe(0);
    expect(nearestIndex(scale, 9)).toBe(3);
  });

  it("measures from the range start on a range that does not start at 0", () => {
    const scale = bandScale({ count: 4, range: [10, 14] });
    expect([10.4, 10.99, 11, 13.9].map((position) => nearestIndex(scale, position))).toEqual([0, 0, 1, 3]);
  });

  it("picks the only slot of a one-slot scale", () => {
    expect(nearestIndex(pointScale({ count: 1, range: [0, 1] }), 0.9)).toBe(0);
  });
});
