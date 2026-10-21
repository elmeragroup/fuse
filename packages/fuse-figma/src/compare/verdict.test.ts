import { describe, expect, it } from "vitest";

import { judgeCell, worstFirst } from "./verdict";
import type { CellVerdict } from "./verdict";

const box = { width: 80, height: 32 };

describe("judgeCell", () => {
  it("measures mismatch against the box's area at the scale", () => {
    // 80 × 32 at 2x is 160 × 64 = 10240 device pixels.
    expect(
      judgeCell({ figmaBox: box, browserBox: box, mismatch: { raw: 64, tolerant: 16 }, scale: 2, flags: [] })
    ).toEqual({ widthDelta: 0, heightDelta: 0, rawPercent: 0.625, tolerantPercent: 0.15625, flags: [] });
  });

  it("flags half a pixel or more as a size difference, Figma minus browser", () => {
    const verdict = judgeCell({
      figmaBox: { width: 81, height: 32 },
      browserBox: box,
      mismatch: { raw: 0, tolerant: 0 },
      scale: 2,
      flags: [],
    });
    expect([verdict.widthDelta, verdict.heightDelta]).toEqual([1, 0]);
    expect(verdict.flags).toEqual(["size"]);
  });

  it("flags less than half a pixel as subpixel, and ignores layout rounding", () => {
    const flagsFor = (width: number) =>
      judgeCell({
        figmaBox: { width, height: 32 },
        browserBox: box,
        mismatch: { raw: 0, tolerant: 0 },
        scale: 2,
        flags: [],
      }).flags;
    expect(flagsFor(80.3)).toEqual(["subpixel-size"]);
    expect(flagsFor(79.6)).toEqual(["subpixel-size"]);
    expect(flagsFor(80.01)).toEqual([]);
  });

  it("flags a cell Figma drew nothing for, and keeps the flags it is given", () => {
    expect(
      judgeCell({
        figmaBox: box,
        browserBox: box,
        mismatch: undefined,
        scale: 2,
        flags: ["state-by-interaction"],
      })
    ).toEqual({
      widthDelta: 0,
      heightDelta: 0,
      rawPercent: 0,
      tolerantPercent: 0,
      flags: ["state-by-interaction", "no-figma-image"],
    });
  });
});

describe("worstFirst", () => {
  const row = (name: string, verdict: Partial<CellVerdict>) => ({
    name,
    verdict: { widthDelta: 0, heightDelta: 0, rawPercent: 0, tolerantPercent: 0, flags: [], ...verdict },
  });

  it("puts severe flags first, then the tolerant mismatch, then the raw one", () => {
    const rows = [
      row("high tolerant", { tolerantPercent: 5, rawPercent: 6 }),
      row("size", { flags: ["size"] }),
      row("low tolerant, high raw", { tolerantPercent: 1, rawPercent: 3 }),
      row("low tolerant, low raw", { tolerantPercent: 1, rawPercent: 2 }),
      row("no picture", { flags: ["no-figma-image"] }),
      row("subpixel only", { flags: ["subpixel-size"], tolerantPercent: 0.5 }),
      row("missing state", { flags: ["state-missing"], tolerantPercent: 0.1 }),
    ];
    expect(worstFirst(rows).map((entry) => entry.name)).toEqual([
      "missing state",
      "size",
      "no picture",
      "high tolerant",
      "low tolerant, high raw",
      "low tolerant, low raw",
      "subpixel only",
    ]);
  });
});
