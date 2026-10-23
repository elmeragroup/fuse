/**
 * Build rules the owner's run on a real file on 2026-10-23 showed missing, against the one-cell
 * `chip` fixture of `test/fixture-sets.ts`. The unit under test is `buildComponentSet`. Each describe
 * names its oracle.
 */
import { describe, expect, it } from "vitest";

import { literal } from "../../test/built-kit";
import { buildFixture, chip, dot, frameOf, ICON } from "../../test/fixture-sets";
import type { PartDefinition } from "./component-spec";
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

// Oracle: CSS Backgrounds 3 §7.1, where the first shadow of `box-shadow` paints on top, and a real
// file on 2026-10-23, where a later effect in `effects` painted above an earlier one (PE2). Tailwind
// lists the ring before the shadow, so the ring paints on top in the browser, and Figma draws it on
// top only last in the list, as the outline Sidebar row's ring above its 1px border.
describe("a box with a ring and a shadow", () => {
  it("lists them in the order Figma paints them, the ring that CSS paints on top last", async () => {
    const { variant } = await buildFixture(chip("ring-2 ring-[#ff0000] shadow-[0_0_0_1px_#0000ff]"));
    expect(variant?.root.shadows.map((shadow) => [shadow.color, shadow.spread])).toEqual([
      [{ kind: "literal", color: { r: 0, g: 0, b: 1, a: 1 } }, literal(1)],
      [{ kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } }, literal(2)],
    ]);
  });
});

// Oracle: CSS 2.1 Appendix E, where a stacking context paints the backgrounds and shadows of its
// blocks in tree order, its inline-level boxes after them, and its positioned boxes and the stacking
// contexts inside it after those, CSS Flexbox 1 §4.3, where a flex item paints as an inline block
// does, CSS Color 3 §3.2, where `opacity` below 1 makes a stacking context, and a real file on
// 2026-10-23, where an auto layout painted a later child above an earlier one, and the first on top
// with `itemReverseZIndex` (PZ2). So in a block that stacks blocks, a flex block's item casts its
// ring over a later block's fill, as the Accordion trigger's focus ring over the open panel, while a
// block's own ring paints below a later block, and a later positioned block or stacking context
// paints above the ring, as Figma's own order does. Where no one order of the box's layers draws
// both, the box keeps Figma's order and its `display` stays unmapped.
describe("a block that stacks a ring and a later block's fill", () => {
  const RING = "ring-2 ring-[#ff0000]";
  const part = (key: string, classes: string, parts: readonly PartDefinition[] = []): PartDefinition => ({
    ...dot(classes),
    key,
    slot: `chip-${key}`,
    parts,
  });
  const ringed = part("ringed", `block size-[8px] ${RING}`);
  const panel = part("panel", "block h-[8px] bg-[#0000ff]");
  const between = (raised: string) =>
    `the ring a flex block's layer casts paints above a later block's fill and below ${raised}, a positioned box or a stacking context (CSS 2.1 Appendix E), and Figma paints a box's layers in one order`;
  const covered = (fill: string, shadow: string) =>
    `the ring a flex block's layer casts paints above a later block's fill, and putting the first layer on top would also paint the fill of ${fill} over the shadow ${shadow} casts, which CSS can paint above it`;

  it.each([
    [
      "a flex block's item rings it, before a filled block",
      [part("header", "flex", [ringed]), panel],
      true,
      [],
    ],
    [
      "a block rings itself, before a filled block",
      [part("header", `flex h-[8px] ${RING}`), panel],
      undefined,
      [],
    ],
    [
      "a block inside a block rings it, before a filled block",
      [part("header", "block", [ringed]), panel],
      undefined,
      [],
    ],
    [
      "a flex block's item rings it, before a block with no fill",
      [part("header", "flex", [ringed]), part("panel", "block h-[8px]")],
      undefined,
      [],
    ],
    [
      "a flex block's item rings it, after a filled block",
      [panel, part("header", "flex", [ringed])],
      undefined,
      [],
    ],
    [
      "a flex block's item rings it, before a filled block at 50% opacity, which paints above the ring",
      [part("header", "flex", [ringed]), part("panel", "block h-[8px] bg-[#0000ff] opacity-50")],
      undefined,
      [],
    ],
    [
      "a flex block's item rings it, before a filled positioned block, which paints above the ring",
      [part("header", "flex", [ringed]), part("panel", "relative block h-[8px] bg-[#0000ff]")],
      undefined,
      [],
    ],
    [
      "a flex block's item rings it, before a filled block and a block at 50% opacity",
      [part("header", "flex", [ringed]), panel, part("faded", "block h-[8px] opacity-50")],
      undefined,
      [["display", between("chip-faded")]],
    ],
    [
      "a flex block's filled item rings it, before another flex block's ringed item and a filled block",
      [
        part("first", "flex", [part("filled", `block size-[8px] bg-[#00ff00] ${RING}`)]),
        part("second", "flex", [ringed]),
        panel,
      ],
      undefined,
      [["display", covered("chip-filled", "chip-ringed")]],
    ],
  ])("puts the first layer on top only where %s", async (_case, parts, firstOnTop, unmapped) => {
    const { variant, coverage } = await buildFixture(chip("block w-[200px]", { parts }));
    expect([variant?.root.direction, variant?.root.firstOnTop]).toEqual(["VERTICAL", firstOnTop]);
    expect(
      coverage.filter((row) => row.outcome === "unmapped").map((row) => [row.property, row.detail])
    ).toEqual(unmapped);
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
