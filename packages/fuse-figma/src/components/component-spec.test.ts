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

  // Oracle: CSS Color 4, where `color: currentcolor` computes to the color the element inherits,
  // so `text-current` keeps the parent's red, and its row names what it resolved to.
  it("reads color: currentcolor as the color it inherits", async () => {
    const { variant, coverage } = await buildNested(
      "text-[#ff0000]",
      dot("text-current [&_svg]:size-[16px]", [ICON])
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

// Unit under test: `buildComponentSet` on a part with `grid place-content-center`. Oracle: CSS Grid,
// where a grid with no template puts each child in a row of its own, and `place-content: center`
// centers the rows on both axes. With one child that is a box centered both ways, as an auto
// layout with CENTER on both axes draws it. Two children stack in two rows, which a horizontal
// auto layout does not draw.
describe("a grid that centers its content", () => {
  async function build(icons: readonly IconSlot[]) {
    const { variant, coverage } = await buildNested(
      "text-[#000000]",
      dot("grid place-content-center size-[16px] [&_svg]:size-[12px]", icons)
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

// Unit under test: `buildComponentSet` on a root's `position` and `max-width`. Oracle: CSS. A
// `relative` box stays where the flow puts it and only becomes the containing block of its
// positioned descendants, which an auto layout has none of. CSS Sizing clamps a width by its
// `max-width` only when the width is larger, so a fixed 16px width under a max of 16px or more
// keeps its size, and under 12px shrinks, which the fixed Figma width does not draw.
describe("a box's position and max width", () => {
  async function rowsOf(classes: string) {
    const { coverage } = buildComponentSet(
      { ...CHIP, classesFor: () => classes },
      { ...context, compiled: await compileUtilities(classes.split(" ")) }
    );
    return coverage
      .filter((row) => row.property === "position" || row.property === "max-width")
      .map((row) => [row.className, row.outcome, row.detail]);
  }

  it("drops relative, which anchors no layer in auto layout", async () => {
    expect(await rowsOf("relative")).toEqual([
      ["relative", "dropped", "it only anchors positioned descendants, which auto layout does not need"],
    ]);
  });

  it("leaves absolute unmapped", async () => {
    expect(await rowsOf("absolute")).toEqual([["absolute", "unmapped", expect.any(String)]]);
  });

  it.each(["max-w-[16px]", "max-w-[24px]"])("drops %s at or above a 16px fixed width", async (max) => {
    expect(await rowsOf(`size-[16px] ${max}`)).toEqual([
      [max, "dropped", "it is no less than the fixed width, so it never narrows the box"],
    ]);
  });

  it.each(["size-[16px] max-w-[12px]", "max-w-[16px]"])(
    "leaves the max width of %s unmapped",
    async (classes) => {
      expect(await rowsOf(classes)).toEqual([
        [expect.stringMatching(/^max-w-/), "unmapped", expect.any(String)],
      ]);
    }
  );
});

// Unit under test: `buildComponentSet` on a root whose `after:` classes draw a hit area. Oracle:
// CSS, where `after:` styles the `::after` pseudo-element, a box of its own that the kit draws no
// layer for, so its declarations reach no Figma field. The definition that omits the pseudo-element
// names why, and one that does not leaves the classes to fail the gate.
describe("a class on a pseudo-element", () => {
  const HIT_AREA = ["after:absolute", "after:-inset-x-3", "after:content-['']"];

  async function build(omitted: ReadonlyMap<string, string>) {
    const { coverage } = buildComponentSet(
      { ...CHIP, classesFor: () => HIT_AREA.join(" "), omittedPseudoElements: omitted },
      { ...context, compiled: await compileUtilities(HIT_AREA) }
    );
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

// Unit under test: `buildComponentSet` on a root with Tailwind's marker classes. Oracle: Tailwind
// emits no CSS for `group`, `group/<name>`, `peer` or `peer/<name>`. Each only names an element
// that a descendant's `group-*` or a sibling's `peer-*` variant reads, so it has nothing to draw.
describe("a marker class", () => {
  it.each(["group", "group/chip", "peer", "peer/chip"])(
    "drops %s as a marker with no CSS",
    async (className) => {
      const { coverage } = buildComponentSet(
        { ...CHIP, classesFor: () => className },
        { ...context, compiled: await compileUtilities([className]) }
      );
      expect(coverage).toEqual([
        expect.objectContaining({ className, outcome: "dropped", detail: "a marker class with no CSS" }),
      ]);
    }
  );
});
