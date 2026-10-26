/**
 * Build rules the menu sets are the first to need, against the one-cell `chip` fixture of
 * `test/fixture-sets.ts`. The unit under test is `buildComponentSet`. Each describe names its
 * oracle.
 */
import { describe, expect, it } from "vitest";

import { density, FILL, fixed, HUG, literal } from "../../test/built-kit";
import { buildFixture, buildFixtures, chip, dot, ICON } from "../../test/fixture-sets";
import type {
  ComponentDefinition,
  InstanceDefinition,
  LabelDefinition,
  PartDefinition,
} from "./component-spec";
import type { CoverageRow } from "./coverage";
import { makeVariableIndex } from "./css-values";
import type { BoxSpec } from "./kit-spec";

/** The property, outcome and detail of each coverage row of one class. */
const notesOf = (coverage: readonly CoverageRow[], className: string) =>
  coverage.filter((row) => row.className === className).map((row) => [row.property, row.outcome, row.detail]);

/** The rows no Figma field reads. */
const unmapped = (coverage: readonly CoverageRow[]) => coverage.filter((row) => row.outcome === "unmapped");

/** `font-sans`, `surface-pad-sm`, `row-px` and `row-indicator-room`, as the sync writes their code syntax. */
const SYNCED = makeVariableIndex([
  { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
  { ref: { collection: "Fuse density", name: "surface-pad-sm" }, webSyntax: "var(--surface-pad-sm)" },
  { ref: { collection: "Fuse density", name: "row-px" }, webSyntax: "var(--row-px)" },
  {
    ref: { collection: "Fuse density", name: "row-indicator-room" },
    webSyntax: "calc(var(--row-px) + 1.5rem)",
  },
]);

const TEXT: LabelDefinition = {
  key: "text",
  name: "text",
  characters: "Apple",
  textProperty: undefined,
  shownIn: () => true,
};

/** A part that holds the row's text, as Select's `ItemText` does. */
const itemText = (classes: string): PartDefinition => ({
  ...dot(`font-sans text-[14px]/[20px] text-[#000000] ${classes}`),
  key: "item-text",
  slot: "item-text",
  label: TEXT,
});

/** The trailing indicator, as `menuItemIndicatorClass` and Select's `size-4` place it. */
const indicator = (classes: string): PartDefinition => ({
  ...dot(classes),
  key: "item-indicator",
  slot: "item-indicator",
});

/** The names of a box's layers, in order. */
const layerNames = (box: BoxSpec | undefined) => box?.children.map((child) => child.name);

/** The layer of a box with a name. */
const layerOf = (box: BoxSpec | undefined, name: string) =>
  box?.children.find((child) => child.name === name);

// Oracle: CSS 2.1 §10.3.7 and CSS Flexbox 1 §4.1. An absolute box with `right` set and `left`, `top`
// and `bottom` auto sits `right` from the end of its containing block, the padding box of its
// positioned row, and down the row where `align-items: center` puts its static position. The row's
// end padding keeps that room: `row-px` + 1.5rem is the offset, the row's 8px gap and the 16px
// indicator, so the indicator's box sits exactly where the gap after a filling layer and an end
// padding of `row-px` put it. Worked by hand at 200px: the text fills 200 - 8 - 32 = 160px, then 8px
// of gap, then the indicator from 176 to 192, 8px from the end.
describe("an absolute end indicator in a row that keeps its room", () => {
  const row = (padding: string, offset: string, shown = true) =>
    chip(`relative flex w-[200px] items-center gap-2 px-[8px] ${padding}`, {
      parts: [itemText("flex-1"), { ...indicator(`absolute ${offset} size-4`), shownIn: () => shown }],
    });

  it("draws in flow after the filling layer, with the row padded to its offset", async () => {
    const { variant, coverage } = await buildFixture(row("pr-[32px]", "right-[8px]"), { variables: SYNCED });
    const root = variant?.root;
    expect(layerNames(root)).toEqual(["item-text", "item-indicator"]);
    expect(layerOf(root, "item-indicator")).toMatchObject({
      sizing: { horizontal: fixed(literal(16)), vertical: fixed(literal(16)) },
    });
    expect(layerOf(root, "item-indicator")).not.toHaveProperty("absolute");
    expect(layerOf(root, "item-text")).toMatchObject({ sizing: { horizontal: FILL } });
    expect([root?.paddingRight, root?.itemSpacing, root?.counterAlign]).toEqual([
      literal(8),
      literal(8),
      "CENTER",
    ]);
    expect(unmapped(coverage)).toEqual([]);
  });

  it("binds the row's end padding to the offset's variable", async () => {
    const { variant, coverage } = await buildFixture(
      row("pr-[calc(var(--row-px)+1.5rem)]", "right-(--row-px)"),
      { variables: SYNCED }
    );
    expect(variant?.root.paddingRight).toEqual(density("row-px"));
    expect(notesOf(coverage, "pr-[calc(var(--row-px)+1.5rem)]")).toEqual([
      [
        "padding-right",
        "bound",
        "Fuse density / row-px, the indicator's offset: the indicator draws in flow after the row's other layers, in the room this padding keeps",
      ],
    ]);
    expect(unmapped(coverage)).toEqual([]);
  });

  it("keeps the room where the row does not render the indicator", async () => {
    const { variant } = await buildFixture(
      row("pr-[calc(var(--row-px)+1.5rem)]", "right-(--row-px)", false),
      { variables: SYNCED }
    );
    expect(variant?.root.paddingRight).toEqual(density("row-indicator-room"));
  });

  it.each([
    ["pr-[40px]", "right-[8px]"],
    // Equal to `row-px` + 24px only where `row-px` and `surface-pad-sm` stand in a ratio of 20 to 7:
    // 164px against 32px at the dense metrics, 8px and 4px.
    ["pr-[calc(21*var(--row-px)-7*var(--surface-pad-sm)+24px)]", "right-(--row-px)"],
  ])(
    "stays absolute where the padding %s leaves another room than the offset, the gap and the indicator",
    async (padding, offset) => {
      const { coverage } = await buildFixture(row(padding, offset), { variables: SYNCED });
      expect(notesOf(coverage, "absolute")).toContainEqual([
        "position",
        "unmapped",
        expect.stringContaining("no Figma field reads"),
      ]);
    }
  );
});

// Oracle: CSS Flexbox 1 §8.1, where auto margins take a row's free space before `justify-content`
// distributes it, so an auto start margin on the last of two layers ends the row with it and leaves
// the first at the start, as `justify-content: space-between` places two layers. A label first of
// two such layers fills the room the other and the gap leave, the rule a vertical Navigation menu
// trigger follows: a real file kept no gap under SPACE_BETWEEN beside a filling text (PV), so the row
// packs its layers at the start with its gap between them.
describe("an auto start margin on the last of two layers", () => {
  const WORDS = { ...TEXT, characters: "Two words" };
  const caret = (classes: string, side: "start" | "end") => ({
    ...ICON,
    side,
    classes: `size-[16px] ${classes}`,
  });
  const row = (icons: readonly ReturnType<typeof caret>[]) =>
    chip("flex w-[200px] gap-[8px] font-sans text-[14px]/[20px] text-[#000000]", {
      label: WORDS,
      iconsFor: () => icons,
    });
  const textOf = (box: BoxSpec | undefined) => box?.children.find((child) => child.kind === "text");

  it.each(["ml-auto", "ms-auto"])("fills the label and keeps the gap under %s", async (margin) => {
    const { variant, coverage } = await buildFixture(row([caret(margin, "end")]), { variables: SYNCED });
    expect([
      variant?.root.primaryAlign,
      variant?.root.itemSpacing,
      textOf(variant?.root)?.sizing.horizontal,
    ]).toEqual(["MIN", literal(8), FILL]);
    expect(notesOf(coverage, margin)).toEqual([
      [
        "margin-left",
        "literal",
        "the auto margin takes the row's free space, which ends the row with the layer, as space-between places two layers",
      ],
    ]);
    expect(unmapped(coverage)).toEqual([]);
  });

  // CSS Flexbox 1 §9.7: an item that does not shrink or grow and sets no width keeps its max-content
  // width, which a Figma frame that hugs what it holds draws, so only the text shrinks to the room
  // left, as beside a layer of fixed width. A Command row's Kbd group shortcut is such a layer.
  const keys = (classes: string): PartDefinition => ({
    ...dot(`flex ${classes}`, [{ ...ICON, classes: "size-[16px]" }]),
    key: "keys",
    slot: "keys",
    after: "label",
  });
  const keyed = (classes: string) =>
    chip("flex w-[200px] gap-[8px] font-sans text-[14px]/[20px] text-[#000000]", {
      label: WORDS,
      parts: [keys(classes)],
    });

  it("fills the label beside a last layer that keeps its own width", async () => {
    const { variant, coverage } = await buildFixture(keyed("ms-auto shrink-0"), { variables: SYNCED });
    expect([
      variant?.root.primaryAlign,
      variant?.root.itemSpacing,
      textOf(variant?.root)?.sizing.horizontal,
    ]).toEqual(["MIN", literal(8), FILL]);
    expect(unmapped(coverage)).toEqual([]);
  });

  // CSS Flexbox 1 §9.7: a layer that shrinks too gives up some of the room by its flex base size, which
  // no Figma fill draws.
  it.each(["ms-auto", "ms-auto shrink-0 grow"])(
    "keeps the label at its own width beside `%s`",
    async (classes) => {
      const { variant, coverage } = await buildFixture(keyed(classes), { variables: SYNCED });
      expect(textOf(variant?.root)?.sizing.horizontal).toEqual(HUG);
      expect(unmapped(coverage).length).toBeGreaterThan(0);
    }
  );

  it.each([
    ["on the first of two layers", [caret("ml-auto", "start")]],
    ["on the last of three layers after an icon", [caret("", "end"), caret("ml-auto", "end")]],
  ])("stays unmapped %s", async (_case, icons) => {
    const { variant, coverage } = await buildFixture(row(icons), { variables: SYNCED });
    expect(textOf(variant?.root)?.sizing.horizontal).toEqual(HUG);
    expect(notesOf(coverage, "ml-auto")).toEqual([
      ["margin-left", "unmapped", "the builder maps no Figma field from it"],
    ]);
  });
});

// Oracle: CSS Flexbox 1 §8.1, as above. The auto margin on the last layer takes the row's free space,
// so the layers before it sit packed at the start with the gap between them, the label at its own
// width, and the last layer ends the row. A label right before the last layer that fills the room
// the others and the gaps leave draws the same: a label paints nothing past its text, which starts at
// its left. Worked by hand at 200px: a 16px icon, 8px, the label from 24px, 8px, the 16px caret from
// 184px, the row's end. A row that centers its text would set the label's text away from its left.
describe("an auto start margin on the last of several layers, after the label", () => {
  const caret = (classes: string, side: "start" | "end") => ({
    ...ICON,
    key: `${side}-${classes}`,
    side,
    classes: `size-[16px] ${classes}`,
  });
  const row = (classes: string, characters: string) =>
    chip(`flex w-[200px] gap-[8px] font-sans text-[14px]/[20px] text-[#000000] ${classes}`, {
      label: { ...TEXT, characters },
      iconsFor: () => [caret("", "start"), caret("ml-auto", "end")],
    });
  const textOf = (box: BoxSpec | undefined) => box?.children.find((child) => child.kind === "text");

  it.each(["Two words", "One"])(
    "fills the label %s and packs the row at its start with its gap",
    async (words) => {
      const { variant, coverage } = await buildFixture(row("", words), { variables: SYNCED });
      expect([
        variant?.root.primaryAlign,
        variant?.root.itemSpacing,
        textOf(variant?.root)?.sizing.horizontal,
      ]).toEqual(["MIN", literal(8), FILL]);
      expect(notesOf(coverage, "ml-auto")).toEqual([
        [
          "margin-left",
          "literal",
          "the auto margin takes the row's free space after the label, which fills that space in Figma and paints nothing past its text, so the layer ends the row",
        ],
      ]);
      expect(unmapped(coverage)).toEqual([]);
    }
  );

  // Oracle: CSS Box Alignment 3 §5.3. With no auto margin, `justify-between` spaces three layers out,
  // so the label sits at its own width between the icons, as the rule above leaves such a row.
  it("leaves a `justify-between` row with no auto margin as it was, its label at its own width", async () => {
    const { variant } = await buildFixture(
      chip("flex w-[200px] justify-between gap-[8px] font-sans text-[14px]/[20px] text-[#000000]", {
        label: { ...TEXT, characters: "One" },
        iconsFor: () => [caret("", "start"), caret("", "end")],
      }),
      { variables: SYNCED }
    );
    expect([variant?.root.primaryAlign, textOf(variant?.root)?.sizing.horizontal]).toEqual([
      "SPACE_BETWEEN",
      HUG,
    ]);
  });

  it("stays unmapped where the row centers its text", async () => {
    const { coverage } = await buildFixture(row("text-center", "Two words"), { variables: SYNCED });
    expect(notesOf(coverage, "ml-auto")).toEqual([
      ["margin-left", "unmapped", "the builder maps no Figma field from it"],
    ]);
  });
});

// Oracle: CSS 2.1 §9.2 and CSS Flexbox 1 §4: a part placed after the box's own text in the DOM is the
// row's last flex item, after the text's anonymous item and the icons around the text.
describe("a part the markup holds after the label", () => {
  const shortcut: PartDefinition = {
    ...dot("size-[4px]"),
    key: "shortcut",
    slot: "shortcut",
    after: "label",
  };
  const head: PartDefinition = { ...dot("size-[4px]"), key: "head", slot: "head" };

  it("draws after the start icons, the label and the end icons, and after the parts before it", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex gap-[8px] font-sans text-[14px]/[20px] text-[#000000] [&_svg]:size-[16px]", {
        label: TEXT,
        iconsFor: () => [ICON, { ...ICON, key: "end", name: "End", side: "end" }],
        parts: [shortcut, head],
      }),
      { variables: SYNCED }
    );
    expect(layerNames(variant?.root)).toEqual(["head", "Icon", "text", "End", "shortcut"]);
    expect(unmapped(coverage)).toEqual([]);
  });

  // A Command row's shortcut is a Kbd group, so the part after the text is an instance.
  it("draws an instance part after them too, as a frame part draws", async () => {
    const keys: ComponentDefinition = { ...chip("flex size-[4px]"), key: "keys", name: "Keys", slot: "keys" };
    const after: InstanceDefinition = {
      kind: "instance",
      key: "shortcut",
      of: keys,
      cell: () => ({ state: "rest" }),
      shownIn: () => true,
      after: "label",
    };
    const [, row] = await buildFixtures(
      [
        keys,
        chip("flex gap-[8px] font-sans text-[14px]/[20px] text-[#000000] [&_svg]:size-[16px]", {
          label: TEXT,
          iconsFor: () => [ICON],
          parts: [after, head],
        }),
      ],
      { variables: SYNCED }
    );
    const root = row?.componentSet.variants[0]?.root;
    expect(root?.children.map((child) => child.key)).toEqual(["head", "icon", "text", "shortcut"]);
    expect(unmapped(row?.coverage ?? [])).toEqual([]);
  });
});

