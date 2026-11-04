import { describe, expect, it } from "vitest";

import {
  dotCentre,
  dotDiameter,
  frameX,
  frameY,
  linePath,
  pointsPath,
  referenceInDomains,
} from "./scatter-frame";
import type { ScatterFrame } from "./scatter-frame";

/** A frame over a plot at the page's top left, at 1 device pixel per CSS pixel unless given. */
function frame(
  width: number,
  height: number,
  x: readonly [number, number],
  y: readonly [number, number],
  box: { readonly dpr?: number; readonly left?: number; readonly top?: number } = {}
): ScatterFrame {
  return { box: { width, height, dpr: box.dpr ?? 1, left: box.left ?? 0, top: box.top ?? 0 }, x, y };
}

describe("the scatter projection", () => {
  // Unit under test: frameX and frameY. Oracle: positions worked out by hand.
  it("places x = 2 at 40 px on [−2, 18] across 200 px", () => {
    // 2 lies 4 of the domain's 20 from its start, a fifth of 200 px.
    expect(frameX(frame(200, 140, [-2, 18], [0, 1]), 2)).toBe(40);
  });

  it("places 90 000 70 px up on [20 000, 160 000] across 140 px, y up", () => {
    // 90 000 lies 70 000 of the domain's 140 000 from the bottom, half of 140 px, so 70 px from
    // the top as well.
    expect(frameY(frame(200, 140, [0, 1], [20_000, 160_000]), 90_000)).toBe(70);
    // 160 000 is the top edge and 20 000 the bottom one.
    expect(frameY(frame(200, 140, [0, 1], [20_000, 160_000]), 160_000)).toBe(0);
    expect(frameY(frame(200, 140, [0, 1], [20_000, 160_000]), 20_000)).toBe(140);
  });
});

describe("the dot snapping", () => {
  // Unit under test: dotDiameter and dotCentre. Oracle: device pixels counted by hand. A dot whose
  // diameter is an even count of device pixels centres on a pixel edge, an odd one on a pixel's
  // middle, so its edges fall on whole pixels.
  const plot = frame(200, 140, [-2, 18], [20_000, 160_000]);

  it("centres an 8 px dot on the pixel edge and a 5 px dot on the pixel's middle at 1x", () => {
    expect(dotCentre(plot, 2, 90_000, 8)).toEqual({ x: 40, y: 70 });
    expect(dotCentre(plot, 2, 90_000, 5)).toEqual({ x: 40.5, y: 70.5 });
  });

  it("counts device pixels at 2x, where a 5 px dot is 10 device pixels across", () => {
    const retina = frame(200, 140, [-2, 18], [20_000, 160_000], { dpr: 2 });
    expect(dotDiameter(retina.box, 5)).toBe(5);
    expect(dotCentre(retina, 2, 90_000, 5)).toEqual({ x: 40, y: 70 });
    // 2.15 lies at 41.5 px, device pixel 83, an edge at 2x.
    expect(dotCentre(retina, 2.15, 90_000, 5).x).toBe(41.5);
  });

  it("rounds a diameter to whole device pixels at 1.5x", () => {
    // 5 px is 7.5 device pixels, which rounds to 8, so the dot draws 16/3 CSS pixels across.
    expect(dotDiameter({ width: 1, height: 1, dpr: 1.5, left: 0, top: 0 }, 5)).toBe(16 / 3);
  });

  it("snaps from the plot's page position, as the browser places the layer", () => {
    // The plot starts at 10.6 CSS px, drawn from device pixel 11. x = 40 lands at page 50.6,
    // device pixel 51, which is 40 pixels from the layer's origin.
    const shifted = frame(200, 140, [-2, 18], [20_000, 160_000], { left: 10.6, top: 3.4 });
    expect(dotCentre(shifted, 2, 90_000, 8)).toEqual({ x: 40, y: 70 });
    // x = 2.015 lands at 40.15, page 50.75, device pixel 51 too.
    expect(dotCentre(shifted, 2.015, 90_000, 8).x).toBe(40);
  });
});

describe("the scatter paths", () => {
  // Unit under test: pointsPath and linePath. Oracle: path data written by hand from the
  // positions above.
  const plot = frame(200, 140, [-2, 18], [20_000, 160_000]);

  it("draws each point as a zero-length subpath", () => {
    // (−2, 20 000) is the bottom left corner, (18, 160 000) the top right.
    const xs = Float64Array.of(-2, 2, 18);
    const ys = Float64Array.of(20_000, 90_000, 160_000);
    expect(pointsPath(plot, xs, ys, 8)).toBe("M0 140h0M40 70h0M200 0h0");
    expect(pointsPath(plot, new Float64Array(0), new Float64Array(0), 8)).toBe("");
  });

  it("joins a series' points straight, on the middle of each 1 px hairline", () => {
    const xs = Float64Array.of(-2, 2, 18);
    const ys = Float64Array.of(20_000, 90_000, 160_000);
    expect(linePath(plot, xs, ys, "linear")).toBe("M0,140L40,70L200,0");
    expect(linePath(plot, Float64Array.of(2), Float64Array.of(90_000), "linear")).toBe("");
  });

  it("steps after each point along x", () => {
    // step-after holds each y until the next x: (0,140) → (40,140) → (40,70) → (200,70) → (200,0).
    const xs = Float64Array.of(-2, 2, 18);
    const ys = Float64Array.of(20_000, 90_000, 160_000);
    expect(linePath(plot, xs, ys, "step-after")).toBe("M0,140L40,140L40,70L200,70L200,0");
  });
});

describe("the reference geometry", () => {
  // Unit under test: referenceInDomains, the one geometry every ScatterChart.ReferenceLine form
  // resolves through. Oracle: segment clips worked by hand on the domains [0, 10] × [0, 10].
  const domains = { x: [0, 10], y: [0, 10] } as const;

  it("drops a segment wholly outside the domains, and keeps one wholly inside as it is", () => {
    expect(referenceInDomains({ from: [-10, 5], to: [-5, 5] }, domains)).toBeNull();
    expect(referenceInDomains({ from: [2, 2], to: [8, 6] }, domains)).toEqual([
      [2, 2],
      [8, 6],
    ]);
  });

  it("clips a segment that crosses an edge to the edge", () => {
    // From (−5, 5) to (5, 5) crosses x = 0 at (0, 5).
    expect(referenceInDomains({ from: [-5, 5], to: [5, 5] }, domains)).toEqual([
      [0, 5],
      [5, 5],
    ]);
    // From (−10, −10) to (20, 20) runs along the diagonal, clipped to (0, 0) and (10, 10).
    expect(referenceInDomains({ from: [-10, -10], to: [20, 20] }, domains)).toEqual([
      [0, 0],
      [10, 10],
    ]);
    // From (5, −5) to (15, 5) enters at y = 0 where x = 10, the corner, and leaves there.
    expect(referenceInDomains({ from: [5, -5], to: [15, 5] }, domains)).toEqual([
      [10, 0],
      [10, 0],
    ]);
  });

  it("spans the domain for a line inside it, and drops one outside", () => {
    expect(referenceInDomains({ x: 4 }, domains)).toEqual([
      [4, 0],
      [4, 10],
    ]);
    expect(referenceInDomains({ y: 7 }, domains)).toEqual([
      [0, 7],
      [10, 7],
    ]);
    expect(referenceInDomains({ x: 11 }, domains)).toBeNull();
    expect(referenceInDomains({ y: -1 }, domains)).toBeNull();
  });
});
