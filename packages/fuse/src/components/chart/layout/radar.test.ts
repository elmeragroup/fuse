// The radar's layout. Unit under test: radarDomain, radarRadius, spokeAngle, radarVertices,
// zeroPolygon, radarQuads, polygonsPath, radarLinePath, spokeAt and nearestVertex. Oracles, written
// by hand: ticket 10's R1 vertices for values 1 to 4 on a [0, 4] domain at radius R, which are
// (0, −R/4), (R/2, 0), (0, 3R/4) and (−R, 0); CONTRACT section 8.4's [−2, 1, 3] fixture, whose
// domain is [−2, 3] with the zero ring at two fifths of R; R2's `max` above and below the data;
// R3's per-edge quadrilaterals on a three-spoke fixture; and R6's centre cases, where offsets of
// 0.001 px toward 3, 6 and 9 o'clock pick spokes 1, 2 and 3 of four.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { pointerAngle } from "./polar-angle";
import {
  nearestVertex,
  polygonsPath,
  radarDomain,
  radarLinePath,
  radarQuads,
  radarRadius,
  radarVertices,
  spokeAngle,
  spokeAt,
  zeroPolygon,
} from "./radar";

const R = 100;

describe("the spoke frame (R1)", () => {
  it("places values 1 to 4 on a [0, 4] domain clockwise from 12 o'clock", () => {
    const { domain } = radarDomain([1, 2, 3, 4], undefined);
    expect(domain).toEqual([0, 4]);
    const vertices = radarVertices([1, 2, 3, 4], radarRadius(domain, R));
    const expected = [
      [0, -R / 4],
      [R / 2, 0],
      [0, (3 * R) / 4],
      [-R, 0],
    ];
    vertices.forEach((vertex, index) => {
      expect(vertex?.x).toBeCloseTo(expected[index]?.[0] ?? Number.NaN, 9);
      expect(vertex?.y).toBeCloseTo(expected[index]?.[1] ?? Number.NaN, 9);
    });
  });

  it("puts spoke i of n at 360·i/n degrees", () => {
    expect([0, 1, 2, 3, 4].map((index) => spokeAngle(index, 5))).toEqual([0, 72, 144, 216, 288]);
  });
});

describe("the radius domain (R2) and the negatives of section 8.4", () => {
  it("runs [−2, 1, 3] over [−2, 3] with the zero ring at two fifths of R", () => {
    const { domain, ticks } = radarDomain([-2, 1, 3], undefined);
    expect(domain).toEqual([-2, 3]);
    expect(ticks).toContain(0);
    expect(radarRadius(domain, R)(0)).toBe((2 / 5) * R);
  });

  it("ends the domain at an explicit max above the data", () => {
    expect(radarDomain([1, 2, 3, 4], 10).domain).toEqual([0, 10]);
  });

  it("keeps the niced data maximum when a value passes max, so no reading is clamped", () => {
    expect(radarDomain([1, 2, 3, 4.5], 3).domain).toEqual([0, 5]);
  });

  it("holds the extent, 0 and every max at or above the data", () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -1e6, max: 1e6, noNaN: true }), { minLength: 1, maxLength: 12 }),
        fc.option(fc.double({ min: -1e6, max: 2e6, noNaN: true }), { nil: undefined }),
        (values, max) => {
          const [lo, hi] = radarDomain(values, max).domain;
          // A magnitude under 1e-15 counts as 0, as every value domain reads it.
          for (const value of [...values, 0].map((raw) => (Math.abs(raw) < 1e-15 ? 0 : raw))) {
            expect(lo).toBeLessThanOrEqual(value);
            expect(hi).toBeGreaterThanOrEqual(value);
          }
          if (max !== undefined && max >= Math.max(0, ...values) && max > lo) expect(hi).toBe(max);
        }
      )
    );
  });
});

describe("the zero polygon and the quadrilaterals (R3)", () => {
  // Three spokes on [0, 4], so 0 sits at the centre, with readings 4 and 2 and a missing third.
  const radius = radarRadius([0, 4], R);
  const vertices = radarVertices([4, 2, null], radius);
  const zero = zeroPolygon(3, radius(0));

  it("fills the one edge whose two spokes both hold a reading", () => {
    // Spoke 1 sits at 120°: 50·sin 120° = 43.301 and −50·cos 120° = 25.
    const quads = radarQuads(vertices, zero);
    expect(quads).toHaveLength(1);
    expect(polygonsPath(quads)).toBe("M0,0L0,-100L43.301,25L0,0Z");
  });

  it("draws one quadrilateral per edge when every spoke holds a reading", () => {
    expect(radarQuads(radarVertices([4, 2, 1], radius), zero)).toHaveLength(3);
  });

  it("draws one edge for two spokes and none for one", () => {
    expect(radarQuads(radarVertices([4, 2], radius), zeroPolygon(2, 0))).toHaveLength(1);
    expect(radarQuads(radarVertices([4], radius), zeroPolygon(1, 0))).toHaveLength(0);
  });

  it("puts the zero polygon at the radius of 0 on every spoke", () => {
    const ring = zeroPolygon(4, 40);
    expect(ring.map(({ x, y }) => Math.hypot(x, y))).toEqual([40, 40, 40, 40]);
  });
});

describe("radarLinePath", () => {
  const radius = radarRadius([0, 4], R);

  it("closes the polygon when every spoke holds a reading", () => {
    expect(radarLinePath(radarVertices([4, 2, 2], radius))).toBe("M0,-100L43.301,25L-43.301,25Z");
  });

  it("breaks at a missing spoke and keeps a run across 12 o'clock whole", () => {
    // Spoke 1 at 90° is missing, so spokes 2, 3 and 0, at 180°, 270° and 0°, draw one run across 12 o'clock.
    const line = radarLinePath(radarVertices([4, null, 4, 4], radius));
    expect(line).toBe("M0,100L-100,0L0,-100");
  });
});

describe("the pick (R6)", () => {
  it("picks spoke 0 at the exact centre", () => {
    expect(spokeAt(pointerAngle(0, 0), 4)).toBe(0);
  });

  it.each([
    [0.001, 0, 1],
    [0, 0.001, 2],
    [-0.001, 0, 3],
  ])("picks the spoke an offset of (%f, %f) points toward", (dx, dy, spoke) => {
    expect(spokeAt(pointerAngle(dx, dy), 4)).toBe(spoke);
  });

  it("gives a tie to the lower index", () => {
    expect(spokeAt(45, 4)).toBe(0);
    expect(spokeAt(135, 4)).toBe(1);
  });

  it("advances one spoke when the pointer turns by one spoke's angle", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 24 }),
        fc.double({ min: 0, max: 359.999, noNaN: true }),
        (count, angle) => {
          const step = 360 / count;
          // A pointer within a hair of the midway between two spokes is a tie, which goes to the lower index.
          fc.pre(Math.abs((angle % step) - step / 2) > 1e-6);
          expect(spokeAt((angle + step) % 360, count)).toBe((spokeAt(angle, count) + 1) % count);
        }
      )
    );
  });

  it("picks the series whose vertex lies nearest, skipping one with no reading", () => {
    const vertices = [{ x: 0, y: -80 }, null, { x: 0, y: -40 }];
    expect(nearestVertex({ x: 0, y: -50 }, vertices)).toBe(2);
    expect(
      nearestVertex({ x: 0, y: -60 }, [
        { x: 0, y: -80 },
        { x: 0, y: -40 },
      ])
    ).toBe(0);
    expect(nearestVertex({ x: 0, y: 0 }, [null, null])).toBeNull();
  });
});
