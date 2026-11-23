/**
 * How the build draws a list whose items each span its columns `min(50%, <length>) auto` as a
 * subgrid of two cells, as Description list's responsive layout does. The unit under test is
 * `buildSetsInOrder` on hand-built captures (`test/capture-fixtures.ts`). Oracles:
 *
 * - CSS Grid 1 §7.2.4 and §11.8: the first column is `min(50%, 20rem)` of the list's width and the
 *   `auto` column stretches over the rest, so Chromium sets a 576px list's cells at 288 and 288 and an
 *   800px list's at 320 and 480 (measured 2026-11-19). An item that spans `1 / -1` is as wide as the
 *   list, and a subgrid's cells share its columns (CSS Grid 2 §9).
 * - Probes DL2 and DL3 (2026-11-19): in a horizontal auto layout, two FILL layers split the row
 *   evenly whatever they hold, and a `maxWidth` of 320 on the first gave 320 and 480 at 800 and 288
 *   and 288 at 576, the widths above. So the first cell draws FILL with that `maxWidth` and the
 *   second FILL.
 * - Probe DL5 (a scratch file, 2026-11-20): a gapless row of two FILL frames, the first capped at
 *   320, shares the row's free space after taking each frame's own side padding out, and each frame
 *   gets its share plus its padding. With only the first padded 8px, rows 400 and 576px wide drew it
 *   204 and 292 wide, and 206 and 294 at 12px. With the padding on an unpadded first frame's inner
 *   FILL frame, they drew it 200 and 288. `figmaRow` below draws a built row by that
 *   rule, and the expected widths are Chromium's: 200 and 200 at 400, 288 and 288 at 576, 320 and
 *   480 at 800, the term's text inside its right padding.
 * - The README's rule for layer keys inside a variant: an instance keeps its main's layers. An Item
 *   instance whose term pads 0px where the Item's pads 8px keeps the Item's `inset`, so its `Term`
 *   value and text color reach the text at term / inset / text.
 * - CSS 2.1 Appendix E and probe PZ2: a flex block's ring paints over a later block's fill, and
 *   Figma puts a first layer on top only in a column, which `checkKitSpec` enforces.
 * - CSS Box Alignment 3 §6.1: each cell stretches to its row's height, which draws as the cell at its
 *   own height from the row's top only where the cell paints nothing.
 * - Chromium's widths for the refused borders and writing modes (measured 2026-11-19): an 8px border on
 *   every side of the Item sets an 800px list's cells at 312 and 472, not 320 and 480, and under
 *   `writing-mode: vertical-rl` the list sets an Item's cells one under the other, each 800px across.
 * - The coverage contract: an Item the build does not draw keeps its `display` unmapped.
 */
