/**
 * Build rules the owner's run on a real file on 2026-10-23 showed missing, against the one-cell
 * `chip` fixture of `test/fixture-sets.ts`. The unit under test is `buildComponentSet`. Each describe
 * names its oracle.
 */
import { describe, expect, it } from "vitest";

import { literal } from "../../test/built-kit";
import { buildFixture, chip, dot, frameOf, ICON } from "../../test/fixture-sets";
import type { CoverageRow } from "./coverage";

/** The property, outcome and detail of each coverage row of one class. */
const notesOf = (coverage: readonly CoverageRow[], className: string) =>
  coverage.filter((row) => row.className === className).map((row) => [row.property, row.outcome, row.detail]);

const END_ICON = { ...ICON, side: "end", classes: "size-[16px]" } as const;

// Oracle: CSS Box Alignment 3 §5.3 and §8, and CSS Flexbox 1 §9.5. `space-between` spreads a flex
// box's free space between its items, at least the gap apart. A box that hugs its items along its
// direction has no free space, so they pack at its start, the gap between them, as a Select trigger
// hugs its value and caret. A real file kept SPACE_BETWEEN with no gap beside a filling text on
// 2026-10-23 (PV), and the owner's Select triggers drew the caret against the value. A box with a
// definite length, or with a minimum that can leave room, keeps SPACE_BETWEEN.
describe("justify-between in a box that hugs its layers along its direction", () => {
  const row = (classes: string) =>
    chip(`flex justify-between gap-[6px] text-[#000000] ${classes}`, {
      iconsFor: () => [{ ...END_ICON, key: "start", name: "Start", side: "start" }, END_ICON],
    });

  it("packs them at the start with the gap between them", async () => {
    const { variant, coverage } = await buildFixture(row(""));
    expect([variant?.root.primaryAlign, variant?.root.itemSpacing]).toEqual(["MIN", literal(6)]);
    expect(notesOf(coverage, "justify-between")).toEqual([
      [
        "justify-content",
        "literal",
        "with no room to space them out, so packed at the start of the primary axis",
      ],
    ]);
  });

  it.each([
    ["a definite width", "w-[200px]"],
    ["a minimum width", "min-w-[200px]"],
  ])("spaces them out where the box has %s", async (_case, classes) => {
    const { variant } = await buildFixture(row(classes));
    expect(variant?.root.primaryAlign).toBe("SPACE_BETWEEN");
  });
});

// Oracle: a real file drew a part's 2px spread ring only over a visible fill with clipping on (PR2,
// 2026-10-23), as it draws a root's (2026-10-20), and black at alpha 0.0015 is a fill Figma counts
// that changes no 8-bit channel. A part that casts no spread keeps what its classes give it, and one
// that paints a fill of its own keeps that fill.
describe("a part that casts a spread ring", () => {
  const CLEAR = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0.0015 } } as const;
  const RED = { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } } as const;

  it.each([
    ["no fill", "shadow-[0_0_0_2px_#000000]", CLEAR, true],
    ["a fill of its own", "bg-[#ff0000] shadow-[0_0_0_2px_#000000]", RED, true],
    ["no spread", "shadow-[0_1px_2px_#000000]", undefined, false],
  ])("with %s gets the fill and the clipping its ring needs", async (_case, classes, fill, clips) => {
    const { variant } = await buildFixture(chip("flex", { parts: [dot(`size-[8px] ${classes}`)] }));
    const part = frameOf(variant?.root);
    expect([part?.fill, part?.clips]).toEqual([fill, clips]);
  });
});
