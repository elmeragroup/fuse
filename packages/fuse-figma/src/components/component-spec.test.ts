/**
 * How the spec builder records a class whose variant the matrix does not model. The unit under
 * test is `buildComponentSet`, with the one-cell `chip` fixture of `test/fixture-sets.ts` and
 * Tailwind's compiled utilities. The oracle is the definition: a variant it omits is dropped, and
 * any other variant no cell models is unmapped, which the coverage gate refuses. That includes
 * `focus-visible`, since the definition's state axis has no focus value.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { CENTERED_BOX, FILL, fixed, fixedSize, HUG, literal, UNLIMITED } from "../../test/built-kit";
import { buildFixture, chip, dot, frameOf, ICON } from "../../test/fixture-sets";
import type { FixtureContext } from "../../test/fixture-sets";
import type {
  AncestorDefinition,
  IconSlot,
  InlineDeclaration,
  LabelDefinition,
  OuterDeclaration,
  PartDefinition,
  TextPlacement,
} from "./component-spec";
import type { CoverageRow } from "./coverage";
import { makeVariableIndex } from "./css-values";
import type { BooleanPropertySpec, BoxSpec, FrameLayerSpec, TextLayerSpec } from "./kit-spec";

describe("a class whose variant no cell models", () => {
  let coverage: readonly CoverageRow[];

  beforeAll(async () => {
    ({ coverage } = await buildFixture(
      chip("in-data-[slot=group]:bg-muted data-pressed:bg-muted focus-visible:bg-muted", {
        omittedStates: new Set(["in-data-[slot=group]"]),
      })
    ));
  });

  function outcomes(className: string): ReadonlySet<string> {
    return new Set(coverage.filter((row) => row.className === className).map((row) => row.outcome));
  }

  it("is dropped when the definition omits the state", () => {
    expect(outcomes("in-data-[slot=group]:bg-muted")).toEqual(new Set(["dropped"]));
  });

  // The detail tells this row from the unmapped row of a class whose variant holds and whose value
  // binds no variable, so the case fails if the state table gives the variant a meaning.
  it("is unmapped when the definition does not know the state", () => {
    expect(coverage.filter((row) => row.className === "data-pressed:bg-muted")).toEqual([
      expect.objectContaining({
        outcome: "unmapped",
        detail: "the definition neither models nor omits `data-pressed`",
      }),
    ]);
  });

  it("is unmapped when the state axis lacks the value that renders a shared state", () => {
    expect(outcomes("focus-visible:bg-muted")).toEqual(new Set(["unmapped"]));
  });

  // Oracle: a `state` axis holds one value per cell, so `aria-invalid:` (state=invalid) and
  // `focus-visible:` (state=focus) never hold in the same cell, and the class would otherwise
  // leave no row in the coverage table.
  it("is dropped, naming its variants, when they never hold in one cell together", async () => {
    const { coverage } = await buildFixture(
      chip("aria-invalid:focus-visible:bg-muted", {
        axes: [{ name: "state", values: ["rest", "focus", "invalid"] }],
      })
    );
    expect(coverage).toEqual([
      expect.objectContaining({
        className: "aria-invalid:focus-visible:bg-muted",
        property: "background-color",
        outcome: "dropped",
        detail: "no cell of the matrix shows `aria-invalid` and `focus-visible` at once",
      }),
    ]);
  });
});

// Unit under test: `buildComponentSet` on a root whose class sets a border width and style and
// nothing sets a color. Oracle: the coverage contract, under which a declaration that does not
// reach Figma lands as unmapped. The stroke cannot draw without a color, so the missing color
// must fail the gate rather than vanish.
describe("a border with no color", () => {
  it("records the missing color as unmapped, under the class that drew the border", async () => {
    const { componentSet, coverage } = await buildFixture(chip("border"));
    expect(componentSet.variants[0]?.root.stroke).toBeUndefined();
    expect(coverage).toContainEqual(
      expect.objectContaining({ className: "border", property: "border-color", outcome: "unmapped" })
    );
  });
});

// Unit under test: `buildComponentSet`, which applies the base-layer declarations of its context
// to the root below every recipe class. Oracle: fuse.css's base rule
// `border-color: var(--border, currentcolor)`, and CSS cascade layers, under which any utility
// beats a base-layer declaration.
describe("the base-layer border color", () => {
  const context: FixtureContext = {
    variables: makeVariableIndex(
      ["border", "error"].map((name) => ({
        ref: { collection: "Fuse tokens", name },
        webSyntax: `var(--${name})`,
      }))
    ),
    base: [
      { className: "fuse.css base layer", property: "border-color", value: "var(--border, currentcolor)" },
    ],
  };

  it("colors a border no class colors with the border role", async () => {
    const { componentSet, coverage } = await buildFixture(chip("border"), context);
    expect(componentSet.variants[0]?.root.stroke).toEqual({
      color: { kind: "variable", variable: { collection: "Fuse tokens", name: "border" } },
      weight: { kind: "literal", value: 1 },
    });
    expect(coverage).toContainEqual(
      expect.objectContaining({
        className: "fuse.css base layer",
        property: "border-color",
        outcome: "bound",
      })
    );
  });

  it("loses to a class that colors the border", async () => {
    const strokeOf = async (classes: string) =>
      (await buildFixture(chip(classes), context)).componentSet.variants[0]?.root.stroke;
    expect((await strokeOf("border border-transparent"))?.color).toEqual({
      kind: "literal",
      color: { r: 0, g: 0, b: 0, a: 0 },
    });
    expect((await strokeOf("border border-error"))?.color).toEqual({
      kind: "variable",
      variable: { collection: "Fuse tokens", name: "error" },
    });
  });
});

// Unit under test: `buildComponentSet` on a root with a dashed border. Oracle: the dashes and gaps
// the compare run's Chromium drew along a straight edge of a CSS dashed border on 2026-10-23: 3px
// and 2px at a 1px width, 6px and 4px at 2px, and 6px and 3px at 3px, before it stretched a side's
// gaps by up to half a pixel to end the side on a dash. CSS leaves the lengths to the browser (CSS
// Backgrounds 3 §4.2).
describe("a dashed border", () => {
  const variables = makeVariableIndex([
    { ref: { collection: "Fuse tokens", name: "outline-width" }, webSyntax: "var(--outline-width)" },
  ]);
  const strokeOf = async (classes: string) => {
    const { componentSet, coverage } = await buildFixture(chip(`${classes} border-[#000000]`), { variables });
    return { stroke: componentSet.variants[0]?.root.stroke, coverage };
  };
  const BLACK = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } } as const;

  it.each([
    ["border", 1, [3, 2]],
    ["border-2", 2, [6, 4]],
    ["border-[3px]", 3, [6, 3]],
  ])("draws %s border-dashed with the dashes and gaps Chromium draws", async (width, weight, dashPattern) => {
    const { stroke, coverage } = await strokeOf(`${width} border-dashed`);
    expect(stroke).toEqual({ color: BLACK, weight: literal(weight), dashPattern });
    expect(coverage).toContainEqual(
      expect.objectContaining({ className: "border-dashed", property: "border-style", outcome: "literal" })
    );
  });

  it.each([
    ["a dotted border", "border border-dotted", "border-dotted"],
    // The dashes follow the width, which takes another length in each of the variable's modes.
    [
      "a dashed border whose width binds a variable",
      "border-(length:--outline-width) border-dashed",
      "border-dashed",
    ],
  ])("leaves %s unmapped", async (_, classes, styleClass) => {
    const { stroke, coverage } = await strokeOf(classes);
    expect(stroke).toBeUndefined();
    expect(coverage).toContainEqual(
      expect.objectContaining({ className: styleClass, property: "border-style", outcome: "unmapped" })
    );
  });
});

// Unit under test: `buildComponentSet` on a root with a transparent background and a ring.
// Oracle: CSS, where `background-color: transparent` paints nothing, as an unset background
// does, so the root gets no fill.
describe("a transparent background", () => {
  it("gives the root no fill, whatever shadow it casts", async () => {
    const { componentSet, coverage } = await buildFixture(chip("bg-transparent ring-2 ring-[rgb(0_0_0)]"));
    const [variant] = componentSet.variants;
    expect(variant?.root.shadows).toEqual([
      {
        color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } },
        offsetX: 0,
        offsetY: 0,
        radius: { kind: "literal", value: 0 },
        spread: { kind: "literal", value: 2 },
      },
    ]);
    expect(variant?.root.fill).toBeUndefined();
    expect(coverage.filter((row) => row.className === "bg-transparent").map((row) => row.outcome)).toEqual([
      "literal",
    ]);
  });
});

// Unit under test: the cascade order of `buildComponentSet`. Oracle: CSS Cascading 4, where in one
// layer the more specific selector wins and output order only breaks a tie. Tailwind emits
// fuse.css's `data-checked:` after `aria-invalid:`, but `data-checked:` wraps its attribute in
// `:where()`, so `.x:where([data-checked])` is (0,1,0) and `.x[aria-invalid="true"]` is (0,2,0).
describe("two conditional classes that set one property", () => {
  it("apply the more specific one, though Tailwind emits it first", async () => {
    const classes = ["aria-invalid:bg-[rgb(0_0_255)]", "data-checked:bg-[rgb(255_0_0)]"];
    const { componentSet } = await buildFixture(
      chip(classes.join(" "), {
        axes: [{ name: "state", values: ["invalid"] }],
        facts: new Map([["data-checked", () => true]]),
      })
    );
    expect(componentSet.variants[0]?.root.fill).toEqual({
      kind: "literal",
      color: { r: 0, g: 0, b: 1, a: 1 },
    });
  });
});

// Unit under test: `buildComponentSet` on a root with `tabular-nums`. Oracle: the plugin typings
// (`@figma/plugin-typings`), where a text layer's `openTypeFeatures` is read-only and no setter
// writes `TNUM`, so `font-variant-numeric` has no Figma form and is dropped, not unmapped.
describe("tabular numerals", () => {
  it("drops font-variant-numeric", async () => {
    const { coverage } = await buildFixture(chip("tabular-nums"));
    expect(
      coverage.filter((row) => row.property === "font-variant-numeric").map((row) => row.outcome)
    ).toEqual(["dropped"]);
  });
});

// Unit under test: `buildComponentSet` on a root with `animate-pulse`. Oracle: the Figma component
// model, where a component is one static frame per variant with no keyframes, so the `animation`
// Tailwind compiles the class to has no Figma form, as a transition has none.
describe("an animation", () => {
  it("drops animate-pulse because Figma components do not animate", async () => {
    const { coverage } = await buildFixture(chip("animate-pulse"));
    expect(
      coverage
        .filter((row) => row.className === "animate-pulse")
        .map((row) => [row.property, row.outcome, row.detail])
    ).toEqual([["animation", "dropped", "Figma components do not animate"]]);
  });
});

// Unit under test: `buildComponentSet` on a root whose width is a percentage. Oracle: CSS, where a
// percentage width is a share of the containing block, which a Figma number field cannot hold, so
// the declaration fails the gate instead of passing as a fixed width.
describe("a percentage width", () => {
  it.each(["w-full", "w-[calc(100%-4px)]"])("leaves %s unmapped", async (className) => {
    const { componentSet, coverage } = await buildFixture(chip(className));
    expect(componentSet.variants[0]?.root.sizing.horizontal).toEqual(HUG);
    expect(coverage).toEqual([
      expect.objectContaining({ className, property: "width", outcome: "unmapped" }),
    ]);
  });
});

// Unit under test: `buildComponentSet` on a root with `w-fit`, which Tailwind compiles to
// `width: fit-content`. Oracle: CSS Sizing 3, where a fit-content width in a container with room to
// spare is the box's max-content width, the width of what it holds. That is a Figma hug.
describe("a fit-content width", () => {
  it("hugs the content", async () => {
    const { componentSet, coverage } = await buildFixture(chip("w-fit"));
    expect(componentSet.variants[0]?.root.sizing.horizontal).toEqual(HUG);
    expect(coverage.map((row) => [row.className, row.property, row.outcome, row.detail])).toEqual([
      ["w-fit", "width", "literal", "the box hugs its content"],
    ]);
  });
});

// Unit under test: the cascade `buildComponentSet` runs for a part below the root. Oracle: CSS
// inheritance. `color` and an unregistered custom property inherit their parent's computed value,
// and a custom property Tailwind registers with `@property … { inherits: false }`, as it does
// `--tw-ring-offset-width` for `ring-2`, takes its initial value `0px` on every child.
describe("a part below the root", () => {
  it("reads its parent's text color", async () => {
    const { variant } = await buildFixture(
      chip("text-[#ff0000]", { parts: [dot("[&_svg]:size-[16px]", [ICON])] })
    );
    expect(frameOf(variant?.root)?.children).toEqual([
      expect.objectContaining({
        kind: "icon",
        color: { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } },
      }),
    ]);
  });

  // Oracle: CSS Color 4, where `color: currentcolor` computes to the color the element inherits,
  // so `text-current` keeps the parent's red, and its row names what it resolved to.
  it("reads color: currentcolor as the color it inherits", async () => {
    const { variant, coverage } = await buildFixture(
      chip("text-[#ff0000]", { parts: [dot("text-current [&_svg]:size-[16px]", [ICON])] })
    );
    expect(frameOf(variant?.root)?.children).toEqual([
      expect.objectContaining({ color: { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } } }),
    ]);
    expect(coverage.filter((row) => row.className === "text-current")).toEqual([
      expect.objectContaining({
        part: "chip-dot",
        property: "color",
        outcome: "literal",
        detail: "rgba(255, 0, 0, 1)",
      }),
    ]);
  });

  it("reads a custom property its parent sets, which the parent's class reaches Figma through", async () => {
    const { variant, coverage } = await buildFixture(
      chip("[--chip-corner:6px]", { parts: [dot("rounded-[var(--chip-corner)]")] })
    );
    expect(frameOf(variant?.root)?.cornerRadius).toEqual({ kind: "literal", value: 6 });
    expect(coverage.filter((row) => row.className === "[--chip-corner:6px]")).toEqual([
      expect.objectContaining({ part: "chip", property: "--chip-corner", outcome: "literal" }),
    ]);
  });

  // Oracle: CSS selectors. `[&_svg]` compiles to `.x :is(svg)`, which matches an `<svg>` at any
  // depth below the root, and `[&>svg:not(…)]` to `.x > svg:not(…)`, which matches only a child
  // of the root. The icon is a child of the dot, so the 24px size must not reach it.
  it("takes the root's descendant selector and not its child selector", async () => {
    const { variant } = await buildFixture(
      chip("text-[#000000] [&_svg]:size-[16px] [&>svg:not([data-icon=inline-end])]:size-[24px]", {
        parts: [dot("", [ICON])],
      })
    );
    expect(frameOf(variant?.root)?.children).toEqual([
      expect.objectContaining({ kind: "icon", size: { kind: "literal", value: 16 } }),
    ]);
  });

  // Oracle: the coverage contract, one row per distinct outcome of each declaration of each part.
  it("records one class on the root and on the part as two rows, one per part", async () => {
    const { coverage } = await buildFixture(chip("bg-[#000000]", { parts: [dot("bg-[#000000]")] }));
    expect(
      coverage
        .filter((row) => row.className === "bg-[#000000]")
        .map((row) => `${row.part}: ${row.outcome}`)
        .toSorted()
    ).toEqual(["chip-dot: literal", "chip: literal"]);
  });

  // Oracle: CSS inheritance passes `--chip-corner` through the dot to the ring below it, and the
  // coverage contract names the root's class as read, whichever layer the build maps first.
  it("records a root class only a grandchild reads as read, under the root", async () => {
    const { variant, coverage } = await buildFixture(
      chip("[--chip-corner:6px]", {
        parts: [
          {
            ...dot(""),
            parts: [{ ...dot("rounded-[var(--chip-corner)]"), key: "ring", slot: "chip-ring" }],
          },
        ],
      })
    );
    expect(frameOf(frameOf(variant?.root))?.cornerRadius).toEqual({ kind: "literal", value: 6 });
    expect(coverage.filter((row) => row.className === "[--chip-corner:6px]")).toEqual([
      expect.objectContaining({ part: "chip", property: "--chip-corner", outcome: "literal" }),
    ]);
  });

  // Oracle: CSS inheritance, under which the `<svg>` inherits the custom property its part sets.
  it("gives an icon the custom property its part sets", async () => {
    const { variant, coverage } = await buildFixture(
      chip("text-[#000000]", { parts: [dot("[--icon-size:16px] [&_svg]:size-[var(--icon-size)]", [ICON])] })
    );
    expect(frameOf(variant?.root)?.children).toEqual([
      expect.objectContaining({ kind: "icon", size: { kind: "literal", value: 16 } }),
    ]);
    expect(coverage.filter((row) => row.className === "[--icon-size:16px]")).toEqual([
      expect.objectContaining({ part: "chip-dot", property: "--icon-size", outcome: "literal" }),
    ]);
  });

  it("does not inherit a custom property registered with inherits: false", async () => {
    const { variant } = await buildFixture(
      chip("[--tw-ring-offset-width:4px]", { parts: [dot("rounded-[var(--tw-ring-offset-width)]")] }),
      { registered: ["ring-2"] }
    );
    expect(frameOf(variant?.root)?.cornerRadius).toEqual(literal(0));
  });
});

// Unit under test: `buildComponentSet` on a root that holds a part, which holds an icon, in the
// cells the part's `shownIn` names. Oracle: CSS flexbox. `items-start` packs the children at the
// start of the cross axis and `justify-end` at the end of the row, which Figma calls MIN and MAX,
// and `items-center justify-center` centers them on both. The icon takes the root's white text
// color and the dot's 12px `[&_svg]` size.
describe("a root that holds a part", () => {
  const definition = chip("inline-flex items-start justify-end text-[#ffffff]", {
    axes: [{ name: "checked", values: ["off", "on"] }],
    columnAxis: "checked",
    parts: [
      {
        ...dot("flex items-center justify-center size-[16px] bg-[#000000] [&_svg]:size-[12px]", [ICON]),
        shownIn: (cell) => cell.checked === "on",
      },
    ],
  });

  it("builds the part as a frame inside the root, in the cells that render it", async () => {
    const { componentSet } = await buildFixture(definition);
    const zero = literal(0);
    const box = { paddingTop: zero, paddingRight: zero, paddingBottom: zero, paddingLeft: zero };
    const [off, on] = componentSet.variants;
    expect(on?.root).toEqual({
      name: "chip",
      direction: "HORIZONTAL",
      sizing: { horizontal: HUG, vertical: HUG },
      limits: UNLIMITED,
      clips: true,
      ...box,
      itemSpacing: zero,
      primaryAlign: "MAX",
      counterAlign: "MIN",
      cornerRadius: zero,
      shadows: [],
      opacity: 1,
      children: [
        {
          kind: "frame",
          key: "dot",
          name: "chip-dot",
          direction: "HORIZONTAL",
          sizing: fixedSize(literal(16), literal(16)),
          limits: UNLIMITED,
          clips: false,
          ...box,
          itemSpacing: zero,
          primaryAlign: "CENTER",
          counterAlign: "CENTER",
          cornerRadius: zero,
          fill: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } },
          shadows: [],
          opacity: 1,
          children: [
            {
              kind: "icon",
              key: "icon",
              name: "Icon",
              icon: "icon/Plus",
              swapProperty: undefined,
              size: { kind: "literal", value: 12 },
              color: { kind: "literal", color: { r: 1, g: 1, b: 1, a: 1 } },
            },
          ],
        },
      ],
    });
    expect(off?.root.children).toEqual([]);
  });

  it("leaves an alignment other than start, center, end or space-between unmapped", async () => {
    const { coverage } = await buildFixture({
      ...definition,
      classesFor: () => "inline-flex justify-around items-baseline text-[#ffffff]",
    });
    expect(
      coverage.filter((row) => row.outcome === "unmapped").map((row) => [row.part, row.property])
    ).toEqual([
      ["chip", "align-items"],
      ["chip", "justify-content"],
    ]);
  });

  // Oracle: CSS Box Alignment 3, where `justify-content: space-between` puts the first and last
  // item flush with the ends of the main axis and shares the free space between the items, as
  // Figma's SPACE_BETWEEN does along the primary axis.
  it("reads justify-between as SPACE_BETWEEN along the primary axis", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex justify-between w-[100px]", {
        parts: [dot("size-[4px]"), { ...dot("size-[4px]"), key: "end", slot: "chip-end" }],
      })
    );
    expect(variant?.root.primaryAlign).toBe("SPACE_BETWEEN");
    expect(
      coverage.filter((row) => row.className === "justify-between").map((row) => [row.outcome, row.detail])
    ).toEqual([["literal", "spaced out between the ends of the primary axis"]]);
  });
});

// Unit under test: `buildComponentSet` on a part with `flex-1`, which Tailwind compiles to `flex: 1`,
// a grow of 1 from a zero basis. Oracle: CSS Flexbox 1 §9.7. A row that hugs its width is as wide as
// its layers, so it has no free space, and the one layer that grows keeps its own width, as Chromium
// draws Select's value at its text's width in its `w-fit` trigger. A row with a fixed width gives the
// growing layer the room the others leave, and two growing layers share the free space by their
// grow, neither of which the builder maps, so both stay unmapped.
describe("a part that grows along its row", () => {
  const detail = "the row hugs its layers, so the one layer that grows has no room to grow into";

  it("keeps its own width in a row that hugs its layers", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex", {
        parts: [dot("flex-1 h-[8px]"), { ...dot("size-[8px]"), key: "ring", slot: "chip-ring" }],
      })
    );
    const [grown] = variant?.root.children ?? [];
    expect(grown?.kind === "frame" && grown.sizing).toEqual({ horizontal: HUG, vertical: fixed(literal(8)) });
    expect(coverage.filter((row) => row.className === "flex-1")).toEqual([
      expect.objectContaining({ part: "chip-dot", property: "flex", outcome: "dropped", detail }),
    ]);
  });

  // A zero minimum never widens the row, so the row still has no free space.
  it("keeps its own width in a row that hugs its layers above a zero minimum", async () => {
    const { coverage } = await buildFixture(chip("flex min-w-0", { parts: [dot("flex-1 h-[8px]")] }));
    expect(coverage.filter((row) => row.className === "flex-1")).toEqual([
      expect.objectContaining({ property: "flex", outcome: "dropped", detail }),
    ]);
  });

  // A row that hugs its width up to a minimum is the minimum's width where its layers are narrower,
  // which leaves free space the growing layer takes: 92px of the 100px beside the 8px ring. A maximum
  // can take room away. Neither is the layer's own width.
  it.each([
    ["a row with a fixed width", "flex w-[100px]", [dot("flex-1")]],
    [
      "a row with two layers that grow",
      "flex",
      [dot("flex-1"), { ...dot("flex-1"), key: "ring", slot: "chip-ring" }],
    ],
    [
      "a row that hugs up to a minimum width",
      "flex w-fit min-w-[100px]",
      [dot("flex-1 size-[8px]"), { ...dot("size-[8px]"), key: "ring", slot: "chip-ring" }],
    ],
    [
      "a row that hugs below a maximum width",
      "flex w-fit max-w-[10px]",
      [dot("flex-1 size-[8px]"), { ...dot("size-[8px]"), key: "ring", slot: "chip-ring" }],
    ],
  ])("leaves flex-1 unmapped in %s", async (_name, classes, parts) => {
    const { coverage } = await buildFixture(chip(classes, { parts }));
    expect(new Set(coverage.filter((row) => row.className === "flex-1").map((row) => row.outcome))).toEqual(
      new Set(["unmapped"])
    );
  });
});

// Unit under test: `buildComponentSet` on a flex column. Oracle: CSS Flexbox 1 and Box Alignment 3.
// `flex-direction: column` lays the items out top to bottom, a vertical auto layout. An unset
// `align-items` is `normal`, which behaves as `stretch` on a flex item, so an item with an auto
// width takes the column's content width (Flexbox 1 §9.4 step 11). Figma draws that as FILL across
// a column whose counter alignment is MIN. An item whose width is set, to a length or to
// `fit-content`, keeps it, since stretch only fills an auto size. An unset `justify-content` packs
// the items at the start of the column, MIN. A row keeps the CENTER default every published set
// was drawn with, and its items keep their own width.
describe("a flex column", () => {
  const PARTS = [
    dot("h-[4px]"),
    { ...dot("w-[20px] h-[4px]"), key: "fixed", slot: "chip-fixed" },
    { ...dot("w-fit h-[4px]"), key: "fit", slot: "chip-fit" },
  ];
  const widths = (root: BoxSpec | undefined) =>
    root?.children.map((child) => (child.kind === "frame" ? child.sizing.horizontal : undefined));

  it("is a vertical auto layout that stretches each part with no width across it", async () => {
    const { variant, coverage } = await buildFixture(chip("flex flex-col w-[100px]", { parts: PARTS }));
    expect(variant?.root).toEqual(
      expect.objectContaining({ direction: "VERTICAL", primaryAlign: "MIN", counterAlign: "MIN" })
    );
    expect(widths(variant?.root)).toEqual([FILL, fixed(literal(20)), HUG]);
    const rowsOf = (className: string) =>
      coverage
        .filter((row) => row.className === className)
        .map((row) => [row.property, row.outcome, row.detail]);
    expect(rowsOf("flex-col")).toEqual([["flex-direction", "literal", "a column, its layers top to bottom"]]);
    expect(rowsOf("flex")).toEqual([["display", "literal", "a vertical auto layout"]]);
  });

  it("keeps a row horizontal and centered, with each part at its own width", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex flex-row w-[100px] h-[20px]", { parts: PARTS })
    );
    expect(variant?.root).toEqual(
      expect.objectContaining({ direction: "HORIZONTAL", primaryAlign: "CENTER", counterAlign: "CENTER" })
    );
    expect(widths(variant?.root)).toEqual([HUG, fixed(literal(20)), HUG]);
    expect(coverage.filter((row) => row.className === "flex-row").map((row) => row.outcome)).toEqual([
      "literal",
    ]);
  });

  // A column that hugs its width is as wide as its widest layer, and stretches the others to it.
  // Figma shrinks a layer that fills a hugging frame to its smallest size, so the stretch has no
  // Figma form, and the missing alignment fails the gate under the class that made the column.
  it("records the alignment a column that hugs its width is missing", async () => {
    const { variant, coverage } = await buildFixture(chip("flex flex-col", { parts: [dot("h-[4px]")] }));
    expect(widths(variant?.root)).toEqual([HUG]);
    expect(coverage).toContainEqual(
      expect.objectContaining({ className: "flex-col", property: "align-items", outcome: "unmapped" })
    );
  });
});

// Unit under test: `buildComponentSet` on parts whose width or height is a percentage. Oracle: CSS
// Sizing 3. A percentage takes the parent's content box. Where the parent's length is definite,
// fixed or itself filling a definite box, `100%` is that whole length. Across the parent's
// direction, and along it for the parent's only layer, that is what Figma's FILL draws. Along the
// direction beside other layers, CSS sizes the item at 100% of the row and then shrinks or
// overflows it with them (Flexbox 1 §9.7): in a 100px row, `w-full shrink-0` beside a 20px part
// stays 100px wide, where a fill takes the 80px the part leaves. Where the parent's length depends
// on its content, the percentage is cyclic and behaves as auto, and Figma shrinks a layer that
// fills a hugging frame, so it stays unmapped. A share other than the whole has no Figma field.
describe("a part with a percentage length", () => {
  const END = { ...dot("w-[20px] h-[4px]"), key: "end", slot: "chip-end" };

  async function build(rootClasses: string, part: PartDefinition, ...siblings: PartDefinition[]) {
    const { variant, coverage } = await buildFixture(chip(rootClasses, { parts: [part, ...siblings] }));
    return {
      frame: frameOf(variant?.root),
      rows: coverage
        .filter((row) => row.part === "chip-dot" && (row.property === "width" || row.property === "height"))
        .map((row) => [row.className, row.property, row.outcome]),
      coverage,
    };
  }

  it("fills a fixed row it holds alone", async () => {
    const { frame, rows } = await build("flex w-[100px]", dot("w-full h-[4px]"));
    expect(frame?.sizing).toEqual({ horizontal: FILL, vertical: fixed(literal(4)) });
    expect(rows).toContainEqual(["w-full", "width", "literal"]);
  });

  it("stays unmapped along a fixed row it shares, naming the other layers", async () => {
    const { frame, coverage } = await build("flex w-[100px]", dot("w-full shrink-0 h-[4px]"), END);
    expect(frame?.sizing.horizontal).toEqual(HUG);
    expect(
      coverage.filter((row) => row.className === "w-full").map((row) => [row.outcome, row.detail])
    ).toEqual([
      [
        "unmapped",
        "chip-end shares the row, and a fill takes only the room it leaves, where CSS sizes 100% of the row",
      ],
    ]);
  });

  it("fills across a fixed column it shares", async () => {
    const { frame } = await build("flex flex-col w-[100px]", dot("w-full h-[4px]"), END);
    expect(frame?.sizing.horizontal).toEqual(FILL);
  });

  it("fills the height of a parent with a fixed height", async () => {
    const { frame } = await build("flex h-[20px]", dot("h-full w-[4px]"));
    expect(frame?.sizing).toEqual({ horizontal: fixed(literal(4)), vertical: FILL });
  });

  it("fills a parent that fills a parent with a fixed width", async () => {
    const { variant } = await buildFixture(
      chip("flex w-[100px]", {
        parts: [
          { ...dot("flex w-full"), parts: [{ ...dot("w-full h-[4px]"), key: "bar", slot: "chip-bar" }] },
        ],
      })
    );
    expect(frameOf(frameOf(variant?.root))?.sizing.horizontal).toEqual(FILL);
  });

  it("stays unmapped in a parent that hugs its width", async () => {
    const { frame, rows } = await build("flex", dot("w-full h-[4px]"));
    expect(frame?.sizing.horizontal).toEqual(HUG);
    expect(rows).toContainEqual(["w-full", "width", "unmapped"]);
  });

  it("leaves a share other than the whole unmapped", async () => {
    const { frame, rows } = await build("flex w-[100px]", dot("w-[50%] h-[4px]"));
    expect(frame?.sizing.horizontal).toEqual(HUG);
    expect(rows).toContainEqual(["w-[50%]", "width", "unmapped"]);
  });
});

// Unit under test: `buildComponentSet` on a root whose width is `100%`, with a preview width in the
// definition. Oracle: CSS Sizing 3, where a root's percentage width takes its container's width,
// which the definition names as the width the Figma preview and the compare host give it. A
// variant root sits in its component set, which has no auto layout, so the width is fixed.
describe("a root's percentage width against the preview width", () => {
  it("resolves 100% to the preview width", async () => {
    const { variant, coverage } = await buildFixture(chip("w-full", { previewWidth: 384 }));
    expect(variant?.root.sizing.horizontal).toEqual(fixed(literal(384)));
    expect(coverage.map((row) => [row.className, row.outcome, row.detail])).toEqual([
      ["w-full", "literal", "384px, the preview width that 100% takes"],
    ]);
  });

  it("resolves a share to that share of the preview width", async () => {
    const { variant, coverage } = await buildFixture(chip("w-1/2", { previewWidth: 384 }));
    expect(variant?.root.sizing.horizontal).toEqual(fixed(literal(192)));
    expect(coverage.map((row) => [row.className, row.outcome, row.detail])).toEqual([
      ["w-1/2", "literal", "192px, 50% of the preview width"],
    ]);
  });

  it("leaves a length that depends on a percentage unmapped", async () => {
    const { coverage } = await buildFixture(chip("w-[calc(100%-4px)]", { previewWidth: 384 }));
    expect(coverage.map((row) => row.outcome)).toEqual(["unmapped"]);
  });

  // CSS 2.1 §10.3.3: a block-level box with no width fills its containing block, as a `flex` column
  // does, while an `inline-flex` box shrinks to fit what it holds.
  it.each([
    ["flex flex-col", fixed(literal(256))],
    ["inline-flex", HUG],
  ])("gives a %s root with no width %o", async (classes, horizontal) => {
    const { variant } = await buildFixture(chip(classes, { previewWidth: 256 }));
    expect(variant?.root.sizing.horizontal).toEqual(horizontal);
  });

  // CSS 2.1 §6.4.1: the browser's default style sheet makes a `<p>` or a `<div>` block-level, and any
  // author declaration beats it. The block box sets its text in lines across its width (CSS Text 3).
  describe("with the display its element takes from the browser's default style sheet", () => {
    const P_BLOCK = { className: "user agent style sheet, p", property: "display", value: "block" };

    it("fills the preview width and sets its label in lines across it", async () => {
      const { variant, coverage } = await buildLabelled("", {
        previewWidth: 256,
        elementDefaults: [P_BLOCK],
        label: LABEL,
      });
      expect(variant?.root.sizing.horizontal).toEqual(fixed(literal(256)));
      expect(textOf(variant?.root)?.sizing).toEqual(FILL_WIDTH);
      expect(notesOf(coverage, P_BLOCK.className)).toEqual([
        ["display", "literal", "a block box that sets its own text in lines"],
      ]);
    });

    it("loses to a display class of the root's own", async () => {
      const { variant, coverage } = await buildLabelled("inline-flex", {
        previewWidth: 256,
        elementDefaults: [P_BLOCK],
        label: LABEL,
      });
      expect(variant?.root.sizing.horizontal).toEqual(HUG);
      expect(notesOf(coverage, P_BLOCK.className)).toEqual([]);
    });
  });
});

// Unit under test: `buildComponentSet` on a part with `grid place-content-center`. Oracle: CSS Grid,
// where a grid with no template puts each child in a row of its own, and `place-content: center`
// centers the rows on both axes. With one child that is a box centered both ways, as an auto
// layout with CENTER on both axes draws it. Two children stack in two rows, which a horizontal
// auto layout does not draw.
describe("a grid that centers its content", () => {
  async function build(icons: readonly IconSlot[]) {
    const { variant, coverage } = await buildFixture(
      chip("text-[#000000]", {
        parts: [dot("grid place-content-center size-[16px] [&_svg]:size-[12px]", icons)],
      })
    );
    const rows = coverage
      .filter((row) => row.className === "grid" || row.className === "place-content-center")
      .map((row) => `${row.className}: ${row.outcome}`)
      .toSorted();
    return { frame: frameOf(variant?.root), rows };
  }

  it("centers its one layer on both axes", async () => {
    const { frame, rows } = await build([ICON]);
    expect(frame).toEqual(expect.objectContaining({ primaryAlign: "CENTER", counterAlign: "CENTER" }));
    expect(rows).toEqual(["grid: literal", "place-content-center: literal"]);
  });

  it("is unmapped when it holds more than one layer", async () => {
    const { rows } = await build([ICON, { ...ICON, key: "second" }]);
    expect(rows).toEqual(["grid: unmapped", "place-content-center: unmapped"]);
  });
});

// Unit under test: `buildComponentSet` on a root's `position`, `align-self` and `flex`. Oracle: CSS. A
// `relative` box stays where the flow puts it and only becomes the containing block of its
// positioned descendants, which an auto layout has none of. `align-self` places a flex item across
// its parent's line, and a component's root sits in no line: `auto`, the initial value, asks for
// nothing, while `stretch` asks for a length the root does not have. `flex` grows or shrinks a flex
// item along its line (CSS Flexbox 1 §7), which the root is not.
describe("a box's position and alignment", () => {
  async function rowsOf(classes: string) {
    const { coverage } = await buildFixture(chip(classes));
    return coverage
      .filter((row) => ["position", "align-self", "flex"].includes(row.property))
      .map((row) => [row.className, row.outcome, row.detail]);
  }

  it("drops flex-1 on the root, which sits in no flex line", async () => {
    expect(await rowsOf("flex-1")).toEqual([
      ["flex-1", "dropped", "the component's root sits in no flex line, so nothing grows or shrinks it"],
    ]);
  });

  it("drops relative, which anchors no layer in auto layout", async () => {
    expect(await rowsOf("relative")).toEqual([
      ["relative", "dropped", "it only anchors positioned descendants, which auto layout does not need"],
    ]);
  });

  it("leaves absolute unmapped", async () => {
    expect(await rowsOf("absolute")).toEqual([["absolute", "unmapped", expect.any(String)]]);
  });

  it("drops self-auto on the root, which sits in no row", async () => {
    expect(await rowsOf("self-auto")).toEqual([
      ["self-auto", "dropped", "the component's root sits in no row, and auto asks for no alignment"],
    ]);
  });

  it("leaves self-stretch unmapped", async () => {
    expect(await rowsOf("self-stretch")).toEqual([["self-stretch", "unmapped", expect.any(String)]]);
  });
});

// Unit under test: `buildComponentSet` on a box's margins. Oracle: CSS 2.1 §8.3 and §10.3.3. A
// margin lies outside the box's border, where it spaces the box from its siblings and its parent's
// edge. A component's root sits alone in its component set, so its margin changes nothing the set
// draws, unless the root is a block whose width its container gives it: the width is then the
// container's less the horizontal margins. A part's margin moves it within its parent, which the kit
// does not yet draw.
describe("a box's margin", () => {
  it.each([
    ["mb-3", "margin-bottom"],
    ["-mt-1.5", "margin-top"],
    ["mx-auto", "margin-inline"],
  ])("drops %s on the root, which sits beside no other box", async (className, property) => {
    const { coverage } = await buildFixture(chip(className));
    expect(notesOf(coverage, className)).toEqual([
      [
        property,
        "dropped",
        "the component's root sits alone in its component set, so its margin spaces it from nothing the set draws",
      ],
    ]);
  });

  // Oracle: CSS Flexbox 1 §4.2. A flex item's margins add to the space between it and its siblings
  // and its parent's edge, and never collapse, so a frame around the part whose padding is the margin
  // draws the part's margin box. The frame carries the part's BOOLEAN property, so hiding the part
  // takes its margin away too, as CSS does when the part is not rendered.
  it("draws a part's margin in a flex parent as the padding of a transparent frame around it", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex flex-col items-center", {
        parts: [{ ...dot("size-[8px] bg-[#000000] mb-2"), optional: { name: "Dot", defaultValue: true } }],
      })
    );
    const BLACK = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } } as const;
    const plain = { ...CENTERED_BOX, clips: false, cornerRadius: literal(0), stroke: undefined };
    expect(frameOf(variant?.root)).toEqual({
      ...plain,
      kind: "frame",
      key: "dot",
      name: "chip-dot",
      visibleProperty: "Dot",
      sizing: { horizontal: HUG, vertical: HUG },
      paddingBottom: literal(8),
      fill: undefined,
      children: [
        {
          ...plain,
          kind: "frame",
          key: "box",
          name: "box",
          sizing: fixedSize(literal(8), literal(8)),
          fill: BLACK,
          children: [],
        },
      ],
    });
    expect(notesOf(coverage, "mb-2")).toEqual([
      ["margin-bottom", "literal", "8px of padding on a frame around the part, the space the margin adds"],
    ]);
  });

  it.each([
    ["a negative margin", "flex", "size-[8px] -mt-1", "-mt-1", "margin-top"],
    ["a margin in a parent that is no flex box", "block", "size-[8px] mt-1", "mt-1", "margin-top"],
    ["a margin beside a fill", "flex flex-col w-[100px]", "w-full h-[8px] mt-1", "mt-1", "margin-top"],
    ["a logical margin", "flex", "size-[8px] mx-1", "mx-1", "margin-inline"],
  ])("leaves %s on a part unmapped", async (_, parent, part, className, property) => {
    const { coverage } = await buildFixture(chip(parent, { parts: [dot(part)] }));
    expect(notesOf(coverage, className)).toEqual([[property, "unmapped", expect.any(String)]]);
  });

  it("leaves the horizontal margins of a block that takes the preview width unmapped, and drops its vertical ones", async () => {
    const { coverage } = await buildFixture(chip("block mx-[16px] my-[4px]", { previewWidth: 384 }));
    // CSS draws the block 352px wide, 384px less the two 16px margins.
    expect(notesOf(coverage, "mx-[16px]")).toEqual([
      [
        "margin-inline",
        "unmapped",
        "the root's width is its container's less this margin, which the build does not subtract",
      ],
    ]);
    expect(notesOf(coverage, "my-[4px]").map(([property, outcome]) => [property, outcome])).toEqual([
      ["margin-block", "dropped"],
    ]);
  });

  it("drops the horizontal margins of a block whose width is its own", async () => {
    const { coverage } = await buildFixture(chip("block w-[200px] mx-[16px]", { previewWidth: 384 }));
    expect(notesOf(coverage, "mx-[16px]").map(([property, outcome]) => [property, outcome])).toEqual([
      ["margin-inline", "dropped"],
    ]);
  });
});

// Unit under test: `buildComponentSet` on a box's `min-*` and `max-*` lengths. Oracle: CSS 2.1
// §10.4 and §10.7. The used width is the width lowered to `max-width` and then raised to
// `min-width`, so the min wins a conflict, and the used height follows the same rule. Beside a fixed
// length a limit therefore resolves into the length, or changes nothing. Beside a length that hugs
// or fills, it bounds the length as Figma's limits do. The plugin typings require a positive limit,
// and Figma's auto layout never shrinks a layer, so a zero minimum has nothing to keep.
describe("a box's limits", () => {
  async function build(classes: string, context: FixtureContext = {}) {
    const { variant, coverage } = await buildFixture(chip(classes), context);
    return {
      root: variant?.root,
      rows: coverage
        .filter((row) => /^(?:min|max)-(?:width|height)$/.test(row.property))
        .map((row) => [row.className, row.outcome, row.detail]),
    };
  }

  it.each([
    ["w-[20px] max-w-[12px]", "horizontal", 12],
    ["w-[20px] min-w-[24px]", "horizontal", 24],
    ["h-[20px] max-h-[12px]", "vertical", 12],
    ["h-[20px] min-h-[24px]", "vertical", 24],
    ["w-[20px] max-w-[10px] min-w-[15px]", "horizontal", 15],
  ] as const)("resolves %s into a fixed %s length of %ipx", async (classes, axis, length) => {
    const { root, rows } = await build(classes);
    expect(root?.sizing[axis]).toEqual(fixed(literal(length)));
    expect(root?.limits).toEqual(UNLIMITED);
    expect(new Set(rows.map(([, outcome]) => outcome))).toEqual(new Set(["literal"]));
  });

  it.each(["max-w-[16px]", "max-w-[24px]"])("drops %s at or above a 16px fixed width", async (max) => {
    expect((await build(`size-[16px] ${max}`)).rows).toEqual([
      [max, "dropped", "it is no less than the fixed width, so it never narrows the box"],
    ]);
  });

  it("drops a min-width at or below the fixed width", async () => {
    expect((await build("size-[16px] min-w-[12px]")).rows).toEqual([
      ["min-w-[12px]", "dropped", "it is no more than the fixed width, so it never widens the box"],
    ]);
  });

  it("leaves a limit it cannot compare with the fixed length unmapped", async () => {
    const variables = makeVariableIndex([
      { ref: { collection: "Fuse tokens", name: "chip-max" }, webSyntax: "var(--chip-max)" },
    ]);
    const { root, rows } = await build("w-[20px] max-w-(--chip-max)", { variables });
    expect(root?.sizing.horizontal).toEqual(fixed(literal(20)));
    expect(root?.limits).toEqual(UNLIMITED);
    expect(rows).toEqual([["max-w-(--chip-max)", "unmapped", expect.any(String)]]);
  });

  // A 5px `--chip-max` would lower the width to 5px and the 10px minimum would raise it to 10px, so
  // whether the minimum moves the width depends on a value the build cannot compare.
  it("leaves a literal limit unmapped where the other limit cannot be compared", async () => {
    const variables = makeVariableIndex([
      { ref: { collection: "Fuse tokens", name: "chip-max" }, webSyntax: "var(--chip-max)" },
    ]);
    const { root, rows } = await build("w-[20px] min-w-[10px] max-w-(--chip-max)", { variables });
    expect(root?.sizing.horizontal).toEqual(fixed(literal(20)));
    expect(rows).toEqual([
      ["min-w-[10px]", "unmapped", expect.any(String)],
      ["max-w-(--chip-max)", "unmapped", expect.any(String)],
    ]);
  });

  it("keeps a limit beside a width or height that hugs", async () => {
    const { root, rows } = await build("max-w-[16px] min-h-[64px]");
    expect(root?.sizing).toEqual({ horizontal: HUG, vertical: HUG });
    expect(root?.limits).toEqual({ ...UNLIMITED, maxWidth: literal(16), minHeight: literal(64) });
    expect(rows).toEqual([
      ["max-w-[16px]", "literal", "16px"],
      ["min-h-[64px]", "literal", "64px"],
    ]);
  });

  it("keeps a limit beside a width that fills", async () => {
    const { variant } = await buildFixture(chip("flex w-[100px]", { parts: [dot("w-full max-w-[40px]")] }));
    expect(frameOf(variant?.root)).toEqual(
      expect.objectContaining({
        sizing: { horizontal: FILL, vertical: HUG },
        limits: { ...UNLIMITED, maxWidth: literal(40) },
      })
    );
  });

  // The plugin typings require a positive limit, so a zero maximum has no Figma form.
  it.each(["max-w-[0px]", "max-h-[0px]"])("leaves %s unmapped beside a length that hugs", async (max) => {
    const { root, rows } = await build(max);
    expect(root?.limits).toEqual(UNLIMITED);
    expect(rows).toEqual([[max, "unmapped", expect.any(String)]]);
  });

  it("leaves a zero maximum unmapped beside a width that fills", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex w-[100px]", { parts: [dot("w-full max-w-[0px]")] })
    );
    expect(frameOf(variant?.root)).toEqual(
      expect.objectContaining({ sizing: { horizontal: FILL, vertical: HUG }, limits: UNLIMITED })
    );
    expect(coverage.filter((row) => row.className === "max-w-[0px]").map((row) => row.outcome)).toEqual([
      "unmapped",
    ]);
  });

  it("leaves a zero maximum that would fold a fixed width to nothing unmapped", async () => {
    const { root, rows } = await build("w-[20px] max-w-[0px]");
    expect(root?.sizing.horizontal).toEqual(fixed(literal(20)));
    expect(rows).toEqual([["max-w-[0px]", "unmapped", expect.any(String)]]);
  });

  it("drops min-w-0, which keeps nothing in Figma", async () => {
    const { root, rows } = await build("min-w-0");
    expect(root?.limits).toEqual(UNLIMITED);
    expect(rows).toEqual([
      ["min-w-0", "dropped", "Figma takes no zero minimum, and its auto layout never shrinks a layer"],
    ]);
  });
});

// Unit under test: `buildComponentSet` on a root with `field-sizing-content`. Oracle: CSS Basic UI 4,
// where `field-sizing: content` sizes a form control to its content on a side no length sets, so
// an unset height follows the text, as a Figma height that hugs does, above its `min-height`.
describe("a box sized to its content", () => {
  it("reads field-sizing-content as a height that hugs", async () => {
    const { variant, coverage } = await buildFixture(chip("field-sizing-content min-h-[64px]"));
    expect(variant?.root.sizing.vertical).toEqual(HUG);
    expect(variant?.root.limits).toEqual({ ...UNLIMITED, minHeight: literal(64) });
    expect(
      coverage
        .filter((row) => row.className === "field-sizing-content")
        .map((row) => [row.outcome, row.detail])
    ).toEqual([["literal", "the height hugs its content"]]);
  });
});

// Unit under test: `buildComponentSet` on boxes with `overflow-hidden`. Oracle: CSS Overflow 3, where
// `overflow: hidden` clips a box's content at its padding box, as a Figma frame's `clipsContent`
// does. A part that sets nothing shows its overflow.
describe("a box that hides its overflow", () => {
  it("clips a part with overflow-hidden", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex", {
        parts: [dot("overflow-hidden size-[8px]"), { ...dot("size-[8px]"), key: "open", slot: "chip-open" }],
      })
    );
    expect(variant?.root.children.map((child) => child.kind === "frame" && child.clips)).toEqual([
      true,
      false,
    ]);
    expect(
      coverage.filter((row) => row.className === "overflow-hidden").map((row) => [row.part, row.outcome])
    ).toEqual([["chip-dot", "literal"]]);
  });

  it("reads overflow-hidden on the root, which clips anyway", async () => {
    const { variant, coverage } = await buildFixture(chip("overflow-hidden"));
    expect(variant?.root.clips).toBe(true);
    expect(coverage.map((row) => [row.className, row.outcome])).toEqual([["overflow-hidden", "literal"]]);
  });
});

// Unit under test: `buildComponentSet` on a root whose `after:` classes draw a hit area. Oracle:
// CSS, where `after:` styles the `::after` pseudo-element, a box of its own that the kit draws no
// layer for, so its declarations reach no Figma field. The definition that omits the pseudo-element
// names why, and one that does not leaves the classes to fail the gate.
describe("a class on a pseudo-element", () => {
  const HIT_AREA = ["after:absolute", "after:-inset-x-3", "after:content-['']"];

  async function build(omitted: ReadonlyMap<string, string>) {
    const { coverage } = await buildFixture(chip(HIT_AREA.join(" "), { omittedPseudoElements: omitted }));
    return coverage.map((row) => [row.className, row.property, row.outcome, row.detail]);
  }

  it("is dropped with the reason the definition omits it for", async () => {
    const reason = "a hit area, which paints nothing";
    expect(await build(new Map([["after", reason]]))).toEqual([
      ["after:absolute", "position", "dropped", reason],
      ["after:-inset-x-3", "inset-inline", "dropped", reason],
      ["after:content-['']", "--tw-content", "dropped", reason],
      ["after:content-['']", "content", "dropped", reason],
    ]);
  });

  it("is unmapped when the definition does not omit it", async () => {
    expect(new Set((await build(new Map())).map(([, , outcome]) => outcome))).toEqual(new Set(["unmapped"]));
  });
});

// Unit under test: `buildComponentSet` on a root whose classes style it around a child it holds or
// style that child. Oracle: CSS, where `has-[>[data-slot=checkbox]]:` holds only while the root
// holds a checkbox and `*:` styles the root's children, neither of which a set that draws the
// root on its own renders. The definition that omits those variants names why, and one that does
// not leaves the classes to fail the gate.
describe("a class that styles a composition", () => {
  const ARMS = ["has-[>[data-slot=checkbox]]:items-center", "*:data-[slot=field]:p-2"];

  async function build(omitted: ReadonlyMap<string, string>) {
    const { coverage } = await buildFixture(chip(ARMS.join(" "), { omittedCompositions: omitted }));
    return coverage.map((row) => [row.className, row.property, row.outcome, row.detail]);
  }

  it("is dropped with the reason the definition omits it for", async () => {
    const reason = "a chip around a control";
    expect(
      await build(
        new Map([
          ["has-[>[data-slot=checkbox]]", reason],
          ["*", reason],
        ])
      )
    ).toEqual([
      ["has-[>[data-slot=checkbox]]:items-center", "align-items", "dropped", reason],
      ["*:data-[slot=field]:p-2", "padding", "dropped", reason],
    ]);
  });

  it("is unmapped when the definition does not omit it", async () => {
    expect(new Set((await build(new Map())).map(([, , outcome]) => outcome))).toEqual(new Set(["unmapped"]));
  });
});

// Unit under test: `buildComponentSet` on a root whose `*:data-[slot=…]:` classes style a part below
// it. Oracle: Tailwind compiles `*:data-[slot=chip-dot]:size-[8px]` to
// `:is(.… > *)[data-slot="chip-dot"]`, which matches each child of the root that carries the slot at
// (0,2,0), so it beats the part's own `size-[4px]` at (0,1,0) and leaves a part with another slot
// alone. A slot no part of the definition carries leaves the class styling nothing the set draws, and
// a variant past the slot tests the child's own state, which no cell models, so both fail the gate.
describe("a class that styles a child part through `*:data-[slot=…]:`", () => {
  const RING = { ...dot(""), key: "ring", slot: "chip-ring" };

  it("sizes the part that carries the slot over the part's own size, and leaves another part as it is", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex *:data-[slot=chip-dot]:size-[8px]", { parts: [dot("size-[4px]"), RING] })
    );
    const [first, second] = variant?.root.children ?? [];
    expect([first?.kind === "frame" && first.sizing, second?.kind === "frame" && second.sizing]).toEqual([
      fixedSize(literal(8), literal(8)),
      { horizontal: HUG, vertical: HUG },
    ]);
    expect(
      new Set(
        coverage
          .filter((row) => row.className === "*:data-[slot=chip-dot]:size-[8px]")
          .map((row) => `${row.part} ${row.property} ${row.outcome}`)
      )
    ).toEqual(new Set(["chip width literal", "chip height literal"]));
  });

  it.each([
    [
      "*:data-[slot=chip-gap]:size-[8px]",
      "the definition draws no part with `data-slot=chip-gap` below chip",
    ],
    [
      "*:data-[slot=chip-dot]:hover:size-[8px]",
      "the builder reads `*:data-[slot=…]:` only as a class's last variants, and models no state of the child",
    ],
    ["*:size-[8px]", "the builder reads `*:` only before a `data-[slot=…]:` that names one part"],
  ])("leaves %s unmapped", async (className, detail) => {
    const { coverage } = await buildFixture(chip(`flex ${className}`, { parts: [dot("")] }));
    expect(new Set(coverage.filter((row) => row.className === className).map((row) => row.detail))).toEqual(
      new Set([detail])
    );
    expect(new Set(coverage.filter((row) => row.className === className).map((row) => row.outcome))).toEqual(
      new Set(["unmapped"])
    );
  });
});

// Unit under test: `buildComponentSet` on a root with Tailwind's marker classes. Oracle: Tailwind
// emits no CSS for `group`, `group/<name>`, `peer` or `peer/<name>`. Each only names an element
// that a descendant's `group-*` or a sibling's `peer-*` variant reads, so it has nothing to draw.
describe("a marker class", () => {
  it.each(["group", "group/chip", "peer", "peer/chip"])(
    "drops %s as a marker with no CSS",
    async (className) => {
      const { coverage } = await buildFixture(chip(className));
      expect(coverage).toEqual([
        expect.objectContaining({ className, outcome: "dropped", detail: "a marker class with no CSS" }),
      ]);
    }
  );
});

// Unit under test: `buildComponentSet` on a box that declares a custom property none of its own
// declarations read. Oracle: CSS Custom Properties 1, where a custom property draws nothing itself
// and takes effect only where a `var()` reads it. The box's own reads count already, so an unread
// one only passes its value down: a box with no part or icon has nothing to pass it to, while a part
// that does not read it may still need a reader the builder lacks.
describe("an unread custom property", () => {
  it("drops on a box that holds no part or icon", async () => {
    const { coverage } = await buildFixture(chip("[--chip-inner:4px]"));
    expect(coverage).toEqual([
      expect.objectContaining({
        className: "[--chip-inner:4px]",
        outcome: "dropped",
        detail: "a custom property passes its value down, and the box holds no part or icon to take it",
      }),
    ]);
  });

  // A part that reads it reads it through the box's declaration, so the declaration is read, as "a
  // part below the root" shows. Unread at the end of the cell, it reached no Figma field of any
  // layer below, as the shell corners of Select's trigger reach neither its value nor its caret.
  it("drops on a box whose part and icon do not read it", async () => {
    const { coverage } = await buildFixture(
      chip("[--chip-inner:4px] [&_svg]:size-[16px] text-[#000000]", {
        parts: [dot("")],
        iconsFor: () => [ICON],
      })
    );
    expect(coverage.filter((row) => row.className === "[--chip-inner:4px]")).toEqual([
      expect.objectContaining({
        outcome: "dropped",
        detail: "a custom property passes its value down, and no part or icon below reads it",
      }),
    ]);
  });

  // The browser paints `bg-card` with the box's own `--card`, red, while the builder keeps a synced
  // variable as its `var()` and binds `card`. The override goes unread for that reason, not because
  // it only passes its value down, so it must fail the gate.
  it("stays unmapped on a leaf where it overrides a synced variable, which the builder binds instead", async () => {
    const { coverage } = await buildFixture(chip("bg-card [--card:#ff0000]"), {
      variables: makeVariableIndex([
        { ref: { collection: "Fuse tokens", name: "card" }, webSyntax: "var(--card)" },
      ]),
    });
    expect(coverage.filter((row) => row.className === "[--card:#ff0000]")).toEqual([
      expect.objectContaining({ property: "--card", outcome: "unmapped" }),
    ]);
  });
});

// Unit under test: `buildComponentSet` on a root with `rounded-full`, which Tailwind compiles to
// `border-radius: calc(infinity * 1px)`. Oracle: CSS Backgrounds 3, which scales down corner radii
// whose sum exceeds a side, so any radius above half the shorter side draws as that half: 8px on
// a 16px circle, 4px on an 8px one. Probe P10 (2026-10-22) showed Figma draws a radius the same way
// and keeps the written value, so half of the one fixed side draws as CSS does whichever side ends
// up shorter. A box that hugs both sides has no length to halve before layout.
describe("a pill corner", () => {
  async function build(classes: string) {
    const { componentSet, coverage } = await buildFixture(chip(classes));
    return {
      corner: componentSet.variants[0]?.root.cornerRadius,
      rows: coverage
        .filter((row) => row.className === "rounded-full")
        .map((row) => [row.outcome, row.detail]),
    };
  }

  it.each([
    ["size-[16px]", 8],
    ["size-[8px]", 4],
    ["w-[24px] h-[10px]", 5],
  ])("reads as half the shorter side of a %s box", async (size, radius) => {
    expect(await build(`${size} rounded-full`)).toEqual({
      corner: { kind: "literal", value: radius },
      rows: [["literal", `${radius}px, half the shorter side, which CSS draws for any larger radius`]],
    });
  });

  it("reads as half the fixed side of a box that hugs the other side", async () => {
    expect(await build("h-[16px] rounded-full")).toEqual({
      corner: literal(8),
      rows: [["literal", "8px, half the fixed height, which Figma and CSS cap at half the shorter side"]],
    });
  });

  it("reads as half the fixed side of a part that fills the other side", async () => {
    const { variant } = await buildFixture(
      chip("flex w-[100px]", { parts: [dot("w-full h-[6px] rounded-full")] })
    );
    expect(frameOf(variant?.root)?.cornerRadius).toEqual(literal(3));
  });

  it("is unmapped on a box that hugs both sides", async () => {
    const { rows } = await build("rounded-full");
    expect(rows).toEqual([["unmapped", expect.any(String)]]);
  });
});

// Unit under test: `buildComponentSet` on a root with `aspect-square`. Oracle: CSS Sizing 4, under
// which `aspect-ratio` sizes a box only through a side it leaves automatic. With both sides fixed
// the ratio changes nothing, and with one side hugging it would size that side, which a Figma
// frame cannot follow.
describe("an aspect ratio", () => {
  it.each([
    ["size-[16px] aspect-square", "dropped"],
    ["h-[16px] aspect-square", "unmapped"],
  ])("on %s is %s", async (classes, outcome) => {
    const { coverage } = await buildFixture(chip(classes));
    expect(coverage.filter((row) => row.className === "aspect-square").map((row) => row.outcome)).toEqual([
      outcome,
    ]);
  });
});

// Unit under test: `buildComponentSet` on a part positioned by `absolute top-1/2 left-1/2
// -translate-x-1/2 -translate-y-1/2`. Oracle: CSS. The offsets put the part's corner at the center
// of its containing block, and the translate moves it back by half its own size, so its center
// lands on the block's center. A parent that centers its one layer on both axes draws the same
// place in auto layout. A parent that packs it at the start does not, and an offset outside the
// whole pattern moves the part in a way no auto layout field holds.
describe("a part centered by absolute position", () => {
  const CENTERED = "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[8px]";
  const PLACEMENT = new Set(["position", "top", "left", "translate"]);

  async function build(parentClasses: string, partClasses: string) {
    const { variant, coverage } = await buildFixture(chip(parentClasses, { parts: [dot(partClasses)] }));
    return {
      frame: frameOf(variant?.root),
      rows: coverage
        .filter((row) => row.part === "chip-dot" && PLACEMENT.has(row.property))
        .map((row) => `${row.property}: ${row.outcome}`)
        .toSorted(),
    };
  }

  it("is a layer its parent's auto layout centers", async () => {
    const { frame, rows } = await build("relative flex items-center justify-center size-[16px]", CENTERED);
    expect(frame).toEqual(expect.objectContaining({ sizing: fixedSize(literal(8), literal(8)) }));
    expect(rows).toEqual(["left: literal", "position: literal", "top: literal", "translate: literal"]);
  });

  it("stays unmapped in a parent that does not center it", async () => {
    const { rows } = await build("relative flex items-start justify-center size-[16px]", CENTERED);
    expect(rows).toEqual(["left: unmapped", "position: unmapped", "top: unmapped", "translate: unmapped"]);
  });

  it("leaves a lone top-1/2 unmapped", async () => {
    const { rows } = await build(
      "relative flex items-center justify-center size-[16px]",
      "top-1/2 size-[8px]"
    );
    expect(rows).toEqual(["top: unmapped"]);
  });
});

// Unit under test: `buildComponentSet` on a part with `absolute top-0 left-0`. Oracle: CSS 2.1
// §10.1 and §10.3.7 to §10.6.4. An absolute box sits out of its parent's flow, at the offsets from
// its containing block, the padding box of its nearest positioned ancestor, and its percentages take
// that block. In a `relative` 256 × 6 parent with no padding or border, `w-[85%]` is 217.6px and
// `h-full` 6px, at the parent's top left, as a meter's fill sits in its bar. A percentage width keeps
// its share when the parent grows, which Figma's SCALE draws, and a full height keeps both edges,
// which STRETCH draws (P8). Out of flow, it shares its parent's row with no other layer.
describe("a part at its positioned parent's top left", () => {
  const AT_START = "absolute top-0 left-0 w-[85%] h-full";
  const CONSTRAINED = { x: 0, y: 0, constraints: { horizontal: "SCALE", vertical: "STRETCH" } };
  const PLACEMENT = new Set(["position", "top", "left"]);

  async function build(parentClasses: string, partClasses: string) {
    const { variant, coverage } = await buildFixture(chip(parentClasses, { parts: [dot(partClasses)] }));
    return {
      frame: frameOf(variant?.root),
      rows: coverage
        .filter((row) => row.part === "chip-dot" && PLACEMENT.has(row.property))
        .map((row) => `${row.property}: ${row.outcome}`)
        .toSorted(),
      coverage,
    };
  }

  it("is an absolute layer at its parent's top left, its width a share and its height the parent's", async () => {
    const { frame, rows, coverage } = await build("relative w-[256px] h-[6px]", AT_START);
    expect(frame).toEqual(
      expect.objectContaining({ sizing: fixedSize(literal(217.6), literal(6)), absolute: CONSTRAINED })
    );
    expect(rows).toEqual(["left: literal", "position: literal", "top: literal"]);
    expect(
      coverage
        .filter((row) => row.part === "chip-dot" && ["width", "height"].includes(row.property))
        .map((row) => [row.className, row.detail])
    ).toEqual([
      ["w-[85%]", "217.6px, 85% of the parent's width"],
      ["h-full", "6px, the parent's height that 100% takes"],
    ]);
  });

  it("takes its share of a parent that fills a column's fixed width", async () => {
    const { variant } = await buildFixture(
      chip("flex flex-col w-[256px]", {
        parts: [
          {
            ...dot("relative w-full h-[6px]"),
            parts: [{ ...dot(AT_START), key: "fill", slot: "chip-fill" }],
          },
        ],
      })
    );
    const bar = frameOf(variant?.root);
    expect(bar?.sizing.horizontal).toEqual(FILL);
    expect(frameOf(bar)).toEqual(
      expect.objectContaining({ sizing: fixedSize(literal(217.6), literal(6)), absolute: CONSTRAINED })
    );
  });

  it.each([
    ["a parent that is not positioned", "w-[256px] h-[6px]", AT_START],
    ["a parent with padding", "relative w-[256px] h-[6px] p-[1px]", AT_START],
    ["a parent with a border", "relative w-[256px] h-[6px] border border-[#000000]", AT_START],
    ["an offset from the top", "relative w-[256px] h-[6px]", "absolute top-[2px] left-0 w-[85%] h-full"],
    ["a width in pixels", "relative w-[256px] h-[6px]", "absolute top-0 left-0 w-[100px] h-full"],
    ["a height of its own", "relative w-[256px] h-[6px]", "absolute top-0 left-0 w-[85%] h-[4px]"],
  ])("stays unmapped in %s", async (_case, parentClasses, partClasses) => {
    const { frame, rows } = await build(parentClasses, partClasses);
    expect(frame?.absolute).toBeUndefined();
    expect(rows).toContain("position: unmapped");
  });

  it("leaves a sibling in its parent's row alone, so the sibling's 100% fills the row", async () => {
    const { variant } = await buildFixture(
      chip("relative flex w-[100px] h-[6px]", {
        parts: [dot("w-full h-[4px]"), { ...dot(AT_START), key: "fill", slot: "chip-fill" }],
      })
    );
    const [sibling, fill] = variant?.root.children ?? [];
    expect([
      sibling?.kind === "frame" && sibling.sizing.horizontal,
      fill?.kind === "frame" && fill.absolute,
    ]).toEqual([FILL, CONSTRAINED]);
  });

  /** A column 256px wide holding a positioned bar with the given classes, which holds the part. */
  async function inBar(barClasses: string, partClasses = AT_START) {
    const { variant, coverage } = await buildFixture(
      chip("flex flex-col w-[256px]", {
        parts: [{ ...dot(barClasses), parts: [{ ...dot(partClasses), key: "fill", slot: "chip-fill" }] }],
      })
    );
    return { fill: frameOf(frameOf(variant?.root)), coverage };
  }

  // CSS sizes the containing block after its own limits (CSS 2.1 §10.4), so a bar that fills the
  // column up to `max-w-[128px]` is 128px wide, and 85% of it is 108.8px.
  it("takes its share of a filling parent after the parent's maximum", async () => {
    const { fill } = await inBar("relative w-full max-w-[128px] h-[6px]");
    expect(fill).toEqual(
      expect.objectContaining({ sizing: fixedSize(literal(108.8), literal(6)), absolute: CONSTRAINED })
    );
  });

  // In the 256px column `max-w-[calc(100%-64px)]` is 192px, which lowers a 200px bar to 192px, so an
  // 85% fill would be 163.2px, not the 170px of the bar's own width. The build reads no such limit.
  it.each([
    ["fills", "relative w-full max-w-[calc(100%-4px)] h-[6px]"],
    ["is fixed", "relative w-[200px] max-w-[calc(100%-64px)] h-[6px]"],
  ])(
    "leaves its share unmapped where a parent that %s has a maximum the build cannot read",
    async (_case, bar) => {
      const { fill, coverage } = await inBar(bar);
      expect(fill?.absolute).toBeUndefined();
      expect(
        coverage
          .filter((row) => row.part === "chip-fill" && row.property === "width")
          .map((row) => row.outcome)
      ).toEqual(["unmapped"]);
    }
  );

  // A maximum caps the share: CSS keeps `w-[85%] max-w-[100px]` at 100px however wide the parent
  // grows, where Figma's SCALE would scale the layer past it.
  it("stays unmapped where a maximum bounds its share, and says so", async () => {
    const { frame, coverage } = await build(
      "relative w-[256px] h-[6px]",
      "absolute top-0 left-0 w-[85%] max-w-[100px] h-full"
    );
    expect(frame?.absolute).toBeUndefined();
    expect(
      coverage
        .filter((row) => row.part === "chip-dot" && row.property === "position")
        .map((row) => [row.outcome, row.detail])
    ).toEqual([
      [
        "unmapped",
        "max-width bounds the layer's share of its parent, which Figma's constraints would carry past the bound as the parent resizes",
      ],
    ]);
  });

  // CSS Grid 1 §9: an absolute child is no grid item, so a grid holding one child in its flow and an
  // absolute one places its one item, as a grid with one child does.
  it("leaves a grid's one item alone, so the grid centers it", async () => {
    const { coverage } = await buildFixture(
      chip("relative grid place-content-center w-[256px] h-[6px]", {
        parts: [dot("size-[4px]"), { ...dot(AT_START), key: "fill", slot: "chip-fill" }],
      })
    );
    expect(
      coverage
        .filter((row) => row.className === "grid" || row.className === "place-content-center")
        .map((row) => `${row.className}: ${row.outcome}`)
        .toSorted()
    ).toEqual(["grid: literal", "place-content-center: literal"]);
  });
});

