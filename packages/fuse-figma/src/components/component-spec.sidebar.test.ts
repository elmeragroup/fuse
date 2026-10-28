/**
 * Build rules Sidebar's rows are the first sets to need, against the one-cell `chip` fixture of
 * `test/fixture-sets.ts`. The unit under test is `buildComponentSet`. Each describe names its
 * oracle.
 */
import { describe, expect, it } from "vitest";

import { FILL, fixed, fixedSize, HUG, literal } from "../../test/built-kit";
import { buildFixture, buildFixtures, chip, dot, frameOf, ICON } from "../../test/fixture-sets";
import type { ComponentDefinition, LabelDefinition } from "./component-spec";
import type { CoverageRow } from "./coverage";
import { makeVariableIndex } from "./css-values";
import type { BoxSpec, TextLayerSpec } from "./kit-spec";

/** The property, value, outcome and detail of each coverage row of one class, by property. */
const rowsOf = (coverage: readonly CoverageRow[], className: string) =>
  coverage
    .filter((row) => row.className === className)
    .map((row) => [row.property, row.value, row.outcome, row.detail])
    .toSorted(([left = ""], [right = ""]) => (left < right ? -1 : left > right ? 1 : 0));

// Oracle: CSS Cascade 4 §6.1, where an author's important declaration beats every normal one of the
// author, whatever their specificity or order, as a collapsed Sidebar row's `size-8!` beats the
// row's own height. Tailwind compiles a `!` suffix to declarations marked `!important`.
// `data-active:w-[10px]` is (0,2,0), more specific than `size-[32px]!` at (0,1,0), and Tailwind
// emits `px-[4px]` after `p-[8px]!`, so only the importance decides each length.
describe("an important declaration", () => {
  it("beats a more specific or later normal one, on each side of a shorthand", async () => {
    const { variant, coverage } = await buildFixture(
      chip("w-[40px] data-active:w-[10px] size-[32px]! p-[8px]! px-[4px]", {
        facts: new Map([["data-active", () => true]]),
      })
    );
    expect(variant?.root.sizing).toEqual(fixedSize(literal(32), literal(32)));
    expect([
      variant?.root.paddingTop,
      variant?.root.paddingRight,
      variant?.root.paddingBottom,
      variant?.root.paddingLeft,
    ]).toEqual([literal(8), literal(8), literal(8), literal(8)]);
    expect(rowsOf(coverage, "size-[32px]!").map(([property, value]) => [property, value])).toEqual([
      ["height", "32px"],
      ["width", "32px"],
    ]);
  });
});

// Oracle: Selectors 4 §17, where `:where()` adds nothing to a selector's specificity, so
// `[:where(&)]:` compiles a class to `:where(.class)` at (0,0,0), which any plain utility of the box
// beats whatever their order, as a Sidebar row's `[:where(&)]:rounded-md` yields to a consumer's
// corner. The variant tests nothing of the cell, so the class holds in every cell.
describe("a class whose variant only lowers its specificity", () => {
  const RED = { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } };
  const GREEN = { kind: "literal", color: { r: 0, g: 1, b: 0, a: 1 } };

  it("applies in every cell", async () => {
    const { variant } = await buildFixture(chip("[:where(&)]:bg-[#ff0000]"));
    expect(variant?.root.fill).toEqual(RED);
  });

  it("loses to a plain class of the box", async () => {
    const { variant } = await buildFixture(chip("[:where(&)]:bg-[#ff0000] bg-[#00ff00]"));
    expect(variant?.root.fill).toEqual(GREEN);
  });
});

// Oracle: CSS Backgrounds 3 §3, where a border of no width paints nothing whatever its style and
// color, as a Sidebar row's `border-0` resets a `<button>`'s border, which the base layer colors.
describe("a border of no width", () => {
  it("draws no stroke", async () => {
    const { variant, coverage } = await buildFixture(chip("border-0"), {
      base: [
        { className: "fuse.css base layer", property: "border-color", value: "var(--border, currentcolor)" },
      ],
    });
    const nothing = "the border has no width, so it draws nothing";
    expect(variant?.root.stroke).toBeUndefined();
    expect([...rowsOf(coverage, "border-0"), ...rowsOf(coverage, "fuse.css base layer")]).toEqual([
      ["border-style", "var(--tw-border-style)", "dropped", nothing],
      ["border-width", "0px", "literal", "no stroke"],
      ["border-color", "var(--border, currentcolor)", "dropped", nothing],
    ]);
  });
});

