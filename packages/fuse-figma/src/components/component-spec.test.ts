/**
 * How the spec builder records a class whose variant the matrix does not model. The unit under
 * test is `buildComponentSet`, with a one-cell definition and Tailwind's compiled utilities.
 * The oracle is the definition: a variant it omits is dropped, and any other variant no cell
 * models is unmapped, which the coverage gate refuses. That includes `focus-visible`, since the
 * definition's state axis has no focus value.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { buildComponentSet, definitionClasses } from "./component-spec";
import type { BuildContext, ComponentDefinition, IconSlot, PartDefinition } from "./component-spec";
import { makeVariableIndex } from "./css-values";
import type { BoxSpec, FrameLayerSpec } from "./kit-spec";
import { compileUtilities } from "./utility-css";

const CHIP: ComponentDefinition = {
  key: "chip",
  name: "Chip",
  slot: "chip",
  axes: [{ name: "state", values: ["rest"] }],
  columnAxis: "state",
  classesFor: () => "in-data-[slot=group]:bg-muted data-pressed:bg-muted focus-visible:bg-muted",
  states: {},
  facts: new Map(),
  omittedStates: new Set(["in-data-[slot=group]"]),
  label: undefined,
  iconsFor: () => [],
  swapProperties: [],
};

let context: BuildContext;

beforeAll(async () => {
  context = {
    compiled: await compileUtilities(["bg-muted"]),
    variables: makeVariableIndex([]),
    page: [],
    base: [],
  };
});

function outcomes(className: string): ReadonlySet<string> {
  const { coverage } = buildComponentSet(CHIP, context);
  return new Set(coverage.filter((row) => row.className === className).map((row) => row.outcome));
}

describe("a class whose variant no cell models", () => {
  it("is dropped when the definition omits the state", () => {
    expect(outcomes("in-data-[slot=group]:bg-muted")).toEqual(new Set(["dropped"]));
  });

  it("is unmapped when the definition does not know the state", () => {
    expect(outcomes("data-pressed:bg-muted")).toEqual(new Set(["unmapped"]));
  });

  it("is unmapped when the state axis lacks the value that renders a shared state", () => {
    expect(outcomes("focus-visible:bg-muted")).toEqual(new Set(["unmapped"]));
  });

  // Oracle: a `state` axis holds one value per cell, so `aria-invalid:` (state=invalid) and
  // `focus-visible:` (state=focus) never hold in the same cell, and the class would otherwise
  // leave no row in the coverage table.
  it("is dropped, naming its variants, when they never hold in one cell together", () => {
    const { coverage } = buildComponentSet(
      {
        ...CHIP,
        axes: [{ name: "state", values: ["rest", "focus", "invalid"] }],
        classesFor: () => "aria-invalid:focus-visible:bg-muted",
      },
      context
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
    const bordered: ComponentDefinition = { ...CHIP, classesFor: () => "border" };
    const { componentSet, coverage } = buildComponentSet(bordered, {
      ...context,
      compiled: await compileUtilities(["border"]),
    });
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
  const variables = makeVariableIndex(
    ["border", "error"].map((name) => ({
      ref: { collection: "Fuse tokens", name },
      webSyntax: `var(--${name})`,
    }))
  );
  const base = [
    { className: "fuse.css base layer", property: "border-color", value: "var(--border, currentcolor)" },
  ];

  async function build(classes: string) {
    return buildComponentSet(
      { ...CHIP, classesFor: () => classes },
      {
        ...context,
        compiled: await compileUtilities(classes.split(" ")),
        variables,
        base,
      }
    );
  }

  it("colors a border no class colors with the border role", async () => {
    const { componentSet, coverage } = await build("border");
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
    const strokeOf = async (classes: string) => (await build(classes)).componentSet.variants[0]?.root.stroke;
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

// Unit under test: `buildComponentSet` on a root with a transparent background and a ring.
// Oracle: CSS, where `background-color: transparent` paints nothing, as an unset background
// does, so the root gets no fill.
describe("a transparent background", () => {
  const RING: ComponentDefinition = { ...CHIP, classesFor: () => "bg-transparent ring-2 ring-[rgb(0_0_0)]" };

  it("gives the root no fill, whatever shadow it casts", async () => {
    const ringContext = {
      ...context,
      compiled: await compileUtilities(["bg-transparent", "ring-2", "ring-[rgb(0_0_0)]"]),
    };
    const { componentSet, coverage } = buildComponentSet(RING, ringContext);
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
    const { componentSet } = buildComponentSet(
      {
        ...CHIP,
        axes: [{ name: "state", values: ["invalid"] }],
        classesFor: () => classes.join(" "),
        facts: new Map([["data-checked", () => true]]),
      },
      { ...context, compiled: await compileUtilities(classes) }
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
    const { coverage } = buildComponentSet(
      { ...CHIP, classesFor: () => "tabular-nums" },
      { ...context, compiled: await compileUtilities(["tabular-nums"]) }
    );
    expect(
      coverage.filter((row) => row.property === "font-variant-numeric").map((row) => row.outcome)
    ).toEqual(["dropped"]);
  });
});

const zero = { kind: "literal", value: 0 } as const;

// Unit under test: `buildComponentSet` on a root whose width is a percentage. Oracle: CSS, where a
// percentage width is a share of the containing block, which a Figma number field cannot hold, so
// the declaration fails the gate instead of passing as a fixed width.
describe("a percentage width", () => {
  it.each(["w-full", "w-[calc(100%-4px)]"])("leaves %s unmapped", async (className) => {
    const { componentSet, coverage } = buildComponentSet(
      { ...CHIP, classesFor: () => className },
      { ...context, compiled: await compileUtilities([className]) }
    );
    expect(componentSet.variants[0]?.root.width).toBeUndefined();
    expect(coverage).toEqual([
      expect.objectContaining({ className, property: "width", outcome: "unmapped" }),
    ]);
  });
});

/** The one icon of the fixtures below, which sits inside the chip's dot. */
const ICON: IconSlot = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "Plus",
  swapProperty: undefined,
};

