/**
 * A turned absolute part that hangs from its containing block's bottom edge, centred across it, as a
 * Tooltip's arrow does, which Tooltip is the first set to need, against the `chip` and `dot` fixtures
 * of `test/fixture-sets.ts`. The unit under test is `buildComponentSet`.
 *
 * Oracle: CSS 2.1 §10.3.7 and §10.6.4, CSS Transforms 2 §6 and Chromium on 2026-10-27. An absolute
 * box's `left` and `bottom` offset its margin box from its containing block's padding box; `translate`
 * then moves it, a percentage taking its own size, and `rotate` turns it about its centre, which the
 * turn leaves where it was. So a 10px square at `left: calc(50% - 5px)`, `bottom: -10px`, translated
 * `calc(-50% - 2px)` down, centres 2px above the bottom edge on the horizontal centre: Chromium drew
 * Tooltip's arrow's turned box 14.14px square, centred at (46, 26) in a 92 × 28 popup, at (W/2, H - 2).
 * Figma counts the turn counterclockwise, so `rotate: 45deg` is -45 (PQ).
 */
import { describe, expect, it } from "vitest";

import { fixed, literal } from "../../test/built-kit";
import { buildFixture, chip, dot } from "../../test/fixture-sets";
import type { InlineDeclaration } from "./component-spec";
import type { CoverageRow } from "./coverage";

/** The property, outcome and detail of each coverage row of one class. */
const notesOf = (coverage: readonly CoverageRow[], className: string) =>
  coverage.filter((row) => row.className === className).map((row) => [row.property, row.outcome, row.detail]);

const ARROW_CLASSES =
  "absolute size-[10px] -bottom-[10px] translate-y-[calc(-50%-2px)] rotate-45 bg-[#000000]";

/** The arrow, with the `left` Base UI writes inline. */
const arrow = (left: string) => ({
  ...dot(ARROW_CLASSES),
  key: "arrow",
  slot: "chip-arrow",
  styleFor: (): readonly InlineDeclaration[] => [{ property: "left", value: left }],
});

const PLACED =
  "the layer's centre sits 0px from its containing block's horizontal centre and 2px above its bottom edge, where the plugin places it by its centre, and CENTER across and MAX down keep it there";

describe("a turned absolute part on its containing block's bottom edge", () => {
  it("places a centred arrow by its centre, 2px above the bottom edge, turned -45", async () => {
    const { variant, coverage } = await buildFixture(
      chip("relative flex w-[92px] h-[28px] bg-[#111111]", { parts: [arrow("calc(50% - 5px)")] })
    );
    expect(variant?.root.children[0]).toMatchObject({
      kind: "frame",
      key: "arrow",
      sizing: { horizontal: fixed(literal(10)), vertical: fixed(literal(10)) },
      rotation: -45,
      pivot: { constraints: { horizontal: "CENTER", vertical: "MAX" }, centerOffset: 0, bottomInset: 2 },
    });
    expect([
      ...notesOf(coverage, "-bottom-[10px]"),
      ...notesOf(coverage, "translate-y-[calc(-50%-2px)]").filter(([property]) => property === "translate"),
      ...notesOf(coverage, "inline style"),
    ]).toEqual([
      ["bottom", "literal", PLACED],
      ["translate", "literal", PLACED],
      ["left", "literal", PLACED],
    ]);
  });

  it("takes a static root as the containing block where its definition names the positioned element around it", async () => {
    const { variant } = await buildFixture(
      chip("flex w-[92px] h-[28px] bg-[#111111]", {
        parts: [arrow("calc(50% - 5px)")],
        positionedBy: "the fixture's positioner, which has the root's box",
      })
    );
    expect(variant?.root.children[0]).toMatchObject({ pivot: { centerOffset: 0, bottomInset: 2 } });
  });

  it("leaves the place unmapped in a static root whose definition names no positioned element", async () => {
    const { coverage } = await buildFixture(
      chip("flex w-[92px] h-[28px] bg-[#111111]", { parts: [arrow("calc(50% - 5px)")] })
    );
    expect(notesOf(coverage, "-bottom-[10px]").map(([property, outcome]) => [property, outcome])).toEqual([
      ["bottom", "unmapped"],
    ]);
  });

  it("leaves the place unmapped where the arrow's left does not centre it", async () => {
    const { variant, coverage } = await buildFixture(
      chip("relative flex w-[92px] h-[28px] bg-[#111111]", { parts: [arrow("12px")] })
    );
    expect(variant?.root.children[0]).not.toHaveProperty("pivot");
    expect(notesOf(coverage, "inline style").map(([property, outcome]) => [property, outcome])).toEqual([
      ["left", "unmapped"],
    ]);
  });

  // A 2px bottom border moves the padding box's bottom edge, and so the arrow's centre, 2px above the
  // frame's bottom: CSS centres it 4px up, where the frame's edge would put it 2px up.
  it.each([
    ["a physical bottom border", "border-b-2"],
    ["a logical block-end border", "[border-block-end-width:2px]"],
  ])("leaves the place unmapped in a containing block with %s", async (_, border) => {
    const { variant, coverage } = await buildFixture(
      chip(`relative flex w-[92px] h-[28px] bg-[#111111] border-solid ${border}`, {
        parts: [arrow("calc(50% - 5px)")],
      })
    );
    expect(variant?.root.children[0]).not.toHaveProperty("pivot");
    expect(notesOf(coverage, "-bottom-[10px]").map(([property, outcome]) => [property, outcome])).toEqual([
      ["bottom", "unmapped"],
    ]);
  });
});