// Unit under test: `buildComponentSet` on a part whose markup carries a `style` attribute. Oracle:
// CSS Cascade 4, where a style attribute's declarations beat every rule of an author style sheet
// (§6.2) and `inherit` takes the parent's computed value (§7.3), and CSS Logical Properties 1, where
// `inset-inline-start` is `left` in a left-to-right page and cascades with it. Base UI's meter fill
// carries `inset-inline-start: 0; height: inherit; width: 85%` over its classes. Here the classes
// set another left, width and height, which the style attribute overrides, so they leave no row.
describe("a part with an inline style", () => {
  const STYLE: readonly InlineDeclaration[] = [
    { property: "inset-inline-start", value: "0" },
    { property: "height", value: "inherit" },
    { property: "width", value: "85%" },
  ];

  it("lands its width and inherited height over the classes, and sets left through inset-inline-start", async () => {
    const fill: PartDefinition = {
      ...dot("absolute top-0 left-[4px] w-[10%] h-full"),
      styleFor: () => STYLE,
    };
    const { variant, coverage } = await buildFixture(chip("relative w-[256px] h-[6px]", { parts: [fill] }));
    expect(frameOf(variant?.root)).toEqual(
      expect.objectContaining({
        sizing: fixedSize(literal(217.6), literal(6)),
        absolute: { x: 0, y: 0, constraints: { horizontal: "SCALE", vertical: "STRETCH" } },
      })
    );
    expect(
      coverage
        .filter((row) => row.part === "chip-dot" && ["left", "width", "height"].includes(row.property))
        .map((row) => [row.className, row.property, row.value, row.outcome, row.detail])
        .toSorted(([, left = ""], [, right = ""]) => left.localeCompare(right))
    ).toEqual([
      ["inline style", "height", "inherit", "literal", "6px"],
      [
        "inline style",
        "left",
        "0",
        "literal",
        "an absolute layer at its parent's top left, which keeps its share of the parent's width and stretches with its height",
      ],
      ["inline style", "width", "85%", "literal", "217.6px, 85% of the parent's width"],
    ]);
  });
});