// Oracle: CSS 2.1 §10.3.7 and CSS Flexbox 1 §4.1, as for the indicator at the end above. An absolute
// box first in the DOM leaves the flow, so the row's text is its only item, and the box sits `right`
// from the row's padding box's end. A box with no width is as wide as the one 16px icon it holds.
// Worked by hand at 200px with `pr-[32px]` and `right-[8px]`: the text fills 200 - 8 - 32 = 160px,
// then 8px of gap, then the indicator from 176 to 192, 8px from the end, where a row padded 8px at its
// end draws it after the text.
describe("an absolute end indicator first in the DOM beside the row's own text", () => {
  const row = (padding: string, shown = true) =>
    chip(
      `relative flex w-[200px] items-center gap-2 px-[8px] ${padding} font-sans text-[14px]/[20px] text-[#000000] [&_svg]:size-[16px]`,
      {
        label: TEXT,
        parts: [
          {
            ...indicator("absolute right-[8px] flex items-center justify-center"),
            shownIn: () => shown,
            iconsFor: () => [{ ...ICON, direct: false }],
          },
        ],
      }
    );

  it("draws the indicator in flow after the text, with the row padded to its offset", async () => {
    const { variant, coverage } = await buildFixture(row("pr-[32px]"), { variables: SYNCED });
    const root = variant?.root;
    expect(layerNames(root)).toEqual(["text", "item-indicator"]);
    expect(layerOf(root, "item-indicator")).not.toHaveProperty("absolute");
    const text = layerOf(root, "text");
    expect([
      root?.paddingRight,
      root?.itemSpacing,
      text?.kind === "text" ? text.sizing.horizontal : text,
    ]).toEqual([literal(8), literal(8), FILL]);
    expect(notesOf(coverage, "absolute")).toEqual([
      [
        "position",
        "literal",
        "drawn in flow after the row's other layers, where the row's end padding, its gap and the part's width put it",
      ],
    ]);
    expect(unmapped(coverage)).toEqual([]);
  });

  it("stays absolute where the padding leaves another room than the offset, the gap and the icon", async () => {
    const { coverage } = await buildFixture(row("pr-[40px]"), { variables: SYNCED });
    expect(
      notesOf(coverage, "absolute").map(([property, outcome]) => [property, outcome])
    ).not.toContainEqual(["position", "literal"]);
  });
});

