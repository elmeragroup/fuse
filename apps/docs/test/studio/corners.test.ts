import { describe, expect, it } from "vitest";

import {
  RUNGS,
  arcMidpoint,
  arcPath,
  checkCorner,
  cornerEquation,
  cornerSum,
  insetOf,
  insetRedline,
  packLabels,
  paintsFill,
  rungFormula,
  usedRadii,
} from "../../src/studio/lib/corners";

// Every expected value below is worked out by hand from the formulas in CONTEXT.md ("Radius
// rung", "Inner corner") and fuse.css, never computed with the module under test.

describe("rungFormula", () => {
  it("writes each rung's distance from --radius in steps", () => {
    expect(RUNGS.map(({ steps }) => rungFormula(steps))).toEqual([
      "radius − 3 × step",
      "radius − 2 × step",
      "radius − step",
      "radius",
      "radius + 2 × step",
      "radius − 4 × step",
    ]);
  });
});

describe("insetOf", () => {
  it.each([
    [
      "adds the corner box's border and padding",
      [{ border: 1, padding: 12, margin: 0 }],
      { border: 1, padding: 12 },
    ],
    [
      // An InputGroup: the 1px field border, then an addon padded 8px and pulled back 4px.
      "adds every box between the corner and the part, margins included",
      [
        { border: 1, padding: 0, margin: 0 },
        { border: 0, padding: 8, margin: -4 },
      ],
      { border: 1, padding: 4 },
    ],
    [
      "ignores the corner box's own margin, which lies outside its corner",
      [{ border: 1, padding: 24, margin: 16 }],
      { border: 1, padding: 24 },
    ],
  ])("%s", (_case, chain, inset) => {
    expect(insetOf(chain)).toEqual(inset);
  });
});

describe("checkCorner", () => {
  it.each([
    [
      "passes a part that rounds with the outer corner less the inset",
      { outer: 20, border: 1, padding: 16, inner: 3 },
      { expected: 3, clamped: false, mismatch: false },
    ],
    [
      "marks the clamped case when the inset reaches past the corner",
      { outer: 4, border: 1, padding: 8, inner: 0 },
      { expected: 0, clamped: true, mismatch: false },
    ],
    [
      "tolerates half a pixel of rounding",
      { outer: 20, border: 1, padding: 16, inner: 3.4 },
      { expected: 3, clamped: false, mismatch: false },
    ],
    [
      // A naive part that keeps the outer corner.
      "flags a part more than half a pixel off the formula",
      { outer: 20, border: 1, padding: 16, inner: 20 },
      { expected: 3, clamped: false, mismatch: true },
    ],
  ])("%s", (_case, reading, check) => {
    expect(checkCorner(reading)).toEqual(check);
  });
});

describe("cornerEquation", () => {
  it.each([
    [
      "writes the formula with the measured numbers",
      { outer: 16, border: 1, padding: 12 },
      "max(0, 16 − 1 − 12) = 3px",
    ],
    [
      "keeps fractional px to two places",
      { outer: 10.5, border: 1, padding: 2.125 },
      "max(0, 10.5 − 1 − 2.13) = 7.38px",
    ],
    [
      "writes the clamp's 0 when the inset is deeper",
      { outer: 4, border: 1, padding: 8 },
      "max(0, 4 − 1 − 8) = 0px",
    ],
  ])("%s", (_case, inset, text) => {
    expect(cornerEquation(inset)).toBe(text);
  });
});

describe("cornerSum", () => {
  it("writes outer, minus border, minus padding, equals the clamped inner corner", () => {
    expect(cornerSum({ outer: 16, border: 1, padding: 12 })).toBe("16 − 1 − 12 = 3px");
    expect(cornerSum({ outer: 4, border: 1, padding: 8 })).toBe("4 − 1 − 8 → 0px");
  });
});

describe("arcPath", () => {
  it.each([
    [
      "draws a top-left quarter circle from the left edge to the top edge",
      8,
      "start",
      "M 10 28 A 8 8 0 0 1 18 20",
    ],
    ["draws a square corner as two short ticks", 0, "start", "M 10 26 L 10 20 L 16 20"],
    [
      "mirrors to a top-right corner from the top edge to the right edge",
      8,
      "end",
      "M 92 20 A 8 8 0 0 1 100 28",
    ],
    ["mirrors a square top-right corner's ticks", 0, "end", "M 94 20 L 100 20 L 100 26"],
  ] as const)("%s", (_case, r, side, path) => {
    expect(arcPath(side === "start" ? 10 : 100, 20, r, side)).toBe(path);
  });
});

describe("arcMidpoint", () => {
  it("sits on the arc at 45°", () => {
    // r(1 − cos 45°) = 10 × (1 − 0.7071…) = 2.9289…
    const point = arcMidpoint(0, 0, 10);
    expect(point.x).toBeCloseTo(2.9289, 4);
    expect(point.y).toBeCloseTo(2.9289, 4);
  });

  it("is the corner itself at radius 0", () => {
    expect(arcMidpoint(5, 7, 0)).toEqual({ x: 5, y: 7 });
  });

  it("mirrors inward from a top-right corner", () => {
    const point = arcMidpoint(100, 0, 10, "end");
    expect(point.x).toBeCloseTo(97.0711, 4);
    expect(point.y).toBeCloseTo(2.9289, 4);
  });
});

describe("insetRedline", () => {
  it("runs along the inset with an end tick at each edge", () => {
    expect(insetRedline(10, 23, 40)).toBe("M 10 37 L 10 43 M 10 40 L 23 40 M 23 37 L 23 43");
  });
});