import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, FILL, HUG, literal, notesOf, part } from "../../test/capture-fixtures";
import type { FixtureElement } from "../../test/capture-fixtures";
import type { LabelManifest, SetManifest } from "../capture/manifest";
import { makeVariableIndex } from "./css-values";
import { checkKitSpec } from "./kit-check";
import type { BoxSpec, ChildLayerSpec, ComponentSetSpec, KitSpec, NumberSpec } from "./kit-spec";

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

  // An instance part's root carries its own padding and takes no cap, so the row would split unevenly.
  it("keeps the Item unmapped for a term that is an instance part", async () => {
    const term = chip({ key: "term-set", name: "Term set", slot: "term" });
    const root = { slot: "term", classes: `${TERM} h-[24px]` };
    const { coverage } = await buildCaptured(
      chip({
        previewWidth: 576,
        parts: [
          { kind: "instance", key: "term", of: term, cell: () => ({ state: "rest" }), shownIn: () => true },
          part({ key: "details", slot: "details", label: text("Kari Nordmann", "Details") }),
        ],
      }),
      [
        {
          cell: { state: "rest" },
          around: [{ tag: "dl", classes: `${LIST} ${TYPE}` }],
          root: {
            slot: "chip",
            classes: ITEM,
            children: [root, { tag: "dd", slot: "details", classes: DETAILS, text: "Kari Nordmann" }],
          },
        },
      ],
      { ...FONTS, inner: [{ manifest: term, cells: [{ cell: { state: "rest" }, root }] }] }
    );
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

/** A literal length, where `dl5Row` reads only what DL5 measured. */
function pixels(length: NumberSpec): number {
  if (length.kind !== "literal") {
    throw new Error("DL5 measured literal lengths only");
  }
  return length.value;
}

/**
 * Draw a gapless row of two FILL frames the given width as DL5 measured Figma drawing it: the row,
 * less each frame's own side padding, split in half, each frame its half plus its padding, the
 * first at most its `maxWidth` and the second the rest. That reproduces every width DL5 measured.
 *
 * @param row - The built row.
 * @param width - The row's width.
 * @returns Each frame's left edge and width.
 * @throws Outside the shape DL5 measured.
 */
function dl5Row(row: BoxSpec, width: number): readonly { x: number; width: number }[] {
  const [first, second, ...more] = row.children;
  if (
    row.direction !== "HORIZONTAL" ||
    pixels(row.itemSpacing) !== 0 ||
    first?.kind !== "frame" ||
    second?.kind !== "frame" ||
    more.length > 0 ||
    first.sizing.horizontal.kind !== "fill" ||
    second.sizing.horizontal.kind !== "fill" ||
    second.limits.maxWidth !== undefined
  ) {
    throw new Error("DL5 measured a gapless row of two FILL frames, the first capped, only");
  }
  const [own, other] = [first, second].map((frame) => pixels(frame.paddingLeft) + pixels(frame.paddingRight));
  const half = (width - (own ?? 0) - (other ?? 0)) / 2;
  const cap = first.limits.maxWidth;
  const left = Math.min(half + (own ?? 0), cap === undefined ? width : pixels(cap));
  return [
    { x: 0, width: left },
    { x: left, width: width - left },
  ];
}

describe("an Item's row as Figma splits it", () => {
  // Chromium's cells: `min(50%, 320px)` and the rest.
  it.each([
    [8, 400, 200],
    [8, 576, 288],
    [8, 800, 320],
    [12, 400, 200],
    [12, 576, 288],
    [12, 800, 320],
  ])("draws a term padded %ipx in a row %ipx wide where Chromium sets it", async (px, width, term) => {
    const { variant } = await buildItem({ term: `col-start-1 py-[6px] pr-[${String(px)}px]` });
    const root = variant?.root;
    expect(root === undefined ? undefined : dl5Row(root, width)).toEqual([
      { x: 0, width: term },
      { x: term, width: width - term },
    ]);
  });

  it("pads the term's text on its right from a frame inside the term that fills it", async () => {
    const { variant } = await buildItem({});
    const [term] = variant?.root.children ?? [];
    const [inset, ...rest] = term?.kind === "frame" ? term.children : [];
    expect(
      inset?.kind === "frame"
        ? {
            key: inset.key,
            sizing: inset.sizing.horizontal,
            left: inset.paddingLeft,
            right: inset.paddingRight,
            holds: inset.children.map((child) => child.key),
            rest: rest.length,
          }
        : undefined
    ).toEqual({ key: "inset", sizing: FILL, left: literal(0), right: literal(8), holds: ["text"], rest: 0 });
  });
});

/** The layers a term can hold: a positioned overlay and relative boxes, and the overlay keyed `inset`. */
type TermLayer = "overlay" | "box" | "after" | "inset";

/**
 * A term holding the given layers in order, padded `termClasses`: `overlay` and `inset` are absolute
 * boxes, and `box` and `after` relative ones.
 */
function overlaidItem(order: readonly TermLayer[], termClasses = "col-start-1 pr-[8px]") {
  const overlay = (slot: string): FixtureElement => ({
    slot,
    classes: "absolute top-0 left-0 size-[8px] bg-[#ff0000]",
    measured: { parentSpansBlock: true },
  });
  const elements = {
    overlay: overlay("overlay"),
    inset: overlay("inset"),
    box: { slot: "box", classes: "relative size-[8px] bg-[#0000ff]" },
    after: { slot: "after", classes: "relative size-[8px] bg-[#00ff00]" },
  } satisfies Record<TermLayer, FixtureElement>;
  return buildCaptured(
    chip({
      previewWidth: 576,
      parts: [
        part({ key: "term", slot: "term", parts: order.map((key) => part({ key, slot: key })) }),
        part({ key: "details", slot: "details" }),
      ],
    }),
    [
      {
        cell: { state: "rest" },
        around: [{ tag: "dl", classes: LIST }],
        root: {
          slot: "chip",
          classes: "col-span-full grid grid-cols-subgrid",
          children: [
            { slot: "term", classes: termClasses, children: order.map((key) => elements[key]) },
            { slot: "details", classes: "col-start-2 h-[12px]" },
          ],
        },
      },
    ]
  );
}

/**
 * The keys of the layers below a layer that hold none, in the order Figma paints them, back to front:
 * each frame's layers in their order, or reversed where it paints its first on top (`firstOnTop`,
 * Figma's `itemReverseZIndex`), a frame painting all it holds where it sits among its siblings.
 */
function paintedBackToFront(layer: ChildLayerSpec | undefined): readonly string[] {
  if (layer?.kind !== "frame") {
    return layer === undefined ? [] : [layer.key];
  }
  if (layer.children.length === 0) {
    return [layer.key];
  }
  const ordered = layer.firstOnTop === true ? [...layer.children].reverse() : layer.children;
  return ordered.flatMap(paintedBackToFront);
}

// CSS 2.1 Appendix E: positioned boxes at `z-index: auto` paint in tree order, so the term's layers
// paint back to front in the order the term holds them.
describe("a padded term that holds a layer out of its layout", () => {
  it.each([[["overlay", "box"]], [["box", "overlay"]]] as const)(
    "paints %j back to front in tree order, with nothing unmapped",
    async (order) => {
      const { variant, coverage } = await overlaidItem(order);
      expect({
        painted: paintedBackToFront(variant?.root.children[0]),
        unmapped: coverage.filter((row) => row.outcome === "unmapped").map((row) => row.property),
      }).toEqual({ painted: order, unmapped: [] });
    }
  );

  // The cell keeps its padding, and only a side it pads can move the row's split.
  it("keeps the term's right padding unmapped, and its zero left padding mapped, for an overlay between two relative boxes", async () => {
    const { coverage } = await overlaidItem(["box", "overlay", "after"], "col-start-1 pl-[0px] pr-[8px]");
    expect(
      coverage.filter((row) => row.part === "term" && row.outcome === "unmapped").map((row) => row.property)
    ).toEqual(["padding-right"]);
  });

  // A key is unique among a frame's layers (the plugin stops on two of one key), so the frame that
  // takes the padding needs a key the term's layers leave free.
  it("gives the frame that takes the padding a key apart from a layer keyed inset", async () => {
    const { variant, coverage } = await overlaidItem(["inset", "box"]);
    const term = variant?.root.children[0];
    const keys = term?.kind === "frame" ? term.children.map((child) => child.key) : [];
    expect({
      unique: new Set(keys).size === keys.length,
      count: keys.length,
      painted: paintedBackToFront(term),
      unmapped: coverage.filter((row) => row.outcome === "unmapped").map((row) => row.property),
    }).toEqual({ unique: true, count: 2, painted: ["inset", "box"], unmapped: [] });
  });

  // CSS draws a cell that holds only an overlay as tall as its padding, 12px here, and the padding
  // moves nothing it holds. A frame inside the cell would hold nothing, which Figma keeps at its last
  // height (PE4), so the cell keeps its padding and names the side it pads unmapped, not its 0px left.
  it("draws no frame inside a padded term that holds only an overlay, and keeps the side it pads unmapped", async () => {
    const { variant, coverage } = await overlaidItem(["overlay"], "col-start-1 py-[6px] pl-[0px] pr-[8px]");
    const term = variant?.root.children[0];
    expect({
      holds: term?.kind === "frame" ? term.children.map((child) => child.key) : [],
      right: term?.kind === "frame" ? term.paddingRight : undefined,
      unmapped: coverage
        .filter((row) => row.part === "term" && row.outcome === "unmapped")
        .map((row) => row.property),
    }).toEqual({ holds: ["overlay"], right: literal(8), unmapped: ["padding-right"] });
  });
});

/** An Item set whose term pads its right with the given class. */
function paddedTerm(padding: string) {
  const item = chip({ key: "item", name: "Item", slot: "item", previewWidth: 576, parts: CELLS });
  const row = (pad: string): FixtureElement => ({
    slot: "item",
    classes: ITEM,
    children: cells(`col-start-1 py-[6px] ${pad}`, DETAILS),
  });
  return { item, row: row(padding), with: row };
}

/**
 * Build a list of one Item instance whose Item set's term pads by `inner` and whose composite's term
 * pads by `outer`, the list setting `listClasses` too.
 */
function buildItemList(inner: string, outer: string, listClasses = "") {
  const { item, row, with: withPadding } = paddedTerm(inner);
  return buildCaptured(
    chip({
      previewWidth: 576,
      parts: [
        { kind: "instance", key: "item", of: item, cell: () => ({ state: "rest" }), shownIn: () => true },
      ],
    }),
    [
      {
        cell: { state: "rest" },
        root: { slot: "chip", classes: `${LIST} ${TYPE} ${listClasses}`, children: [withPadding(outer)] },
      },
    ],
    {
      ...FONTS,
      inner: [
        {
          manifest: item,
          cells: [{ cell: { state: "rest" }, around: [{ classes: `${LIST} ${TYPE}` }], root: row }],
        },
      ],
    }
  );
}

// The coverage contract: a class the composite passes that changes what the instance draws, where an
// instance carries none of it, is unmapped. Whether the term draws `inset` follows its padding.
describe("a list whose Item instance changes the term's padding", () => {
  it.each([
    ["0px", "8px"],
    ["8px", "0px"],
  ])(
    "keeps the composite's --pad unmapped where the Item defaults to %s and the list sets %s",
    async (fallback, pad) => {
      const term = `pr-[var(--pad,${fallback})]`;
      const { coverage } = await buildItemList(term, term, `[--pad:${pad}]`);
      expect(coverage.filter((row) => row.property === "--pad").map((row) => row.outcome)).toEqual([
        "unmapped",
      ]);
    }
  );

  it.each([
    ["pr-[0px]", "pr-[8px]"],
    ["pr-[8px]", "pr-[0px]"],
  ])(
    "keeps the composite's padding-right unmapped where the Item's term sets %s and the list's %s",
    async (inner, outer) => {
      const { coverage } = await buildItemList(inner, outer);
      expect(
        coverage
          .filter((row) => row.className === outer && row.property === "padding-right")
          .map((row) => row.outcome)
      ).toEqual(["unmapped"]);
    }
  );
});

/**
 * An Item whose term holds a flex block whose layer casts a ring, then a block that fills, padded on
 * its right, after `before`'s absolute box with a red border.
 */
function ringedItem(before: readonly "overlay"[]) {
  const overlay: FixtureElement = {
    slot: "overlay",
    classes: "absolute top-0 left-0 size-[8px] border border-[#ff0000]",
    measured: { parentSpansBlock: true },
  };
  return buildCaptured(
    chip({
      previewWidth: 576,
      parts: [
        part({
          key: "term",
          slot: "term",
          parts: [
            ...before.map((key) => part({ key, slot: key })),
            part({ key: "ring", slot: "ring", parts: [part({ key: "shadowed", slot: "shadowed" })] }),
            part({ key: "panel", slot: "panel" }),
          ],
        }),
        part({ key: "details", slot: "details" }),
      ],
    }),
    [
      {
        cell: { state: "rest" },
        around: [{ tag: "dl", classes: LIST }],
        root: {
          slot: "chip",
          classes: "col-span-full grid grid-cols-subgrid",
          children: [
            {
              tag: "div",
              slot: "term",
              classes: "col-start-1 block pr-[8px]",
              children: [
                ...before.map(() => overlay),
                {
                  tag: "div",
                  slot: "ring",
                  classes: "flex",
                  children: [
                    { tag: "div", slot: "shadowed", classes: "size-[8px] shadow-[0_0_0_2px_#000000]" },
                  ],
                },
                { tag: "div", slot: "panel", classes: "block h-[8px] bg-[#0000ff]" },
              ],
            },
            { slot: "details", classes: "col-start-2 h-[12px]" },
          ],
        },
      },
    ]
  );
}

/** A text style the docs of {@link kitAround} link. */
const DOCS_STYLE = {
  key: "text-style/caption",
  name: "Caption",
  description: "The docs' captions.",
  fontFamily: { kind: "literal", value: "Roboto" },
  fontWeight: { kind: "literal", style: "Medium" },
  fontSize: literal(12),
  lineHeight: literal(16),
  letterSpacing: { unit: "PERCENT", value: 0 },
  textCase: "ORIGINAL",
  textDecoration: "NONE",
  textWrapStyle: "AUTO",
} as const;

/** A kit that holds one built set, on a page with the docs every page that holds a set needs. */
function kitAround(built: Omit<ComponentSetSpec, "page">): KitSpec {
  const page = "page";
  const set: ComponentSetSpec = { ...built, page };
  const text = (key: string, characters: string) =>
    ({ kind: "text", key: `docs/${key}`, name: key, page, text: characters, style: DOCS_STYLE.key }) as const;
  const black = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } } as const;
  return {
    pages: [{ key: page, name: "Page" }],
    fonts: [],
    glyphFont: { family: "Inter", glyphs: [] },
    icons: { key: "icons", page, name: "Icons", size: 16, color: black, icons: [] },
    componentSets: [set],
    previews: [],
    textStyles: [DOCS_STYLE],
    docs: [
      {
        page,
        title: text("title", "Title"),
        description: text("description", "Description"),
        docsLink: {
          ...text("docs-link", "View documentation"),
          kind: "link",
          url: "https://example.com",
          color: black,
          underline: { offset: 2, thickness: 1, color: black },
        },
        rule: { kind: "rule", key: "docs/rule", name: "Rule", page, color: black },
        labels: [
          {
            kind: "labels",
            key: "docs/labels",
            name: "Labels",
            page,
            componentSet: set.key,
            nameStyle: DOCS_STYLE.key,
            axisStyle: DOCS_STYLE.key,
          },
        ],
        themesHeader: text("themes", "Themes"),
        examplesHeader: text("examples", "Examples"),
        example: {
          kind: "example",
          key: "docs/example",
          name: "Example",
          page,
          componentSet: set.key,
          variant: set.variants[0]?.key ?? "",
        },
      },
    ],
  };
}

