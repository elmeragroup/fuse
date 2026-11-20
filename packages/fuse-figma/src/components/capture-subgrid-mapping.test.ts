/**
 * How the build draws a list whose items each span its columns `min(50%, <length>) auto` as a
 * subgrid of two cells, as Description list's responsive layout does. The unit under test is
 * `buildComponentSet` on hand-built captures (`test/capture-fixtures.ts`). Oracles:
 *
 * - CSS Grid 1 §7.2.4 and §11.8: the first column is `min(50%, 20rem)` of the list's width and the
 *   `auto` column stretches over the rest, so Chromium sets a 576px list's cells at 288 and 288 and an
 *   800px list's at 320 and 480 (measured 2026-11-19). An item that spans `1 / -1` is as wide as the
 *   list, and a subgrid's cells share its columns (CSS Grid 2 §9).
 * - Probes DL2 and DL3 (2026-11-19): in a horizontal auto layout, two FILL layers split the row
 *   evenly whatever they hold, and a `maxWidth` of 320 on the first gave 320 and 480 at 800 and 288
 *   and 288 at 576, the widths above. So the first cell draws FILL with that `maxWidth` and the
 *   second FILL.
 * - CSS Box Alignment 3 §6.1: each cell stretches to its row's height, which draws as the cell at its
 *   own height from the row's top only where the cell paints nothing.
 * - Chromium's widths for the refused borders and writing modes (measured 2026-11-19): an 8px border on
 *   every side of the Item sets an 800px list's cells at 312 and 472, not 320 and 480, and under
 *   `writing-mode: vertical-rl` the list sets an Item's cells one under the other, each 800px across.
 * - The coverage contract: an Item the build does not draw keeps its `display` unmapped.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, FILL, HUG, literal, notesOf, part } from "../../test/capture-fixtures";
import type { FixtureElement } from "../../test/capture-fixtures";
import type { LabelManifest, SetManifest } from "../capture/manifest";
import { makeVariableIndex } from "./css-values";
import type { ChildLayerSpec } from "./kit-spec";

/** The list's own classes: two columns, the first at most half the list and 20rem. */
const LIST = "grid grid-cols-[min(50%,20rem)_auto]";

