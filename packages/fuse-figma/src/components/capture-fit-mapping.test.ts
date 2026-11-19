/**
 * How the build sizes a flex row's part from its content and the room the row leaves it, as
 * Checkbox card's label grows across its content row and its text column sits beside its control.
 * The unit under test is `buildComponentSet` on hand-built captures (`test/capture-fixtures.ts`), whose
 * `div`s set `block` as the browser's style sheet does.
 * Oracles, measured in Chromium on 2026-11-19 with 16px Arial on 24px lines:
 *
 * - CSS Flexbox 1 §7.2.3 and §9.7: a 300px row's one `flex-grow: 1` layer is 300px wide around
 *   `Short`, and 300px, two lines, around a 73-character sentence. With `flex-shrink: 0` it is
 *   519.4px wide around the sentence, past the row. A `flex-grow: 0.5` layer is 169.1px wide around
 *   `Short`, half the free space, and with `flex-shrink: 0.5` a growing layer is 413.7px wide around
 *   the sentence, past the row. A `flex: none` layer that sets `flex-grow: 1` computes `1 0 auto` and
 *   is 675px wide around a 95-character sentence. A `flex-grow: 1` layer centering a 400px icon that
 *   does not shrink is 400px wide, past the row. With a 50px margin to a side, a growing layer around
 *   a 250px icon is 250px wide, past the 200px the margins leave.
 * - CSS Flexbox 1 §9.7 and CSS Sizing 3 §5.1: beside a `shrink-0` 24px control and a 12px gap, a
 *   300px row's last column is 90.7px wide around `Insurance` and `Covers theft.`, its content, and
 *   264px, the room the row leaves, around the sentence, which wraps to two lines. Where the control
 *   can shrink, Chromium shrinks it to 16px and sets the column at 272px. A red block in the column
 *   is 90.7px wide, where the column's fill would be 264px, and a `text-center` title centers in a
 *   227.7px column, not in the room. Around the sentence, a title with a 400px minimum widens the
 *   column to 400px, and one with a 200px minimum leaves it at the room's 264px. A 400px-wide title
 *   widens it to 400px too. Turned 180° about its centre, the column's title starts at 64.4px
 *   fitted and at 237.7px in the room. A column that shrinks by 0.5 is 406.8px wide
 *   around a longer sentence, past the room; this row's short text fits, so its case refuses the
 *   factor on that guarantee rather than on a width it draws. Around the 95-character sentence a
 *   title that does not wrap, by `white-space: nowrap`, `pre` or `truncate`'s ellipsis, widens the
 *   column to 675px. Where the control has a 100px minimum, it is 100px wide, and a title with a
 *   200px minimum keeps the column at 200px, past the 188px the control leaves. The column's
 *   least width passes the room by its own padding, its gap or a stroke inside it: 350.3px with 140px
 *   of padding to a side, 320px as a row of two 10px blocks 300px apart, and 280px around an empty
 *   `w-fit` box with a 140px border. Laid out as a column that centers its layers, a title that
 *   fills the column up to a 100px maximum starts at 36px fitted and at 118px in the room.
 * - CSS Flexbox 1 §7: `flex` applies only to a flex item, so a block's part sizes nothing by it.
 * - The coverage contract: a part whose fitted width the build does not draw keeps a row unmapped.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, FILL, HUG, ICON, notesOf, part } from "../../test/capture-fixtures";
import type { FixtureElement } from "../../test/capture-fixtures";
import type { LabelManifest, PartManifest } from "../capture/manifest";
import { makeVariableIndex } from "./css-values";
import type { ChildLayerSpec } from "./kit-spec";

/** The synced font family the type reads. */
const FONTS = {
  variables: makeVariableIndex([
    { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
  ]),
};

/** The font family, and a density length that spans 200px to 400px across its modes. */
const WITH_DENSITY = {
  variables: makeVariableIndex([
    { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
    {
      ref: { collection: "Fuse density", name: "column-min" },
      webSyntax: "var(--column-min)",
      minimum: 200,
      maximum: 400,
    },
  ]),
};

/** The type the root passes its parts. */
const TYPE = "font-sans text-[16px] leading-[24px] text-[#000000]";

/** A text a TEXT property sets. */
function text(characters: string, textProperty: string): LabelManifest {
  return { key: "text", name: "text", characters, textProperty, shownIn: () => true };
}

/** A layer's horizontal sizing, or undefined for an icon. */
function across(layer: ChildLayerSpec | undefined) {
  return layer === undefined || layer.kind === "icon" ? undefined : layer.sizing.horizontal;
}

/** The rows of a build's coverage that stay unmapped, by class, property and detail. */
function unmapped(
  coverage: readonly { outcome: string; className: string; property: string; detail: string }[]
) {
  return coverage
    .filter((row) => row.outcome === "unmapped")
    .map((row) => [row.className, row.property, row.detail] as const);
}

describe("a flex row's one layer that grows from its content", () => {
  /**
   * Build a 300px row around one part with the given classes, holding `Short`.
   *
   * @param classes - The row's and the part's classes.
   */
  function buildLone(classes: { readonly row?: string; readonly part: string }) {
    return buildCaptured(
      chip({ parts: [part({ key: "item", slot: "item", label: text("Short", "Label") })] }),
      [
        {
          cell: { state: "rest" },
          root: {
            slot: "chip",
            classes: `${classes.row ?? "flex w-[300px]"} ${TYPE}`,
            children: [{ slot: "item", classes: classes.part, text: "Short" }],
          },
        },
      ],
      FONTS
    );
  }

  it("fills the row", async () => {
    const { variant, coverage } = await buildLone({ part: "grow" });
    expect([across(variant?.root.children[0]), notesOf(coverage, "grow")]).toEqual([
      FILL,
      [
        [
          "flex-grow",
          "literal",
          "the row's one layer grows from its content into all the room the row has, and shrinks to it where its content is wider, which a fill takes",
        ],
      ],
    ]);
  });

  // Each case keeps the layer from being the row's width, so `flex-grow`, the part's first class, stays unread.
  it.each([
    ["it does not shrink, and overflows the row around wider content", { part: "grow shrink-0" }],
    ["it grows by less than 1, so it takes only part of the free space", { part: "grow-[0.5]" }],
    ["it shrinks by less than 1, so it gives back only part of the overflow", { part: "grow shrink-[0.5]" }],
    ["it sets a basis of its own", { part: "grow basis-[100px]" }],
    ["it sets a width of its own", { part: "grow w-[100px]" }],
    ["it sets a maximum width", { part: "grow max-w-[100px]" }],
    ["it sets a minimum width", { part: "grow min-w-[400px]" }],
    ["it sets a `flex` shorthand, whose shrink of 0 overflows the row", { part: "grow flex-none" }],
    ["it sets a margin across, which takes room from the fill", { part: "grow mx-[50px]" }],
    ["the row hugs it", { row: "flex w-fit", part: "grow" }],
  ])("keeps flex-grow unmapped where %s", async (_case, classes) => {
    const { coverage } = await buildLone(classes);
    const [grow = ""] = classes.part.split(" ");
    expect(notesOf(coverage, grow).map(([property, outcome]) => [property, outcome])).toEqual([
      ["flex-grow", "unmapped"],
    ]);
  });

  it("keeps the layer's width unmapped where its least width is wider than the row", async () => {
    const { coverage } = await buildCaptured(
      chip({ parts: [part({ key: "item", slot: "item", iconsFor: () => [ICON] })] }),
      [
        {
          cell: { state: "rest" },
          root: {
            slot: "chip",
            classes: `flex w-[300px] ${TYPE}`,
            children: [
              {
                slot: "item",
                classes: "grow flex items-center justify-center",
                children: [{ tag: "svg", classes: "size-[400px] shrink-0" }],
              },
            ],
          },
        },
      ],
      FONTS
    );
    expect(unmapped(coverage)).toContainEqual([
      "grow",
      "width",
      "the row's one layer grows into the row and keeps its least width, and that width may be wider than the row in a mode or is unknown, so the layer would draw wider than the fill",
    ]);
  });
});

describe("a flex row's last part that fits its content to the room beside a control", () => {
  /** The control: a 24px box that keeps its width. */
  const CONTROL: PartManifest = part({ key: "control", slot: "control" });

  /** The column: the title and the description, each a block of its own text. */
  const COLUMN: PartManifest = part({
    key: "column",
    slot: "column",
    parts: [
      part({ key: "title", slot: "title", label: text("Insurance", "Title") }),
      part({ key: "description", slot: "description", label: text("Covers theft.", "Description") }),
    ],
  });

  /** A part after the column, which a case adds. */
  const AFTER: PartManifest = part({ key: "after", slot: "after" });

  /** An empty box after the description, inside the column, which a case adds. */
  const MARK: PartManifest = part({ key: "mark", slot: "mark" });

  /**
   * Build a 300px row around the control and the column, and the part after it where a case adds
   * one.
   *
   * @param classes - The classes of the row, the control, the column, `block` by default, the title
   *   and the description, and of a box inside the column and a part after it.
   */
  function buildRow(classes: {
    readonly row?: string;
    readonly control?: string;
    readonly column?: string;
    readonly title?: string;
    readonly description?: string;
    readonly mark?: string;
    readonly after?: string;
  }) {
    const after: readonly FixtureElement[] =
      classes.after === undefined ? [] : [{ slot: "after", classes: classes.after }];
    const mark: readonly FixtureElement[] =
      classes.mark === undefined ? [] : [{ tag: "div", slot: "mark", classes: classes.mark }];
    const column: PartManifest =
      classes.mark === undefined ? COLUMN : { ...COLUMN, parts: [...(COLUMN.parts ?? []), MARK] };
    return buildCaptured(
      chip({ parts: [CONTROL, column, ...(classes.after === undefined ? [] : [AFTER])] }),
      [
        {
          cell: { state: "rest" },
          root: {
            slot: "chip",
            classes: `${classes.row ?? "flex w-[300px] items-center gap-[12px]"} ${TYPE}`,
            children: [
              { slot: "control", classes: classes.control ?? "size-[24px] shrink-0" },
              {
                tag: "div",
                slot: "column",
                classes: classes.column ?? "block",
                children: [
                  { tag: "div", slot: "title", classes: `block ${classes.title ?? ""}`, text: "Insurance" },
                  {
                    tag: "div",
                    slot: "description",
                    classes: `block ${classes.description ?? ""}`,
                    text: "Covers theft.",
                  },
                  ...mark,
                ],
              },
              ...after,
            ],
          },
        },
      ],
      WITH_DENSITY
    );
  }

  it.each([
    ["", {}],
    [", and a minimum width inside it within the room changes nothing", { title: "min-w-[200px]" }],
  ])(
    "draws the column as a fill whose texts fill it, so a longer text wraps at the room%s",
    async (_case, classes) => {
      const { variant, coverage } = await buildRow(classes);
      const column = variant?.root.children[1];
      const texts =
        column?.kind === "frame"
          ? column.children.map((block) => (block.kind === "frame" ? across(block.children[0]) : undefined))
          : [];
      expect({ column: across(column), texts, unmapped: unmapped(coverage) }).toEqual({
        column: FILL,
        texts: [FILL, FILL],
        unmapped: [],
      });
    }
  );

  // The column takes no fill where CSS sizes it otherwise than fitting it to the room it is drawn at.
  it.each([
    ["the control can shrink too", { control: "size-[24px]" }],
    ["the row packs its layers at its end", { row: "flex w-[300px] items-center justify-end gap-[12px]" }],
    ["a part follows the column", { after: "size-[24px] shrink-0" }],
    [
      "the column shrinks by less than 1, so it gives back only part of the overflow",
      { column: "block shrink-[0.5]" },
    ],
    [
      "the control's minimum widens it past its width, so the room is narrower than the row leaves the width",
      { control: "size-[24px] shrink-0 min-w-[100px]", title: "min-w-[200px]" },
    ],
  ])("keeps the column hugging where %s", async (_case, classes) => {
    const { variant } = await buildRow(classes);
    expect(across(variant?.root.children[1])).toEqual(HUG);
  });

  // The fill would draw the column's content wider or elsewhere than its fitted width does.
  it.each([
    ["a block in it paints", { description: "bg-[#ff0000]" }],
    ["a text in it is centered", { title: "text-center" }],
    ["it turns about its centre", { column: "block rotate-180" }],
    [
      "it centers a text that fills it up to a width cap",
      { column: "flex flex-col items-center", title: "w-full max-w-[100px]", description: "w-full" },
    ],
    ["a minimum width inside it exceeds the room", { title: "min-w-[400px]" }],
    ["a width inside it exceeds the room", { title: "w-[400px]" }],
    ["a minimum width inside it exceeds the room in a mode", { title: "min-w-[var(--column-min)]" }],
    ["a text in it does not wrap", { title: "whitespace-nowrap" }],
    ["a text in it keeps its white space and does not wrap", { title: "whitespace-pre" }],
    ["a text in it ends in an ellipsis on one line", { title: "truncate" }],
    ["its padding exceeds the room", { column: "block px-[140px]" }],
    [
      "the gap between its layers exceeds the room",
      { column: "flex justify-start gap-[300px]", title: "w-[10px]", description: "w-[10px]" },
    ],
    [
      "a stroke inside it exceeds the room",
      { mark: "block w-fit border-[140px] border-solid border-[#000000]" },
    ],
  ])("keeps the column's width unmapped where %s", async (_case, classes) => {
    const { coverage } = await buildRow(classes);
    expect(unmapped(coverage).map(([, property, detail]) => [property, detail])).toContainEqual([
      "width",
      "the part fits its content to the room the row leaves it, and a fill draws that room, where it or a layer inside it paints, turns, does not start at its start, holds a text that does not wrap or may be wider than the room, so it would draw wider or elsewhere",
    ]);
  });
});

describe("a block's part that sets a flex", () => {
  it("drops the flex, which sizes no part of a block", async () => {
    const { coverage } = await buildCaptured(
      chip({
        parts: [
          part({
            key: "column",
            slot: "column",
            parts: [part({ key: "title", slot: "title", label: text("Insurance", "Title") })],
          }),
        ],
      }),
      [
        {
          cell: { state: "rest" },
          root: {
            slot: "chip",
            classes: `block w-[300px] ${TYPE}`,
            children: [
              {
                tag: "div",
                slot: "column",
                classes: "flex flex-1 flex-col",
                children: [{ tag: "div", slot: "title", text: "Insurance" }],
              },
            ],
          },
        },
      ],
      FONTS
    );
    expect(notesOf(coverage, "flex-1")).toEqual([
      [
        "flex",
        "dropped",
        "the part's box is a block container, so the part is no flex item and its flex sizes nothing (CSS Flexbox 1 §7)",
      ],
    ]);
  });
});