// Oracle: CSS 2.1 §10.3.3 and CSS Flexbox 1 §9.4. A block or a stretched column item with no width
// of its own is as wide as its container's content box less its margins, so margins of minus the
// container's padding make a separator as wide as the container's padding box, while the rows beside
// it keep the padding. In a container that pads nothing across and clips what overflows it
// (CSS Overflow 3 §3), the separator's overshoot is clipped, so it draws the container's width.
describe("a separator that cancels its popup's padding", () => {
  const part = (key: string, classes: string): PartDefinition => ({ ...dot(classes), key, slot: key });
  const ROWS = [
    part("row", "h-[32px]"),
    part("separator", "-mx-(--surface-pad-sm) h-px bg-[#cccccc]"),
    part("row", "h-[32px]"),
  ];
  const popup = (classes: string, parts: readonly PartDefinition[]) =>
    chip(`flex flex-col w-[200px] ${classes}`, {
      parts: parts.map((each, at) => ({ ...each, key: `${each.key}-${at}` })),
    });
  const SEPARATOR_MARGIN = "-mx-(--surface-pad-sm)";

  it("draws the popup with no padding across and pads each run of rows in a section", async () => {
    const { variant, coverage } = await buildFixture(popup("p-(--surface-pad-sm)", ROWS), {
      variables: SYNCED,
    });
    const root = variant?.root;
    const pad = density("surface-pad-sm");
    expect([root?.paddingLeft, root?.paddingRight, root?.paddingTop, root?.paddingBottom]).toEqual([
      literal(0),
      literal(0),
      pad,
      pad,
    ]);
    expect(root?.children.map((child) => [child.key, child.name])).toEqual([
      ["section-0", "section"],
      ["separator-1", "separator"],
      ["section-2", "section"],
    ]);
    for (const at of [0, 2]) {
      expect(root?.children[at]).toMatchObject({
        kind: "frame",
        direction: "VERTICAL",
        sizing: { horizontal: FILL, vertical: HUG },
        paddingLeft: pad,
        paddingRight: pad,
        paddingTop: literal(0),
        paddingBottom: literal(0),
        fill: undefined,
        children: [{ key: `row-${at}`, sizing: { horizontal: FILL } }],
      });
    }
    expect(layerOf(root, "separator")).toMatchObject({ sizing: { horizontal: FILL } });
    expect(notesOf(coverage, SEPARATOR_MARGIN)).toEqual(
      ["margin-left", "margin-right"].map((property) => [
        property,
        "literal",
        "cancels the popup's padding, so the separator spans the popup, which pads the layers between its separators in section frames",
      ])
    );
    expect(unmapped(coverage)).toEqual([]);
  });

  it("drops the margins where the popup pads nothing across and clips", async () => {
    const { variant, coverage } = await buildFixture(popup("overflow-hidden", ROWS), { variables: SYNCED });
    expect(layerNames(variant?.root)).toEqual(["row", "separator", "row"]);
    expect(layerOf(variant?.root, "separator")).toMatchObject({ sizing: { horizontal: FILL } });
    expect(notesOf(coverage, SEPARATOR_MARGIN)).toEqual(
      ["margin-left", "margin-right"].map((property) => [
        property,
        "dropped",
        "the popup pads nothing across and clips what overflows it, so the separator draws the popup's width",
      ])
    );
    expect(unmapped(coverage)).toEqual([]);
  });

  // As Select's listbox fills its popup: a list that pads nothing across inside a popup that pads
  // nothing across and clips spans the popup's padding box, so the popup clips the overshoot there.
  it.each([
    ["clips", "overflow-hidden", "dropped"],
    ["does not clip", "", "unmapped"],
  ])(
    "reads the margins of a list's separators as the popup around the list that %s",
    async (_, overflow, outcome) => {
      const definition = chip(`flex flex-col w-[200px] ${overflow}`, {
        parts: [{ ...dot("flex flex-col"), key: "list", slot: "list", parts: popup("", ROWS).parts ?? [] }],
      });
      const { coverage } = await buildFixture(definition, { variables: SYNCED });
      expect(notesOf(coverage, SEPARATOR_MARGIN).map(([, read]) => read)).toEqual([outcome, outcome]);
    }
  );

  // Unit under test: the coverage of a composite whose instance part's rows sit in sections.
  // Oracle: Figma's instance model, under which an instance carries a fill it overrides at the
  // layer's key path (N3), and the rule that a passed class the instance overrides keeps its read.
  // `*:data-[slot=row]:` compiles to `:is(.… > *)[data-slot="row"]`, which reaches both rows.
  it("keeps the read of a class an instance overrides on a row inside a section", async () => {
    const inner: ComponentDefinition = {
      ...popup("p-(--surface-pad-sm)", ROWS),
      key: "popup",
      name: "Popup",
      slot: "popup",
    };
    const reaching = "*:data-[slot=row]:bg-[#ff0000]";
    const [, composite] = await buildFixtures(
      [
        inner,
        chip("flex", {
          parts: [
            {
              kind: "instance",
              key: "menu",
              of: inner,
              cell: () => ({ state: "rest" }),
              classesFor: () => reaching,
              shownIn: () => true,
            },
          ],
        }),
      ],
      { variables: SYNCED }
    );
    const red = { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } };
    expect(composite?.componentSet.variants[0]?.root.children[0]).toMatchObject({
      kind: "instance",
      overrides: [
        { path: ["section-0", "row-0"], field: "fill", color: red },
        { path: ["section-2", "row-2"], field: "fill", color: red },
      ],
    });
    const rows = composite?.coverage.filter((row) => row.className === reaching) ?? [];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((row) => [row.property, row.outcome])).toEqual(
      rows.map(() => ["background-color", "literal"])
    );
  });

  it.each([
    ["cancels another padding", popup("p-[8px]", ROWS)],
    ["pads nothing across and does not clip", popup("", ROWS)],
  ])("leaves the margins unmapped where the popup %s", async (_case, definition) => {
    const { coverage } = await buildFixture(definition, { variables: SYNCED });
    expect(notesOf(coverage, SEPARATOR_MARGIN).map(([, outcome]) => outcome)).toEqual([
      "unmapped",
      "unmapped",
    ]);
  });
});

