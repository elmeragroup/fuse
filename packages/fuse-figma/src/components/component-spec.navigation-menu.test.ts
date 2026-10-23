/**
 * Build rules Navigation menu's triggers and links are the first sets to need, against the one-cell
 * `chip` fixture of `test/fixture-sets.ts`. The unit under test is `buildComponentSet`. Each describe
 * names its oracle.
 */
import { describe, expect, it } from "vitest";

import { density, FILL, fixed, HUG, literal } from "../../test/built-kit";
import { buildFixture, chip, dot, frameOf, ICON } from "../../test/fixture-sets";
import type { LabelDefinition } from "./component-spec";
import type { CoverageRow } from "./coverage";
import { makeVariableIndex } from "./css-values";
import type { BoxSpec } from "./kit-spec";

/** The property, outcome and detail of each coverage row of one class. */
const notesOf = (coverage: readonly CoverageRow[], className: string) =>
  coverage.filter((row) => row.className === className).map((row) => [row.property, row.outcome, row.detail]);

/** The synced variables the fixtures bind. */
const SYNCED = makeVariableIndex(
  ["font-sans", "foreground"].map((name) => ({
    ref: { collection: "Fuse tokens", name },
    webSyntax: `var(--${name})`,
  }))
);

/** The page's text color, as the docs layout sets it on `<body>`. */
const PAGE = [{ className: "body text-foreground", property: "color", value: "var(--foreground)" }];

/** A label the root holds, which reads the text color and weight the root computes. */
const TEXT: LabelDefinition = {
  key: "text",
  name: "text",
  characters: "Chip",
  textProperty: undefined,
  shownIn: () => true,
};

const token = (name: string) =>
  ({ kind: "variable", variable: { collection: "Fuse tokens", name } }) as const;

/** The text layer a root holds. */
function textOf(box: BoxSpec | undefined) {
  const text = box?.children.find((child) => child.kind === "text");
  return text?.kind === "text" ? text : undefined;
}

// Oracle: CSS Cascade 4 §7.3.1, where `inherit` gives an element its parent's computed value, and
// the page is the parent of the root, as `<body>` holds a Navigation menu trigger whose
// `text-inherit` takes the page's `text-foreground`. The page computes its own color, whether a host
// declaration sits between it and the root or not.
describe("a root's inherit", () => {
  const inheriting = chip("font-sans text-[14px]/[20px] text-inherit", { label: TEXT });
  it.each([
    ["no host declaration", inheriting],
    [
      "a host declaration",
      { ...inheriting, inheritedFor: () => [{ className: "html", property: "font-size", value: "16px" }] },
    ],
  ])("takes the page's color, with %s", async (_case, definition) => {
    const { variant, coverage } = await buildFixture(definition, { variables: SYNCED, page: PAGE });
    expect(textOf(variant?.root)?.color).toEqual(token("foreground"));
    expect(notesOf(coverage, "text-inherit")).toEqual([["color", "bound", "Fuse tokens / foreground"]]);
  });
});

// Oracle: CSS Cascade 4 §7.3.1, where `inherit` takes the parent's computed value, and CSS Fonts 4
// §2.2, where `font-weight` starts as `normal`, 400, on the document's root. The docs page sets no
// weight on `<html>` or `<body>`, so a vertical trigger's `font-[number:inherit]` draws Regular there,
// and a weight the host sets passes down.
describe("an inherited weight", () => {
  const inheriting = chip("font-sans text-[14px]/[20px] font-[number:inherit]", { label: TEXT });
  it.each([
    ["nothing outside sets a weight", inheriting, "Regular"],
    [
      "the host sets one",
      { ...inheriting, inheritedFor: () => [{ className: "host", property: "font-weight", value: "500" }] },
      "Medium",
    ],
  ])("takes the weight from outside where %s", async (_case, definition, fontStyle) => {
    const { variant, coverage } = await buildFixture(definition, { variables: SYNCED, page: PAGE });
    expect(textOf(variant?.root)?.fontStyle).toBe(fontStyle);
    expect(notesOf(coverage, "font-[number:inherit]")).toContainEqual([
      "font-weight",
      "literal",
      `font style ${fontStyle}`,
    ]);
  });

  // CSS Custom Properties 1 §3 makes an ancestor's `font-weight: var(--missing)` invalid at
  // computed-value time, and the browser then computes it as `unset`, the page's 500 here. The build
  // carries such a value down as invalid with the declaration that made it so, as it does for every
  // inherited property, and leaves a read of it unmapped, so the gate shows the failed declaration
  // where the initial 400 would hide it.
  it("leaves a weight an ancestor makes invalid unmapped", async () => {
    const { coverage } = await buildFixture(
      {
        ...inheriting,
        ancestorsFor: () => [
          {
            slot: "chip-host",
            classes: "font-[number:var(--missing)]",
            undrawn: "the host lays out nothing the set draws",
          },
        ],
      },
      {
        variables: SYNCED,
        page: [...PAGE, { className: "body font-medium", property: "font-weight", value: "500" }],
      }
    );
    expect(
      [
        ...notesOf(coverage, "font-[number:inherit]"),
        ...notesOf(coverage, "font-[number:var(--missing)]"),
      ].filter(([property]) => property === "font-weight")
    ).toEqual([
      ["font-weight", "unmapped", "no Figma field reads an invalid value"],
      ["font-weight", "unmapped", "no Figma field reads an invalid value"],
    ]);
  });
});

