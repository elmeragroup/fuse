/**
 * How the build sizes a flex row's part from its content and the room the row leaves it, as
 * Checkbox card's label grows across its content row and its text column sits beside its control, and
 * as File upload's description, Card's footer paragraph and Radio row's label fit their own text.
 * The unit under test is `buildSetsInOrder` on hand-built captures (`test/capture-fixtures.ts`), whose
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
 * - CSS Flexbox 1 §9.7 and CSS Sizing 3 §5.1, for a part that holds its own text: beside the 24px
 *   control and the 12px gap, a 300px row's last paragraph is 90.7px wide around `Covers theft.`
 *   and 264px, two lines, around a 70-character sentence. Alone in the row it is 90.7px and 300px,
 *   two lines. Around the sentence, a row that hugs it sets it 469.6px wide, on one line, and a
 *   400px minimum at 400px. A `<textarea>` with no padding or border is 176px wide, its 20 default
 *   columns, around `Short` and around the sentence alike (HTML §4.10.11). A `<button>` in the
 *   paragraph's place is 90.7px and 264px wide, as the paragraph is. A label that centres a
 *   16px control and a 50px box that keeps its width, 8px apart, is 74px wide.
 *   Measured on 2026-11-20: with `margin: 0` the paragraph is the same 264px. Beside a 32px control whose width reads a
 *   variable it is 256px, and beside the 24px control with a 12px right margin 252px, both the room
 *   a fill takes. A -4px right margin on the control gives it 268px, which no padding draws.
 * - The same rule beside a `shrink-0` 16px icon in the control's place, as Toast's status icon sits
 *   before its text column: the icon keeps its width, so the room is the row's less it. An icon that
 *   can shrink gives back part of the overflow, as the control does, so the room is unknown. A 100px
 *   basis or minimum on the icon widens it to 100px in Chromium, which leaves the column 192px and
 *   three lines of the sentence where a fill would take 276px, and a -4px margin, which no padding
 *   draws, leaves it 280px. A margin that resolves to no length leaves the icon's width unknown.
 * - CSS Flexbox 1 §9.7 and CSS Sizing 3 §5.1, for the first of two layers a row spaces between its
 *   ends, as Tour's header holds its title before Close: in a 300px `justify-between` row with an
 *   8px gap, a title before a `shrink-0` 24px control is 268px wide, two lines, around the sentence,
 *   with the control at 276px, and beside a 32px control whose width reads a variable, 260px. With
 *   a zero margin it is the same 268px. Around `Covers theft.` it is 90.7px wide at the row's start
 *   with the control still at 276px, where a fill of the 268px room draws it too. A control 10%
 *   wide is 30px, a share of the row that no Figma width holds. A 12px left margin on the control
 *   leaves the title 256px, and a 32px gap 244px, both the room a fill takes. A -4px right margin
 *   on the control gives the title 272px, which no padding draws. Where the row
 *   packs from its start, the control sits right after that title, at 98.7px. A control that can
 *   shrink gives back part of the overflow: it shrinks to 14.2px and the title is 277.8px. A 40px
 *   left margin sets the title at 40px, 228px wide on three lines. A third layer sits at 171.4px,
 *   between the title and the last. A reversed row puts the title at 209.3px, a wrapping row puts
 *   the control on a line of its own, and a row that hugs sets the title on one line, 469.6px wide.
 *   A `text-center` title around `Covers theft.` centers its text in its 90.7px box, at the row's
 *   start, where a fill centers it in the room.
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

/**
 * The font family, a density length that spans 200px to 400px across its modes, and a control
 * height that spans 24px to 40px, as an `icon-sm` Icon button's square size reads `--control-h-sm`.
 */
