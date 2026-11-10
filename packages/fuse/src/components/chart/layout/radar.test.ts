// The radar's layout. Unit under test: radarDomain, radarRadius, spokeAngle, radarVertices,
// zeroPolygon, radarQuads, polygonsPath, radarEdges, radarAreas, loneVertices, dotsPath, spokeAt and
// edgePoint. Oracles, written
// by hand: the vertices of values 1 to 4 on a [0, 4] domain at radius R, which are
// (0, −R/4), (R/2, 0), (0, 3R/4) and (−R, 0); CONTRACT section 8.4's [−2, 1, 3] fixture, whose
// domain is [−2, 3] with the zero ring at two fifths of R; a `max` above and below the data;
// the per-edge quadrilaterals on a three-spoke fixture; and R6's centre cases, where offsets of
// 0.001 px toward 3, 6 and 9 o'clock pick spokes 1, 2 and 3 of four; and R5's counts on a six-spoke
// fixture, whose spoke 1 is estimated and spoke 4 missing: two dashed edges and two hatched
// quadrilaterals beside spoke 1, two plain edges and quadrilaterals, and two removed beside spoke 4.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { pointerAngle } from "./polar-angle";
import {
  edgePoint,
  dotsPath,
  loneVertices,
  polygonsPath,
  radarAreas,
  radarDomain,
  radarEdges,
  radarQuads,
  radarRadius,
  radarVertices,
  spokeAngle,
  spokeAt,
  zeroPolygon,
} from "./radar";

const R = 100;

