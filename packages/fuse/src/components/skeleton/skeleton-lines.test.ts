/**
 * Unit under test: line-fragment merging. Oracle: synthetic fragments whose expected bars are
 * worked out by hand from the rule: fragments overlapping by half the shorter one's height, with a
 * gap no wider than 0.4 of the larger font size, form one bar spanning them.
 */
import { describe, expect, it } from "vitest";

import { mergeLineFragments } from "./skeleton-lines";
import type { LineFragment } from "./skeleton-lines";

/** A 16 px fragment on the 24 px line box at `top`, with its bar from 4 px to 20 px into the box. */
function fragment(left: number, right: number, top = 0, fontSize = 16): LineFragment {
  return { left, right, top, bottom: top + 24, fontSize, barTop: top + 4, barBottom: top + 20 };
}

describe("mergeLineFragments", () => {
  it("merges fragments on one line closer than 0.4 em, however they arrive", () => {
    // A link splits "Paid on 4 May" into three fragments 4 px and 6 px apart; 0.4 × 16 = 6.4.
    const bars = mergeLineFragments([fragment(80, 120), fragment(0, 40), fragment(44, 74)]);
    expect(bars).toEqual([{ x: 0, y: 4, width: 120, height: 16, fontSize: 16 }]);
  });

  it("keeps fragments a gutter apart as two bars", () => {
    const bars = mergeLineFragments([fragment(0, 40), fragment(47, 90)]);
    expect(bars).toEqual([
      { x: 0, y: 4, width: 40, height: 16, fontSize: 16 },
      { x: 47, y: 4, width: 43, height: 16, fontSize: 16 },
    ]);
  });

  it("reads the gap against the larger font of the two", () => {
    // 10 px apart: too far at 16 px (6.4), close enough beside 32 px text (12.8).
    const bars = mergeLineFragments([fragment(0, 40), fragment(50, 90, 0, 32)]);
    expect(bars).toEqual([{ x: 0, y: 4, width: 90, height: 16, fontSize: 32 }]);
  });

  it("keeps each wrapped line its own bar", () => {
    const bars = mergeLineFragments([fragment(0, 200), fragment(0, 120, 24)]);
    expect(bars).toEqual([
      { x: 0, y: 4, width: 200, height: 16, fontSize: 16 },
      { x: 0, y: 28, width: 120, height: 16, fontSize: 16 },
    ]);
  });

  it("joins fragments overlapping by half the shorter one, spanning both bars", () => {
    // 12 px of a 24 px box overlap: exactly half.
    const bars = mergeLineFragments([fragment(0, 40), fragment(42, 80, 12)]);
    expect(bars).toEqual([{ x: 0, y: 4, width: 80, height: 28, fontSize: 16 }]);
  });

  it("keeps fragments overlapping by less than half on separate lines", () => {
    const bars = mergeLineFragments([fragment(0, 40), fragment(42, 80, 13)]);
    expect(bars).toHaveLength(2);
  });

  it("reports the largest font size of the fragments a line merges", () => {
    // A 32 px word between two 16 px fragments, 4 px and 2 px apart: one line, at 32 px.
    const bars = mergeLineFragments([fragment(0, 40), fragment(44, 120, 0, 32), fragment(122, 160)]);
    expect(bars.map((bar) => bar.fontSize)).toEqual([32]);
  });

  it("draws nothing for no text", () => {
    expect(mergeLineFragments([])).toEqual([]);
  });
});