/** The synced font family the type reads. */
const FONTS = {
  variables: makeVariableIndex([
    { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
  ]),
};

/** The type the list passes its cells. */
const TYPE = "font-sans text-[14px] leading-[24px] text-[#000000]";

/** An Item's own classes, as Description list's responsive Item sets them. */
const ITEM = "col-span-full grid grid-cols-subgrid border-t border-[#000000]";

/** A text a TEXT property sets. */
function text(characters: string, textProperty: string): LabelManifest {
  return { key: "text", name: "text", characters, textProperty, shownIn: () => true };
}

/** The term and details parts of an Item. */
const CELLS = [
  part({ key: "term", slot: "term", label: text("Name", "Term") }),
  part({ key: "details", slot: "details", label: text("Kari Nordmann", "Details") }),
];

/** An Item's elements: its term and details, with the given classes. */
function cells(term: string, details: string): readonly FixtureElement[] {
  return [
    { tag: "dt", slot: "term", classes: term, text: "Name" },
    { tag: "dd", slot: "details", classes: details, text: "Kari Nordmann" },
  ];
}

/** The term's and details' classes, as Description list's responsive cells set them. */
const TERM = "col-start-1 py-[6px] pr-[8px]";
const DETAILS = "col-start-2 ms-0 py-[6px]";

/** The Item set: an Item 576px wide in a list around it. */
const ITEM_SET: SetManifest = chip({ previewWidth: 576, parts: CELLS });

/**
 * Build an Item as the root of its set, in a list of the given classes.
 *
 * @param classes - The list's, the Item's, the term's and the details' classes.
 * @returns The built set.
 */
function buildItem(classes: {
  readonly list?: string;
  readonly item?: string;
  readonly term?: string;
  readonly details?: string;
}) {
  return buildCaptured(
    ITEM_SET,
    [
      {
        cell: { state: "rest" },
        around: [{ tag: "dl", classes: `${classes.list ?? LIST} ${TYPE}` }],
        root: {
          slot: "chip",
          classes: classes.item ?? ITEM,
          children: cells(classes.term ?? TERM, classes.details ?? DETAILS),
        },
      },
    ],
    FONTS
  );
}

/** A layer's sizing and limits, or undefined for an icon. */
function sized(layer: ChildLayerSpec | undefined) {
  return layer === undefined || layer.kind === "icon" || layer.kind === "text" || layer.kind === "instance"
    ? undefined
    : { sizing: layer.sizing, maxWidth: layer.limits.maxWidth };
}

describe("an Item of a list in columns min(50%, 20rem) auto", () => {
  it("draws a row whose first cell fills it up to 320 and whose second fills the rest", async () => {
    const { variant, coverage } = await buildItem({});
    const root = variant?.root;
    const [term, details] = root?.children ?? [];
    expect({
      direction: root?.direction,
      primaryAlign: root?.primaryAlign,
      counterAlign: root?.counterAlign,
      itemSpacing: root?.itemSpacing,
      term: sized(term),
      details: sized(details),
    }).toEqual({
      direction: "HORIZONTAL",
      primaryAlign: "MIN",
      counterAlign: "MIN",
      itemSpacing: literal(0),
      term: { sizing: { horizontal: FILL, vertical: HUG }, maxWidth: literal(320) },
      details: { sizing: { horizontal: FILL, vertical: HUG }, maxWidth: undefined },
    });
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  it("drops each cell's column start, which places it in source order", async () => {
    const { coverage } = await buildItem({});
    expect([
      notesOf(coverage, "col-start-1").map(([property, outcome]) => [property, outcome]),
      notesOf(coverage, "col-start-2").map(([property, outcome]) => [property, outcome]),
    ]).toEqual([[["grid-column-start", "dropped"]], [["grid-column-start", "dropped"]]]);
  });

  // Each case changes what the even split of two FILL layers draws, so the Item stays unmapped.
  it.each([
    ["a share of the list other than half", { list: "grid grid-cols-[min(40%,20rem)_auto]" }],
    ["a column gap, which takes its share before the split", { list: `${LIST} gap-x-[16px]` }],
    ["cells out of source order", { term: "col-start-2 py-[6px]", details: "col-start-1 py-[6px]" }],
    ["a cell that paints, which the row's stretch would show", { term: `${TERM} bg-[red]` }],
    ["inline padding, which narrows the edge columns", { item: `${ITEM} px-[8px]` }],
    ["a gap shorthand, whose column gap takes its share", { list: `${LIST} gap-[16px]` }],
    ["a gap shorthand on the Item", { item: `${ITEM} gap-[16px]` }],
    ["an inline margin, which narrows an edge column", { item: `${ITEM} ml-[8px]` }],
    ["a width, which a subgrid ignores across its columns", { item: `${ITEM} w-[400px]` }],
    ["a max-width, which a subgrid ignores across its columns", { item: `${ITEM} max-w-[400px]` }],
    ["a flex cell, which centers its text in the stretched row", { term: `${TERM} flex items-center` }],
    ["a block cell that centers its content down the row", { term: `${TERM} content-center` }],
    ["a cell that spans both columns", { term: "col-span-2 py-[6px]" }],
    ["a place-items on the Item", { item: `${ITEM} place-items-center` }],
    ["a place-content on the list", { list: `${LIST} place-content-center` }],
    ["a place-items on the list", { list: `${LIST} place-items-center` }],
    ["a place-self on the Item", { item: `${ITEM} place-self-center` }],
    ["a place-content on a cell", { term: `${TERM} place-content-center` }],
    ["a min-width on the Item", { item: `${ITEM} min-w-[400px]` }],
    ["a right margin on the Item", { item: `${ITEM} mr-[8px]` }],
    ["a border width on every side of the Item", { item: `${ITEM} border-[8px]` }],
    ["a border shorthand on the Item", { item: `${ITEM} [border:8px_solid_black]` }],
    ["an inline border on the Item", { item: `${ITEM} border-x-[8px]` }],
    ["a bottom border on the Item", { item: `${ITEM} border-b-[8px]` }],
    ["a border width on every side of a cell", { term: `${TERM} border-[8px] border-[#000000]` }],
    ["a block border on a cell", { term: `${TERM} border-y-[8px] border-[#000000]` }],
    ["a vertical writing mode on the list", { list: `${LIST} [writing-mode:vertical-rl]` }],
    ["a vertical writing mode on a cell", { term: `${TERM} [writing-mode:vertical-lr]` }],
  ])("keeps the Item unmapped for %s", async (_case, classes) => {
    const { coverage } = await buildItem(classes);
    expect(
      coverage.filter(
        (row) => row.part === "chip" && row.property === "display" && row.outcome === "unmapped"
      )
    ).toHaveLength(1);
  });
});

/**
 * Build a list of two Items as the root of its set.
 *
 * @param list - The list's classes.
 * @returns The built set.
 */
function buildList(list: string) {
  const item = (key: string) => part({ key, slot: key, parts: CELLS.map((cell) => ({ ...cell })) });
  return buildCaptured(
    chip({ previewWidth: 576, parts: [item("first"), item("second")] }),
    [
      {
        cell: { state: "rest" },
        root: {
          tag: "dl",
          slot: "chip",
          classes: `${list} ${TYPE}`,
          children: ["first", "second"].map((slot) => ({
            slot,
            classes: ITEM,
            children: cells(TERM, DETAILS),
          })),
        },
      },
    ],
    FONTS
  );
}

describe("a list whose items each span its columns min(50%, 20rem) auto", () => {
  it("draws a column whose Items fill it, each a row of its two cells", async () => {
    const { variant, coverage } = await buildList(LIST);
    const root = variant?.root;
    const items = root?.children ?? [];
    expect({
      direction: root?.direction,
      items: items.map((layer) =>
        layer.kind === "frame"
          ? { direction: layer.direction, sizing: layer.sizing, cells: layer.children.map(sized) }
          : undefined
      ),
    }).toEqual({
      direction: "VERTICAL",
      items: [
        {
          direction: "HORIZONTAL",
          sizing: { horizontal: FILL, vertical: HUG },
          cells: [
            { sizing: { horizontal: FILL, vertical: HUG }, maxWidth: literal(320) },
            { sizing: { horizontal: FILL, vertical: HUG }, maxWidth: undefined },
          ],
        },
        {
          direction: "HORIZONTAL",
          sizing: { horizontal: FILL, vertical: HUG },
          cells: [
            { sizing: { horizontal: FILL, vertical: HUG }, maxWidth: literal(320) },
            { sizing: { horizontal: FILL, vertical: HUG }, maxWidth: undefined },
          ],
        },
      ],
    });
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  // Under a vertical writing mode Chromium sets an Item's cells one under the other, not side by side.
  it("keeps the list unmapped for a vertical writing mode", async () => {
    const { coverage } = await buildList(`${LIST} [writing-mode:vertical-rl]`);
    expect(
      coverage.filter(
        (row) => row.part === "chip" && row.property === "display" && row.outcome === "unmapped"
      )
    ).toHaveLength(1);
  });
});
