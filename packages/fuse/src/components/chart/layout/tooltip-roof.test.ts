import { describe, expect, it } from "vitest";

import {
  boundsOf,
  box,
  ellipse,
  higherRoof,
  polyline,
  roofOver,
  roofProfile,
  raisedRoof,
  widenedRoof,
} from "./tooltip-roof";
import type { RoofMark } from "./tooltip-roof";

// The oracle is geometry worked by hand on shapes small enough to check on paper, y down. A profile
// keeps one roof per whole pixel column, and a span reads every column it touches.

/** A mark that only fills. */
function filled(pieces: RoofMark["pieces"]): RoofMark {
  return { pieces, reach: 0 };
}

describe("roofOver", () => {
  it("finds no roof where no mark reaches the span", () => {
    expect(roofOver(roofProfile([], 0, 100), 0, 100)).toBeNull();
    // The box spans columns 10 to 30, so a span from column 31 misses it.
    expect(roofOver(roofProfile([filled(box(10, 40, 20, 60))], 0, 100), 31, 100)).toBeNull();
  });

  it("reads a straight line at the end of the span where it is highest", () => {
    // From (0, 100) to (100, 0), y = 100 − x. The span 20 to 40 covers columns 20 to 39, and column
    // 39 runs to x = 40, where y = 60.
    const line = polyline([
      [0, 100],
      [100, 0],
    ]);
    expect(roofOver(roofProfile([filled(line)], 0, 100), 20, 40)).toBe(60);
  });

  it("follows sampled points above their ends, as a curve that rises between two readings", () => {
    // Samples of a hump: both ends at y = 100, its peak at (50, 25).
    const hump = polyline([
      [0, 100],
      [25, 50],
      [50, 25],
      [75, 50],
      [100, 100],
    ]);
    expect(roofOver(roofProfile([filled(hump)], 0, 100), 45, 55)).toBe(25);
  });

  it("counts a box's top over its width and its sides at its edges", () => {
    // A box from x = 10 to 30 with its top at 40. Its left side lies in column 10. A span that ends
    // at x = 10 covers columns 0 to 9 and misses it, and one that reaches into column 10 meets it.
    const profile = roofProfile([filled(box(10, 40, 20, 60))], 0, 100);
    expect(roofOver(profile, 0, 10)).toBeNull();
    expect(roofOver(profile, 0, 10.5)).toBe(40);
    expect(roofOver(profile, 25, 50)).toBe(40);
  });

  it("reads a dot as its circle", () => {
    // A circle of radius 5 around (15, 50). Column 19 runs from x = 19, 4 from the centre, where the
    // circle reaches 50 − √(5² − 4²) = 47. Column 14 holds the centre, where it reaches 45.
    const profile = roofProfile([filled(ellipse(15, 50, 5, 5))], 0, 100);
    expect(roofOver(profile, 0, 100)).toBe(45);
    expect(roofOver(profile, 19, 30)).toBeCloseTo(47, 9);
    expect(roofOver(profile, 21, 30)).toBeNull();
  });

  it("lifts a stroked mark by half its stroke and widens its reach as much", () => {
    // A 2 px stroke along y = 100 reaches 99. A circle of radius 4 around (15, 50) with a 2 px
    // stroke draws out to x = 20, so column 20 meets it, where the circle sits at y = 50 and its
    // stroke reaches 49.
    const flat = polyline([
      [0, 100],
      [100, 100],
    ]);
    expect(roofOver(roofProfile([{ pieces: flat, reach: 1 }], 0, 100), 50, 60)).toBe(99);
    expect(roofOver(roofProfile([{ pieces: ellipse(15, 50, 4, 4), reach: 1 }], 0, 100), 20, 30)).toBe(49);
  });

  it("keeps no mark outside the profile's stretch", () => {
    // The stretch ends at x = 50, so the box from 60 leaves no roof anywhere.
    expect(roofOver(roofProfile([filled(box(60, 10, 10, 90))], 0, 50), 0, 100)).toBeNull();
  });

  // bklit's bars drawn by hand into a 600 × 200 plot over 0 to 25,000, so a value lands at
  // y = 200 − 0.008 · value. Each 100 px band holds revenue from 15 to 48 px and profit from 52 to
  // 85 px. Revenue 12000, 15500, 11000, 18800, 16800, 21200 tops out at 104, 76, 112, 49.6, 65.6
  // and 30.4. Profit 4500, 5200, 3800, 7100, 5400, 8800 tops out at 164, 158.4, 169.6, 143.2,
  // 156.8 and 129.6.
  const REVENUE_TOPS = [104, 76, 112, 49.6, 65.6, 30.4];
  const PROFIT_TOPS = [164, 158.4, 169.6, 143.2, 156.8, 129.6];
  const BARS = roofProfile(
    [
      ...REVENUE_TOPS.map((top, slot) => filled(box(100 * slot + 15, top, 33, 200 - top))),
      ...PROFIT_TOPS.map((top, slot) => filled(box(100 * slot + 52, top, 33, 200 - top))),
    ],
    -48,
    608
  );

  it.each([
    // Over Jan's 140 px popup from −20: Jan's bars and Feb's revenue from 115.
    ["Jan", -20, 120, 76],
    // Over Mar's from 180: Feb's profit to 185, Mar's bars and Apr's revenue from 315.
    ["Mar", 180, 320, 49.6],
    // Over Jun's, held at 468: May's profit from 452 and Jun's bars, but not May's revenue to 448.
    ["Jun", 468, 608, 30.4],
  ])("finds the highest bar under %s's popup", (_, start, end, roof) => {
    expect(roofOver(BARS, start, end)).toBeCloseTo(roof, 9);
  });
});