// Oracle: CSS Flexbox 1 §4 and §9.7, and CSS Box Alignment 3 §8. A flex row sets its text as an
// anonymous item that does not grow and shrinks to the room the row's other layers and its gap leave,
// where it wraps. First of two layers in a row that spaces them between its ends, the item sits at the
// start at its own width, its lines start at its start, and the other layer ends the row, at least the
// gap away, which a text that fills the room left draws the same, short or long, as a vertical
// Navigation menu trigger holds its title and caret. A filling layer leaves no room to space out, so
// the row packs its layers at the start with the gap between them: a real file kept no gap under
// SPACE_BETWEEN beside a filling text on 2026-10-23 (PV).
describe("a label first of two layers spaced between the ends of a row", () => {
  const TWO_WORDS = { ...TEXT, characters: "Two words" };
  const END_ICON = { ...ICON, side: "end", classes: "size-[16px]" } as const;
  const START_ICON = { ...ICON, classes: "size-[16px]" };
  const row = (classes: string, icon: typeof START_ICON) =>
    chip(`flex w-[200px] font-sans text-[14px]/[20px] ${classes}`, {
      label: TWO_WORDS,
      iconsFor: () => [icon],
    });

  it("fills the room the other layer and the gap leave, packed at the start", async () => {
    const { variant, coverage } = await buildFixture(row("justify-between gap-[8px]", END_ICON), {
      variables: SYNCED,
      page: PAGE,
    });
    expect([
      variant?.root.primaryAlign,
      variant?.root.itemSpacing,
      textOf(variant?.root)?.sizing.horizontal,
    ]).toEqual(["MIN", literal(8), FILL]);
    expect(notesOf(coverage, "justify-between")).toContainEqual([
      "justify-content",
      "literal",
      "the label fills the room the other layer leaves, so nothing is left to space out, and the row packs its layers at the start with its gap between them",
    ]);
  });

  it.each([
    ["packs the two at the start", row("", END_ICON), "Icon"],
    ["puts the label last", row("justify-between", START_ICON), "Icon"],
  ])("stays unmapped where the row %s", async (_case, definition, other) => {
    const { variant, coverage } = await buildFixture(definition, { variables: SYNCED, page: PAGE });
    expect(textOf(variant?.root)?.sizing.horizontal).toEqual(HUG);
    expect(notesOf(coverage, "flex")).toContainEqual([
      "display",
      "unmapped",
      `the label shares the row with ${other}, so it keeps its own width, where a text that fills takes the room left`,
    ]);
  });
});

// Oracle: CSS Sizing 3 §5.1, where `max-content` makes a box as wide as what it holds laid out on one
// line, and a Figma frame that hugs a hugging text draws that width, as a bar trigger's `w-max` hugs
// its label and caret.
describe("a max-content width", () => {
  it("hugs the box's content, its label on one line", async () => {
    const { variant, coverage } = await buildFixture(
      chip("w-max font-sans text-[14px]/[20px]", { label: TEXT }),
      { variables: SYNCED, page: PAGE }
    );
    expect([variant?.root.sizing.horizontal, textOf(variant?.root)?.sizing.horizontal]).toEqual([HUG, HUG]);
    expect(notesOf(coverage, "w-max")).toEqual([["width", "literal", "the box hugs its content"]]);
  });
});

