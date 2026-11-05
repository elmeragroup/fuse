// Unit under test: the polar tooltip's resting place and orbit. Oracles, worked by hand: D7's rule
// that the popup's centre sits on the ray with its nearest edge one gap past the rim, the Motion
// table's orbit of 10° keyframes the short way round, Q9's safe triangle, and plane geometry in
// client pixels, where y grows downward, so 12 o'clock is up and 3 o'clock is to the right.
import { describe, expect, it } from "vitest";

import { inTriangle, nearEdge, nearestSide, orbitTurns, rayCentre } from "./polar-orbit";
import type { OrbitPoint } from "./polar-orbit";

/** Expect a point at x and y, each to six decimals. */
function expectAt(point: OrbitPoint | undefined, x: number, y: number): void {
  expect(point?.x).toBeCloseTo(x, 6);
  expect(point?.y).toBeCloseTo(y, 6);
}

describe("nearestSide", () => {
  it.each([
    [0, "top"],
    [44.9, "top"],
    [45, "right"],
    [134.9, "right"],
    [135, "bottom"],
    [225, "left"],
    [314.9, "left"],
    [315, "top"],
    [-10, "top"],
    [450, "right"],
  ])("names the side nearest a ray at %s°", (angle, side) => {
    expect(nearestSide(angle)).toBe(side);
  });
});

describe("rayCentre", () => {
  const size = { width: 40, height: 20 };

  it("rests a popup at 3 o'clock half its width past the rim and the gap", () => {
    // 100 + 8 + 40 / 2.
    expectAt(rayCentre(90, 100, 8, size), 128, 0);
  });

  it("rests a popup at 12 o'clock half its height above the rim and the gap", () => {
    // 100 + 8 + 20 / 2, upward.
    expectAt(rayCentre(0, 100, 8, size), 0, -118);
  });

  it("rests a popup at 45° by its box's support along the diagonal", () => {
    // The support is √½ · 20 + √½ · 10 = 21.2132, so the centre lies 129.2132 out along the
    // diagonal: √½ · 129.2132 = 91.3675 right and up.
    expectAt(rayCentre(45, 100, 8, size), 91.367_532, -91.367_532);
  });
});

/** A popup place whose centre is at a point, for a box of 40 by 20. */
const placeAt = (x: number, y: number) => ({ left: x - 20, bottom: y + 10 });
const SIZE = { width: 40, height: 20 };
const CENTRE = { x: 300, y: 200 };

/** The centres of an orbit's places, relative to the dial's centre. */
function centres(places: readonly { readonly left: number; readonly bottom: number }[]) {
  return places.map(({ left, bottom }) => ({ x: left + 20 - CENTRE.x, y: bottom - 10 - CENTRE.y }));
}

describe("orbitTurns", () => {
  it("orbits from 3 o'clock through 6 o'clock to 200° at one radius, in 10° steps", () => {
    // From 90° to 200° is 110° clockwise: 11 steps, through 180°, straight down.
    const from = placeAt(CENTRE.x + 100, CENTRE.y);
    const radians = (200 * Math.PI) / 180;
    const to = placeAt(CENTRE.x + 100 * Math.sin(radians), CENTRE.y - 100 * Math.cos(radians));
    const points = centres(orbitTurns(from, to, SIZE, CENTRE));
    expect(points).toHaveLength(12);
    for (const { x, y } of points) expect(Math.hypot(x, y)).toBeCloseTo(100, 6);
    // The ninth place, 90° + 9 · 10°, sits straight below the centre.
    expectAt(points[9], 0, 100);
  });

  it("takes the short way, counterclockwise from 30° to 330°", () => {
    const at = (angle: number) => {
      const radians = (angle * Math.PI) / 180;
      return placeAt(CENTRE.x + 100 * Math.sin(radians), CENTRE.y - 100 * Math.cos(radians));
    };
    const points = centres(orbitTurns(at(30), at(330), SIZE, CENTRE));
    // 60° back through 12 o'clock: six steps, and the middle place is straight above.
    expect(points).toHaveLength(7);
    expectAt(points[3], 0, -100);
  });

  it("spirals evenly from one radius to another", () => {
    // From 120 out at 3 o'clock to 80 out at 6 o'clock: 9 steps, each 40 / 9 closer.
    const points = centres(
      orbitTurns(placeAt(CENTRE.x + 120, CENTRE.y), placeAt(CENTRE.x, CENTRE.y + 80), SIZE, CENTRE)
    );
    const radii = points.map(({ x, y }) => Math.hypot(x, y));
    expect(radii).toHaveLength(10);
    radii.forEach((radius, step) => {
      expect(radius).toBeCloseTo(120 - (40 * step) / 9, 6);
    });
  });

  it("runs straight from a popup at the dial's very centre, which has no angle", () => {
    const from = placeAt(CENTRE.x, CENTRE.y);
    const to = placeAt(CENTRE.x + 100, CENTRE.y);
    expect(orbitTurns(from, to, SIZE, CENTRE)).toEqual([from, to]);
  });
});

describe("the safe triangle (Q9)", () => {
  const a = { x: 0, y: 0 };
  const b = { x: 10, y: 0 };
  const c = { x: 0, y: 10 };

  it.each([
    [{ x: 2, y: 2 }, true],
    [{ x: 5, y: 5 }, true],
    [{ x: 0, y: 0 }, true],
    [{ x: 6, y: 6 }, false],
    [{ x: -1, y: 2 }, false],
  ])("holds %o: %s", (point, inside) => {
    expect(inTriangle(point, a, b, c)).toBe(inside);
  });

  const box = { left: 100, top: 100, right: 140, bottom: 120 };

  it("takes the box's left edge from a point to its left", () => {
    expect(nearEdge({ x: 50, y: 110 }, box)).toEqual([
      { x: 100, y: 100 },
      { x: 100, y: 120 },
    ]);
  });

  it("takes the box's bottom edge from a point mostly below it", () => {
    expect(nearEdge({ x: 130, y: 200 }, box)).toEqual([
      { x: 100, y: 120 },
      { x: 140, y: 120 },
    ]);
  });
});
