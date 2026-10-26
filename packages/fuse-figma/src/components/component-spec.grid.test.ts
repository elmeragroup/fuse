/**
 * The one-column grid, the Navigation menu popup's list, against the one-cell `chip` fixture of
 * `test/fixture-sets.ts`. The unit under test is `buildComponentSet`.
 *
 * Oracle: CSS Grid 1. A grid that sets no template, areas or column auto-flow, and whose items set no
 * placement, puts every item in one implicit column, one row each (§7.1, §8.5). The column's `auto`
 * track stretches to a definite grid width under `justify-content: normal` (§11.8), and each item's
 * `justify-self: normal` stretches it across the track (Box Alignment 3 §6.1). Rows are `auto`, so each
 * item keeps its own height, packed from the top and spaced by `row-gap`. One column has no column gap.
 */
import { describe, expect, it } from "vitest";

import { FILL, HUG, literal } from "../../test/built-kit";
import { buildFixture, chip, dot } from "../../test/fixture-sets";
import type { PartDefinition } from "./component-spec";
import type { CoverageRow } from "./coverage";

/** Three 32px rows, each a part with its own key and slot, as a list's items. */
const ROWS: readonly PartDefinition[] = ["first", "second", "third"].map((key) => ({
  ...dot("flex h-[32px]"),
  key,
  slot: `chip-${key}`,
}));

/** The outcome and detail of each coverage row of one class. */
const notesOf = (coverage: readonly CoverageRow[], className: string) =>
  coverage.filter((row) => row.className === className).map((row) => [row.property, row.outcome, row.detail]);

describe("a grid with no template", () => {
  it("draws as a column packed at its start, its rows filling a definite width, spaced by the gap", async () => {
    const { variant, coverage } = await buildFixture(chip("grid w-[256px] gap-[4px]", { parts: ROWS }));
    const root = variant?.root;
    expect([root?.direction, root?.primaryAlign, root?.counterAlign, root?.itemSpacing]).toEqual([
      "VERTICAL",
      "MIN",
      "MIN",
      literal(4),
    ]);
    expect(
      root?.children.map((child) => (child.kind === "frame" ? child.sizing.horizontal : undefined))
    ).toEqual([FILL, FILL, FILL]);
    expect(notesOf(coverage, "grid").map(([, outcome]) => outcome)).toEqual(["literal"]);
  });

  it("hugs its rows where its own width hugs", async () => {
    const { variant } = await buildFixture(chip("grid gap-[4px]", { parts: ROWS }));
    expect(
      variant?.root.children.map((child) => (child.kind === "frame" ? child.sizing.horizontal : undefined))
    ).toEqual([HUG, HUG, HUG]);
  });

  it("spaces its rows by `row-gap` and drops `column-gap`, which one column never spaces", async () => {
    const { variant, coverage } = await buildFixture(
      chip("grid w-[256px] gap-x-[8px] gap-y-[4px]", { parts: ROWS })
    );
    expect(variant?.root.itemSpacing).toEqual(literal(4));
    expect(notesOf(coverage, "gap-x-[8px]")).toEqual([
      ["column-gap", "dropped", "the grid lays its items in one column, which has no column gap"],
    ]);
  });

  // Negative controls: a template, a column auto-flow or an item's placement can put items side by
  // side or in tracks of their own, which a column does not draw.
  it.each([
    ["a column template", chip("grid w-[256px] grid-cols-2 gap-[4px]", { parts: ROWS })],
    ["a column auto-flow", chip("grid w-[256px] grid-flow-col gap-[4px]", { parts: ROWS })],
    [
      "an item that spans two columns",
      chip("grid w-[256px] gap-[4px]", {
        parts: [{ ...dot("flex h-[32px] col-span-2"), key: "wide", slot: "chip-wide" }, ...ROWS],
      }),
    ],
  ])("stays unmapped with %s", async (_kind, definition) => {
    const { coverage } = await buildFixture(definition);
    expect(notesOf(coverage, "grid").map(([, outcome]) => outcome)).toEqual(["unmapped"]);
  });
});

// Oracle: CSS Display 3 §2.3, where `display: list-item` is a block box with a marker, and CSS 2.1
// §10.3.3, where a block-level box with no width fills its block container. Tailwind preflight's
// `list-style: none` on the list leaves the item no marker, so the item lays out as a block box: a
// block-level `flex` row inside it fills it.
describe("a list item, as the browser's default style sheet displays an `<li>`", () => {
  const ITEM: PartDefinition = {
    key: "item",
    slot: undefined,
    element: { tag: "li", attributes: {} },
    shownIn: () => true,
    classesFor: () => "",
    label: undefined,
    iconsFor: () => [],
    elementDefaults: [{ className: "user agent style sheet, li", property: "display", value: "list-item" }],
    parts: [{ ...dot("flex h-[32px]"), key: "row", slot: "chip-row" }],
  };

  it("stacks its block-level part as a block box does, the part filling it", async () => {
    const { variant, coverage } = await buildFixture(chip("grid w-[256px] gap-[4px]", { parts: [ITEM] }));
    const item = variant?.root.children[0];
    const row = item?.kind === "frame" ? item.children[0] : undefined;
    expect([
      item?.kind === "frame" ? item.sizing.horizontal : undefined,
      row?.kind === "frame" ? row.sizing.horizontal : undefined,
    ]).toEqual([FILL, FILL]);
    expect(notesOf(coverage, "user agent style sheet, li").map(([, outcome]) => outcome)).toEqual([
      "literal",
    ]);
  });
});