// Unit under test: `buildComponentSet` on a root with `display: block`. Oracle: CSS Display. A
// block box with nothing inside lays nothing out, so it draws as any frame of its size does. One
// that holds a layer stacks it in block flow, which a horizontal auto layout does not draw.
describe("a block box", () => {
  it.each([
    ["holds no layers", "literal", []],
    ["holds a layer", "unmapped", [ICON]],
  ])("that %s is %s", async (_case, outcome, icons) => {
    const classes = "block size-[16px] text-[#000000] [&_svg]:size-[12px]";
    const { coverage } = await buildFixture(chip(classes, { iconsFor: () => icons }));
    expect(coverage.filter((row) => row.className === "block").map((row) => row.outcome)).toEqual([outcome]);
  });

  it("that holds only its label sets it in lines across its width", async () => {
    const { variant, coverage } = await buildLabelled("block w-[100px]", { label: LABEL });
    expect(textOf(variant?.root)?.sizing).toEqual(FILL_WIDTH);
    expect(notesOf(coverage, "block")).toEqual([
      ["display", "literal", "a block box that sets its own text in lines"],
    ]);
  });

  // CSS 2.1 §9.4.1: a block box sets its first line box at the top of its content box, so a box
  // taller than its line, by its height or its minimum, keeps the text at the top.
  it.each(["h-[100px]", "min-h-[100px]"])("with %s sets its line at the top", async (height) => {
    const { variant } = await buildLabelled(`block w-[100px] ${height}`, { label: LABEL });
    expect(variant?.root.counterAlign).toBe("MIN");
  });
});