// Oracle: the CSS box model (CSS 2.1 §8.3, §10.3.3) and CSS Flexbox 1 §4.2. A menu separator,
// `-mx-(--surface-pad-sm) my-1 h-px`, is a 1px rule with 4px of margin above and below it, which
// neither collapses in a flex column nor narrows the rule, so the rows around it sit 4px above and
// 4px below the rule. Worked by hand in a 200px column of two 32px rows: the rule runs from 36 to 37,
// and the column is 32 + 4 + 1 + 4 + 32 = 73 tall.
describe("a separator's margins above and below it", () => {
  const SEPARATOR = "-mx-(--surface-pad-sm) my-1 h-px bg-[#cccccc]";
  const part = (key: string, classes: string, slot = key): PartDefinition => ({ ...dot(classes), key, slot });
  const rows = (separator: PartDefinition | InstanceDefinition) => [
    part("row-0", "h-[32px]"),
    separator,
    part("row-2", "h-[32px]"),
  ];
  const popup = (classes: string, parts: readonly (PartDefinition | InstanceDefinition)[]) =>
    chip(`flex flex-col w-[200px] ${classes}`, { parts });
  const MARGIN = {
    kind: "frame",
    key: "separator-1",
    name: "separator",
    direction: "VERTICAL",
    sizing: { horizontal: FILL, vertical: HUG },
    paddingTop: literal(4),
    paddingBottom: literal(4),
    paddingLeft: literal(0),
    paddingRight: literal(0),
    fill: undefined,
  };
  const RULE = { key: "box", name: "box", sizing: { horizontal: FILL, vertical: fixed(literal(1)) } };

  it("draws the rule in a frame that fills across and pads its top and bottom by the margins", async () => {
    const { variant, coverage } = await buildFixture(
      popup("overflow-hidden", rows(part("separator-1", SEPARATOR, "separator"))),
      { variables: SYNCED }
    );
    const separator = variant?.root.children[1];
    expect(separator).toMatchObject(MARGIN);
    expect(separator?.kind === "frame" ? separator.children : undefined).toMatchObject([RULE]);
    expect(notesOf(coverage, "my-1")).toEqual(
      ["margin-top", "margin-bottom"].map((property) => [
        property,
        "literal",
        "4px of padding on a frame around the part, the space the margin adds",
      ])
    );
    expect(unmapped(coverage)).toEqual([]);
  });

  it("keeps the frame inside a section of a popup whose padding it cancels", async () => {
    const { variant, coverage } = await buildFixture(
      popup("p-(--surface-pad-sm)", rows(part("separator-1", SEPARATOR, "separator"))),
      { variables: SYNCED }
    );
    expect(layerNames(variant?.root)).toEqual(["section", "separator", "section"]);
    expect(variant?.root.children[1]).toMatchObject(MARGIN);
    expect(unmapped(coverage)).toEqual([]);
  });

  // Oracle: CSS 2.1 §8.3.1. In a block column, as Select's list stacks its rows, a block's vertical
  // margin collapses only with a margin it adjoins: none between two rows that set no margin, so the
  // rule still sits 4px from each, and the column's own where the separator comes first.
  const blocks = (order: readonly ("row" | "separator")[]) =>
    chip("block w-[200px] overflow-hidden", {
      parts: order.map((kind, at) =>
        kind === "row"
          ? part(`row-${at}`, "block h-[32px]")
          : part(`separator-${at}`, `block ${SEPARATOR}`, "separator")
      ),
    });

  it("draws the frame in a block column where no margin adjoins the separator's", async () => {
    const { variant, coverage } = await buildFixture(blocks(["row", "separator", "row"]), {
      variables: SYNCED,
    });
    expect(variant?.root.children[1]).toMatchObject(MARGIN);
    expect(unmapped(coverage)).toEqual([]);
  });

  it("leaves the margins unmapped where they collapse with the column's", async () => {
    const { coverage } = await buildFixture(blocks(["separator", "row", "row"]), { variables: SYNCED });
    expect(notesOf(coverage, "my-1").map(([, outcome]) => outcome)).toEqual(["unmapped", "unmapped"]);
  });

  // Unit under test: the same rule on an instance part, whose margins the composite passes. Oracle: as
  // above, and Figma's instance model, under which the frame around an instance is the composite's own
  // layer, so the instance carries only its own sizing (N4) and the composite owns the margins' reads.
  it("draws an instance's margins in the same frame, and keeps the reads of the margins it passes", async () => {
    const separator: ComponentDefinition = {
      ...chip("-mx-(--surface-pad-sm) h-px bg-[#cccccc] w-[144px]"),
      key: "separator",
      name: "Separator",
      slot: "separator",
    };
    const [, composite] = await buildFixtures(
      [
        separator,
        popup(
          "overflow-hidden",
          rows({
            kind: "instance",
            key: "separator-1",
            of: separator,
            cell: () => ({ state: "rest" }),
            classesFor: () => "my-1 w-auto",
            shownIn: () => true,
          })
        ),
      ],
      { variables: SYNCED }
    );
    const frame = composite?.componentSet.variants[0]?.root.children[1];
    expect(frame).toMatchObject(MARGIN);
    expect(frame?.kind === "frame" ? frame.children : undefined).toMatchObject([
      { kind: "instance", key: "box", name: "box", sizing: { horizontal: FILL } },
    ]);
    expect(notesOf(composite?.coverage ?? [], "my-1")).toEqual(
      ["margin-top", "margin-bottom"].map((property) => [
        property,
        "literal",
        "4px of padding on a frame around the part, the space the margin adds",
      ])
    );
    expect(unmapped(composite?.coverage ?? [])).toEqual([]);
  });

  // Unit under test: the stacking of a composite that holds the popup as an instance, which draws the
  // popup's inner root in place, the wrapped separator instance among its layers. Oracle: every
  // instance the mapping places paints its inner root, so the outer build resolves the separator
  // inside its frame to the separator's own root, a 1px fill, rather than failing to find it.
  it("paints a wrapped instance where a composite above draws the instance that holds it", async () => {
    const separator: ComponentDefinition = {
      ...chip("-mx-(--surface-pad-sm) h-px bg-[#cccccc] w-[144px]"),
      key: "separator",
      name: "Separator",
      slot: "separator",
    };
    const inner: ComponentDefinition = {
      ...popup(
        "overflow-hidden",
        rows({
          kind: "instance",
          key: "separator-1",
          of: separator,
          cell: () => ({ state: "rest" }),
          classesFor: () => "my-1 w-auto",
          shownIn: () => true,
        })
      ),
      key: "popup",
      name: "Popup",
      slot: "popup",
    };
    const [, , outer] = await buildFixtures(
      [
        separator,
        inner,
        chip("flex flex-col", {
          parts: [
            {
              kind: "instance",
              key: "popup",
              of: inner,
              cell: () => ({ state: "rest" }),
              shownIn: () => true,
            },
          ],
        }),
      ],
      { variables: SYNCED }
    );
    expect(outer?.componentSet.variants[0]?.root.children).toMatchObject([
      { kind: "instance", key: "popup", componentSet: "popup" },
    ]);
    expect(unmapped(outer?.coverage ?? [])).toEqual([]);
  });
});