// Oracle: CSS 2.1 §9.3 and §10.3.7, and CSS Transforms 2. An absolute box's offsets place it in its
// containing block, and a translate moves its painting from where layout puts it. A component's root
// sits alone in its component set, so neither moves it against anything the set draws, as a menu
// badge's `absolute right-1` places it in a menu item the badge set does not hold. An absolute box
// with no width shrinks to fit its content, so where the preview width would make the root fill,
// the position changes what the set draws and stays unmapped.
describe("a root's offsets", () => {
  const OFFSET =
    "the component's root sits alone in its component set, so the offsets that place it in its containing block place it against nothing the set draws";

  it("drop on an absolute root that hugs its content", async () => {
    const { coverage } = await buildFixture(chip("absolute top-[6px] right-1"));
    expect([
      ...rowsOf(coverage, "absolute"),
      ...rowsOf(coverage, "top-[6px]"),
      ...rowsOf(coverage, "right-1"),
    ]).toEqual([
      ["position", "absolute", "dropped", OFFSET],
      ["top", "6px", "dropped", OFFSET],
      ["right", "0.25rem", "dropped", OFFSET],
    ]);
  });

  // CSS 2.1 §9.6.1 and §9.9.1: a fixed box is an absolute box whose containing block is the
  // viewport, or the nearest ancestor that contains its paint, as the Sidebar demo frame's
  // `contain-paint` does, and `z-index` orders it among the boxes it overlaps. The root overlaps
  // nothing the set draws, so its stacking level drops with its position and offsets.
  it.each(["fixed", "absolute"])("drop with the stacking level on a %s root", async (position) => {
    const classes = `${position} inset-y-0 left-0 z-10 flex h-[40px] w-[256px]`;
    const { coverage } = await buildFixture(chip(classes));
    const STACKED =
      "the component's root sits alone in its component set, so its stacking level orders it among nothing the set draws";
    expect([
      ...rowsOf(coverage, position),
      ...rowsOf(coverage, "inset-y-0"),
      ...rowsOf(coverage, "left-0"),
      ...rowsOf(coverage, "z-10"),
    ]).toEqual([
      ["position", position, "dropped", OFFSET],
      ["bottom", "0px", "dropped", OFFSET],
      ["top", "0px", "dropped", OFFSET],
      ["left", "0px", "dropped", OFFSET],
      ["z-index", "10", "dropped", STACKED],
    ]);
  });

  it("drop as a translate on the root", async () => {
    const { coverage } = await buildFixture(chip("-translate-x-px"));
    expect(rowsOf(coverage, "-translate-x-px").filter(([property]) => property === "translate")).toEqual([
      [
        "translate",
        "var(--tw-translate-x) var(--tw-translate-y)",
        "dropped",
        "the component's root sits alone in its component set, so a translate moves it against nothing the set draws",
      ],
    ]);
  });

  // CSS 2.1 §10.3.7 and §10.6.4: opposing insets with an automatic size on that axis set the size
  // from the containing block, which the set does not draw.
  it.each([
    ["absolute inline-flex left-0 right-0 h-5", ["left", "right"], "width"],
    ["absolute top-0 bottom-0 w-10", ["bottom", "top"], "height"],
  ])("leave %s's opposing insets unmapped", async (classes, insets, axis) => {
    const { coverage } = await buildFixture(chip(classes));
    const detail = `with an automatic ${axis}, opposing insets size the absolute root from its containing block, which the set does not draw`;
    const rows = coverage
      .filter((row) => ["position", ...insets].includes(row.property))
      .map((row) => [row.property, row.outcome, row.detail])
      .toSorted(([left = ""], [right = ""]) => (left < right ? -1 : left > right ? 1 : 0));
    expect(rows).toEqual(
      [...insets, "position"].toSorted().map((property) => [property, "unmapped", detail])
    );
  });

  it("leave an absolute root unmapped where the preview width would make it fill", async () => {
    // `flex` makes the root block-level, which takes the preview width while it sits in the flow.
    const { coverage } = await buildFixture(chip("absolute flex", { previewWidth: 100 }));
    expect(rowsOf(coverage, "absolute")).toEqual([
      [
        "position",
        "absolute",
        "unmapped",
        "an absolute root shrinks to fit its content, where the preview width would make it fill",
      ],
    ]);
  });
});