// Unit under test: `buildComponentSet` on a part its parent's row holds alone, moved along the row
// by `translate-x`. Oracle: CSS. A flex row with no `justify-content` packs its child at the start
// of its content box, and a translate moves the child's border box by its length, a percentage
// taking the child's own width (CSS Transforms 1, the reference box). In a 32px row with a 1px
// border, the content box is 30px wide, so a 16px part moved 0px sits at the start and one moved
// 14px sits flush with the end, which Figma calls MIN and MAX. `calc(100% - 2px)` of the 16px part
// is 14px. A 13px move leaves a gap no alignment draws, and so does any move in a row whose width
// is not fixed or that does not pack its child at the start.
describe("a part translated along its parent's row", () => {
  const ROW = "inline-flex items-center w-[32px] h-[18.4px] border border-[#000000]";
  const AT_END = "at the end of its parent's row, flush with the end of the content box";
  const AT_START = "at the start of its parent's row, where it sits unmoved";

  async function build(rowClasses: string, partClasses: string) {
    const { variant, coverage } = await buildFixture(
      chip(rowClasses, { parts: [dot(`size-[16px] ${partClasses}`)] })
    );
    return {
      align: variant?.root.primaryAlign,
      rows: coverage
        .filter((row) => row.part === "chip-dot" && row.property === "translate")
        .map((row) => [row.outcome, row.detail]),
    };
  }

  it.each([
    ["translate-x-[14px]", "MAX", AT_END],
    ["translate-x-[calc(100%-2px)]", "MAX", AT_END],
    ["translate-x-0", "MIN", AT_START],
  ])("reads %s as the row's %s alignment", async (translate, align, detail) => {
    expect(await build(ROW, translate)).toEqual({ align, rows: [["literal", detail]] });
  });

  it("agrees with a row that packs its child at the start", async () => {
    expect(await build(`${ROW} justify-start`, "translate-x-0")).toEqual({
      align: "MIN",
      rows: [["literal", AT_START]],
    });
  });

  it.each([
    ["a move that leaves a gap", ROW, "translate-x-[13px]"],
    [
      "a move in a row with no fixed width",
      "inline-flex items-center border border-[#000000]",
      "translate-x-0",
    ],
    ["a move in a row that centers its child", `${ROW} justify-center`, "translate-x-0"],
    ["a move in a row that packs its child at the end", `${ROW} justify-end`, "translate-x-[14px]"],
    ["a move in a row that packs its child at the start", `${ROW} justify-start`, "translate-x-[14px]"],
    ["a vertical move", ROW, "translate-y-[1px]"],
  ])("leaves %s unmapped", async (_case, rowClasses, translate) => {
    const { rows } = await build(rowClasses, translate);
    expect(rows).toEqual([["unmapped", expect.any(String)]]);
  });

  // A grid with `place-content: center` centers its one child before the translate moves it, so a
  // move of 0 leaves the part centered, which no row alignment read from the translate draws.
  it("leaves a move in a centering grid unmapped, with the part still centered", async () => {
    expect(await build("grid place-content-center size-[32px]", "block translate-x-0")).toEqual({
      align: "CENTER",
      rows: [["unmapped", expect.any(String)]],
    });
  });
});