// Oracle: CSS Overflow 3 §3, where a box's initial `overflow: visible` draws its content's shadows past
// its edges, as an open Select's column shows its popup's. A root that paints draws a spread ring only
// while it clips (PR2), so the build refuses to leave one unclipped.
describe("a composite root that leaves its layers unclipped", () => {
  const SHADOWED = { ...dot("w-[100px] h-[20px] shadow-[0_4px_6px_#000000]"), key: "popup", slot: "popup" };

  it("clips nothing where it paints nothing", async () => {
    const { variant } = await buildFixture(
      chip("flex flex-col", { parts: [SHADOWED], rootOverflow: "visible" }),
      { variables: SYNCED }
    );
    expect(variant?.root.clips).toBe(false);
  });

  it("refuses a root that paints", async () => {
    await expect(
      buildFixture(chip("flex flex-col bg-[#ffffff]", { parts: [SHADOWED], rootOverflow: "visible" }), {
        variables: SYNCED,
      })
    ).rejects.toThrow("a root that leaves its layers unclipped must paint nothing");
  });
});

// Oracle: CSS Overflow 3 §3, where `auto`, `scroll`, `hidden` and `clip` clip a box's content at its
// padding box, and a `visible` on the other axis computes to `auto` beside any of them, so a box
// that clips on one axis clips on both, as Figma's `clipsContent` does. A hugging column capped by
// `max-height` with clipping reads its cap and exports clipped, as a real file did (N10).
describe("a list capped in height that clips", () => {
  const ROWS = [1, 2, 3, 4, 5].map((at): PartDefinition => ({
    ...dot("h-[30px]"),
    key: `row-${at}`,
    slot: "row",
  }));
  // A variant root always clips, so the list is a part of the popup. The control beside it caps its
  // height the same and sets no overflow, so it shows what overflows it.
  const popup = (classes: string) =>
    chip("flex flex-col w-[200px]", {
      parts: [
        { ...dot(`flex flex-col ${classes}`), key: "list", slot: "list", parts: ROWS },
        { ...dot("flex flex-col max-h-[120px]"), key: "control", slot: "control", parts: ROWS },
      ],
    });

  it.each([
    ["overflow-y-auto", "overflow-y"],
    ["overflow-auto", "overflow"],
    ["overflow-x-hidden overflow-y-auto", "overflow-x"],
    ["overflow-y-scroll", "overflow-y"],
  ])("maps max-h-[120px] to a cap on a hugging list that clips under %s", async (overflow, property) => {
    const { variant, coverage } = await buildFixture(popup(`max-h-[120px] ${overflow}`), {
      variables: SYNCED,
    });
    const capped = { sizing: { vertical: HUG }, limits: { maxHeight: literal(120) } };
    expect(layerOf(variant?.root, "list")).toMatchObject({ ...capped, clips: true });
    expect(layerOf(variant?.root, "control")).toMatchObject({ ...capped, clips: false });
    expect(
      coverage.filter((row) => row.property === property).map((row) => [row.outcome, row.detail])
    ).toEqual([["literal", "the box clips its content"]]);
    expect(unmapped(coverage)).toEqual([]);
  });

  it("drops a cap at the available height, which the kit's popup never reaches", async () => {
    const { variant, coverage } = await buildFixture(popup("max-h-(--available-height) overflow-y-auto"), {
      variables: SYNCED,
    });
    expect(layerOf(variant?.root, "list")).toMatchObject({ limits: { maxHeight: undefined }, clips: true });
    expect(notesOf(coverage, "max-h-(--available-height)")).toEqual([
      ["max-height", "dropped", "the kit draws a popup with room, so the available height never caps it"],
    ]);
    expect(unmapped(coverage)).toEqual([]);
  });

  it("drops a cap at the available width, which the kit's popup never reaches", async () => {
    // Combobox's popup, `max-w-(--available-width)`: Base UI's positioner writes the width between the
    // anchor's side and the viewport's edge, less the collision padding, as it writes the height.
    const { variant, coverage } = await buildFixture(popup("w-[150px] max-w-(--available-width)"), {
      variables: SYNCED,
    });
    expect(layerOf(variant?.root, "list")).toMatchObject({
      sizing: { horizontal: fixed(literal(150)) },
      limits: { maxWidth: undefined },
    });
    expect(notesOf(coverage, "max-w-(--available-width)")).toEqual([
      ["max-width", "dropped", "the kit draws a popup with room, so the available width never caps it"],
    ]);
    expect(unmapped(coverage)).toEqual([]);
  });

  // Oracle: CSS Scroll Snap 1 §4.1 (`scroll-padding` insets only the scrollport's snap and scroll-into
  // -view area), CSS Overscroll Behavior 1 §2 (`overscroll-behavior` only says where a scroll chains),
  // and CSS Scrollbars 1 §3 with IE's `-ms-overflow-style` (whether a scroll container shows its
  // scrollbar). A static frame does not scroll and Figma draws no scrollbar, so none of them shows.
  it("drops a list's scroll behaviour, which a frame that does not scroll never shows", async () => {
    const classes = "max-h-[120px] overflow-y-auto no-scrollbar scroll-py-1 overscroll-contain";
    const { coverage } = await buildFixture(popup(classes), { variables: SYNCED });
    expect(
      coverage
        .filter((row) => ["no-scrollbar", "scroll-py-1", "overscroll-contain"].includes(row.className))
        .map((row) => [row.property, row.outcome])
    ).toEqual([
      ["-ms-overflow-style", "dropped"],
      ["scrollbar-width", "dropped"],
      ["scroll-padding-block", "dropped"],
      ["overscroll-behavior", "dropped"],
    ]);
    expect(unmapped(coverage)).toEqual([]);
  });

  it("caps at the length a cap takes beside an available height the kit's popup never reaches", async () => {
    // Combobox's list, `max-h-[min(calc(var(--spacing)*72),calc(var(--available-height)-calc(var(--spacing)*9)))]`.
    const cap = "max-h-[min(252px,calc(var(--available-height)-36px))]";
    const { variant, coverage } = await buildFixture(popup(`${cap} overflow-y-auto`), { variables: SYNCED });
    expect(layerOf(variant?.root, "list")).toMatchObject({
      limits: { maxHeight: literal(252) },
      clips: true,
    });
    expect(notesOf(coverage, cap)).toEqual([
      [
        "max-height",
        "literal",
        "252px, since the kit draws a popup with room, so the available height never caps it",
      ],
    ]);
    expect(unmapped(coverage)).toEqual([]);
  });
});