/** A part below the chip's root, the `chip-dot`, with the given classes and icons. */
function dot(classes: string, icons: readonly IconSlot[] = []): PartDefinition {
  return {
    key: "dot",
    slot: "chip-dot",
    shownIn: () => true,
    classesFor: () => classes,
    label: undefined,
    iconsFor: () => icons,
  };
}

/**
 * Build a chip whose root carries `rootClasses` and holds `part`, compiling every class the two
 * use and `registered`, classes that make Tailwind register the custom properties they set.
 */
async function buildNested(rootClasses: string, part: PartDefinition, registered: readonly string[] = []) {
  const definition: ComponentDefinition = { ...CHIP, classesFor: () => rootClasses, parts: [part] };
  const built = buildComponentSet(definition, {
    ...context,
    compiled: await compileUtilities([...definitionClasses(definition), ...registered]),
  });
  return { ...built, variant: built.componentSet.variants[0] };
}

function frameOf(box: BoxSpec | undefined): FrameLayerSpec | undefined {
  const [first] = box?.children ?? [];
  return first?.kind === "frame" ? first : undefined;
}

// Unit under test: the cascade `buildComponentSet` runs for a part below the root. Oracle: CSS
// inheritance. `color` and an unregistered custom property inherit their parent's computed value,
// and a custom property Tailwind registers with `@property … { inherits: false }`, as it does
// `--tw-ring-offset-width` for `ring-2`, takes its initial value `0px` on every child.
describe("a part below the root", () => {
  it("reads its parent's text color", async () => {
    const { variant } = await buildNested("text-[#ff0000]", dot("[&_svg]:size-[16px]", [ICON]));
    expect(frameOf(variant?.root)?.children).toEqual([
      expect.objectContaining({
        kind: "icon",
        color: { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } },
      }),
    ]);
  });

  it("reads a custom property its parent sets, which the parent's class reaches Figma through", async () => {
    const { variant, coverage } = await buildNested(
      "[--chip-corner:6px]",
      dot("rounded-[var(--chip-corner)]")
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
    const { variant } = await buildNested(
      "text-[#000000] [&_svg]:size-[16px] [&>svg:not([data-icon=inline-end])]:size-[24px]",
      dot("", [ICON])
    );
    expect(frameOf(variant?.root)?.children).toEqual([
      expect.objectContaining({ kind: "icon", size: { kind: "literal", value: 16 } }),
    ]);
  });

  // Oracle: the coverage contract, one row per distinct outcome of each declaration of each part.
  it("records one class on the root and on the part as two rows, one per part", async () => {
    const { coverage } = await buildNested("bg-[#000000]", dot("bg-[#000000]"));
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
    const { variant, coverage } = await buildNested("[--chip-corner:6px]", {
      ...dot(""),
      parts: [{ ...dot("rounded-[var(--chip-corner)]"), key: "ring", slot: "chip-ring" }],
    });
    expect(frameOf(frameOf(variant?.root))?.cornerRadius).toEqual({ kind: "literal", value: 6 });
    expect(coverage.filter((row) => row.className === "[--chip-corner:6px]")).toEqual([
      expect.objectContaining({ part: "chip", property: "--chip-corner", outcome: "literal" }),
    ]);
  });

  // Oracle: CSS inheritance, under which the `<svg>` inherits the custom property its part sets.
  it("gives an icon the custom property its part sets", async () => {
    const { variant, coverage } = await buildNested(
      "text-[#000000]",
      dot("[--icon-size:16px] [&_svg]:size-[var(--icon-size)]", [ICON])
    );
    expect(frameOf(variant?.root)?.children).toEqual([
      expect.objectContaining({ kind: "icon", size: { kind: "literal", value: 16 } }),
    ]);
    expect(coverage.filter((row) => row.className === "[--icon-size:16px]")).toEqual([
      expect.objectContaining({ part: "chip-dot", property: "--icon-size", outcome: "literal" }),
    ]);
  });

  it("does not inherit a custom property registered with inherits: false", async () => {
    const { variant } = await buildNested(
      "[--tw-ring-offset-width:4px]",
      dot("rounded-[var(--tw-ring-offset-width)]"),
      ["ring-2"]
    );
    expect(frameOf(variant?.root)?.cornerRadius).toEqual(zero);
  });
});

