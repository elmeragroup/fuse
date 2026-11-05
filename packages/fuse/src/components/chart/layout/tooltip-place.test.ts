import { describe, expect, it } from "vitest";

import { glidePath, roofRest, someSideHolds, tooltipSideOffset } from "./tooltip-place";
import type { PopupPlace } from "./tooltip-place";
import { box, roofOver, roofProfile } from "./tooltip-roof";

// The oracle is arithmetic on boxes written by hand: a 320 × 225 viewport, the 400 % zoom of a
// 1280 × 900 window, and CONTRACT section 9.5's 8 px inset at every edge.
const VIEWPORT = { width: 320, height: 225 };

describe("someSideHolds", () => {
  // Each case holds the popup on one side alone, so a mutant of any one side's rule shows.
  it("holds a popup above a column that leaves room above, and on no other side", () => {
    // 120 − 60 = 60 above. Below, 215 + 60 passes 217, and 200 px fits beside neither side.
    expect(
      someSideHolds({ top: 120, right: 170, bottom: 215, left: 150 }, { width: 200, height: 60 }, VIEWPORT)
    ).toBe(true);
  });

  it("holds a popup below a column that ends high, and on no other side", () => {
    // 100 + 100 = 200, inside 225 − 8. Above, 5 − 100 is outside.
    expect(
      someSideHolds({ top: 5, right: 170, bottom: 100, left: 150 }, { width: 200, height: 100 }, VIEWPORT)
    ).toBe(true);
  });

  it("holds a popup right of a column near the left edge, and on no other side", () => {
    // 60 + 140 = 200, inside 320 − 8, and 40 − 140 is outside.
    expect(
      someSideHolds({ top: 20, right: 60, bottom: 215, left: 40 }, { width: 140, height: 120 }, VIEWPORT)
    ).toBe(true);
  });

  it("holds a popup left of a column near the right edge, and on no other side", () => {
    // 290 − 140 = 150 leaves the inset, and 310 + 140 passes 312.
    expect(
      someSideHolds({ top: 20, right: 310, bottom: 215, left: 290 }, { width: 140, height: 120 }, VIEWPORT)
    ).toBe(true);
  });

  it("holds no side for a centred column that fills the viewport's height", () => {
    // 20 px above, 10 px below, 160 px left and 150 px right of the column: none take 155 + 8.
    expect(
      someSideHolds({ top: 20, right: 170, bottom: 215, left: 160 }, { width: 155, height: 52 }, VIEWPORT)
    ).toBe(false);
  });

  it.each([
    [
      "above",
      { top: 70, right: 170, bottom: 215, left: 160 },
      { top: 69, right: 170, bottom: 215, left: 160 },
      62,
    ],
    [
      "below",
      { top: 5, right: 170, bottom: 155, left: 160 },
      { top: 5, right: 170, bottom: 156, left: 160 },
      62,
    ],
    [
      "right",
      { top: 20, right: 157, bottom: 215, left: 142 },
      { top: 20, right: 158, bottom: 215, left: 143 },
      120,
    ],
    [
      "left",
      { top: 20, right: 173, bottom: 215, left: 163 },
      { top: 20, right: 172, bottom: 215, left: 162 },
      120,
    ],
  ])(
    "counts a popup that exactly meets the inset %s as held, and one a pixel past it as not",
    (_, meets, past, height) => {
      // Above: 70 − 62 = 8. Below: 155 + 62 = 217. Right: 157 + 155 = 312. Left: 163 − 155 = 8.
      expect(someSideHolds(meets, { width: 155, height }, VIEWPORT)).toBe(true);
      expect(someSideHolds(past, { width: 155, height }, VIEWPORT)).toBe(false);
    }
  );
});