// Oracle: Base UI's popup states and tw-animate-css. Base UI writes `data-open` on an open popup,
// `data-closed` on a closing one, and `data-starting-style` and `data-ending-style` on the first and
// last frames of its transition. tw-animate-css's `animate-in` and `animate-out` play keyframes that
// read the `--tw-enter-*` and `--tw-exit-*` lengths the fade, zoom and slide classes set, about the
// `transform-origin` Base UI publishes. A popup at rest after its enter animation shows none of them,
// and the kit draws the popup at rest.
describe("a popup's motion", () => {
  const MOTION = [
    "origin-(--transform-origin)",
    "data-[side=bottom]:slide-in-from-top-2",
    "data-open:animate-in",
    "data-open:fade-in-0",
    "data-open:zoom-in-95",
    "data-closed:animate-out",
    "data-closed:fade-out-0",
    "data-closed:zoom-out-95",
    "duration-100",
    "data-starting-style:opacity-0",
    "data-ending-style:opacity-0",
  ];
  const popup = chip(`flex flex-col w-[200px] ${MOTION.join(" ")}`, {
    facts: new Map<string, () => boolean>([
      ["data-open", () => true],
      ["data-closed", () => false],
      ["data-[side=bottom]", () => true],
    ]),
  });

  it("drops every motion class with its reason", async () => {
    const { variant, coverage } = await buildFixture(popup, { variables: SYNCED });
    expect(variant?.root.opacity).toBe(1);
    expect(unmapped(coverage)).toEqual([]);
    expect(
      coverage.filter((row) => MOTION.includes(row.className)).filter((row) => row.outcome !== "dropped")
    ).toEqual([]);
    expect(notesOf(coverage, "data-starting-style:opacity-0")).toEqual([
      [
        "opacity",
        "dropped",
        "Base UI sets `data-starting-style` on a transition's first frame, and the kit draws the component at rest",
      ],
    ]);
    expect(notesOf(coverage, "origin-(--transform-origin)")).toEqual([
      [
        "transform-origin",
        "dropped",
        "the box sets no transform at rest, so the origin a transform moves about moves nothing",
      ],
    ]);
  });
});