// Unit under test: `buildComponentSet` on a root that holds a part, which holds an icon, in the
// cells the part's `shownIn` names. Oracle: CSS flexbox. `items-start` packs the children at the
// start of the cross axis and `justify-end` at the end of the row, which Figma calls MIN and MAX,
// and `items-center justify-center` centers them on both. The icon takes the root's white text
// color and the dot's 12px `[&_svg]` size.
describe("a root that holds a part", () => {
  const definition: ComponentDefinition = {
    ...CHIP,
    axes: [{ name: "checked", values: ["off", "on"] }],
    columnAxis: "checked",
    classesFor: () => "inline-flex items-start justify-end text-[#ffffff]",
    parts: [
      {
        ...dot("flex items-center justify-center size-[16px] bg-[#000000] [&_svg]:size-[12px]", [ICON]),
        shownIn: (cell) => cell.checked === "on",
      },
    ],
  };

  /** Build the chip, with its root's classes replaced by `rootClasses` when given. */
  async function build(rootClasses?: string) {
    const built: ComponentDefinition =
      rootClasses === undefined ? definition : { ...definition, classesFor: () => rootClasses };
    return buildComponentSet(built, {
      ...context,
      compiled: await compileUtilities(definitionClasses(built)),
    });
  }

  it("builds the part as a frame inside the root, in the cells that render it", async () => {
    const { componentSet } = await build();
    const box = { paddingTop: zero, paddingRight: zero, paddingBottom: zero, paddingLeft: zero };
    const [off, on] = componentSet.variants;
    expect(on?.root).toEqual({
      name: "chip",
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
          width: { kind: "literal", value: 16 },
          height: { kind: "literal", value: 16 },
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

  it("leaves an alignment other than start, center or end unmapped", async () => {
    const { coverage } = await build("inline-flex justify-between items-baseline text-[#ffffff]");
    expect(
      coverage.filter((row) => row.outcome === "unmapped").map((row) => [row.part, row.property])
    ).toEqual([
      ["chip", "align-items"],
      ["chip", "justify-content"],
    ]);
  });
});