describe("tooltipSideOffset", () => {
  it("keeps a popup above or below on its column's edge whenever a side holds it", () => {
    for (const side of ["top", "bottom"]) {
      expect(
        tooltipSideOffset(
          side,
          { top: 120, right: 170, bottom: 215, left: 150 },
          { width: 140, height: 60 },
          VIEWPORT
        ),
        side
      ).toBe(0);
    }
  });

  it("reaches half a pixel over the column's edge beside it, which whole-pixel rounding cannot open into a gap", () => {
    // Rounding moves the popup by at most 0.5 px, so a 0.5 px reach leaves 0 to 1 px over the edge.
    for (const column of [
      { top: 120, right: 170, bottom: 215, left: 150 },
      { top: 20, right: 170, bottom: 215, left: 160 },
    ]) {
      expect(tooltipSideOffset("right", column, { width: 155, height: 52 }, VIEWPORT)).toBe(-0.5);
      expect(tooltipSideOffset("left", column, { width: 155, height: 52 }, VIEWPORT)).toBe(-0.5);
    }
  });

  it("moves a popup above the column down until its top meets the inset when no side holds it", () => {
    // The popup's bottom would sit at 20, so its top at 20 − 52 = −32. The offset moves the top
    // to 8: 20 − 52 − 8 = −40.
    const column = { top: 20, right: 170, bottom: 215, left: 160 };
    expect(tooltipSideOffset("top", column, { width: 155, height: 52 }, VIEWPORT)).toBe(-40);
  });

  it("moves a popup below the column up until its bottom meets the inset when no side holds it", () => {
    // Its top would sit at 215. The bottom must end at 225 − 8 = 217, so the top at 165: 165 − 215.
    const column = { top: 20, right: 170, bottom: 215, left: 160 };
    expect(tooltipSideOffset("bottom", column, { width: 155, height: 52 }, VIEWPORT)).toBe(-50);
  });
});

describe("roofRest", () => {
  // Two bar series drawn by hand into a 600 × 200 plot over 0 to 25,000, so a value lands at
  // y = 200 − 0.008 · value. Each 100 px band holds revenue from 15 to 48 px and profit from 52 to
  // 85 px, and slot centres sit at 50, 150 … 550. Revenue 12000, 15500, 11000, 18800, 16800, 21200
  // tops out at 104, 76, 112, 49.6, 65.6 and 30.4. Profit 4500, 5200, 3800, 7100, 5400, 8800
  // tops out at 164, 158.4, 169.6, 143.2, 156.8 and 129.6. The Root's box runs from a 48 px axis
  // left of the plot to 8 px right of it.
  const REVENUE_TOPS = [104, 76, 112, 49.6, 65.6, 30.4];
  const PROFIT_TOPS = [164, 158.4, 169.6, 143.2, 156.8, 129.6];
  const BARS = roofProfile(
    [
      ...REVENUE_TOPS.map((top, slot) => ({ pieces: box(100 * slot + 15, top, 33, 200 - top), reach: 0 })),
      ...PROFIT_TOPS.map((top, slot) => ({ pieces: box(100 * slot + 52, top, 33, 200 - top), reach: 0 })),
    ],
    -48,
    608
  );
  const WITHIN = [-48, 608] as const;
  // A viewport wide enough to leave every place above alone.
  const WIDE_VIEWPORT = [-1000, 1000] as const;

  function rest(slot: number, width: number, from: PopupPlace | null): PopupPlace {
    return roofRest({
      centre: 100 * slot + 50,
      width,
      within: WITHIN,
      viewport: WIDE_VIEWPORT,
      roof: (start, end) => roofOver(BARS, start, end),
      floor: 200,
      from,
    });
  }

  it.each([
    // Jan's 140 px popup from −20 meets Feb's revenue at 76, so its bottom rests at 68.
    ["Jan", 0, { left: -20, bottom: 68 }],
    // Mar's from 180 meets Apr's revenue at 49.6.
    ["Mar", 2, { left: 180, bottom: 41.6 }],
    // Jun's centres at 480 and would end at 620, so the Root's right edge holds it at 608 − 140.
    ["Jun", 5, { left: 468, bottom: 22.4 }],
  ])("rests 8 px over the highest bar under %s's popup on opening", (_, slot, place) => {
    const placed = rest(slot, 140, null);
    expect(placed.left).toBe(place.left);
    expect(placed.bottom).toBeCloseTo(place.bottom, 9);
  });

  it("centres a popup wider than the Root's box on its slot", () => {
    const placed = roofRest({
      centre: 30,
      width: 140,
      within: [0, 100],
      viewport: WIDE_VIEWPORT,
      roof: () => null,
      floor: 200,
      from: null,
    });
    expect(placed).toEqual({ left: -40, bottom: 192 });
  });

  it("rises over the whole span a jump sweeps, not only its end", () => {
    // A 60 px popup. Over Jan, from 20 to 80, Jan's revenue at 104 sets its bottom at 96. Over May,
    // from 420 to 480, May's revenue at 65.6 would set 57.6, but the jump sweeps 20 to 480, where
    // Apr's revenue reaches 49.6, so it rests at 41.6.
    const jan = rest(0, 60, null);
    expect(jan.bottom).toBe(96);
    const may = rest(4, 60, jan);
    expect(may.left).toBe(420);
    expect(may.bottom).toBeCloseTo(41.6, 9);
  });

  it("keeps its height on a drop of 16 px or less, and sinks on a deeper one", () => {
    // A 60 px popup. Over Apr it rests at 41.6, and over May, 16 px lower, at 57.6, so the step
    // from Apr keeps 41.6. Over Jun it rests at 22.4, so the step from Jun drops 35.2 and sinks.
    const apr = rest(3, 60, null);
    expect(apr.bottom).toBeCloseTo(41.6, 9);
    expect(rest(4, 60, apr).bottom).toBeCloseTo(41.6, 9);
    const jun = rest(5, 60, null);
    expect(jun.bottom).toBeCloseTo(22.4, 9);
    expect(rest(4, 60, jun).bottom).toBeCloseTo(57.6, 9);
  });

  it("rests 8 px over the plot's floor where no mark reaches", () => {
    // A 10 px popup centred on 100 spans 95 to 105, between Jan's profit, which ends at 85, and
    // Feb's revenue, which starts at 115.
    const placed = roofRest({
      centre: 100,
      width: 10,
      within: WITHIN,
      viewport: WIDE_VIEWPORT,
      roof: (start, end) => roofOver(BARS, start, end),
      floor: 200,
      from: null,
    });
    expect(placed).toEqual({ left: 95, bottom: 192 });
  });

  it("holds the popup inside the viewport after the Root's box, and rests over the span it shows on", () => {
    // Jan's 140 px popup would rest from −20 inside the Root's box, but the viewport's edge sits at
    // 10, so it shows from 10 to 150. That span reaches Feb's revenue from 115, at 76, and stops
    // short of Feb's profit from 152, so it rests at 68.
    const placed = roofRest({
      centre: 50,
      width: 140,
      within: WITHIN,
      viewport: [10, 1000],
      roof: (start, end) => roofOver(BARS, start, end),
      floor: 200,
      from: null,
    });
    expect(placed).toEqual({ left: 10, bottom: 68 });
    // At Jun, a viewport edge at 500 holds the popup from 360 to 500. That span meets Apr's profit to
    // 385, at 143.2, and May's revenue, at 65.6, and stops short of Jun's revenue from 515, so it
    // rests at 57.6.
    const jun = roofRest({
      centre: 550,
      width: 140,
      within: WITHIN,
      viewport: [-1000, 500],
      roof: (start, end) => roofOver(BARS, start, end),
      floor: 200,
      from: null,
    });
    expect(jun.left).toBe(360);
    expect(jun.bottom).toBeCloseTo(57.6, 9);
  });
});