/** A label held in a `<span>` with no class, as a Sidebar row holds its text. */
const SPAN_LABEL: LabelDefinition = {
  key: "label",
  name: "label",
  characters: "Label",
  textProperty: "Label",
  textElement: { tag: "span", attributes: {} },
  shownIn: () => true,
};

/** The text classes a label needs, which the chip's root carries and its label inherits. */
const TEXT_STYLE = "font-sans text-[14px] leading-[20px] text-[#000000]";

/** The class that cuts a row's last `<span>` off in an ellipsis. */
const TRUNCATE = "[&>span:last-child]:truncate";

/** Build a chip whose root carries the text style and the given classes, with `font-sans` bound. */
function buildLabelled(classes: string, fields: Parameters<typeof chip>[1] = {}) {
  return buildFixture(chip(`${TEXT_STYLE} ${classes}`, fields), {
    variables: makeVariableIndex([
      { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
    ]),
  });
}

/** The first text layer a box holds. */
function textOf(box: BoxSpec | undefined): TextLayerSpec | undefined {
  const found = box?.children.find((child) => child.kind === "text");
  return found?.kind === "text" ? found : undefined;
}

/** The property, outcome and detail of each coverage row of the truncating class, by property. */
const truncateRows = (coverage: readonly CoverageRow[]) =>
  rowsOf(coverage, TRUNCATE).map(([property, , outcome, detail]) => [property, outcome, detail]);

// Oracle: CSS Display 3 §2.7, CSS Flexbox 1 §4.5 and CSS Overflow 3 §4.2. A flex item is
// blockified, so a `<span>` in a flex row is a block container that takes its own `text-overflow`,
// and one that hides its overflow has an automatic minimum width of 0, so it shrinks below its text.
// Last in a row that packs its layers at the start, with nothing growing, it is as wide as its text
// up to the room the row leaves it, where `truncate` ends the text in an ellipsis. A Figma text that
// fills that room and truncates after one line draws the same pixels, since nothing sits after it.
// Tailwind compiles `[&>span:last-child]:truncate` to `.… > span:last-child`.
describe("a label in a `<span>` that `[&>span:last-child]:` styles", () => {
  it("fills the room a fixed row leaves it and ends in an ellipsis after one line", async () => {
    const { variant, coverage } = await buildLabelled(
      `flex w-[100px] gap-[8px] [&_svg]:size-[16px] ${TRUNCATE}`,
      {
        label: SPAN_LABEL,
        iconsFor: () => [ICON],
      }
    );
    const text = textOf(variant?.root);
    expect([text?.sizing, text?.truncation]).toEqual([{ horizontal: FILL, vertical: HUG }, { maxLines: 1 }]);
    expect(truncateRows(coverage)).toEqual([
      ["overflow", "literal", "the label's element clips its text at the room the row leaves it"],
      ["text-overflow", "literal", "the label ends in an ellipsis after 1 line"],
      ["text-wrap-mode", "literal", "the label keeps to one line"],
      [
        "white-space-collapse",
        "dropped",
        "the characters hold no run of white space or line break to collapse",
      ],
    ]);
  });

  // An unset `justify-content` packs a row's layers at the start (CSS Box Alignment 3 §5.1), which
  // shows where they overflow it, as the icon and the 8px gap before the label overflow the 16px a
  // collapsed Sidebar row leaves inside its padding: the icon keeps its place at the start.
  it("packs its row's layers at the start, where they overflow the row", async () => {
    const { variant } = await buildLabelled(
      `flex w-[32px] p-[8px] gap-[8px] [&_svg]:size-[16px] ${TRUNCATE}`,
      { label: SPAN_LABEL, iconsFor: () => [ICON] }
    );
    expect(variant?.root.primaryAlign).toBe("MIN");
    expect(textOf(variant?.root)?.sizing).toEqual({ horizontal: FILL, vertical: HUG });
  });

  it("hugs its text in a row that hugs its width, where it never overflows", async () => {
    const { variant, coverage } = await buildLabelled(`flex gap-[8px] [&_svg]:size-[16px] ${TRUNCATE}`, {
      label: SPAN_LABEL,
      iconsFor: () => [ICON],
    });
    const text = textOf(variant?.root);
    expect([text?.sizing, text?.truncation]).toEqual([{ horizontal: HUG, vertical: HUG }, undefined]);
    expect(truncateRows(coverage)).toEqual([
      ["overflow", "dropped", "the box hugs the label, so it never overflows"],
      ["text-overflow", "dropped", "the box hugs the label, so it never overflows"],
      ["text-wrap-mode", "literal", "the label hugs its width"],
      [
        "white-space-collapse",
        "dropped",
        "the characters hold no run of white space or line break to collapse",
      ],
    ]);
  });

  // A flex item does not grow by default (CSS Flexbox 1 §7.1), so a short span keeps its own width at
  // the row's start, where a filling text would set its characters across the row by its alignment.
  it.each([
    ["packs its layers at the end", "justify-end"],
    ["centers its text", "text-center"],
    ["sets its text from the end", "text-right"],
  ])("stays unmapped in a row that %s", async (_row, placement) => {
    const { coverage } = await buildLabelled(`flex w-[100px] ${placement} ${TRUNCATE}`, {
      label: SPAN_LABEL,
    });
    const detail =
      "the label's element ends no row that packs its layers at the start with none growing and sets its text from the start, where a text that fills the room left draws it";
    expect(truncateRows(coverage)).toEqual([
      ["overflow", "unmapped", detail],
      ["text-overflow", "unmapped", detail],
      ["text-wrap-mode", "unmapped", detail],
      ["white-space-collapse", "unmapped", detail],
    ]);
  });

  // A row that hugs its width up to a `max-width` shrinks the span to the room the cap leaves, where
  // `truncate` cuts the text off. A hugging Figma text keeps its own width past its frame's limit (P7),
  // and no probe has shown a hugging text truncate at a `maxWidth`, so the span's layout stays
  // unmapped.
  it("stays unmapped in a row that hugs its width up to a cap", async () => {
    const { coverage } = await buildLabelled(`flex max-w-[100px] ${TRUNCATE}`, {
      label: { ...SPAN_LABEL, characters: "A label much longer than the cap of its row" },
    });
    const detail =
      "the row hugs its width up to a cap, where CSS cuts the label's element off, and a text in a hugging frame keeps its own width";
    expect(truncateRows(coverage)).toEqual([
      ["overflow", "unmapped", detail],
      ["text-overflow", "unmapped", detail],
      ["text-wrap-mode", "unmapped", detail],
      ["white-space-collapse", "unmapped", detail],
    ]);
  });

  it("is unmapped where the box holds its label in no `<span>`", async () => {
    const { textElement: _span, ...ownText } = SPAN_LABEL;
    const { coverage } = await buildLabelled(`flex w-[100px] ${TRUNCATE}`, { label: ownText });
    const detail = "the definition holds no label in a `<span>` that is the last child of chip";
    expect(truncateRows(coverage)).toEqual([
      ["overflow", "unmapped", detail],
      ["text-overflow", "unmapped", detail],
      ["white-space", "unmapped", detail],
    ]);
  });
});

// Oracle: CSS Cascade 4 §6, where importance orders the declarations of one element, and CSS
// inheritance, where a child inherits the value its parent's cascade computed, and an element's own
// declaration beats every value it inherits, however important that value was on the element that
// declared it. The page's declarations reach the root as inherited values, and the same page gives
// the same value with or without an element named around the root.
describe("an important declaration of the page", () => {
  const RED = { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } };
  const BLUE = { kind: "literal", color: { r: 0, g: 0, b: 1, a: 1 } };
  const important = { className: "body", property: "color", value: "#ff0000 !important" };
  const later = { className: "body", property: "color", value: "#0000ff" };
  const fonts = makeVariableIndex([
    { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
  ]);
  const { textElement: _span, ...ownText } = SPAN_LABEL;
  const around = { slot: "chip-host", classes: "", undrawn: "the host lays out nothing the set draws" };
  const cases = [
    { face: "loses to the root's own color", page: [important], color: "text-[#0000ff]", expected: BLUE },
    {
      face: "beats the page's later color in what the root inherits",
      page: [important, later],
      color: "",
      expected: RED,
    },
  ];
  const arounds = [
    { where: "no element", fields: {} },
    { where: "an element", fields: { ancestorsFor: () => [around] } },
  ];

  it.each(cases.flatMap((entry) => arounds.map((place) => ({ ...entry, ...place }))))(
    "$face with $where around the root",
    async ({ page, color, expected, fields }) => {
      const { variant } = await buildFixture(
        chip(`font-sans text-[14px] leading-[20px] ${color}`, { label: ownText, ...fields }),
        { page, variables: fonts }
      );
      expect(textOf(variant?.root)?.color).toEqual(expected);
    }
  );
});

// Oracle: CSS Backgrounds 3 §3 and CSS 2.1 §8.1. A border on one side lies inside the border box
// between the margin and the padding of that side, so `border-l` puts the content 1px further from
// the box's left edge than its padding alone does, and the sides with no border width draw nothing,
// as a Sidebar container's `border-r` and a sub menu's `border-l` draw. Probe PS: Figma's per-side
// weights with `strokesIncludedInLayout` true take room on their own side, as a CSS border does, so
// each padding stays as the CSS sets it.
describe("a border on some sides", () => {
  const RED = { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } };
  const room = (side: string, width: number) =>
    `a ${width}px ${side} stroke that takes its room on that side (PS)`;

  it("strokes those sides in the layout and leaves each padding as the CSS sets it", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex border-l border-r-2 border-[#ff0000] px-[10px]")
    );
    expect(variant?.root.stroke).toEqual({ color: RED, sides: { top: 0, right: 2, bottom: 0, left: 1 } });
    expect([
      variant?.root.paddingTop,
      variant?.root.paddingRight,
      variant?.root.paddingBottom,
      variant?.root.paddingLeft,
    ]).toEqual([literal(0), literal(10), literal(0), literal(10)]);
    expect([...rowsOf(coverage, "border-l"), ...rowsOf(coverage, "border-r-2")]).toEqual([
      ["border-left-style", "var(--tw-border-style)", "literal", "a solid stroke"],
      ["border-left-width", "1px", "literal", room("left", 1)],
      ["border-right-style", "var(--tw-border-style)", "literal", "a solid stroke"],
      ["border-right-width", "2px", "literal", room("right", 2)],
    ]);
  });

  it("keeps a bound padding beside the border", async () => {
    const { variant } = await buildFixture(chip("flex border-l border-[#ff0000] px-(--row-px)"), {
      variables: makeVariableIndex([
        { ref: { collection: "Fuse density", name: "row-px" }, webSyntax: "var(--row-px)" },
      ]),
    });
    const ROW_PX = { kind: "variable", variable: { collection: "Fuse density", name: "row-px" } };
    expect([variant?.root.stroke, variant?.root.paddingLeft]).toEqual([
      { color: RED, sides: { top: 0, right: 0, bottom: 0, left: 1 } },
      ROW_PX,
    ]);
  });

  // CSS 2.1 §10.1 and §10.2: an absolute box's percentage width takes its containing block, the
  // padding box of its nearest positioned ancestor, which lies inside the borders.
  it("leaves an absolute part's 100% width the padding box inside the border", async () => {
    const { variant } = await buildFixture(
      chip("relative flex w-[256px] border-r border-[#ff0000]", {
        parts: [dot("absolute top-0 left-0 w-full h-[4px]")],
      })
    );
    const part = variant?.root.children[0];
    expect(part?.kind === "frame" ? part.sizing.horizontal : undefined).toEqual(fixed(literal(255)));
  });

  it("leaves a side unmapped where the box also sets a border on every side", async () => {
    const { variant, coverage } = await buildFixture(chip("border border-r-2 border-[#ff0000]"));
    expect(variant?.root.stroke).toEqual({ color: RED, weight: literal(1) });
    expect(rowsOf(coverage, "border-r-2").map(([property, , outcome]) => [property, outcome])).toEqual([
      ["border-right-style", "unmapped"],
      ["border-right-width", "unmapped"],
    ]);
  });
});