// Oracle: CSS 2.1 §10.3.7 and §10.3.3. An absolutely placed popup with no width of its own shrinks to
// fit its widest block, at least its `min-width`, and every block in it is that wide. A Figma column
// whose layers all fill hugs only to its `minWidth` (PM), and one that hugs a layer takes that layer's
// width while its filling layers stretch to it (PH2, PF). So the row the popup names hugs, every other
// block fills, and a popup that names none hugs its `minWidth`.
describe("a popup that hugs its rows and names the row that sets its width", () => {
  const block = [{ className: "user agent style sheet, div", property: "display", value: "block" }] as const;
  const row = (key: string, characters: string, setsWidth: boolean): PartDefinition => {
    const part: PartDefinition = {
      ...dot("flex px-[8px] font-sans text-[14px]/[20px] text-[#000000]"),
      key,
      slot: key,
      label: { ...TEXT, characters },
    };
    return setsWidth ? { ...part, setsWidth: () => true } : part;
  };
  const popup = (classes: string, names: boolean) =>
    chip(`${classes} p-[4px]`, {
      elementDefaults: block,
      parts: [
        row("short", "Short", false),
        {
          ...dot(""),
          key: "group",
          slot: "group",
          elementDefaults: block,
          parts: [row("long", "A much longer row", names), row("mid", "Middle", false)],
        },
      ],
    });
  const sizingOf = (box: BoxSpec | undefined, name: string) => {
    const layer = layerOf(box, name);
    return layer?.kind === "frame" ? layer.sizing.horizontal : layer;
  };

  it("hugs the named row and the group around it, and fills every other block", async () => {
    const { variant, coverage } = await buildFixture(popup("min-w-[128px]", true), { variables: SYNCED });
    const root = variant?.root;
    const group = layerOf(root, "group");
    expect([
      root?.sizing.horizontal,
      sizingOf(root, "short"),
      sizingOf(root, "group"),
      group?.kind === "frame" ? sizingOf(group, "long") : group,
      group?.kind === "frame" ? sizingOf(group, "mid") : group,
    ]).toEqual([HUG, FILL, HUG, HUG, FILL]);
    // The popup's 128px minimum less its 4px padding on each side keeps the named row at least 120px
    // wide, so it never draws narrower than the rows that fill (PH3).
    const long = group?.kind === "frame" ? layerOf(group, "long") : group;
    expect(long?.kind === "frame" ? long.limits.minWidth : long).toEqual(literal(120));
    expect(
      notesOf(coverage, "user agent style sheet, div").map(([property, outcome]) => [property, outcome])
    ).toEqual([
      ["display", "literal"],
      ["display", "literal"],
    ]);
    expect(unmapped(coverage)).toEqual([]);
  });

  it("fills every block of a popup that names no row, which hugs its minimum", async () => {
    const { variant, coverage } = await buildFixture(popup("min-w-[128px]", false), { variables: SYNCED });
    const root = variant?.root;
    expect([root?.limits.minWidth, sizingOf(root, "short"), sizingOf(root, "group")]).toEqual([
      literal(128),
      FILL,
      FILL,
    ]);
    expect(unmapped(coverage)).toEqual([]);
  });

  it("leaves a hugging block box with no minimum and no named row as it was, its display unmapped", async () => {
    const { coverage } = await buildFixture(popup("", false), { variables: SYNCED });
    expect(notesOf(coverage, "user agent style sheet, div")).toContainEqual([
      "display",
      "unmapped",
      expect.any(String),
    ]);
  });
});