describe("the spoke frame", () => {
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

describe("the radius domain and the negatives of section 8.4", () => {
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

describe("the zero polygon and the quadrilaterals", () => {
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

describe("radarEdges", () => {
  const radius = radarRadius([0, 4], R);
  const none = [false, false, false, false];

  it("closes the polygon when every spoke holds a plain reading", () => {
    expect(radarEdges(radarVertices([4, 2, 2], radius), none)).toEqual({
      plain: "M0,-100L43.301,25L-43.301,25Z",
      marked: "",
    });
  });

  it("breaks at a missing spoke and keeps a run across 12 o'clock whole", () => {
    // Spoke 1 at 90° is missing, so spokes 2, 3 and 0, at 180°, 270° and 0°, draw one run across 12 o'clock.
    expect(radarEdges(radarVertices([4, null, 4, 4], radius), none)).toEqual({
      plain: "M0,100L-100,0L0,-100",
      marked: "",
    });
  });

  it("dashes the two edges beside an estimated spoke and drops the two beside a missing one (R5)", () => {
    // Six spokes at 60° steps, every reading at the rim: v0 (0, −100), v1 (86.603, −50),
    // v2 (86.603, 50), v3 (0, 100), v5 (−86.603, −50). Spoke 1 is estimated and spoke 4 missing.
    const vertices = radarVertices([4, 4, 4, 4, null, 4], radius);
    const marked = [false, true, false, false, false, false];
    expect(radarEdges(vertices, marked)).toEqual({
      plain: "M86.603,50L0,100M-86.603,-50L0,-100",
      marked: "M0,-100L86.603,-50L86.603,50",
    });
  });

  it("closes a ring whose every edge is marked", () => {
    // Spokes 0 and 2 are estimated, so every edge of three touches one.
    expect(radarEdges(radarVertices([4, 4, 4], radius), [true, false, true])).toEqual({
      plain: "",
      marked: "M0,-100L86.603,50L-86.603,50Z",
    });
  });

  it("draws one edge for two spokes and none for one", () => {
    expect(radarEdges(radarVertices([4, 4], radius), [false, false])).toEqual({
      plain: "M0,-100L0,100",
      marked: "",
    });
    expect(radarEdges(radarVertices([4], radius), [false])).toEqual({ plain: "", marked: "" });
  });
});

describe("radarAreas", () => {
  it("hatches the two quadrilaterals beside an estimated spoke and drops the two beside a missing one (R5)", () => {
    const radius = radarRadius([0, 4], R);
    const vertices = radarVertices([4, 4, 4, 4, null, 4], radius);
    const marked = [false, true, false, false, false, false];
    const { plain, marked: hatched } = radarAreas(vertices, zeroPolygon(6, 0), marked);
    // Each quadrilateral runs zero, vertex, next vertex, next zero, and every zero point is the centre.
    expect(plain).toBe("M0,0L86.603,50L0,100L0,0ZM0,0L-86.603,-50L0,-100L0,0Z");
    expect(hatched).toBe("M0,0L0,-100L86.603,-50L0,0ZM0,0L86.603,-50L86.603,50L0,0Z");
  });
});

describe("loneVertices and dotsPath", () => {
  const radius = radarRadius([0, 4], R);

  it("finds the readings between two missing spokes, and the only spoke", () => {
    expect(
      loneVertices(radarVertices([4, null, 4, null], radius)).map(({ x, y }) => [
        Math.round(x),
        Math.round(y),
      ])
    ).toEqual([
      [0, -100],
      [0, 100],
    ]);
    expect(loneVertices(radarVertices([4, 4, null], radius))).toEqual([]);
    expect(loneVertices(radarVertices([2], radius))).toHaveLength(1);
  });

  it("draws each dot as a zero-length subpath", () => {
    expect(
      dotsPath([
        { x: 0, y: -100 },
        { x: 43.3012, y: 25 },
      ])
    ).toBe("M0,-100h0M43.301,25h0");
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

  it("picks the spoke nearest the pointer's angle for any spoke count (Q6)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 24 }),
        fc.double({ min: 0, max: 359.999, noNaN: true }),
        (count, angle) => {
          // Spoke i points at i · 360 / count from 12 o'clock, so away from a midway tie the nearest
          // spoke is the angle in steps, rounded, and a whole turn wraps to spoke 0.
          const step = 360 / count;
          fc.pre(Math.abs((angle % step) - step / 2) > 1e-6);
          expect(spokeAt(angle, count)).toBe(Math.round(angle / step) % count);
        }
      )
    );
  });
});

describe("edgePoint", () => {
  // A square of radius 1: spokes at 0°, 90°, 180° and 270°, vertices (0, −1), (1, 0), (0, 1) and
  // (−1, 0). The ray at 45° meets the edge from (0, −1) to (1, 0) at (½, −½).
  const square = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  it.each([
    [0, { x: 0, y: -1 }],
    [45, { x: 0.5, y: -0.5 }],
    [90, { x: 1, y: 0 }],
    [405, { x: 0.5, y: -0.5 }],
  ])("meets the square at %s°", (angle, expected) => {
    const point = edgePoint(square, angle);
    expect(point?.x).toBeCloseTo(expected.x, 9);
    expect(point?.y).toBeCloseTo(expected.y, 9);
  });

  it("meets nothing on either edge beside a missing vertex, and the present vertices on their spokes", () => {
    // With (1, 0) missing, the edges from 0° to 90° and from 90° to 180° touch it and draw nothing.
    // The spokes at 0° and 180° still hold their vertices, and the edge from 180° to 270°, from
    // (0, 1) to (−1, 0), meets the ray at 225° at (−½, ½).
    const broken = [square[0] ?? null, null, square[2] ?? null, square[3] ?? null];
    expect(edgePoint(broken, 45)).toBeNull();
    expect(edgePoint(broken, 90)).toBeNull();
    expect(edgePoint(broken, 135)).toBeNull();
    expect(edgePoint(broken, 0)).toEqual({ x: 0, y: -1 });
    expect(edgePoint(broken, 180)).toEqual({ x: 0, y: 1 });
    const point = edgePoint(broken, 225);
    expect(point?.x).toBeCloseTo(-0.5, 9);
    expect(point?.y).toBeCloseTo(0.5, 9);
    expect(edgePoint([null, null, null, null], 45)).toBeNull();
  });
});