describe("higherRoof", () => {
  it("takes the higher roof of each column, as a tween's start and its landing", () => {
    // Before the update a bar from 0 to 10 tops out at 80, and after it at 20. A dot around (50, 50)
    // stays. The merged roof keeps the landing bar's 20 and the dot's 45.
    const before = roofProfile([filled(box(0, 80, 10, 120)), filled(ellipse(50, 50, 5, 5))], 0, 100);
    const after = roofProfile([filled(box(0, 20, 10, 180))], 0, 100);
    const merged = higherRoof(before, after);
    expect(roofOver(merged, 0, 10)).toBe(20);
    expect(roofOver(merged, 40, 60)).toBe(45);
    expect(roofOver(before, 0, 10)).toBe(80);
  });
});

describe("widenedRoof", () => {
  it("spreads each column's roof by the travel, so a mark sliding that far stays under it", () => {
    // A bar from 40 to 50 lies in columns 40 to 50 and tops out at 30. Widened by 20.5, which rounds
    // up to 21 columns, it reaches columns 19 to 71, so a span from 15 to 20 meets it and one from
    // 15 to 19 does not, and likewise past its right side.
    const profile = roofProfile([filled(box(40, 30, 10, 170))], 0, 100);
    const widened = widenedRoof(profile, 20.5);
    expect(roofOver(widened, 15, 20)).toBe(30);
    expect(roofOver(widened, 15, 19)).toBeNull();
    expect(roofOver(widened, 70, 75)).toBe(30);
    expect(roofOver(widened, 72, 75)).toBeNull();
    expect(widenedRoof(profile, 0)).toBe(profile);
  });
});

describe("raisedRoof", () => {
  it("lifts every column's roof by the margin and keeps columns without a mark empty", () => {
    // A bar from 40 to 50 tops out at 30. Raised by 1.5, it tops out at 28.5, and the columns
    // beside it still hold no mark.
    const profile = roofProfile([filled(box(40, 30, 10, 170))], 0, 100);
    const raised = raisedRoof(profile, 1.5);
    expect(roofOver(raised, 40, 45)).toBe(28.5);
    expect(roofOver(raised, 60, 70)).toBeNull();
    expect(raisedRoof(profile, 0)).toBe(profile);
  });
});

describe("boundsOf", () => {
  it("holds every piece and a box from another state, as a bar that slides sweeps between both", () => {
    // A bar from x 10 to 40 with its top at 50 and its base at 200, and a dot of radius 5 around
    // (60, 30). Held with the bar's box in another state, from x 300 to 330 and y 20 to 200.
    const pieces = [...box(10, 50, 30, 150), ...ellipse(60, 30, 5, 5)];
    expect(boundsOf(pieces)).toEqual({ left: 10, top: 25, right: 65, bottom: 200 });
    expect(boundsOf(pieces, { left: 300, top: 20, right: 330, bottom: 200 })).toEqual({
      left: 10,
      top: 20,
      right: 330,
      bottom: 200,
    });
    expect(boundsOf([])).toBeNull();
  });
});