// Oracle: CSS 2.1 §10.6.3, where a block with no in-flow children, no padding, no border and no
// height is 0 tall, and CSS Backgrounds 3, where a box with no background, border or shadow paints
// nothing; probe PE4, where Figma keeps an auto-layout frame with no children at its last height
// rather than hugging it to 0. So a part none of whose parts shows in a cell, which paints nothing and
// pads nothing down a column, draws in no layer there.
describe("an empty part", () => {
  const ROW: PartDefinition = { ...dot("h-[30px]"), key: "row", slot: "row", shownIn: () => false };
  const popup = (list: string, rows: readonly PartDefinition[] = [ROW]) =>
    chip("flex flex-col w-[200px] bg-[#ffffff]", {
      parts: [
        { ...dot("h-[20px]"), key: "header", slot: "header" },
        { ...dot(list), key: "list", slot: "list", parts: rows },
      ],
    });
  const EMPTY_REASON =
    "the part holds nothing in this cell, paints nothing and pads nothing down its column, so CSS draws it 0 tall, while Figma keeps an auto-layout frame with no children at its last height (PE4)";

  it("draws no layer for a part that holds nothing, paints nothing and pads nothing", async () => {
    const { variant, coverage } = await buildFixture(popup("p-0 max-h-[120px] overflow-y-auto"), {
      variables: SYNCED,
    });
    expect(layerNames(variant?.root)).toEqual(["header"]);
    expect(notesOf(coverage, "max-h-[120px]")).toEqual([["max-height", "dropped", EMPTY_REASON]]);
    expect(unmapped(coverage)).toEqual([]);
  });

  it.each([
    ["pads down its column", "py-1"],
    ["paints a fill", "bg-[#eeeeee]"],
    ["sets a height", "h-[10px]"],
    ["keeps a margin", "mt-2"],
  ])("draws a part that %s", async (_why, classes) => {
    const { variant } = await buildFixture(popup(classes), { variables: SYNCED });
    expect(layerNames(variant?.root)).toEqual(["header", "list"]);
  });

  it("draws a part that holds no parts in any cell, a box drawn by its own lengths", async () => {
    const { variant } = await buildFixture(popup("p-0", []), { variables: SYNCED });
    expect(layerNames(variant?.root)).toEqual(["header", "list"]);
  });

  it("draws a part that holds a row", async () => {
    const { variant } = await buildFixture(popup("p-0", [{ ...ROW, shownIn: () => true }]), {
      variables: SYNCED,
    });
    expect(layerNames(variant?.root)).toEqual(["header", "list"]);
  });
});

// Figma takes a text layer's sizing from the main component and only its characters from the TEXT
// property, so a label a property sets in place draws as its variant lays it out. CSS Flexbox 1 §8.1
// and §9.7, as above: a label first of two layers spaced by an auto margin, beside a layer that keeps
// its own width, fills the room left at any text that fits, and a one-word label that keeps its own
// width draws a text with no break opportunity only.
describe("a label a TEXT property sets in place", () => {
  const keys: PartDefinition = {
    ...dot("flex ms-auto shrink-0", [{ ...ICON, classes: "size-[16px]" }]),
    key: "keys",
    slot: "keys",
    after: "label",
  };
  const row = (characters: string): ComponentDefinition =>
    chip("flex w-[200px] gap-[8px] font-sans text-[14px]/[20px] text-[#000000]", {
      key: "row",
      name: "Row",
      slot: "row",
      label: { ...TEXT, characters, textProperty: "Label" },
      parts: [keys],
    });
  const holding = (inner: ComponentDefinition, characters: string) =>
    chip("flex w-[200px] flex-col", {
      parts: [
        {
          kind: "instance",
          key: "row",
          of: inner,
          cell: () => ({ state: "rest" }),
          shownIn: () => true,
          properties: () => ({ text: { Label: characters } }),
        },
      ],
    });

  it("takes its variant's filling layout for one word, which draws it as CSS does", async () => {
    const inner = row("Two words");
    const [, built] = await buildFixtures([inner, holding(inner, "Customers")], { variables: SYNCED });
    expect(built?.componentSet.variants[0]?.root.children[0]).toMatchObject({
      kind: "instance",
      properties: { text: { Label: "Customers" } },
    });
    expect(unmapped(built?.coverage ?? [])).toEqual([]);
  });

  it("stays unmapped where its variant keeps one word at its own width and the text it gets can wrap", async () => {
    const inner = row("Customers");
    const [own, built] = await buildFixtures([inner, holding(inner, "Two words")], { variables: SYNCED });
    expect(unmapped(own?.coverage ?? [])).toEqual([]);
    expect(unmapped(built?.coverage ?? []).map((row) => row.property)).toEqual(["primaryAlign", "sizing"]);
  });
});