const WITH_DENSITY = {
  variables: makeVariableIndex([
    { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
    {
      ref: { collection: "Fuse density", name: "column-min" },
      webSyntax: "var(--column-min)",
      minimum: 200,
      maximum: 400,
    },
    {
      ref: { collection: "Fuse density", name: "control-h" },
      webSyntax: "var(--control-h)",
      minimum: 24,
      maximum: 40,
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
    [
      ", and its zero minimum width only lets it shrink to the room, as a fill does",
      { column: "block min-w-0" },
    ],
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
    ["its own minimum width is more than zero", { column: "block min-w-[10px]" }],
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

describe("a flex row's last part that fits its content to the room beside an icon", () => {
  /**
   * Build a 300px row around a 16px icon and the column after it, as Toast's status icon sits before
   * its text column.
   *
   * @param icon - The icon's classes.
   */
  function buildBesideIcon(icon: string) {
    return buildCaptured(
      chip({
        iconsFor: () => [ICON],
        parts: [
          {
            ...part({
              key: "column",
              slot: "column",
              parts: [part({ key: "title", slot: "title", label: text("Insurance", "Title") })],
            }),
            after: "label",
          },
        ],
      }),
      [
        {
          cell: { state: "rest" },
          root: {
            slot: "chip",
            classes: `flex w-[300px] items-start gap-[8px] ${TYPE}`,
            children: [
              { tag: "svg", classes: icon },
              {
                tag: "div",
                slot: "column",
                classes: "flex min-w-0 flex-col",
                children: [{ tag: "div", slot: "title", classes: "block", text: "Insurance" }],
              },
            ],
          },
        },
      ],
      WITH_DENSITY
    );
  }

  it("draws the column as a fill after an icon of a literal size that does not shrink", async () => {
    const { variant, coverage } = await buildBesideIcon("size-[16px] shrink-0");
    const [icon, column] = variant?.root.children ?? [];
    expect({ icon: icon?.kind, column: across(column), unmapped: unmapped(coverage) }).toEqual({
      icon: "icon",
      column: FILL,
      unmapped: [],
    });
  });

  it.each([
    ["whose size reads a variable, so the room is unknown", "size-[var(--column-min)] shrink-0"],
    ["that can shrink too", "size-[16px]"],
    ["whose basis widens it past its size", "size-[16px] shrink-0 basis-[100px]"],
    ["whose minimum widens it past its size", "size-[16px] shrink-0 min-w-[100px]"],
    [
      "whose negative margin, which no frame draws, pulls the column closer",
      "size-[16px] shrink-0 -mr-[4px]",
    ],
    [
      "whose margin no length resolves, so its outer width is unknown",
      "size-[16px] shrink-0 mr-[var(--unknown)]",
    ],
  ])("keeps the column hugging after an icon %s", async (_case, icon) => {
    const { variant } = await buildBesideIcon(icon);
    expect(across(variant?.root.children[1])).toEqual(HUG);
  });
});

describe("a flex row's last part that holds its own text, or sits alone in its row", () => {
  /** The sentence that wraps in each room these rows leave. */
  const SENTENCE = "Settled on 3 April, and the invoice was paid in full by bank transfer.";

  /** The 24px box beside the text, which keeps its width. */
  const CONTROL: PartManifest = part({ key: "control", slot: "control" });

  /** A part that holds its own text. */
  const NOTE: PartManifest = part({ key: "note", slot: "note", label: text(SENTENCE, "Note") });

  /**
   * Build a 300px row around a part that holds its own text, after the control where `control` is
   * given.
   *
   * @param classes - The classes of the row, the control and the part, `block` by default, and the
   *   part's tag, `p` by default.
   */
  function buildText(classes: {
    readonly row?: string;
    readonly control?: string;
    readonly note?: string;
    readonly tag?: string;
  }) {
    const control: readonly FixtureElement[] =
      classes.control === undefined ? [] : [{ slot: "control", classes: classes.control }];
    return buildCaptured(
      chip({ parts: [...(classes.control === undefined ? [] : [CONTROL]), NOTE] }),
      [
        {
          cell: { state: "rest" },
          root: {
            slot: "chip",
            classes: `${classes.row ?? "flex w-[300px] items-center gap-[12px]"} ${TYPE}`,
            children: [
              ...control,
              {
                tag: classes.tag ?? "p",
                slot: "note",
                classes: `block ${classes.note ?? ""}`,
                text: SENTENCE,
              },
            ],
          },
        },
      ],
      WITH_DENSITY
    );
  }

  /** The note's layer and its text's, and the rows that stay unmapped. */
  async function noteOf(classes: Parameters<typeof buildText>[0]) {
    const { variant, coverage } = await buildText(classes);
    const note = variant?.root.children.at(-1);
    return {
      note: across(note),
      text: note?.kind === "frame" ? across(note.children[0]) : undefined,
      unmapped: unmapped(coverage),
    };
  }

  it.each([
    ["beside a control", { control: "size-[24px] shrink-0" }],
    ["alone in its row", {}],
    ["as a button beside a control", { control: "size-[24px] shrink-0", tag: "button" }],
    ["with a zero margin across beside a control", { control: "size-[24px] shrink-0", note: "m-0" }],
    [
      "beside a control whose width binds a synced variable",
      { control: "w-[var(--control-h)] h-[24px] shrink-0" },
    ],
    ["beside a control with a margin across", { control: "size-[24px] shrink-0 mr-[12px]" }],
  ])("draws the text part %s as a fill whose text fills it", async (_case, classes) => {
    expect(await noteOf(classes)).toEqual({ note: FILL, text: FILL, unmapped: [] });
  });

  // The part takes no fill where CSS sizes it otherwise than fitting it to the room it is drawn at.
  it.each([
    ["the row hugs it", { row: "flex w-fit" }],
    ["it sets a minimum width of its own", { note: "min-w-[400px]" }],
    [
      "the control's negative margin gives it room no padding draws",
      { control: "size-[24px] shrink-0 -mr-[4px]" },
    ],
  ])("keeps the text part hugging where %s", async (_case, classes) => {
    expect((await noteOf(classes)).note).toEqual(HUG);
  });

  // A textarea is 176px wide around any text, so the fit leaves it to the control's own sizing, which
  // refuses a hugging control whose text wraps.
  it("leaves a textarea's width to the control, which a fill would draw at the room", async () => {
    await expect(buildText({ tag: "textarea" })).rejects.toThrow(
      "the control wraps its text at its width, so its box needs a fixed or filling width"
    );
  });

  /**
   * Build a 300px row around one label that centres a 16px control and its content down the row, as
   * Radio row's label does, and along it by `justify-center`. CSS sizes the label to its layers, so
   * the centring shows only in a label drawn at the room the row leaves.
   *
   * @param content - The content's classes.
   */
  function buildLabel(content: string) {
    return buildCaptured(
      chip({
        parts: [
          part({
            key: "label",
            slot: "label",
            parts: [
              part({ key: "control", slot: "control" }),
              part({ key: "content", slot: "content", label: text(SENTENCE, "Label") }),
            ],
          }),
        ],
      }),
      [
        {
          cell: { state: "rest" },
          root: {
            slot: "chip",
            classes: `flex w-[300px] ${TYPE}`,
            children: [
              {
                tag: "label",
                slot: "label",
                classes: "flex items-center justify-center gap-[8px]",
                children: [
                  { slot: "control", classes: "size-[16px] shrink-0" },
                  { slot: "content", classes: `block ${content}`, text: SENTENCE },
                ],
              },
            ],
          },
        },
      ],
      WITH_DENSITY
    );
  }

  it("keeps the label's width unmapped where it centres layers that keep their width", async () => {
    const { coverage } = await buildLabel("w-[50px] shrink-0");
    expect(unmapped(coverage).map(([, property, detail]) => [property, detail])).toContainEqual([
      "width",
      "the part fits its content to the room the row leaves it, and a fill draws that room, where it or a layer inside it paints, turns, does not start at its start, holds a text that does not wrap or may be wider than the room, so it would draw wider or elsewhere",
    ]);
  });
});

describe("a flex row's first part that holds its own text before a layer that ends the row", () => {
  /** The sentence that wraps in the room beside the control. */
  const SENTENCE = "Settled on 3 April, and the invoice was paid in full by bank transfer.";

  /** The title, a part that holds its own text, as Tour's title does. */
  const TITLE: PartManifest = part({ key: "title", slot: "title", label: text(SENTENCE, "Title") });

  /** The controls after the title, the 24px box that keeps its width, and a second one. */
  const CONTROLS: readonly PartManifest[] = [
    part({ key: "control", slot: "control" }),
    part({ key: "more", slot: "more" }),
  ];

  /**
   * Build a 300px row that spaces a title and a control between its ends, 8px apart, as Tour's
   * header holds its title and Close.
   *
   * @param classes - The classes of the row, the title and the control, the title's text, and
   *   whether a second control follows the first.
   */
  function buildHeader(classes: {
    readonly row?: string;
    readonly title?: string;
    readonly control?: string;
    readonly characters?: string;
    readonly third?: boolean;
  }) {
    const characters = classes.characters ?? SENTENCE;
    const third = classes.third === true;
    return buildCaptured(
      chip({ parts: [{ ...TITLE, label: text(characters, "Title") }, ...CONTROLS.slice(0, third ? 2 : 1)] }),
      [
        {
          cell: { state: "rest" },
          root: {
            slot: "chip",
            classes: `${classes.row ?? "flex w-[300px] items-center justify-between gap-[8px]"} ${TYPE}`,
            children: [
              { tag: "h2", slot: "title", classes: `block ${classes.title ?? ""}`, text: characters },
              { slot: "control", classes: classes.control ?? "size-[24px] shrink-0" },
              ...(third ? [{ slot: "more", classes: "size-[24px] shrink-0" }] : []),
            ],
          },
        },
      ],
      WITH_DENSITY
    );
  }

  /** The title's layer and its text's, the row's alignment along it, and the rows that stay unmapped. */
  async function headerOf(classes: Parameters<typeof buildHeader>[0]) {
    const { variant, coverage } = await buildHeader(classes);
    const title = variant?.root.children[0];
    return {
      title: across(title),
      text: title?.kind === "frame" ? across(title.children[0]) : undefined,
      primaryAlign: variant?.root.primaryAlign,
      unmapped: unmapped(coverage),
    };
  }

  it.each([
    ["beside a control of a literal width", {}],
    [
      "beside a control whose width binds a synced variable",
      { control: "w-[var(--control-h)] h-[24px] shrink-0" },
    ],
    ["with a zero margin across", { title: "m-0" }],
    ["around a title that fits beside the control", { characters: "Covers theft." }],
    ["beside a control with a margin across", { control: "size-[24px] shrink-0 ml-[12px]" }],
    [
      "in a row whose gap binds a synced variable",
      { row: "flex w-[300px] items-center justify-between gap-[var(--control-h)]" },
    ],
  ])("draws the title %s as a fill, and packs the row at its start", async (_case, classes) => {
    expect(await headerOf(classes)).toEqual({ title: FILL, text: FILL, primaryAlign: "MIN", unmapped: [] });
  });

  it("reads the row's space-between as the fill's room, with its gap", async () => {
    const { coverage } = await buildHeader({});
    expect(notesOf(coverage, "justify-between")).toEqual([
      [
        "justify-content",
        "literal",
        "the first layer fits its content to the room the other leaves, so the other ends the row either way, and a fill of that room leaves nothing to space out, so packed at the start of the primary axis with the gap, which Figma's SPACE_BETWEEN would drop (PV)",
      ],
    ]);
  });

  // CSS sets the title or the control elsewhere than a fill of the room would, as the oracles say.
  it.each([
    [
      "the row packs from its start",
      { row: "flex w-[300px] items-center gap-[8px]", characters: "Covers theft." },
    ],
    ["the control can shrink", { control: "size-[24px] min-w-0" }],
    [
      "the control's width is a share of the row, which no Figma width holds",
      { control: "w-[10%] h-[24px] shrink-0" },
    ],
    ["the title sets a margin across", { title: "ml-[40px]" }],
    [
      "the control's negative margin gives the title room no padding draws",
      { control: "size-[24px] shrink-0 -mr-[4px]" },
    ],
    ["a third layer follows", { third: true, characters: "Covers theft." }],
    [
      "the row reverses",
      {
        row: "flex w-[300px] flex-row-reverse items-center justify-between gap-[8px]",
        characters: "Covers theft.",
      },
    ],
    ["the row wraps", { row: "flex w-[300px] flex-wrap items-center justify-between gap-[8px]" }],
    ["the row hugs it", { row: "flex w-fit items-center justify-between gap-[8px]" }],
  ])("keeps the title hugging where %s", async (_case, classes) => {
    expect((await headerOf(classes)).title).toEqual(HUG);
  });

  it("keeps the title's width and the row's spacing unmapped where a fill draws the title elsewhere", async () => {
    const { coverage } = await buildHeader({ title: "text-center", characters: "Covers theft." });
    expect(unmapped(coverage).map(([, property]) => property)).toEqual(["width", "justify-content"]);
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
