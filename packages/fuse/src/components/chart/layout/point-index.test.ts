import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { buildPointIndex, nearestPoint } from "./point-index";

/**
 * An index over points placed in plot pixels on a plot of the given size, with y measured from
 * the bottom. The index takes shares of the plot, so each pixel divides by the plot's size.
 */
function placed(points: readonly (readonly [number, number])[], width: number, height: number) {
  const xs = Float64Array.from(points, ([x]) => x / width);
  const ys = Float64Array.from(points, ([, y]) => y / height);
  // Rank is the point's walk place. These tests give every point its own index as its rank.
  const rank = Uint32Array.from(points, (_, index) => index);
  return buildPointIndex({ xs, ys, rank });
}

/** The pointer at pixel (x, y), y from the bottom, on a plot of the given size. */
function pointer(x: number, y: number, width: number, height: number) {
  return { x: x / width, y: y / height, width, height };
}

describe("the nearest point", () => {
  // Unit under test: nearestPoint over a uniform grid index. Oracle: distances worked out by hand
  // in plot pixels on a 200 × 100 plot.
  const width = 200;
  const height = 100;

  it("picks the point nearest the pointer in pixels, not in data shares", () => {
    // From (50, 50): (40, 50) lies 10 px away and (50, 62) lies 12 px away. In shares of the
    // plot, (50, 62) is nearer (0.12 tall against 0.05 wide), so a share distance would pick it.
    const index = placed(
      [
        [40, 50],
        [50, 62],
      ],
      width,
      height
    );
    expect(nearestPoint(index, pointer(50, 50, width, height), 24)).toBe(0);
  });

  it("finds nothing past the hit radius, and the point just inside it", () => {
    const index = placed([[100, 50]], width, height);
    // 24.5 px to the right is outside a 24 px radius, 23.5 px is inside.
    expect(nearestPoint(index, pointer(124.5, 50, width, height), 24)).toBe(-1);
    expect(nearestPoint(index, pointer(123.5, 50, width, height), 24)).toBe(0);
    // A diagonal of (18, 18) is 25.46 px, outside, though each axis alone is inside.
    expect(nearestPoint(index, pointer(118, 68, width, height), 24)).toBe(-1);
  });

  it("gives a tie to the point earlier in the walk", () => {
    // Both lie 10 px from (100, 50).
    const index = placed(
      [
        [110, 50],
        [90, 50],
      ],
      width,
      height
    );
    expect(nearestPoint(index, pointer(100, 50, width, height), 24)).toBe(0);
  });

  it("finds a point several empty cells away, and nothing in an empty plot", () => {
    // One point in each corner leaves the middle cells empty.
    const index = placed(
      [
        [0, 0],
        [200, 100],
        [0, 100],
        [200, 0],
      ],
      width,
      height
    );
    expect(nearestPoint(index, pointer(100, 50, width, height), 24)).toBe(-1);
    expect(nearestPoint(index, pointer(190, 95, width, height), 24)).toBe(1);
    expect(nearestPoint(placed([], width, height), pointer(100, 50, width, height), 24)).toBe(-1);
  });

  it("finds a repeated point once, the earlier one", () => {
    const index = placed(
      [
        [60, 40],
        [60, 40],
      ],
      width,
      height
    );
    expect(nearestPoint(index, pointer(61, 41, width, height), 24)).toBe(0);
  });

  it("agrees with a scan of every point", () => {
    // Oracle: a brute-force scan written here, independent of the grid, which measures every
    // point's pixel distance and keeps the nearest within the radius, the lower rank on a tie.
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 0, max: 400 }), fc.integer({ min: 0, max: 120 })), {
          maxLength: 300,
        }),
        fc.tuple(fc.integer({ min: -20, max: 420 }), fc.integer({ min: -20, max: 140 })),
        fc.integer({ min: 1, max: 60 }),
        (points, [px, py], radius) => {
          const index = placed(points, 400, 120);
          let best = -1;
          let bestDistance = Number.POSITIVE_INFINITY;
          points.forEach(([x, y], id) => {
            const distance = Math.hypot(x - px, y - py);
            if (distance <= radius && distance < bestDistance) {
              best = id;
              bestDistance = distance;
            }
          });
          // The index measures through shares of the plot, which round in the last bits, so a
          // case where another point or the radius lies within that rounding is no case.
          const close = (a: number, b: number) => a !== b && Math.abs(a - b) < 1e-6;
          fc.pre(!close(bestDistance, radius));
          fc.pre(
            points.every(([x, y], id) => id === best || !close(Math.hypot(x - px, y - py), bestDistance))
          );
          expect(nearestPoint(index, pointer(px, py, 400, 120), radius)).toBe(best);
        }
      )
    );
  });
});