describe("glidePath", () => {
  // One bar from 100 to 130 tops out at 50, in a plot whose viewport leaves a ceiling at y = 8.
  const ROOF = roofProfile([{ pieces: box(100, 50, 30, 150), reach: 0 }], 0, 400);
  const roof = (start: number, end: number) => roofOver(ROOF, start, end);

  it("rises in place, crosses at the swept roof's height and settles, over a bar between two low places", () => {
    // A 60 × 30 popup from left 0 to left 200, both resting at bottom 190. The sweep from 0 to 260
    // covers the bar, so it travels at 50 − 8 = 42, whose top, 12, stays under the ceiling at 8.
    expect(
      glidePath({ left: 0, bottom: 190 }, { left: 200, bottom: 190 }, { width: 60, height: 30 }, roof, 8)
    ).toEqual([
      { left: 0, bottom: 190 },
      { left: 0, bottom: 42 },
      { left: 200, bottom: 42 },
      { left: 200, bottom: 190 },
    ]);
  });

  it("runs straight when nothing it sweeps reaches above its places", () => {
    // From left 200 to left 300 the sweep, 200 to 360, misses the bar that ends at 130.
    expect(
      glidePath({ left: 200, bottom: 190 }, { left: 300, bottom: 190 }, { width: 60, height: 30 }, roof, 8)
    ).toEqual([
      { left: 200, bottom: 190 },
      { left: 300, bottom: 190 },
    ]);
  });

  it("gives no path when the start, at the popup's new width, already covers a mark", () => {
    // A popup that grew to 120 px at its old place, from 0 to 120 with its bottom at 60, reaches the
    // bar from 100 to 130, whose top at 50 lies above that bottom.
    expect(
      glidePath({ left: 0, bottom: 60 }, { left: 200, bottom: 40 }, { width: 120, height: 30 }, roof, 8)
    ).toBeNull();
  });

  it("gives no path when the raised height would carry the popup's top past the ceiling", () => {
    // A popup 40 px tall travelling at 42 would show its top at 2, above the ceiling at 8.
    expect(
      glidePath({ left: 0, bottom: 190 }, { left: 200, bottom: 190 }, { width: 60, height: 40 }, roof, 8)
    ).toBeNull();
  });
});