// Oracle: Tailwind 4 compiles `**:x` to `:is(.class *)`, which selects every element below the
// element that carries the class, at any depth (Selectors 4 §16.1), and weighs the class and its
// variants, so `data-[state=on]:**:` weighs (0,2,0) and beats an icon's own (0,1,0) color. An icon
// and a part are elements below the box. The box's own text is a text node, no element, so it keeps
// the box's color, and so does the box itself. An element around the root that carries the class
// reaches the root too, as a Navigation menu trigger's `**:` arms reach its caret.
describe("a class for every element below the box", () => {
  const RED = { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } } as const;
  const BLUE = { kind: "literal", color: { r: 0, g: 0, b: 1, a: 1 } } as const;
  const ON = { facts: new Map([["data-[state=on]", () => true]]) };
  const BLUE_ICON = { ...ICON, classes: "size-[16px] text-[#0000ff]" };
  const PAINTS_NOTHING =
    "no element sits below the box in any cell, so the class styles nothing the set draws";

  it("styles an icon below the box over the icon's own class", async () => {
    const { variant, coverage } = await buildFixture(
      chip("data-[state=on]:**:text-[#ff0000]", { ...ON, iconsFor: () => [BLUE_ICON] })
    );
    const [icon] = variant?.root.children ?? [];
    expect(icon?.kind === "icon" ? icon.color : undefined).toEqual(RED);
    expect(notesOf(coverage, "data-[state=on]:**:text-[#ff0000]")).toEqual([
      ["color", "literal", "rgba(255, 0, 0, 1)"],
    ]);
  });

  it("styles a part at any depth below the box", async () => {
    const inner = { ...dot("size-[4px]"), key: "inner", slot: "chip-inner" };
    const { variant } = await buildFixture(
      chip("flex data-[state=on]:**:bg-[#ff0000]", { ...ON, parts: [{ ...dot("flex"), parts: [inner] }] })
    );
    const part = frameOf(variant?.root);
    expect([part?.fill, frameOf(part)?.fill]).toEqual([RED, RED]);
  });

  it("leaves the box and its own text in the box's colors, and drops where no element sits below it", async () => {
    const { variant, coverage } = await buildFixture(
      chip(
        "font-sans text-[14px]/[20px] bg-[#0000ff] text-[#0000ff] data-[state=on]:**:bg-[#ff0000] data-[state=on]:**:text-[#ff0000]",
        { ...ON, label: TEXT }
      ),
      { variables: SYNCED, page: PAGE }
    );
    expect([variant?.root.fill, textOf(variant?.root)?.color]).toEqual([BLUE, BLUE]);
    expect([
      ...notesOf(coverage, "data-[state=on]:**:bg-[#ff0000]"),
      ...notesOf(coverage, "data-[state=on]:**:text-[#ff0000]"),
    ]).toEqual([
      ["background-color", "dropped", PAINTS_NOTHING],
      ["color", "dropped", PAINTS_NOTHING],
    ]);
  });

  it("stays unmapped on the element a box holds its label in, which the kit draws no layer for", async () => {
    const { coverage } = await buildFixture(
      chip("font-sans text-[14px]/[20px] data-[state=on]:**:text-[#ff0000]", {
        ...ON,
        label: { ...TEXT, textElement: { tag: "span", attributes: {} } },
      }),
      { variables: SYNCED, page: PAGE }
    );
    expect(notesOf(coverage, "data-[state=on]:**:text-[#ff0000]")).toEqual([
      [
        "color",
        "unmapped",
        "the class reaches the element the box holds its label in, which the kit draws no layer for",
      ],
    ]);
  });

  it("reaches the root from an element around it", async () => {
    const { variant } = await buildFixture(
      chip("font-sans text-[14px]/[20px]", {
        label: TEXT,
        ancestorsFor: () => [
          {
            slot: "chip-host",
            classes: "**:text-[#ff0000]",
            undrawn: "the host lays out nothing the set draws",
          },
        ],
      }),
      { variables: SYNCED, page: PAGE }
    );
    expect(textOf(variant?.root)?.color).toEqual(RED);
  });
});

// Oracle: CSS 2.1 §10.7, where a box's height is raised to its `min-height`, so a minimum that holds
// the same value as the height never moves it, in any mode of the variable both read, as the md
// control rung sets `h-(--control-h-md) min-h-(--control-h-md)`.
describe("a minimum that reads the variable its fixed length reads", () => {
  const variables = makeVariableIndex([
    { ref: { collection: "Fuse density", name: "control-h-md" }, webSyntax: "var(--control-h-md)" },
  ]);
  it("drops, and the length keeps its binding", async () => {
    const { variant, coverage } = await buildFixture(chip("h-(--control-h-md) min-h-(--control-h-md)"), {
      variables,
    });
    expect([variant?.root.sizing.vertical, variant?.root.limits.minHeight]).toEqual([
      fixed(density("control-h-md")),
      undefined,
    ]);
    expect(notesOf(coverage, "min-h-(--control-h-md)")).toEqual([
      ["min-height", "dropped", "it is no more than the fixed height, so it never lengthens the box"],
    ]);
  });
});
