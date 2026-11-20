/**
 * How the build draws a grid of one cell whose icons stack in it, one shown, as Checkbox card's
 * control crossfades its unchecked and checked icons. The unit under test is `buildSetsInOrder` on
 * hand-built captures (`test/capture-fixtures.ts`). Oracles:
 *
 * - CSS Grid 1 §7.5 and §8.3, measured in Chromium on 2026-11-19: in a 24px `inline-grid`, two 24px
 *   icons at line 1 on both axes both sit at (0, 0), one over the other. Placed automatically, the
 *   second sits at (0, 24), below the first. Two 16px icons in an `items-center` grid sit at (0, 4),
 *   at the cell's start across, where a frame that centers its layer draws (4, 4). With 4px of
 *   padding, both sit at (4, 4) and overflow the grid. A `min-height: 100px` on the opacity-0 icon of
 *   an `items-center` grid makes the row 100px tall, which moves the shown icon to (0, 38).
 *   2px of padding on the shown icon draws its glyph at 20px from (2, 2) as `border-box`, and at 24px
 *   from (2, 2) as `content-box`.
 * - CSS Color 4 §3.2: an element at opacity 0 paints nothing, and at opacity 1 paints as it is.
 * - CSS Variables 1 §3.1: a `filter` whose functions all substitute to nothing is invalid at
 *   computed-value time, so it computes to its initial `none`.
 * - The coverage contract: a grid the build does not draw as its one shown icon keeps its `display`
 *   unmapped.
 */
import { describe, expect, it } from "vitest";

import { buildChip, notesOf } from "../../test/capture-fixtures";
import type { IconManifest } from "../capture/manifest";
import type { ChildLayerSpec } from "./kit-spec";

/** An icon of the stack, a direct child of the grid. */
function icon(key: string, name: string): IconManifest {
  return { key, name, side: "start", direct: true, dataIcon: undefined, icon: name, swapProperty: undefined };
}

/** The stack's icons, in markup order. */
const ICONS = [icon("unchecked", "Circle"), icon("checked", "CheckCircle")];

/** An icon's classes, at line 1 on both axes and as large as the grid. */
const PLACED = "col-start-1 row-start-1 size-[24px]";

/**
 * Build a chip whose root is a grid around the stack's two icons, with the given classes.
 *
 * @param classes - The grid's classes and each icon's.
 */
function buildStack(classes: { readonly grid?: string; readonly icons: readonly [string, string] }) {
  return buildChip(
    classes.grid ?? "inline-grid size-[24px] text-[#000000]",
    classes.icons.map((each) => ({ tag: "svg", classes: each })),
    { iconsFor: () => ICONS }
  );
}

/** The icons a layer list draws, by key. */
function iconKeys(layers: readonly ChildLayerSpec[] | undefined): readonly string[] {
  return (layers ?? []).flatMap((layer) => (layer.kind === "icon" ? [layer.key] : []));
}

/** The display row the stack's grid reads. */
const STACK_DISPLAY = [
  "display",
  "literal",
  "a grid of one cell whose icons stack in it, each covering the cell, of which one shows: a frame around that icon",
];

describe("a grid of one cell whose icons stack in it", () => {
  it.each([
    ["the first", [`${PLACED} opacity-100`, `${PLACED} opacity-0`], ["unchecked"]],
    ["the second", [`${PLACED} opacity-0`, `${PLACED} opacity-100`], ["checked"]],
  ] as const)("draws %s icon, the one at opacity 1, and no other", async (_case, icons, drawn) => {
    const { variant, coverage } = await buildStack({ icons });
    expect({
      drawn: iconKeys(variant?.root.children),
      display: notesOf(coverage, "inline-grid"),
      unmapped: coverage.filter((row) => row.outcome === "unmapped"),
    }).toEqual({ drawn, display: [STACK_DISPLAY], unmapped: [] });
  });

  it("drops what the shown icon sets that draws nothing at rest, and everything the hidden one sets", async () => {
    const { coverage } = await buildStack({
      icons: [`${PLACED} opacity-100 scale-100 blur-none`, `${PLACED} opacity-0 scale-[0.25] blur-[4px]`],
    });
    // Each class's main property, and the outcomes of every declaration the class wins.
    const read = (className: string, property: string) => {
      const notes = notesOf(coverage, className);
      return [notes.some(([each]) => each === property), [...new Set(notes.map(([, outcome]) => outcome))]];
    };
    const dropped = [true, ["dropped"]];
    expect({
      shown: [read("opacity-100", "opacity"), read("scale-100", "scale"), read("blur-none", "filter")],
      hidden: [read("opacity-0", "opacity"), read("scale-[0.25]", "scale"), read("blur-[4px]", "filter")],
    }).toEqual({ shown: [dropped, dropped, dropped], hidden: [dropped, dropped, dropped] });
  });

  it.each([
    ["the shown icon scales", `${PLACED} opacity-100 scale-[0.5]`, "scale"],
    ["the shown icon blurs", `${PLACED} opacity-100 blur-[4px]`, "filter"],
  ])("keeps a rest that draws something unmapped where %s", async (_case, shown, property) => {
    const { coverage } = await buildStack({ icons: [shown, `${PLACED} opacity-0`] });
    expect(coverage.filter((row) => row.outcome === "unmapped").map((row) => row.property)).toContain(
      property
    );
  });

  // Each case lets CSS place an icon other than over the whole box, or show more or less than one.
  it.each([
    ["the icons place themselves", { icons: ["size-[24px] opacity-100", "size-[24px] opacity-0"] }],
    [
      "the icons are smaller than the grid",
      {
        grid: "inline-grid size-[24px] items-center text-[#000000]",
        icons: [
          "col-start-1 row-start-1 size-[16px] opacity-100",
          "col-start-1 row-start-1 size-[16px] opacity-0",
        ],
      },
    ],
    [
      "the grid pads its cell",
      {
        grid: "inline-grid size-[24px] p-[4px] text-[#000000]",
        icons: [`${PLACED} opacity-100`, `${PLACED} opacity-0`],
      },
    ],
    [
      "the grid sets columns",
      {
        grid: "inline-grid size-[24px] grid-cols-1 text-[#000000]",
        icons: [`${PLACED} opacity-100`, `${PLACED} opacity-0`],
      },
    ],
    [
      "the hidden icon sets a minimum height past the cell",
      {
        grid: "inline-grid size-[24px] items-center text-[#000000]",
        icons: [`${PLACED} opacity-100`, `${PLACED} opacity-0 min-h-[100px]`],
      },
    ],
    ["the shown icon pads itself", { icons: [`${PLACED} opacity-100 p-[2px]`, `${PLACED} opacity-0`] }],
    ["both icons show", { icons: [`${PLACED} opacity-100`, `${PLACED} opacity-100`] }],
    ["the other icon shows at half opacity", { icons: [`${PLACED} opacity-100`, `${PLACED} opacity-50`] }],
  ] as const)("keeps the grid's display unmapped where %s", async (_case, classes) => {
    const { coverage } = await buildStack(classes);
    expect(notesOf(coverage, "inline-grid").map(([property, outcome]) => [property, outcome])).toEqual([
      ["display", "unmapped"],
    ]);
  });
});
