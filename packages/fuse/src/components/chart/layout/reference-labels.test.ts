import { describe, expect, it } from "vitest";

import { referenceLabelBottom } from "./reference-labels";

// The oracle is the stacking rule written out by hand: label k's bottom edge is the largest of its
// own edge, each earlier label's own edge plus one line per label from that one to k, and k + 1
// lines times the plot's label floor, the topmost label's floor carried down the stack.
describe("referenceLabelBottom", () => {
  it("keeps a lone label on its own edge, one line under the plot's top at least", () => {
    const self = { order: 0, at: 40, clipped: false };
    expect(referenceLabelBottom([self], self)).toBe("max(40%, calc(1lh * var(--chart-label-floor, 0)))");
  });

  it("stacks a second label at the same value one line below the first", () => {
    const band = { order: 0, at: 0, clipped: false };
    const line = { order: 1, at: 0, clipped: false };
    expect(referenceLabelBottom([band, line], band)).toBe("max(0%, calc(1lh * var(--chart-label-floor, 0)))");
    expect(referenceLabelBottom([band, line], line)).toBe(
      "max(0%, calc(0% + 1lh), calc(2lh * var(--chart-label-floor, 0)))"
    );
  });

  it("orders two labels at one value by mount order, whatever order the list holds them in", () => {
    const band = { order: 0, at: 0, clipped: false };
    const line = { order: 1, at: 0, clipped: false };
    for (const list of [
      [line, band],
      [band, line],
    ]) {
      expect(referenceLabelBottom(list, band)).toBe("max(0%, calc(1lh * var(--chart-label-floor, 0)))");
      expect(referenceLabelBottom(list, line)).toBe(
        "max(0%, calc(0% + 1lh), calc(2lh * var(--chart-label-floor, 0)))"
      );
    }
    // Three at one value, listed last mounted first.
    const third = { order: 2, at: 0, clipped: false };
    expect(referenceLabelBottom([third, line, band], line)).toBe(
      "max(0%, calc(0% + 1lh), calc(2lh * var(--chart-label-floor, 0)))"
    );
  });

  it("places a label missing from the list on its own edge, as before it registers", () => {
    const first = { order: 0, at: 0, clipped: false };
    const second = { order: 1, at: 10, clipped: false };
    const self = { order: 2, at: 30, clipped: false };
    expect(referenceLabelBottom([first, second], self)).toBe(
      "max(30%, calc(1lh * var(--chart-label-floor, 0)))"
    );
  });

  it("orders labels by their edge, not by mount order", () => {
    const low = { order: 0, at: 50, clipped: false };
    const high = { order: 1, at: 10, clipped: false };
    expect(referenceLabelBottom([low, high], high)).toBe("max(10%, calc(1lh * var(--chart-label-floor, 0)))");
    expect(referenceLabelBottom([low, high], low)).toBe(
      "max(50%, calc(10% + 1lh), calc(2lh * var(--chart-label-floor, 0)))"
    );
  });

  it("counts every earlier label for the third, with one line per label between", () => {
    const first = { order: 0, at: 5, clipped: false };
    const second = { order: 1, at: 6, clipped: false };
    const third = { order: 2, at: 7, clipped: false };
    expect(referenceLabelBottom([third, first, second], third)).toBe(
      "max(7%, calc(5% + 2lh), calc(6% + 1lh), calc(3lh * var(--chart-label-floor, 0)))"
    );
  });

  it("puts a band cut at the plot top below the cut", () => {
    const cut = { order: 0, at: 0, clipped: true };
    const line = { order: 1, at: 2, clipped: false };
    expect(referenceLabelBottom([cut, line], cut)).toBe(
      "max(calc(0.25rem + 1lh), calc(1lh * var(--chart-label-floor, 0)))"
    );
    expect(referenceLabelBottom([cut, line], line)).toBe(
      "max(2%, calc(calc(0.25rem + 1lh) + 1lh), calc(2lh * var(--chart-label-floor, 0)))"
    );
  });
});
