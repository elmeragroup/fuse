/**
 * Build rules the menu sets are the first to need, against the one-cell `chip` fixture of
 * `test/fixture-sets.ts`. The unit under test is `buildComponentSet`. Each describe names its
 * oracle.
 */
import { describe, expect, it } from "vitest";

import { density, FILL, fixed, HUG, literal } from "../../test/built-kit";
import { buildFixture, buildFixtures, chip, dot, ICON } from "../../test/fixture-sets";
import type { ComponentDefinition, LabelDefinition, PartDefinition } from "./component-spec";
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

  it.each([
    ["on the first of two layers", [caret("ml-auto", "start")]],
    ["on the last of three layers", [caret("", "start"), caret("ml-auto", "end")]],
  ])("stays unmapped %s", async (_case, icons) => {
    const { variant, coverage } = await buildFixture(row(icons), { variables: SYNCED });
    expect(textOf(variant?.root)?.sizing.horizontal).toEqual(HUG);
    expect(notesOf(coverage, "ml-auto")).toEqual([
      ["margin-left", "unmapped", "the builder maps no Figma field from it"],
    ]);
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