// Unit under test: `buildComponentSet` on a part scaled by `scale-75` in its off cell. Oracle: CSS
// Transforms 2. `scale` draws the box's paint at that share of its size around its center, and
// leaves the box's layout size as it was. A 16px circle at 75% paints a 12px circle, radius 6, in
// the middle of its 16px place, and at no scale a 16px circle, radius 8. Figma draws that as a
// transparent 16px slot centering a dot, in both cells, so both cells have one layer tree.
describe("a part drawn at a scale", () => {
  const THUMB = "size-[16px] rounded-full bg-[#000000]";

  async function build(partClasses: string) {
    const { componentSet, coverage } = await buildFixture(
      chip("inline-flex", {
        axes: [{ name: "checked", values: ["off", "on"] }],
        columnAxis: "checked",
        facts: new Map([["data-unchecked", (cell) => cell.checked === "off"]]),
        parts: [{ ...dot(partClasses), key: "thumb", slot: "chip-thumb" }],
      })
    );
    return {
      frames: componentSet.variants.map((variant) => frameOf(variant.root)),
      rows: coverage.filter((row) => row.property === "scale").map((row) => [row.className, row.outcome]),
    };
  }

  /** A frame with no limits, padding, gap, stroke or shadow, centering what it holds and not clipping it. */
  function frame(
    fields: Omit<FrameLayerSpec, "kind" | "clips" | "stroke" | keyof typeof CENTERED_BOX>
  ): FrameLayerSpec {
    return { kind: "frame", clips: false, stroke: undefined, ...CENTERED_BOX, ...fields };
  }
  const BLACK = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } } as const;

  function slot(dotSize: number): FrameLayerSpec {
    return frame({
      key: "thumb",
      name: "chip-thumb",
      sizing: fixedSize(literal(16), literal(16)),
      cornerRadius: literal(0),
      fill: undefined,
      children: [
        frame({
          key: "dot",
          name: "dot",
          sizing: fixedSize(literal(dotSize), literal(dotSize)),
          cornerRadius: { kind: "literal", value: dotSize / 2 },
          fill: BLACK,
          children: [],
        }),
      ],
    });
  }

  it("is a slot its layout size, centering a dot at the scaled size, in every cell", async () => {
    const { frames, rows } = await build(`${THUMB} data-unchecked:scale-75`);
    expect(frames).toEqual([slot(12), slot(16)]);
    expect(rows).toEqual([["data-unchecked:scale-75", "literal"]]);
  });

  it("leaves a scale that is not the same on both axes unmapped", async () => {
    const { rows } = await build(`${THUMB} data-unchecked:scale-x-75`);
    expect(rows).toEqual([["data-unchecked:scale-x-75", "unmapped"]]);
  });

  // A 1px dashed border paints 3px dashes and 2px gaps (see "a dashed border"), so at 75% it paints
  // a 0.75px stroke with 2.25px dashes and 1.5px gaps.
  it("draws a dashed border's weight and dashes at the scaled size", async () => {
    const { frames } = await build("size-[16px] border border-dashed border-[#000000] scale-75");
    const strokes = frames.map((slot) => frameOf(slot)?.stroke);
    const scaledStroke = { color: BLACK, weight: literal(0.75), dashPattern: [2.25, 1.5] };
    expect(strokes).toEqual([scaledStroke, scaledStroke]);
  });
});

// Unit under test: the cascade `buildComponentSet` runs for an icon that carries classes of its
// own, as Loader's `<SpinnerGap className="animate-spin size-4" />` does. Oracle: CSS Selectors
// specificity. The icon's own `.size-6` is (0,1,0), and its box's `[&_svg]:size-4` compiles to
// `.\[\&_svg\]\:size-4 svg`, (0,1,1). So the box's child selector wins where it reaches the icon,
// whatever order Tailwind emits the two in, and the icon's own class sizes it, 24px, where nothing
// else does.
describe("an icon with classes of its own", () => {
  async function build(rootClasses: string, iconClasses: string) {
    const { variant, coverage } = await buildFixture(
      chip(rootClasses, { iconsFor: () => [{ ...ICON, classes: iconClasses }] })
    );
    const [icon] = variant?.root.children ?? [];
    return { size: icon?.kind === "icon" ? icon.size : undefined, coverage };
  }

  it("takes its size from its own class where no child selector reaches it", async () => {
    const { size, coverage } = await build("text-[#000000]", "size-6");
    expect(size).toEqual({ kind: "literal", value: 24 });
    expect(
      coverage
        .filter((row) => row.className === "size-6")
        .map((row) => `${row.part} ${row.property}: ${row.outcome}`)
        .toSorted()
    ).toEqual(["Icon height: literal", "Icon width: literal"]);
  });

  it("loses to its box's child selector, which is more specific", async () => {
    const { size } = await build("text-[#000000] [&_svg]:size-4", "size-6");
    expect(size).toEqual({ kind: "literal", value: 16 });
  });

  // Oracle: `[class*='size-']` matches a class attribute holding `size-`, so `:not()` skips the icon.
  it("keeps its own size where the box's child selector skips an icon with a size class", async () => {
    const { size } = await build("text-[#000000] [&_svg:not([class*='size-'])]:size-4", "size-6");
    expect(size).toEqual({ kind: "literal", value: 24 });
  });
});

/** A label that a `Label` text property sets, starting as `Label`. */
const LABEL: LabelDefinition = {
  key: "label",
  name: "label",
  characters: "Label",
  textProperty: "Label",
  shownIn: () => true,
};

/** The text classes a label needs, which the chip's root carries and its parts inherit. */
const TEXT_STYLE = "font-sans text-[14px] leading-[20px] text-[#000000]";