describe("usedRadii", () => {
  const even = (r: number) => ({ topLeft: r, topRight: r, bottomRight: r, bottomLeft: r });

  it.each([
    ["keeps radii that fit their box", 100, 80, even(36), even(36)],
    // 40 − 4px of list padding = 36px each. The 28px side holds 36 + 36 = 72px of radii, so
    // f = 28 / 72 and every corner is 36 × 28 / 72 = 14px.
    [
      "scales a short, wide Tabs trigger's 36px corners at --radius: 40px down to its height",
      100,
      28,
      even(36),
      even(14),
    ],
    // The top side is the tightest: 50 / (40 + 10) = 1; the left: 30 / (40 + 20) = 0.5.
    [
      "scales every corner by the tightest side's factor",
      50,
      30,
      { topLeft: 40, topRight: 10, bottomRight: 0, bottomLeft: 20 },
      { topLeft: 20, topRight: 5, bottomRight: 0, bottomLeft: 10 },
    ],
  ])("%s", (_case, width, height, radii, used) => {
    expect(usedRadii(width, height, radii)).toEqual(used);
  });
});

describe("packLabels", () => {
  const BOUNDS = { width: 400, height: 300 };
  const label = (x: number, y: number, side: "start" | "end" = "start") => ({
    anchor: { x, y },
    width: 40,
    height: 16,
    side,
  });

  it("leaves labels that do not collide by their anchors, without leaders", () => {
    expect(packLabels([label(10, 10), label(100, 10), label(150, 50, "end")], BOUNDS)).toEqual([
      { x: 12, y: 12, leader: false },
      { x: 102, y: 12, leader: false },
      // An end-side label hangs left of its anchor: 150 − 2 − 40.
      { x: 108, y: 52, leader: false },
    ]);
  });

  it("moves a colliding label to the next free row, with a leader", () => {
    // The second label's natural box, 14..54 × 12..28, overlaps the first's 12..52 × 12..28,
    // so it drops one row: 12 + 16 + 2px of gap.
    expect(packLabels([label(10, 10), label(12, 10)], BOUNDS)).toEqual([
      { x: 12, y: 12, leader: false },
      { x: 14, y: 30, leader: true },
    ]);
  });

  it("packs the label nearer the top first, whatever the input order", () => {
    // The first, placed at 12, 12, takes 12..28; the second, natural at 14, 13, settles flush
    // below it: 12 + 16 + 2px of gap.
    expect(packLabels([label(12, 11), label(10, 10)], BOUNDS)).toEqual([
      { x: 14, y: 30, leader: true },
      { x: 12, y: 12, leader: false },
    ]);
  });

  it("keeps labels inside the canvas, 4px from its edges", () => {
    expect(packLabels([label(390, 10), label(-20, 290)], BOUNDS)).toEqual([
      // 400 − 4 − 40 = 356.
      { x: 356, y: 12, leader: true },
      // 4 from the left, and 300 − 4 − 16 = 280 from the top.
      { x: 4, y: 280, leader: true },
    ]);
  });

  it("stacks upward when no row below is free", () => {
    // Both clamp to y 280; the row below would end past 296, so the second rises a row: 280 − 18.
    expect(packLabels([label(10, 290), label(12, 290)], BOUNDS)).toEqual([
      { x: 12, y: 280, leader: true },
      { x: 14, y: 262, leader: true },
    ]);
  });

  it("moves to the next column when no row in its own is free", () => {
    // In 100 × 50, x runs 4..56 and y 4..30. The first sits at its natural 12, 12; the second
    // drops a row to 12 + 18 = 30, the last that fits. The third finds both rows taken and no
    // room above, so it moves a column right: 12 + 40 + 2px of gap = 54.
    expect(packLabels([label(10, 10), label(10, 10), label(10, 10)], { width: 100, height: 50 })).toEqual([
      { x: 12, y: 12, leader: false },
      { x: 12, y: 30, leader: true },
      { x: 54, y: 12, leader: true },
    ]);
  });

  it("finds a free place off its own anchor's grid", () => {
    // The first two take 12, 12 and 12, 30, as above. The third's natural x is 16, and every
    // row at 16 or at the left edge, 4, overlaps them; flush right of them, 12 + 40 + 2 = 54,
    // is free.
    expect(packLabels([label(10, 10), label(10, 10), label(14, 10)], { width: 100, height: 50 })).toEqual([
      { x: 12, y: 12, leader: false },
      { x: 12, y: 30, leader: true },
      { x: 54, y: 12, leader: true },
    ]);
  });

  it("drops a label when no slot in the bounds is free", () => {
    // Two columns, 12 and 54, of two rows, 12 and 30: the fifth label has nowhere to go.
    const labels = Array.from({ length: 5 }, () => label(10, 10));
    expect(packLabels(labels, { width: 100, height: 50 })).toEqual([
      { x: 12, y: 12, leader: false },
      { x: 12, y: 30, leader: true },
      { x: 54, y: 12, leader: true },
      { x: 54, y: 30, leader: true },
      undefined,
    ]);
  });
});

describe("paintsFill", () => {
  it.each([
    ["rgb(255, 255, 255)", true],
    ["oklch(0.5 0.1 200 / 0.02)", true],
    ["rgba(0, 0, 0, 0)", false],
    ["oklch(0.5 0.1 200 / 0)", false],
    ["lab(50 20 -10 / 0)", false],
  ])("counts %s as a fill: %s", (backgroundColor, fill) => {
    expect(paintsFill(backgroundColor)).toBe(fill);
  });
});
