/**
 * Unit under test: the reveal planner. Oracle: the reveal rules the component documents, written
 * out by hand per context: `smart` lands content at once over a skeleton up under 150 ms or during
 * input, crossfades a refetch in 120 ms and small content (under 72 px or three pieces) in 200 ms,
 * and sequences the rest by row; `together` always crossfades; `sequence` always times by position.
 */
import { describe, expect, it } from "vitest";

import { planReveal, positionDelayMs, rowDelayMs, skeletonHoldMs } from "./skeleton-reveal-plan";
import type { RevealContext, RevealPlan, SkeletonRevealMode } from "./skeleton-reveal-plan";

const LARGE: RevealContext = { shownMs: 600, recentInput: false, refetch: false, height: 320, pieces: 12 };

const CASES: ReadonlyArray<readonly [string, SkeletonRevealMode, RevealContext, RevealPlan]> = [
  [
    "smart, large content after a long skeleton",
    "smart",
    LARGE,
    { kind: "sequence", order: "row", durationMs: 200 },
  ],
  ["smart, skeleton up 149 ms", "smart", { ...LARGE, shownMs: 149 }, { kind: "instant" }],
  [
    "smart, skeleton up exactly 150 ms",
    "smart",
    { ...LARGE, shownMs: 150 },
    { kind: "sequence", order: "row", durationMs: 200 },
  ],
  ["smart, input in the last 400 ms", "smart", { ...LARGE, recentInput: true }, { kind: "instant" }],
  [
    "smart, server-rendered skeleton",
    "smart",
    { ...LARGE, shownMs: Number.POSITIVE_INFINITY },
    { kind: "sequence", order: "row", durationMs: 200 },
  ],
  ["smart, refetch", "smart", { ...LARGE, refetch: true }, { kind: "together", durationMs: 120 }],
  [
    "smart, refetch during input",
    "smart",
    { ...LARGE, refetch: true, recentInput: true },
    { kind: "instant" },
  ],
  ["smart, 71 px tall", "smart", { ...LARGE, height: 71 }, { kind: "together", durationMs: 200 }],
  [
    "smart, 72 px tall",
    "smart",
    { ...LARGE, height: 72 },
    { kind: "sequence", order: "row", durationMs: 200 },
  ],
  ["smart, three pieces", "smart", { ...LARGE, pieces: 3 }, { kind: "together", durationMs: 200 }],
  [
    "smart, four pieces",
    "smart",
    { ...LARGE, pieces: 4 },
    { kind: "sequence", order: "row", durationMs: 200 },
  ],
  ["together, large content", "together", LARGE, { kind: "together", durationMs: 200 }],
  [
    "together, a flash during input",
    "together",
    { ...LARGE, shownMs: 10, recentInput: true },
    { kind: "together", durationMs: 200 },
  ],
  [
    "sequence, small content",
    "sequence",
    { ...LARGE, height: 20, pieces: 1 },
    { kind: "sequence", order: "position", durationMs: 200 },
  ],
  [
    "sequence, refetch",
    "sequence",
    { ...LARGE, refetch: true },
    { kind: "sequence", order: "position", durationMs: 200 },
  ],
];

describe("planReveal", () => {
  it.each(CASES)("%s", (_name, mode, context, expected) => {
    expect(planReveal(mode, context)).toEqual(expected);
  });
});

describe("skeletonHoldMs", () => {
  it("holds a client skeleton back 150 ms under smart only", () => {
    expect([skeletonHoldMs("smart"), skeletonHoldMs("together"), skeletonHoldMs("sequence")]).toEqual([
      150, 0, 0,
    ]);
  });
});

describe("positionDelayMs", () => {
  const reveal = { left: 100, top: 200, width: 400, height: 500 };

  it("weighs the place down 0.8 and across 0.2 over 320 ms", () => {
    expect(positionDelayMs({ left: 100, top: 200, width: 10, height: 10 }, reveal)).toBe(0);
    // Halfway down: 0.5 × 0.8 × 320.
    expect(positionDelayMs({ left: 100, top: 450, width: 10, height: 10 }, reveal)).toBe(128);
    // Bottom left: 0.8 × 320.
    expect(positionDelayMs({ left: 100, top: 700, width: 10, height: 10 }, reveal)).toBe(256);
    // Halfway across at the top: 0.5 × 0.2 × 320.
    expect(positionDelayMs({ left: 300, top: 200, width: 10, height: 10 }, reveal)).toBe(32);
    // Bottom right: the whole spread.
    expect(positionDelayMs({ left: 500, top: 700, width: 10, height: 10 }, reveal)).toBe(320);
  });

  it("clamps a piece outside the reveal to the spread", () => {
    expect(positionDelayMs({ left: 900, top: 1200, width: 10, height: 10 }, reveal)).toBe(320);
    expect(positionDelayMs({ left: 0, top: 0, width: 10, height: 10 }, reveal)).toBe(0);
  });
});

describe("rowDelayMs", () => {
  const box = { left: 0, top: 410, width: 100, height: 20 };

  it("times a row by its place down the screen, smaller text 60 ms later", () => {
    const unit = { left: 0, top: 400, width: 300, height: 48 };
    // 400 of an 800 px viewport: half the 320 ms spread.
    expect(rowDelayMs({ box, unit, secondary: false }, 800)).toBe(160);
    expect(rowDelayMs({ box, unit, secondary: true }, 800)).toBe(220);
  });

  it("brings a piece outside any row in at once while on screen", () => {
    expect(rowDelayMs({ box, unit: null, secondary: false }, 800)).toBe(0);
  });

  it("brings anything off screen in at once, as null", () => {
    const below = { left: 0, top: 900, width: 300, height: 48 };
    const above = { left: 0, top: -100, width: 300, height: 48 };
    expect(rowDelayMs({ box, unit: below, secondary: false }, 800)).toBeNull();
    expect(rowDelayMs({ box, unit: above, secondary: false }, 800)).toBeNull();
    expect(rowDelayMs({ box: below, unit: null, secondary: false }, 800)).toBeNull();
  });
});