// CSS 2.1 Appendix E paints the blocks' backgrounds, then a flex item as an inline block, so its
// ring over the later block's fill, then positioned boxes. Figma draws a first layer on top only in
// a column (PZ2), and `checkKitSpec` refuses it in a row.
describe("a padded term whose flex block's layer casts a ring over a later block's fill", () => {
  it.each([
    [[], ["panel", "shadowed"]],
    [["overlay"], ["panel", "shadowed", "overlay"]],
  ] as const)(
    "with %j before it, passes the kit check and paints %j back to front",
    async (before, painted) => {
      const { componentSet, variant } = await ringedItem(before);
      const checked = checkKitSpec(kitAround(componentSet), (text) => Buffer.from(text, "base64"));
      expect({
        check: Result.isSuccess(checked) ? "accepted" : checked.failure.message,
        painted: paintedBackToFront(variant?.root.children[0]),
      }).toEqual({ check: "accepted", painted });
    }
  );
});

// An instance keeps its main's layers (README, "Layer keys inside a variant"), and the instance diff
// compares no layer of a box whose layers differ. An Item whose term pads 8px on its right draws that
// padding on the frame `inset` inside the term, and one whose term pads nothing draws no such frame.
// An instance whose own padding would add the frame or remove it keeps the Item's layers, so its
// Term value and its text color reach the Item's text, and the padding that differs stays unmapped.
describe("a list whose Item instance pads its term otherwise than the Item does", () => {
  it.each([
    ["pr-[8px]", "pr-[0px]", ["term", "inset", "text"]],
    ["pr-[0px]", "pr-[8px]", ["term", "text"]],
  ] as const)(
    "keeps the Term value and text color where the Item's term sets %s and the instance's %s",
    async (inner, outer, textPath) => {
      const { item, row } = paddedTerm(inner);
      const { variant, coverage } = await buildCaptured(
        chip({
          previewWidth: 576,
          parts: [
            {
              kind: "instance",
              key: "item",
              of: item,
              cell: () => ({ state: "rest" }),
              properties: () => ({ text: { Term: "Telefon" } }),
              shownIn: () => true,
            },
          ],
        }),
        [
          {
            cell: { state: "rest" },
            root: {
              slot: "chip",
              classes: `${LIST} ${TYPE}`,
              children: [
                {
                  slot: "item",
                  classes: ITEM,
                  children: [
                    {
                      tag: "dt",
                      slot: "term",
                      classes: `col-start-1 py-[6px] ${outer} text-[#ff0000]`,
                      text: "Telefon",
                    },
                    { tag: "dd", slot: "details", classes: DETAILS, text: "Kari Nordmann" },
                  ],
                },
              ],
            },
          },
        ],
        {
          ...FONTS,
          inner: [
            {
              manifest: item,
              cells: [{ cell: { state: "rest" }, around: [{ classes: `${LIST} ${TYPE}` }], root: row }],
            },
          ],
        }
      );
      const [instance] = variant?.root.children ?? [];
      const outcomes = new Map(
        coverage
          .filter((each) => each.className === outer || each.className === "text-[#ff0000]")
          .map((each) => [each.className, each.outcome])
      );
      expect({
        properties: instance?.kind === "instance" ? instance.properties : undefined,
        overrides: instance?.kind === "instance" ? instance.overrides : undefined,
        padding: outcomes.get(outer),
        color: outcomes.get("text-[#ff0000]"),
        rows: coverage.filter((each) => each.className === outer || each.className === "text-[#ff0000]")
          .length,
      }).toEqual({
        properties: { text: { Term: "Telefon" } },
        overrides: [
          {
            path: textPath,
            field: "textColor",
            color: { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } },
          },
        ],
        padding: "unmapped",
        color: "literal",
        rows: 2,
      });
    }
  );
});