// Oracle: CSS 2.1 §10.5, where a percentage height takes the height of the containing block when
// that block's height is given, as the Sidebar demo frame's `h-[28rem]` gives the Sidebar container's
// `h-full`. With no preview height a root's percentage height has no block to take.
describe("a root's 100% height", () => {
  it("takes the preview height the definition names", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex flex-col w-[256px] h-full", { previewHeight: { pixels: 448 } })
    );
    expect(variant?.root.sizing.vertical).toEqual(fixed(literal(448)));
    expect(rowsOf(coverage, "h-full")).toEqual([
      ["height", "100%", "literal", "448px, the preview height that 100% takes"],
    ]);
  });
});

// Oracle: CSS Color 4 §3.2, where `opacity: 0` paints nothing of the box or what it holds, and CSS
// 2.1 §8.3 and §10.6, where a top margin of minus the box's height leaves its margin box 0 tall, so the
// box takes no room in a column that sets no gap, as the collapsed Sidebar rail's group label
// (`h-8 -mt-8 opacity-0`) pulls the rows up and fades out.
describe("a part that leaves no trace", () => {
  const label = (classes: string) => ({ ...dot(classes), key: "label", slot: "chip-label" });
  const row = { ...dot("h-[32px]"), key: "row", slot: "chip-row" };
  const NO_TRACE =
    "the part paints nothing at opacity 0, and its top margin takes back its height, so it takes no room in its column";

  it("draws in no layer, its declarations dropped", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex flex-col w-[48px]", { parts: [label("flex h-[32px] -mt-[32px] opacity-0"), row] })
    );
    expect(variant?.root.children.map((child) => child.name)).toEqual(["chip-row"]);
    expect(
      coverage
        .filter((row) => row.part === "chip-label")
        .map((row) => [row.property, row.outcome, row.detail])
        .toSorted(([left = ""], [right = ""]) => (left < right ? -1 : left > right ? 1 : 0))
    ).toEqual([
      ["display", "dropped", NO_TRACE],
      ["height", "dropped", NO_TRACE],
      ["margin-top", "dropped", NO_TRACE],
      ["opacity", "dropped", NO_TRACE],
    ]);
  });

  it.each([
    ["a margin short of its height", "flex flex-col", "h-[32px] -mt-[16px] opacity-0"],
    ["a part it still paints", "flex flex-col", "h-[32px] -mt-[32px] opacity-50"],
    ["a column that spaces its parts", "flex flex-col gap-[4px]", "h-[32px] -mt-[32px] opacity-0"],
  ])("stays drawn with %s", async (_case, column, classes) => {
    const { variant } = await buildFixture(chip(`${column} w-[48px]`, { parts: [label(classes), row] }));
    expect(variant?.root.children.map((child) => child.name)).toEqual(["chip-label", "chip-row"]);
  });

  // A collapsed Sidebar group's label is an instance of the label set, whose rail arm the group's
  // instance names as a fact, so the in-place root takes the fade and the pull-up.
  describe("as an instance", () => {
    const RAIL = "group-data-[collapsible=icon]";
    const inner = (pullUp: string) =>
      chip(`flex h-[32px] ${RAIL}:${pullUp} ${RAIL}:opacity-0`, {
        key: "label",
        name: "Label",
        slot: "label",
        omittedCompositions: new Map([[RAIL, "the rail, which the label set does not draw"]]),
      });
    const holder = (of: ComponentDefinition) =>
      chip("flex flex-col w-[48px]", {
        key: "group",
        name: "Group",
        slot: "group",
        parts: [
          {
            kind: "instance",
            key: "label",
            of,
            cell: () => ({ state: "rest" }),
            facts: new Map([[RAIL, () => true]]),
            shownIn: () => true,
          },
          row,
        ],
      });

    it("draws in no layer and leaves no unmapped row", async () => {
      const of = inner("-mt-[32px]");
      const [, built] = await buildFixtures([of, holder(of)]);
      expect(built?.componentSet.variants[0]?.root.children.map((child) => child.name)).toEqual(["chip-row"]);
      expect(built?.coverage.filter((covered) => covered.outcome === "unmapped")).toEqual([]);
    });

    it("stays drawn with a margin short of its height", async () => {
      const of = inner("-mt-[16px]");
      const [, built] = await buildFixtures([of, holder(of)]);
      expect(built?.componentSet.variants[0]?.root.children.map((child) => child.name)).toEqual([
        "label",
        "chip-row",
      ]);
    });
  });
});

// Oracle: CSS 2.1 §9.2.1, where `display: list-item` makes a box block-level, and §10.3.3, where a
// block-level box with no width fills its containing block, as a Sidebar menu item fills its menu.
describe("a list item root", () => {
  it("takes the preview width and stacks its block parts down it", async () => {
    const { variant, coverage } = await buildFixture(
      chip("relative", {
        previewWidth: 120,
        elementDefaults: [
          { className: "user agent style sheet, li", property: "display", value: "list-item" },
        ],
        parts: [{ ...dot("flex h-[32px] w-full"), key: "row", slot: "chip-row" }],
      })
    );
    expect(variant?.root.sizing).toEqual({ horizontal: fixed(literal(120)), vertical: HUG });
    expect(variant?.root.direction).toBe("VERTICAL");
    expect(frameOf(variant?.root)?.sizing).toEqual({ horizontal: FILL, vertical: fixed(literal(32)) });
    expect(coverage.filter((covered) => covered.outcome === "unmapped")).toEqual([]);
  });
});