/** A build context whose `font-sans` binds the synced family, as every kit label's does. */
const FONT_SANS: FixtureContext = {
  variables: makeVariableIndex([
    { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
  ]),
};

/** Build a chip whose root carries the text style and the given classes. */
function buildLabelled(classes: string, fields: Parameters<typeof chip>[1] = {}) {
  return buildFixture(chip(`${TEXT_STYLE} ${classes}`, fields), FONT_SANS);
}

/** The first text layer a box holds, at any depth. */
function textOf(box: BoxSpec | undefined): TextLayerSpec | undefined {
  for (const child of box?.children ?? []) {
    const found = child.kind === "text" ? child : child.kind === "frame" ? textOf(child) : undefined;
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

/** The property, outcome and detail of each row a class has in the coverage table, by property. */
function notesOf(coverage: readonly CoverageRow[], className: string) {
  return coverage
    .filter((row) => row.className === className)
    .map((row) => [row.property, row.outcome, row.detail])
    .toSorted(([left = ""], [right = ""]) => (left < right ? -1 : left > right ? 1 : 0));
}

const FILL_WIDTH = { horizontal: FILL, vertical: HUG };

// Unit under test: `buildComponentSet` on a box whose own text is its label. Oracle: CSS Text 3 and
// CSS Sizing 3. A label is the box's own text, laid out in the box's content width. Where that width
// is definite, fixed or filling, text that wraps (`white-space: normal`) breaks its lines there, as a
// Figma text that fills the width and hugs its height does. A box that hugs its width is as wide as
// its text on one line, since a kit frame always has room to spare, so the text hugs. A column with
// an unset `align-items` stretches its text, an anonymous flex item, across its width (Flexbox 1
// §9.4 step 11), which is the same fill. `white-space: nowrap` keeps the text on one line at its own
// width, which a hugging text draws.
describe("a label's sizing", () => {
  it("fills a fixed width and wraps, hugging its height", async () => {
    const { variant } = await buildLabelled("flex w-[100px]", { label: LABEL });
    expect(textOf(variant?.root)?.sizing).toEqual(FILL_WIDTH);
  });

  it("fills a part that fills its parent", async () => {
    const { variant } = await buildLabelled("flex w-[100px]", {
      parts: [{ ...dot("w-full"), label: LABEL }],
    });
    expect(textOf(variant?.root)?.sizing).toEqual(FILL_WIDTH);
  });

  it("reads an explicit whitespace-normal as wrapping", async () => {
    const { variant, coverage } = await buildLabelled("w-[100px] whitespace-normal", { label: LABEL });
    expect(textOf(variant?.root)?.sizing).toEqual(FILL_WIDTH);
    expect(notesOf(coverage, "whitespace-normal")).toEqual([
      ["white-space", "literal", "the label wraps at the box's width"],
    ]);
  });

  it("hugs its one line with nowrap, whatever the box's width", async () => {
    const { variant, coverage } = await buildLabelled("flex w-[100px] whitespace-nowrap", { label: LABEL });
    expect(textOf(variant?.root)?.sizing).toEqual({ horizontal: HUG, vertical: HUG });
    expect(notesOf(coverage, "whitespace-nowrap")).toEqual([
      ["white-space", "literal", "the label hugs its width"],
    ]);
  });

  // Oracle: CSS Text 4 §6.3. `text-wrap: balance` and `pretty` choose where a wrapping text breaks its
  // lines, and change nothing on a text that sets one line. A Figma text fills each line before the
  // next, so the kit draws the breaks a greedy browser would.
  it.each(["text-balance", "text-pretty"])(
    "drops %s on a label that wraps, and on one that hugs its one line",
    async (className) => {
      const wrapping = await buildLabelled(`w-[100px] ${className}`, { label: LABEL });
      expect(textOf(wrapping.variant?.root)?.sizing).toEqual(FILL_WIDTH);
      expect(notesOf(wrapping.coverage, className)).toEqual([
        [
          "text-wrap",
          "dropped",
          "a Figma text fills each line before it starts the next, so it cannot even out its lines",
        ],
      ]);
      const hugging = await buildLabelled(`w-fit ${className}`, { label: LABEL });
      expect(notesOf(hugging.coverage, className)).toEqual([
        ["text-wrap", "dropped", "the box hugs the label on one line"],
      ]);
    }
  );

  // Oracle: CSS Text 4 §6.1, where `text-wrap-mode` and `text-wrap-style`, which `text-wrap` sets,
  // are inherited, so a part's label wraps as its parent's `text-balance` says.
  it("reads the text-wrap a part's label inherits from the box around it", async () => {
    const { coverage } = await buildLabelled("flex items-start text-balance", {
      parts: [{ ...dot(""), label: LABEL }],
    });
    expect(notesOf(coverage, "text-balance")).toEqual([
      ["text-wrap", "dropped", "the box hugs the label on one line"],
    ]);
  });

  it("leaves text-balance unmapped beside nowrap, where the later of the two decides whether the text wraps", async () => {
    const { coverage } = await buildLabelled("w-[100px] whitespace-nowrap text-balance", { label: LABEL });
    expect(notesOf(coverage, "text-balance")).toEqual([["text-wrap", "unmapped", expect.any(String)]]);
  });

  it("stretches across a column with a definite width, and hugs in a column that hugs its width", async () => {
    const stretched = await buildLabelled("flex flex-col w-[100px]", { label: LABEL });
    expect(textOf(stretched.variant?.root)?.sizing).toEqual(FILL_WIDTH);
    const hugging = await buildLabelled("flex flex-col", { label: LABEL });
    expect(textOf(hugging.variant?.root)?.sizing).toEqual({ horizontal: HUG, vertical: HUG });
    expect(hugging.coverage.filter((row) => row.property === "align-items")).toEqual([]);
  });
});

// Unit under test: `buildComponentSet` on a label whose box sets `letter-spacing`. Oracle: CSS Text 3
// §8.2, where an `em` spacing is a share of the font size, Tailwind's `tracking-tight`, which is
// `-0.025em`, and probe PL, where Figma read `{ unit: "PERCENT", value: -2.5 }` back exactly and drew
// it at any size as the same share.
describe("a label's letter spacing", () => {
  it("reads an em spacing as a percent of the font size", async () => {
    const { variant, coverage } = await buildLabelled("tracking-tight", { label: LABEL });
    expect(textOf(variant?.root)?.letterSpacing).toEqual({ unit: "PERCENT", value: -2.5 });
    expect(notesOf(coverage, "tracking-tight")).toContainEqual([
      "letter-spacing",
      "literal",
      "letters -2.5% of the font size apart",
    ]);
  });

  // Oracle: CSS Text 4 §8.2, where an `em` spacing computes to a length where it is declared, which
  // the element's children inherit. Inherited at the same font size it is the same share of it, and
  // at another size it is not.
  it.each([
    ["the same", "", "", { unit: "PERCENT", value: -2.5 }],
    ["another", "text-[18px]", "text-[14px]", undefined],
  ])(
    "reads an em spacing a label inherits at %s font size",
    async (_, outerSize, innerSize, letterSpacing) => {
      const { variant, coverage } = await buildLabelled("flex", {
        parts: [
          {
            ...dot(`flex ${outerSize} tracking-tight`),
            parts: [{ ...dot(innerSize), key: "inner", slot: "chip-inner", label: LABEL }],
          },
        ],
      });
      expect(textOf(variant?.root)?.letterSpacing).toEqual(letterSpacing);
      const [outcome] = notesOf(coverage, "tracking-tight")
        .filter(([property]) => property === "letter-spacing")
        .map(([, note]) => note);
      expect(outcome).toBe(letterSpacing === undefined ? "unmapped" : "literal");
    }
  );

  it("leaves a spacing in pixels unmapped and draws none", async () => {
    const { variant, coverage } = await buildLabelled("tracking-[1px]", { label: LABEL });
    expect(textOf(variant?.root)?.letterSpacing).toBeUndefined();
    expect(notesOf(coverage, "tracking-[1px]")).toContainEqual([
      "letter-spacing",
      "unmapped",
      expect.any(String),
    ]);
  });
});

// Unit under test: `buildComponentSet` on a flex box whose own text wraps. Oracle: CSS Flexbox 1 and
// CSS Text 3. The text is an anonymous flex item, which does not grow (`flex: 0 1 auto`, §7.1), so a
// short label sits at its own width where `justify-content` places it in a row, or `align-items` in a
// column. A Figma text that fills the row sets its lines by its own alignment instead, so it draws
// what CSS draws only where the two put the line in the same place: at the start, or both centered. A
// column with an unset `align-items` stretches the item, which a fill draws whatever the alignment.
// Beside other layers in a row the label keeps its own width, where a fill takes the room they leave.
// A text with no soft wrap opportunity, such as a word of ASCII letters (UAX #14 keeps classes AL and
// NU together), never wraps, so its item keeps its own width wherever the box places it, which a
// hugging text draws, unless `overflow-wrap` or `word-break` lets the browser break inside a word.
// Fullwidth letters take class ID in LineBreak.txt, which breaks between them.
describe("a wrapping label in a flex box", () => {
  /** A label whose text wraps at its space. */
  const TWO_WORDS: LabelDefinition = { ...LABEL, characters: "Two words" };

  it("fills a row that places it at the start", async () => {
    const { variant } = await buildLabelled("flex w-[200px] justify-start", { label: TWO_WORDS });
    expect(textOf(variant?.root)?.sizing).toEqual(FILL_WIDTH);
  });

  it("stays unmapped in a row that centers it, where a fill sets its lines at the left", async () => {
    const { variant, coverage } = await buildLabelled("flex w-[200px] justify-center", { label: TWO_WORDS });
    expect(textOf(variant?.root)?.sizing).toEqual({ horizontal: HUG, vertical: HUG });
    expect(notesOf(coverage, "justify-center")).toContainEqual([
      "justify-content",
      "unmapped",
      "the row places the label at its own width in the center, where a text that fills it sets its lines at the left",
    ]);
  });

  it("hugs a word where a row centers it, since the word never wraps", async () => {
    const { variant, coverage } = await buildLabelled("flex w-[200px] justify-center", { label: LABEL });
    expect([textOf(variant?.root)?.sizing, variant?.root.primaryAlign]).toEqual([
      { horizontal: HUG, vertical: HUG },
      "CENTER",
    ]);
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  it("stays unmapped for fullwidth letters, which line breaking lets break between", async () => {
    const { coverage } = await buildLabelled("flex w-[200px] justify-center", {
      label: { ...LABEL, characters: "ＡＬ" },
    });
    expect(notesOf(coverage, "justify-center")).toContainEqual([
      "justify-content",
      "unmapped",
      "the row places the label at its own width in the center, where a text that fills it sets its lines at the left",
    ]);
  });

  it("stays unmapped for a word where word-break lets the browser break it", async () => {
    const { coverage } = await buildLabelled("flex w-[200px] justify-center break-all", { label: LABEL });
    expect(notesOf(coverage, "justify-center")).toContainEqual([
      "justify-content",
      "unmapped",
      "the row places the label at its own width in the center, where a text that fills it sets its lines at the left",
    ]);
  });

  it("fills a row that centers it when its lines are centered too", async () => {
    const { variant, coverage } = await buildLabelled("flex w-[200px] justify-center text-center", {
      label: TWO_WORDS,
    });
    const text = textOf(variant?.root);
    expect([text?.sizing, text?.align.horizontal]).toEqual([FILL_WIDTH, "CENTER"]);
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  it("stays unmapped beside an icon in a row, where a fill takes the room the icon leaves", async () => {
    const { coverage } = await buildLabelled("flex w-[200px] [&_svg]:size-[16px]", {
      label: TWO_WORDS,
      iconsFor: () => [ICON],
    });
    expect(notesOf(coverage, "flex")).toContainEqual([
      "display",
      "unmapped",
      "the label shares the row with Icon, so it keeps its own width, where a text that fills takes the room left",
    ]);
  });
});

// Unit under test: `buildComponentSet` on boxes with `truncate` and `line-clamp-*`. Oracle: CSS
// Overflow 3 and 4. `truncate` sets `overflow: hidden`, `text-overflow: ellipsis` and `white-space:
// nowrap`, so the text keeps to one line and ends in an ellipsis where it overflows the box's content
// width. `line-clamp-2` sets `overflow: hidden`, `display: -webkit-box`, `-webkit-box-orient:
// vertical` and `-webkit-line-clamp: 2`, so the wrapping text ends in an ellipsis after two lines.
// Figma draws both as a text that fills the width and truncates at its ending after that many
// lines. A box that hugs its width never overflows, so the ellipsis has nothing to cut.
// `text-overflow` applies to block containers only (CSS Overflow 3 §4.2). A flex box sets its own
// text as an anonymous flex item, which it clips with no ellipsis, as WPT
// `css-flexbox/text-overflow-on-flexbox-001` checks.
describe("a label that ends in an ellipsis", () => {
  it("reads truncate in a fixed block box as a fill that keeps to one line", async () => {
    const { variant, coverage } = await buildLabelled("w-[100px] truncate", { label: LABEL });
    const text = textOf(variant?.root);
    expect([text?.sizing, text?.truncation]).toEqual([FILL_WIDTH, { maxLines: 1 }]);
    expect(variant?.root.clips).toBe(true);
    expect(notesOf(coverage, "truncate")).toEqual([
      ["overflow", "literal", "the box clips its content"],
      ["text-overflow", "literal", "the label ends in an ellipsis after 1 line"],
      ["white-space", "literal", "the label keeps to one line"],
    ]);
  });

  it("clips a flex box's label with no ellipsis, hugging its one line", async () => {
    const { variant, coverage } = await buildLabelled("flex w-[100px] truncate", { label: LABEL });
    const text = textOf(variant?.root);
    expect([text?.sizing, text?.truncation]).toEqual([{ horizontal: HUG, vertical: HUG }, undefined]);
    expect(variant?.root.clips).toBe(true);
    expect(notesOf(coverage, "truncate")).toEqual([
      ["overflow", "literal", "the box clips its content"],
      ["text-overflow", "dropped", "a flex box sets its text as a flex item, which takes no ellipsis"],
      ["white-space", "literal", "the label hugs its width"],
    ]);
  });

  it("drops the ellipsis in a box that hugs its width, where the label never overflows", async () => {
    const { variant, coverage } = await buildLabelled("truncate", { label: LABEL });
    const text = textOf(variant?.root);
    expect([text?.sizing, text?.truncation]).toEqual([{ horizontal: HUG, vertical: HUG }, undefined]);
    expect(notesOf(coverage, "truncate")).toEqual([
      ["overflow", "literal", "the box clips its content"],
      ["text-overflow", "dropped", "the box hugs the label, so it never overflows"],
      ["white-space", "literal", "the label hugs its width"],
    ]);
  });

  it("reads line-clamp-2 in a fixed box as a fill that ends after two lines", async () => {
    const { variant, coverage } = await buildLabelled("w-[100px] line-clamp-2", { label: LABEL });
    const text = textOf(variant?.root);
    expect([text?.sizing, text?.truncation]).toEqual([FILL_WIDTH, { maxLines: 2 }]);
    expect(notesOf(coverage, "line-clamp-2")).toEqual([
      ["-webkit-box-orient", "literal", "a column around its clamped label"],
      ["-webkit-line-clamp", "literal", "the label ends in an ellipsis after 2 lines"],
      ["display", "literal", "a column around its clamped label"],
      ["overflow", "literal", "the box clips its content"],
    ]);
  });

  // A box that hugs its width grows to its `max-width` and no further, so CSS wraps and clamps the
  // label there. A Figma text in a hugging frame keeps its own width past the frame's limit (P7), so
  // the clamp and the limit stay unmapped and the gate fails, rather than reading "never overflows".
  it("leaves a clamp in a box that hugs up to a max-width unmapped", async () => {
    const detail =
      "the box hugs its width up to its max-width, where CSS wraps or cuts off the label, and a text in a hugging frame keeps its own width";
    const { variant, coverage } = await buildLabelled("w-fit max-w-[100px] line-clamp-2", { label: LABEL });
    expect(textOf(variant?.root)?.truncation).toBeUndefined();
    expect(notesOf(coverage, "line-clamp-2")).toContainEqual(["-webkit-line-clamp", "unmapped", detail]);
    expect(notesOf(coverage, "max-w-[100px]")).toContainEqual(["max-width", "unmapped", detail]);
  });

  // Tailwind emits `flex` after `line-clamp-2`, so its `display: flex` replaces the clamp's
  // `-webkit-box`, and `-webkit-line-clamp` and `-webkit-box-orient` take effect only in a
  // `-webkit-box` (CSS Overflow 4 §4.2), as Chromium leaves Select's value. The clamp sets nothing,
  // and the flex box clips its wrapping text.
  it("drops the clamp of a box whose later display replaces its -webkit-box", async () => {
    const detail = "the box's display is flex, and a line clamp takes effect only in a -webkit-box";
    const { variant, coverage } = await buildLabelled("w-[100px] line-clamp-2 flex", { label: LABEL });
    const text = textOf(variant?.root);
    expect([text?.sizing, text?.truncation]).toEqual([FILL_WIDTH, undefined]);
    expect(notesOf(coverage, "flex")).toEqual([["display", "literal", "a horizontal auto layout"]]);
    expect(notesOf(coverage, "line-clamp-2")).toEqual([
      ["-webkit-box-orient", "dropped", detail],
      ["-webkit-line-clamp", "dropped", detail],
      ["overflow", "literal", "the box clips its content"],
    ]);
  });

  // `-webkit-line-clamp` clamps lines that wrap, so `nowrap` leaves it nothing to clamp, and the
  // column it needs stays unmapped with it rather than drawing a clamp the label does not have.
  it("leaves the clamp and its column unmapped together when the text does not wrap", async () => {
    const { coverage } = await buildLabelled("w-[100px] line-clamp-2 whitespace-nowrap", { label: LABEL });
    expect(
      notesOf(coverage, "line-clamp-2")
        .filter(([property]) => property !== "overflow")
        .map(([property, outcome]) => [property, outcome])
    ).toEqual([
      ["-webkit-box-orient", "unmapped"],
      ["-webkit-line-clamp", "unmapped"],
      ["display", "unmapped"],
    ]);
  });
});

// Unit under test: `buildComponentSet` on a wrapping label in boxes that hug their width up to a
// `max-width`. Oracle: CSS Sizing 3 §5.1 and CSS 2.1 §10.4, where a box that hugs its width is as
// wide as its text, up to its `max-width` raised to its `min-width`, so its text wraps at that width
// less the box's padding and border. In a row the layers beside the text and the gaps take their
// share of that width (CSS Flexbox 1 §9.7), and a part's margins take theirs (CSS Sizing 3 §2.3).
// Probe P7: a hugging Figma text with a `maxWidth` wrapped there and kept hugging, and Figma takes
// only a positive `maxWidth`.
describe("a label under a max-width", () => {
  /** The cap a built label wraps at, as its text layer's `maxWidth`. */
  async function capOf(classes: string, fields: Parameters<typeof chip>[1]) {
    const { variant } = await buildLabelled(classes, fields);
    const text = textOf(variant?.root);
    return { sizing: text?.sizing, maxWidth: text?.maxWidth };
  }
  const HUGGING = { horizontal: HUG, vertical: HUG };
  const STOPS = "chip/state=rest: a box around label caps its width";

  it("gives a wrapping label in a box that hugs up to a max-width that width less the padding", async () => {
    const { variant, coverage } = await buildLabelled("w-fit max-w-[100px] px-[10px]", { label: LABEL });
    const text = textOf(variant?.root);
    expect([text?.sizing, text?.maxWidth]).toEqual([HUGGING, literal(80)]);
    expect(notesOf(coverage, "max-w-[100px]")).toEqual([["max-width", "literal", "100px"]]);
  });

  // CSS 2.1 §10.4: the box is lowered to its 100px maximum and then raised to its 200px minimum, so
  // the minimum wins and the text has 200px less 20px of padding.
  it("caps a label at the min-width that wins over the max-width, less the padding", async () => {
    expect(await capOf("w-fit min-w-[200px] max-w-[100px] px-[10px]", { label: LABEL })).toEqual({
      sizing: HUGGING,
      maxWidth: literal(180),
    });
  });

  it("stops the build where the padding leaves the label no width under the cap", async () => {
    await expect(buildLabelled("w-fit max-w-[16px] px-[8px]", { label: LABEL })).rejects.toThrow(
      `${STOPS} at 0px, and Figma takes only a positive max width`
    );
  });

  // The cap passes down through every box that hugs its width: each part is as wide as its text, up
  // to what the box around it leaves inside its padding.
  it("gives a label in a part the max-width of a box around it, less the padding in between", async () => {
    expect(
      await capOf("flex flex-col items-center max-w-[100px] px-[10px]", {
        parts: [{ ...dot("px-[4px]"), label: LABEL }],
      })
    ).toEqual({ sizing: HUGGING, maxWidth: literal(72) });
  });

  it("takes a fixed part and the gap beside a text part out of a capped row's width", async () => {
    expect(
      await capOf("flex max-w-[100px] gap-[4px]", {
        parts: [
          { ...dot("w-[16px] h-[16px]"), key: "mark", slot: "chip-mark" },
          { ...dot(""), key: "text", slot: "chip-text", label: LABEL },
        ],
      })
    ).toEqual({ sizing: HUGGING, maxWidth: literal(80) });
  });

  it("takes an icon and the gap beside the label out of its capped part's width", async () => {
    expect(
      await capOf("flex flex-col items-center max-w-[100px]", {
        parts: [{ ...dot("flex gap-[4px] [&_svg]:size-[16px]", [ICON]), label: LABEL }],
      })
    ).toEqual({ sizing: HUGGING, maxWidth: literal(80) });
  });

  it("takes a part's own margins out of the cap it gets", async () => {
    expect(
      await capOf("flex flex-col items-center max-w-[100px]", {
        parts: [{ ...dot("ml-[10px] mr-[10px]"), label: LABEL }],
      })
    ).toEqual({ sizing: HUGGING, maxWidth: literal(80) });
  });

  // A part that hugs what it holds takes a width the build does not read before it maps the part.
  it("stops the build where a part beside the label's part takes a share of the row it cannot read", async () => {
    const definition = chip(`${TEXT_STYLE} flex max-w-[100px] gap-[4px]`, {
      parts: [
        { ...dot("flex [&_svg]:size-[16px]", [ICON]), key: "other", slot: "chip-other" },
        { ...dot(""), key: "text", slot: "chip-text", label: LABEL },
      ],
    });
    await expect(buildFixture(definition, FONT_SANS)).rejects.toThrow(
      `${STOPS}, and the build cannot read in pixels the room the label has under it`
    );
  });

  it("stops the build where a box around a wrapping label caps it at no literal width", async () => {
    const context: FixtureContext = {
      variables: makeVariableIndex([
        { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
        { ref: { collection: "Fuse density", name: "cap" }, webSyntax: "var(--cap)" },
      ]),
    };
    const definition = chip(`${TEXT_STYLE} flex flex-col items-center max-w-(--cap)`, {
      parts: [{ ...dot(""), label: LABEL }],
    });
    await expect(buildFixture(definition, context)).rejects.toThrow(
      `${STOPS}, and the build cannot read in pixels the room the label has under it`
    );
  });
});

// Unit under test: `buildComponentSet` on parts that hold the label below a root that sets the text
// layout. Oracle: CSS Text 3, where `white-space` and `text-align` inherit, so a `truncate` on the
// root keeps a part's text on one line, while its ellipsis and clip stay on the root, and a
// `text-center` on the root centers a part's lines.
describe("a label below a root that sets its text layout", () => {
  it("keeps to one line at its own width under a root's truncate", async () => {
    const { variant, coverage } = await buildLabelled("flex w-[100px] truncate", {
      parts: [{ ...dot("w-[80px]"), label: LABEL }],
    });
    const text = textOf(variant?.root);
    expect([text?.sizing, text?.truncation]).toEqual([{ horizontal: HUG, vertical: HUG }, undefined]);
    expect(notesOf(coverage, "truncate")).toEqual([
      ["overflow", "literal", "the box clips its content"],
      ["text-overflow", "dropped", "the box holds no text of its own"],
      ["white-space", "literal", "the label hugs its width"],
    ]);
  });

  it("centers its lines under a root's text-center", async () => {
    const { variant, coverage } = await buildLabelled("text-center", {
      parts: [{ ...dot(""), label: LABEL }],
    });
    expect(textOf(variant?.root)?.align).toEqual({ horizontal: "CENTER", vertical: "TOP" });
    expect(notesOf(coverage, "text-center")).toEqual([
      ["text-align", "literal", "the label sets its lines in the center"],
    ]);
  });
});

// Unit under test: `buildComponentSet` on a label whose definition places its text in a 100 × 80
// control. Oracle: where the browser sets the line, which the definition states, as an `<input>`
// centers its value down its box and a `<textarea>` starts its text at the top of its content box.
// The label hugs its height, so the box's alignment moves the layer down, and across where the label
// hugs its width. A label that fills the width sets its lines across by its own alignment, and a
// `text-align` class still sets them, as it does in CSS.
describe("a label that a native control places", () => {
  const placed = (horizontal: TextPlacement["horizontal"], vertical: TextPlacement["vertical"]) => ({
    ...LABEL,
    placement: { horizontal, vertical },
  });
  const CONTROL = "w-[100px] h-[80px]";

  it.each([
    ["top", "MIN"],
    ["center", "CENTER"],
    ["bottom", "MAX"],
  ] as const)(
    "puts its line at the %s of the control through the box's alignment",
    async (vertical, align) => {
      const { variant } = await buildLabelled(CONTROL, { label: placed("start", vertical) });
      expect(variant?.root.counterAlign).toBe(align);
      expect(textOf(variant?.root)?.align).toEqual({ horizontal: "LEFT", vertical: "TOP" });
    }
  );

  it("places a label that hugs its one line across through the box's alignment", async () => {
    const { variant } = await buildLabelled(`${CONTROL} whitespace-nowrap`, {
      label: placed("start", "top"),
    });
    expect([variant?.root.primaryAlign, textOf(variant?.root)?.sizing.horizontal]).toEqual(["MIN", HUG]);
  });

  it("sets a filling label's lines across where it places them, unless a text-align class does", async () => {
    const centered = await buildLabelled(CONTROL, { label: placed("center", "top") });
    expect(textOf(centered.variant?.root)?.align.horizontal).toBe("CENTER");
    const right = await buildLabelled(`${CONTROL} text-right`, { label: placed("center", "top") });
    expect(textOf(right.variant?.root)?.align.horizontal).toBe("RIGHT");
  });
});

// Unit under test: `buildComponentSet` on a label whose definition says the control sets it on one
// line, as an `<input>` sets its value. Oracle: HTML's rendering of a text `<input>`, which draws its
// value on one line across its content box and clips it there, whatever the box's `display` or
// `white-space` say, since the value is no anonymous flex item or line box of the box's own. The
// owner chose an ellipsis at the end for the overflow (`DECISIONS.md` round 2), so the label fills the
// width and ends in an ellipsis after one line. The placement still puts the text at the start of
// the row, over the box's own `justify-content`.
describe("a label that a native control sets on one line", () => {
  const ONE_LINE: LabelDefinition = {
    ...LABEL,
    placement: { horizontal: "start", vertical: "center", lines: "single" },
  };

  it("fills a flex row that centers its layers and ends in an ellipsis after one line", async () => {
    const { variant, coverage } = await buildLabelled("flex w-[200px] h-[40px] justify-center", {
      label: ONE_LINE,
    });
    const text = textOf(variant?.root);
    expect([text?.sizing, text?.truncation, text?.align]).toEqual([
      FILL_WIDTH,
      { maxLines: 1 },
      { horizontal: "LEFT", vertical: "TOP" },
    ]);
    expect([variant?.root.primaryAlign, variant?.root.counterAlign]).toEqual(["MIN", "CENTER"]);
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  it("keeps to one line whatever white-space says, and drops it with the reason", async () => {
    const { variant, coverage } = await buildLabelled("w-[200px] whitespace-normal", { label: ONE_LINE });
    expect(textOf(variant?.root)?.truncation).toEqual({ maxLines: 1 });
    expect(notesOf(coverage, "whitespace-normal")).toEqual([
      ["white-space", "dropped", "the control sets its text on one line itself"],
    ]);
  });

  it("stops the build in a box that hugs its width, where the control's own width has no Figma form", async () => {
    await expect(buildLabelled("flex", { label: ONE_LINE })).rejects.toThrow(
      "chip/state=rest: the control sets its text on one line across its width, so its box needs a fixed or filling width"
    );
  });
});

// Unit under test: `buildComponentSet` on a label whose definition says the control wraps it, as a
// `<textarea>` wraps its value. Oracle: HTML's rendering of a `<textarea>`, which sets its value in
// lines across its content box from the top left and wraps them at its width, whatever the box's
// `display` says, since the value is no anonymous flex item of the box's own. So the label fills the
// width with its height following its lines and no ellipsis. A `<textarea>` honours its own
// `white-space`, so one that stops the wrap has no Figma form here.
describe("a label that a native control wraps", () => {
  const WRAPPING: LabelDefinition = {
    ...LABEL,
    placement: { horizontal: "start", vertical: "top", lines: "wrap" },
  };

  it("fills a flex row that centers its layers and wraps from the top left", async () => {
    const { variant, coverage } = await buildLabelled("flex w-[200px] h-[80px] justify-center", {
      label: WRAPPING,
    });
    const text = textOf(variant?.root);
    expect([text?.sizing, text?.truncation, text?.align]).toEqual([
      FILL_WIDTH,
      undefined,
      { horizontal: "LEFT", vertical: "TOP" },
    ]);
    expect([variant?.root.primaryAlign, variant?.root.counterAlign]).toEqual(["MIN", "MIN"]);
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });

  it("reads whitespace-normal as the wrap, and leaves a nowrap that stops it unmapped", async () => {
    const normal = await buildLabelled("w-[200px] whitespace-normal", { label: WRAPPING });
    expect(notesOf(normal.coverage, "whitespace-normal")).toEqual([
      ["white-space", "literal", "the label wraps at the box's width"],
    ]);
    const nowrap = await buildLabelled("w-[200px] whitespace-nowrap", { label: WRAPPING });
    expect(notesOf(nowrap.coverage, "whitespace-nowrap")).toEqual([
      ["white-space", "unmapped", "no Figma field reads nowrap"],
    ]);
  });

  it("stops the build in a box that hugs its width, where the control's own width has no Figma form", async () => {
    await expect(buildLabelled("flex", { label: WRAPPING })).rejects.toThrow(
      "chip/state=rest: the control wraps its text at its width, so its box needs a fixed or filling width"
    );
  });
});

// Unit under test: `buildComponentSet` on labels and the TEXT properties the set lists. Oracle: the
// Figma property model, where one TEXT property holds one default for every layer it sets, so two
// labels that name it must start with the same text, and a label whose text differs per cell sets
// none and writes its characters in each variant.
describe("a set's text properties", () => {
  const part = (key: string, label: LabelDefinition): PartDefinition => ({
    ...dot(""),
    key,
    slot: `chip-${key}`,
    label,
  });

  it("lists one property per name, in order, for labels on several parts", async () => {
    const { componentSet } = await buildLabelled("flex", {
      parts: [
        part("title", { ...LABEL, textProperty: "Title", characters: "Storage" }),
        part("hint", { ...LABEL, textProperty: "Hint", characters: "Used" }),
        part("caption", { ...LABEL, textProperty: "Title", characters: "Storage" }),
      ],
    });
    expect(componentSet.textProperties).toEqual([
      { name: "Title", defaultValue: "Storage" },
      { name: "Hint", defaultValue: "Used" },
    ]);
  });

  it("stops the build when two labels give one property two defaults, naming both", async () => {
    await expect(
      buildLabelled("flex", {
        parts: [
          part("title", { ...LABEL, characters: "Storage" }),
          part("hint", { ...LABEL, characters: "Used" }),
        ],
      })
    ).rejects.toThrow(
      'Chip: the labels chip-title / label and chip-hint / label both set the Label property, one starting as "Storage" and one as "Used".'
    );
  });

  it("writes a label's own characters in each cell, with no property", async () => {
    const { componentSet } = await buildLabelled("flex", {
      axes: [{ name: "level", values: ["50", "85"] }],
      columnAxis: "level",
      label: {
        key: "value",
        name: "value",
        charactersFor: (cell) => `${cell.level ?? ""}%`,
        shownIn: () => true,
      },
    });
    expect(componentSet.textProperties).toEqual([]);
    expect(
      componentSet.variants.map((variant) => {
        const text = textOf(variant.root);
        return [text?.characters, text?.textProperty];
      })
    ).toEqual([
      ["50%", undefined],
      ["85%", undefined],
    ]);
  });
});

// Unit under test: `buildComponentSet` on a root that inherits declarations from an ancestor in some
// cells, as an `<input>` inside an invalid Field root inherits the root's `data-invalid:text-error`.
// Oracle: CSS inheritance. An element inherits its parent's computed value, so the ancestor resolves
// its own `var()` before the value reaches the root, and the root's `currentcolor` is the color it
// inherits. Of two ancestors the nearer one passes its value down, so the ancestor's color beats the
// page's, and an element's own declaration beats every inherited value.
describe("a declaration an ancestor passes down in some cells", () => {
  const RED: readonly OuterDeclaration[] = [
    { className: "field data-invalid:text-[red]", property: "color", value: "rgb(255 0 0)" },
  ];
  const build = (
    classes: string,
    ancestors: readonly OuterDeclaration[],
    states: readonly string[] = ["rest", "invalid"]
  ) =>
    buildFixture(
      chip(`font-sans text-[14px] leading-[20px] ${classes}`, {
        axes: [{ name: "state", values: states }],
        label: LABEL,
        inheritedFor: (cell) => (cell.state === "invalid" ? ancestors : []),
      }),
      {
        ...FONT_SANS,
        page: [{ className: "body text-[black]", property: "color", value: "rgb(0 0 0)" }],
      }
    );
  const colors = (built: Awaited<ReturnType<typeof build>>) =>
    built.componentSet.variants.map((variant) => textOf(variant.root)?.color);
  const rgb = (r: number, g: number, b: number) => ({ kind: "literal", color: { r, g, b, a: 1 } });

  it("colors the text in the cells that name it, over the page's color", async () => {
    const built = await build("", RED);
    expect(colors(built)).toEqual([rgb(0, 0, 0), rgb(1, 0, 0)]);
    expect(notesOf(built.coverage, "field data-invalid:text-[red]")).toEqual([
      ["color", "literal", "rgba(255, 0, 0, 1)"],
    ]);
  });

  it("loses to a color class of the root's own, which leaves the ancestor's color unread", async () => {
    const built = await build("text-[#0000ff]", RED);
    expect(colors(built)).toEqual([rgb(0, 0, 1), rgb(0, 0, 1)]);
    expect(notesOf(built.coverage, "field data-invalid:text-[red]")).toEqual([
      ["color", "dropped", "the root sets its own, so it does not inherit this"],
    ]);
  });

  it("passes the color the ancestor computes from its own custom property, whatever the root sets", async () => {
    const tone: readonly OuterDeclaration[] = [
      { className: "field [--tone:red]", property: "--tone", value: "rgb(255 0 0)" },
      { className: "field text-(--tone)", property: "color", value: "var(--tone)" },
    ];
    expect(colors(await build("[--tone:#0000ff]", tone))).toEqual([rgb(0, 0, 0), rgb(1, 0, 0)]);
  });

  it("gives the root's currentcolor the color it inherits", async () => {
    expect(colors(await build("text-current", RED, ["invalid"]))).toEqual([rgb(1, 0, 0)]);
  });

  // An icon takes the text color and no type. A root that shows no text therefore draws nothing of
  // the type that the page and an ancestor pass down, as a breadcrumb separator's chevron draws
  // nothing of its list's 14px type.
  it("drops the type it passes to a root that shows no text, and colors the root's icon", async () => {
    const list: readonly OuterDeclaration[] = [
      { className: "list text-[12px]", property: "font-size", value: "12px" },
      ...RED,
    ];
    const built = await buildFixture(
      chip("[&_svg]:size-[16px]", { iconsFor: () => [ICON], inheritedFor: () => list }),
      {
        ...FONT_SANS,
        page: [{ className: "body font-sans", property: "font-family", value: "var(--font-sans)" }],
      }
    );
    const [icon] = built.variant?.root.children ?? [];
    expect(icon?.kind === "icon" ? icon.color : undefined).toEqual(rgb(1, 0, 0));
    expect(notesOf(built.coverage, "list text-[12px]")).toEqual([
      ["font-size", "dropped", "the cell shows no text"],
    ]);
    expect(notesOf(built.coverage, "body font-sans")).toEqual([
      ["font-family", "dropped", "the cell shows no text"],
    ]);
  });
});

// Unit under test: `buildComponentSet` on a root inside elements the definition names by their recipe
// classes, as a breadcrumb link sits in its list and item. Oracle: CSS inheritance and the cascade.
// Each element cascades its own classes, so a variant holds where the cell's state says, as a
// Field root's `data-invalid:` holds while the cell is invalid. Each element inherits its parent's
// computed values, and its own declaration beats what it inherits whatever the specificity of the
// rule a farther element took it from. The root inherits only the inherited properties, so the
// elements' flex rows and gaps reach no drawn layer.
describe("an ancestor named by its recipe classes", () => {
  const LAYOUT = "the list lays out its items, which the set does not draw";
  const list = (classes: string): AncestorDefinition => ({ slot: "list", classes, undrawn: LAYOUT });
  const item = (classes: string): AncestorDefinition => ({
    slot: "item",
    classes,
    undrawn: "the item lays out its entry, which the set does not draw",
  });
  const build = (ancestors: readonly AncestorDefinition[]) =>
    buildFixture(
      chip("font-sans", {
        axes: [{ name: "state", values: ["rest", "invalid"] }],
        label: LABEL,
        ancestorsFor: () => ancestors,
      }),
      FONT_SANS
    );
  const rgb = (r: number, g: number, b: number) => ({ kind: "literal", color: { r, g, b, a: 1 } });
  const texts = (built: Awaited<ReturnType<typeof build>>) =>
    built.componentSet.variants.map((variant) => {
      const text = textOf(variant.root);
      return [text?.fontSize, text?.lineHeight, text?.color];
    });
  const LIST = "text-[12px] leading-[16px] text-[#00ff00] data-invalid:text-[#ff0000] flex gap-[8px]";

  it("gives the root's label the type and color its classes compute, a variant where the cell holds it", async () => {
    expect(texts(await build([list(LIST)]))).toEqual([
      [literal(12), literal(16), rgb(0, 1, 0)],
      [literal(12), literal(16), rgb(1, 0, 0)],
    ]);
  });

  it("drops its own declarations that do not inherit, under its slot, with its reason", async () => {
    const { coverage } = await build([list(LIST)]);
    const rows = (className: string) =>
      coverage
        .filter((row) => row.className === className)
        .map((row) => [row.part, row.property, row.outcome, row.detail]);
    expect(rows("flex")).toEqual([["list", "display", "dropped", LAYOUT]]);
    expect(rows("gap-[8px]")).toEqual([["list", "gap", "dropped", LAYOUT]]);
    expect(rows("text-[12px]")).toEqual([["list", "font-size", "literal", "12px"]]);
  });

  it("lets a nearer ancestor's own color beat the one it inherits, whatever the rule's specificity", async () => {
    const built = await build([list(LIST), item("text-[#0000ff]")]);
    expect(texts(built).map(([, , color]) => color)).toEqual([rgb(0, 0, 1), rgb(0, 0, 1)]);
    expect(notesOf(built.coverage, "data-invalid:text-[#ff0000]")).toEqual([
      ["color", "dropped", "the item around the root sets its own, so the root does not inherit this"],
    ]);
  });
});

// Unit under test: `buildComponentSet` on a label whose markup holds a space before it, after an
// icon, as Meter's value does. Oracle: CSS Text 3 §4.1, where a block box sets an inline icon, a
// space and text on one line, the space one advance of the text's font wide, and Roboto Regular's
// space, 508 of 2048 units per em in `@fontsource/roboto` 5.3.0, 3.47265625px at 14px. A space that
// starts a line collapses. A flex box sets its text as an anonymous item, which the space starts.
describe("a label after a space the markup holds", () => {
  const VALUE: LabelDefinition = {
    key: "value",
    name: "value",
    characters: "85%",
    textProperty: undefined,
    shownIn: () => true,
    leadingSpace: true,
  };

  async function gapOf(classes: string, icons: readonly IconSlot[]) {
    const { variant } = await buildLabelled(`${classes} [&_svg]:size-[16px]`, {
      label: VALUE,
      iconsFor: () => icons,
    });
    return variant?.root.itemSpacing;
  }

  it.each([
    ["sits one Roboto space after an icon in a block box", "", [ICON], literal(3.47265625)],
    [
      "takes the box's own gap in a flex box, where it starts the text's item",
      "flex gap-[2px]",
      [ICON],
      literal(2),
    ],
    ["draws no gap with no icon before it, where it starts the line", "", [], literal(0)],
  ])("%s", async (_case, classes, icons, gap) => {
    expect(await gapOf(classes, icons)).toEqual(gap);
  });
});

// Unit under test: `buildComponentSet` on parts behind a BOOLEAN property. Oracle: the Figma property
// model, where one BOOLEAN property holds one default and shows or hides every layer that links its
// `visible`, and CSS, where a parent's `:has()` restyles the parent once the part is gone, which
// hiding a layer cannot do. Tailwind compiles `has-[>[data-slot=x]]:` to `:has( > [data-slot=x])`.
describe("an optional part", () => {
  const DETAIL: BooleanPropertySpec = { name: "Detail", defaultValue: true };
  /** A 4px part, its `data-slot` `chip-` and its key unless the case names another. */
  const part = (key: string, slot = `chip-${key}`): ReturnType<typeof dot> => ({
    ...dot("size-[4px]"),
    key,
    slot,
  });
  const hidden = (key: string, optional: BooleanPropertySpec, slot?: string): PartDefinition => ({
    ...part(key, slot),
    optional,
  });
  const READS_DETAIL = "has-[>[data-slot=chip-detail]]";
  const READS_TITLE = "has-[>[data-slot=chip-title]]";

  it("links its frame's visibility to the property, which the set lists once", async () => {
    const { componentSet, variant } = await buildFixture(
      chip("flex", { parts: [part("title"), hidden("detail", DETAIL), hidden("hint", DETAIL)] })
    );
    expect(componentSet.booleanProperties).toEqual([DETAIL]);
    expect(
      variant?.root.children.map((layer) => [
        layer.name,
        layer.kind === "frame" ? layer.visibleProperty : layer,
      ])
    ).toEqual([
      ["chip-title", undefined],
      ["chip-detail", "Detail"],
      ["chip-hint", "Detail"],
    ]);
  });

  it("leaves the properties out of a set with no optional part, as a set built before them", async () => {
    const { componentSet } = await buildFixture(chip("flex", { parts: [part("title")] }));
    expect(componentSet.booleanProperties).toBeUndefined();
  });

  it("stops the build when two parts give one property two defaults, naming both", async () => {
    await expect(
      buildFixture(
        chip("flex", {
          parts: [hidden("detail", DETAIL), hidden("hint", { ...DETAIL, defaultValue: false })],
        })
      )
    ).rejects.toThrow(
      "Chip: the parts chip-detail and chip-hint both hide behind the Detail property, one starting true and one false."
    );
  });

  it("stops the build when a selector of its parent reads whether it is there, naming the selector", async () => {
    await expect(
      buildFixture(
        chip(`flex ${READS_DETAIL}:gap-[2px]`, {
          facts: new Map([[READS_DETAIL, () => true]]),
          parts: [hidden("detail", DETAIL)],
        })
      )
    ).rejects.toThrow(
      `Chip: chip-detail cannot hide behind the Detail property, since \`${READS_DETAIL}:gap-[2px]\` reads whether it is there through \`:has( > [data-slot=chip-detail])\`.`
    );
  });

  // Tailwind compiles this class to `:has( > [data-label=")"] [data-slot=chip-detail])`.
  it("reads past a parenthesis a quoted value holds inside the :has()", async () => {
    const reads = 'has-[>[data-label=")"]_[data-slot=chip-detail]]';
    await expect(
      buildFixture(
        chip(`flex ${reads}:gap-[2px]`, {
          facts: new Map([[reads, () => true]]),
          parts: [hidden("detail", DETAIL)],
        })
      )
    ).rejects.toThrow(
      `Chip: chip-detail cannot hide behind the Detail property, since \`${reads}:gap-[2px]\` reads whether it is there through \`:has( > [data-label=")"] [data-slot=chip-detail])\`.`
    );
  });

  // Tailwind compiles fuse.css's `item-described:` to `:where(:has( > [data-slot="item-content"] >
  // [data-slot="item-description"])) > .x`, a selector that does not start with the class.
  it("stops the build on Item's item-described: arm over an optional description", async () => {
    const media = { ...part("media", "item-media"), classesFor: () => "item-described:self-start" };
    const content = {
      ...part("content", "item-content"),
      parts: [hidden("description", { ...DETAIL, name: "Description" }, "item-description")],
    };
    await expect(
      buildFixture(
        chip("flex", { facts: new Map([["item-described", () => true]]), parts: [media, content] })
      )
    ).rejects.toThrow(
      'Chip: item-description cannot hide behind the Description property, since `item-described:self-start` reads whether it is there through `:has( > [data-slot="item-content"] > [data-slot="item-description"])`.'
    );
  });

  // Tailwind compiles this class to `:has(:is([data-slot^=chip]))`, which needs some part whose slot
  // starts with `chip` and may need the optional one.
  it("stops the build where it cannot tell which parts a class reads", async () => {
    const reads = "has-[[data-slot^=chip]]";
    await expect(
      buildFixture(
        chip(`flex ${reads}:gap-[2px]`, {
          facts: new Map([[reads, () => true]]),
          parts: [hidden("detail", DETAIL)],
        })
      )
    ).rejects.toThrow(
      `Chip: chip-detail cannot hide behind the Detail property, since the build cannot tell which parts \`${reads}:gap-[2px]\` reads:`
    );
  });

  // Tailwind compiles this class to `:has(:is([data-slot=description]))`. Hiding the content frame
  // hides the description inside it.
  it("stops the build when a selector reads whether a part inside it is there", async () => {
    const reads = "has-[[data-slot=description]]";
    const content: PartDefinition = {
      ...dot("flex"),
      key: "content",
      slot: undefined,
      optional: DETAIL,
      parts: [part("description", "description")],
    };
    await expect(
      buildFixture(
        chip(`flex ${reads}:gap-[2px]`, { facts: new Map([[reads, () => true]]), parts: [content] })
      )
    ).rejects.toThrow(
      `Chip: content cannot hide behind the Detail property, since \`${reads}:gap-[2px]\` reads whether description, which content holds, is there through \`:has(:is([data-slot=description]))\`.`
    );
  });

  it("builds where a selector reads whether another part is there", async () => {
    const { componentSet } = await buildFixture(
      chip(`flex ${READS_TITLE}:gap-[2px]`, {
        facts: new Map([[READS_TITLE, () => true]]),
        parts: [part("title"), hidden("detail", DETAIL)],
      })
    );
    expect(componentSet.booleanProperties).toEqual([DETAIL]);
  });
});

// Unit under test: `buildComponentSet` on icons and parts that `rotate-*` turns. Oracle: Tailwind's
// compile, `rotate: 180deg` for `rotate-180` and `rotate: calc(90deg * -1)` for `-rotate-90`, CSS,
// which turns a box clockwise about its center and leaves its layout as it was, and the typings,
// under which Figma counts `rotation` counterclockwise.
describe("a turned icon or part", () => {
  const rotateRows = (coverage: readonly CoverageRow[]) =>
    coverage.filter((row) => row.property === "rotate").map((row) => [row.part, row.outcome]);

  it.each([
    ["half a turn as 180", "rotate-180", 180],
    ["a clockwise quarter turn as -90", "rotate-90", -90],
    ["a counterclockwise quarter turn as 90", "-rotate-90", 90],
    ["no turn as none", "rotate-none", undefined],
  ])("turns an icon its own class turns, %s", async (_case, turn, rotation) => {
    const { variant, coverage } = await buildFixture(
      chip("text-[#000000]", { iconsFor: () => [{ ...ICON, classes: `size-4 ${turn}` }] })
    );
    const [icon] = variant?.root.children ?? [];
    expect(icon?.kind === "icon" ? icon.rotation : icon).toBe(rotation);
    expect(rotateRows(coverage)).toEqual([["Icon", "literal"]]);
  });

  it("turns a part", async () => {
    const { variant } = await buildFixture(chip("inline-flex", { parts: [dot("size-[4px] rotate-180")] }));
    expect(frameOf(variant?.root)?.rotation).toBe(180);
  });

  it("leaves a turn of the root unmapped, since a variant sits in its set outside any auto layout", async () => {
    const { coverage } = await buildFixture(chip("inline-flex rotate-180"));
    expect(rotateRows(coverage)).toEqual([["chip", "unmapped"]]);
  });

  it("leaves a turn in another unit unmapped", async () => {
    const { variant, coverage } = await buildFixture(
      chip("text-[#000000]", { iconsFor: () => [{ ...ICON, classes: "size-4 rotate-[0.5turn]" }] })
    );
    const [icon] = variant?.root.children ?? [];
    expect(icon?.kind === "icon" ? icon.rotation : icon).toBeUndefined();
    expect(rotateRows(coverage)).toEqual([["Icon", "unmapped"]]);
  });
});
