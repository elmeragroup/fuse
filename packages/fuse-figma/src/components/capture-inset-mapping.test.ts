/**
 * How the build places an absolute part by its distances to its parent's edges, draws a painting
 * `::before` as a layer of its own, and keeps a block's margin beside a margin of zero. The unit under
 * test is `buildSetsInOrder` on hand-built captures of one-cell `chip` sets (`test/capture-fixtures.ts`).
 * Oracles: CSS 2.1 §10.3.7 and §10.6.4, under which an absolute box's offsets measure from its
 * containing block's padding edge, the box spans the room between two offsets at an `auto` length,
 * and a `100%` length is the containing block's padding box; Figma's constraints, where MIN keeps a
 * layer's distance to its parent's start, MAX to its end and STRETCH to both; CSS 2.1 §8.3.1, under
 * which two adjoining margins collapse to the larger; and the coverage contract, under which a part
 * the build cannot place, and a pseudo-element the capture did not measure, keep their rows unmapped.
 * A static parent the capture measured as spanning the part's containing block (`parentSpansBlock`)
 * has its outer edge on that block's padding edge, so each distance is the offset alone; a border on
 * the parent, or a wrapper the kit does not draw between the two, breaks that. An absolute icon with
 * both vertical offsets `auto` in a flex row that centres its items sits at its static position,
 * centred in the row's content box (CSS Flexbox 1 §4.1), which CENTER keeps, and a half turn about
 * its centre leaves its square box where CSS put it (CSS Transforms 2 §6).
 */
import { describe, expect, it } from "vitest";

import {
  buildCaptured,
  chip,
  fixed,
  frameOf,
  ICON,
  literal,
  notesOf,
  part,
  rest,
} from "../../test/capture-fixtures";
import type { FixtureElement, Written } from "../../test/capture-fixtures";
import type { CoverageRow } from "./coverage";
import { makeVariableIndex } from "./css-values";
import type { VariableIndex } from "./css-values";
import type { AxisPlacementSpec, EdgePlacementSpec } from "./kit-spec";

/** A place by the parent's edges on each axis. */
const edges = (horizontal: AxisPlacementSpec, vertical: AxisPlacementSpec): EdgePlacementSpec => ({
  kind: "edges",
  within: "parent",
  horizontal,
  vertical,
});

/** A `relative` root around one absolute part with the given classes. */
function holding(root: string, classes: string) {
  return buildCaptured(
    chip({ parts: [part({ key: "mark", slot: "mark" })] }),
    rest({ slot: "chip", classes: root, children: [{ slot: "mark", classes }] })
  );
}

/** The properties of the rows a build leaves unmapped, sorted. */
const unmapped = (coverage: readonly CoverageRow[]) =>
  coverage
    .filter((row) => row.outcome === "unmapped")
    .map((row) => row.property)
    .toSorted();

describe("an absolute part placed by its parent's edges", () => {
  it("sits at its offsets past the parent's border, MIN on both axes, at its own size", async () => {
    // `top-2` is 8px and `left-1` 4px from the padding edge, which a 2px border sets in.
    const { variant, coverage } = await holding(
      "relative border-2 border-black",
      "absolute top-2 left-1 size-[8px]"
    );
    const mark = frameOf(variant?.root);
    expect([mark?.placement, mark?.sizing]).toEqual([
      edges({ kind: "start", start: 6 }, { kind: "start", start: 10 }),
      { horizontal: fixed(literal(8)), vertical: fixed(literal(8)) },
    ]);
    expect(unmapped(coverage)).toEqual([]);
  });

  it("spans the parent between two offsets and keeps a fixed height its bottom offset from the end", async () => {
    const { variant, coverage } = await holding("relative", "absolute inset-x-0 bottom-[-5px] h-0.5");
    expect(frameOf(variant?.root)?.placement).toEqual(
      edges({ kind: "stretch", start: 0, end: 0 }, { kind: "end", end: -5 })
    );
    expect(unmapped(coverage)).toEqual([]);
  });

  it("reaches past the far edge by its one offset at a full length", async () => {
    // A `100%` height is the padding box's, so a box 32px down ends 32px below the parent.
    const { variant, coverage } = await holding("relative", "absolute top-8 left-[4px] h-full w-px");
    const mark = frameOf(variant?.root);
    expect([mark?.placement, mark?.sizing.horizontal]).toEqual([
      edges({ kind: "start", start: 4 }, { kind: "stretch", start: 32, end: -32 }),
      fixed(literal(1)),
    ]);
    expect(unmapped(coverage)).toEqual([]);
  });

  it.each([
    ["a static parent, which is no containing block", "", "absolute top-2 left-0 size-[8px]"],
    [
      "a translate, which moves the part off its offsets",
      "relative",
      "absolute top-2 left-0 size-[8px] translate-x-1",
    ],
    ["both offsets beside a width of its own", "relative", "absolute left-0 right-0 top-0 w-4 h-4"],
  ])("leaves the place unmapped beside %s", async (_case, root, classes) => {
    const { variant, coverage } = await holding(root, classes);
    expect(frameOf(variant?.root)?.placement).toBeUndefined();
    expect(unmapped(coverage)).toContain("position");
  });
});

/** A static root holding the corner close a containing block above it places, as Sheet's column does. */
function spanning(root: string, measured: FixtureElement["measured"], wrapped: boolean) {
  const own: FixtureElement = { slot: "mark", classes: "absolute top-4 right-4 size-[8px]" };
  const mark: FixtureElement = measured === undefined ? own : { ...own, measured };
  return buildCaptured(
    chip({ parts: [part({ key: "mark", slot: "mark" })] }),
    rest({ slot: "chip", classes: root, children: [wrapped ? { children: [mark] } : mark] })
  );
}

describe("an absolute part whose containing block lies above its static parent", () => {
  it("sits at its offsets alone, MAX across and MIN down, where the parent spans the block", async () => {
    const { variant, coverage } = await spanning("w-[200px] h-[100px]", { parentSpansBlock: true }, false);
    expect(frameOf(variant?.root)?.placement).toEqual(
      edges({ kind: "end", end: 16 }, { kind: "start", start: 16 })
    );
    expect(unmapped(coverage)).toEqual([]);
  });

  it.each([
    ["no measured span", "w-[200px] h-[100px]", undefined, false],
    [
      "a span beside a border on the parent",
      "w-[200px] h-[100px] border-2",
      { parentSpansBlock: true },
      false,
    ],
    ["a span measured below an undrawn wrapper", "w-[200px] h-[100px]", { parentSpansBlock: true }, true],
  ] as const)("leaves the place unmapped with %s", async (_case, root, measured, wrapped) => {
    const { variant, coverage } = await spanning(root, measured, wrapped);
    expect(frameOf(variant?.root)?.placement).toBeUndefined();
    expect(unmapped(coverage)).toContain("position");
  });
});

/**
 * A `relative` root whose `::before` paints a 1px line from 32px down to its full height, or, with
 * `hidden`, generates no box.
 */
function connector(measured: FixtureElement["measured"], hidden = false) {
  const root: FixtureElement = {
    slot: "chip",
    classes: "relative",
    pseudo: {
      before: {
        classes: `absolute top-8 left-[4px] h-full w-px bg-black${hidden ? " hidden" : ""}`,
        written: [{ className: "before:content-['']", property: "content", value: '""' }],
      },
    },
  };
  return buildCaptured(chip(), rest(measured === undefined ? root : { ...root, measured }));
}

describe("an absolute part's length between its parent's edges", () => {
  it("is the parent's padding box less the offsets where the parent's lengths are literals, so a full radius resolves", async () => {
    const { variant, coverage } = await holding(
      "relative w-[200px] h-[100px]",
      "absolute inset-0 rounded-full bg-black"
    );
    const mark = frameOf(variant?.root);
    expect([mark?.sizing, mark?.cornerRadius, mark?.placement]).toEqual([
      { horizontal: fixed(literal(200)), vertical: fixed(literal(100)) },
      literal(50),
      edges({ kind: "stretch", start: 0, end: 0 }, { kind: "stretch", start: 0, end: 0 }),
    ]);
    expect(unmapped(coverage)).toEqual([]);
  });

  it("is the place's to set where the parent hugs its content, with no length of its own in the spec", async () => {
    const { variant } = await holding("relative flex flex-col w-[100px]", "absolute top-0 left-0 size-full");
    const mark = frameOf(variant?.root);
    expect([
      mark?.sizing.vertical,
      mark?.placement?.kind === "edges" ? mark.placement.vertical : undefined,
    ]).toEqual([{ kind: "placed" }, { kind: "stretch", start: 0, end: 0 }]);
  });

  it.each([
    ["a share", "absolute left-1 top-1 w-full max-w-[50px] h-[10px]"],
    ["two offsets", "absolute left-0 right-0 top-0 max-w-[50px] h-[10px]"],
  ])(
    "leaves the place unmapped where a maximum bounds %s, which CSS holds and STRETCH would not",
    async (_case, classes) => {
      const { variant, coverage } = await holding("relative w-[100px] h-[40px]", classes);
      expect(frameOf(variant?.root)?.placement).toBeUndefined();
      expect(unmapped(coverage)).toContain("position");
    }
  );
});

describe("an absolute part whose place or length CSS resolves another way", () => {
  it("draws no length its place would set where the place is refused on its other axis", async () => {
    // `w-max` sizes the part by its content, which no place by one edge reads as a literal.
    const { variant, coverage } = await holding(
      "relative flex flex-col w-[100px]",
      "absolute left-0 top-0 h-full w-max"
    );
    const mark = frameOf(variant?.root);
    expect([mark?.placement, mark?.sizing.vertical.kind === "placed"]).toEqual([undefined, false]);
    expect(unmapped(coverage)).toContain("position");
  });

  it("scales only from a zero start, which keeps both of its ends a share of the parent", async () => {
    const offset = await holding("relative w-[100px] h-[40px]", "absolute left-[4px] top-0 w-1/2 h-[10px]");
    expect(frameOf(offset.variant?.root)?.placement).toBeUndefined();
    expect(unmapped(offset.coverage)).toContain("position");
    const whole = await holding("relative w-[100px] h-[40px]", "absolute left-[4px] top-0 w-full h-[10px]");
    const mark = frameOf(whole.variant?.root);
    expect(mark?.placement?.kind === "edges" ? mark.placement.horizontal : undefined).toEqual({
      kind: "stretch",
      start: 4,
      end: -4,
    });
  });

  it("counts a zero maximum as a bound, which holds the part at no width", async () => {
    const { variant, coverage } = await holding(
      "relative w-[100px] h-[40px]",
      "absolute inset-x-0 top-0 max-w-0 h-[10px]"
    );
    expect(frameOf(variant?.root)?.placement).toBeUndefined();
    expect(unmapped(coverage)).toContain("position");
  });

  it("reads an inherited height as the parent's declared one where a minimum makes the parent taller", async () => {
    // CSS inherits the parent's computed 10px, while its `min-h-[40px]` makes it 40px tall.
    const { variant } = await buildCaptured(
      chip({ parts: [part({ key: "mark", slot: "mark" })] }),
      rest({
        slot: "chip",
        classes: "relative w-[100px] h-[10px] min-h-[40px]",
        children: [
          {
            slot: "mark",
            classes: "absolute top-0 left-0 w-[10px]",
            written: [{ className: "inline style", property: "height", value: "inherit", source: "inline" }],
          },
        ],
      })
    );
    const mark = frameOf(variant?.root);
    expect([
      mark?.placement?.kind === "edges" ? mark.placement.vertical : undefined,
      mark?.sizing.vertical,
    ]).toEqual([{ kind: "start", start: 0 }, fixed(literal(10))]);
  });

  it("leaves no place where both offsets leave the part no room, as CSS resolves its width to zero", async () => {
    const { variant, coverage } = await holding(
      "relative w-[100px] h-[60px]",
      "absolute left-[60px] right-[60px] top-0 h-[10px]"
    );
    const mark = frameOf(variant?.root);
    expect(mark?.placement).toBeUndefined();
    expect(
      mark?.sizing.horizontal.kind === "fixed" &&
        mark.sizing.horizontal.length.kind === "literal" &&
        mark.sizing.horizontal.length.value < 0
    ).toBe(false);
    expect(unmapped(coverage)).toContain("position");
  });
});

describe("the order a box's layers paint in", () => {
  it("puts an absolute overlay after the in-flow content it covers, as CSS paints positioned boxes last", async () => {
    const { variant } = await buildCaptured(
      chip({ parts: [part({ key: "body", slot: "body" })] }),
      rest({
        slot: "chip",
        classes: "relative flex flex-col w-[100px]",
        measured: { pseudoBoxes: ["before"] },
        pseudo: {
          before: {
            classes: "absolute inset-0 bg-white",
            written: [{ className: "before:content-['']", property: "content", value: '""' }],
          },
        },
        children: [{ slot: "body", classes: "w-full h-[50px] bg-black" }],
      })
    );
    expect(variant?.root.children.map((child) => child.key)).toEqual(["body", "::before"]);
  });

  /** A root whose white `::before` covers it, over the given blocks in flow. */
  const overlaid = (children: readonly FixtureElement[]) =>
    buildCaptured(
      chip({ parts: children.map((child) => part({ key: child.slot ?? "", slot: child.slot ?? "" })) }),
      rest({
        slot: "chip",
        classes: "relative flex flex-col w-[100px] h-[60px]",
        measured: { pseudoBoxes: ["before"] },
        pseudo: {
          before: {
            classes: "absolute inset-0 bg-white",
            written: [{ className: "before:content-['']", property: "content", value: '""' }],
          },
        },
        children,
      })
    );

  it("paints the overlay between a static block and a later relative one, as CSS paints them", async () => {
    const { variant, coverage } = await overlaid([
      { slot: "body", classes: "w-full h-[40px] bg-black" },
      { slot: "rel", classes: "relative w-full h-[10px] bg-black" },
    ]);
    expect(variant?.root.children.map((child) => child.key)).toEqual(["body", "::before", "rel"]);
    expect(unmapped(coverage)).toEqual([]);
  });

  it("draws no overlay where CSS paints it over a static block that a relative one precedes in flow", async () => {
    const { variant, coverage } = await overlaid([
      { slot: "rel", classes: "relative w-full h-[10px] bg-black" },
      { slot: "body", classes: "w-full h-[40px] bg-black" },
    ]);
    expect(variant?.root.children.map((child) => child.key)).toEqual(["rel", "body"]);
    expect(unmapped(coverage)).toContain("position");
  });
});

/** A flex row holding a black block, the given parts, and a part at `z-20` with the given facts. */
function raised(
  classes: string,
  measured: FixtureElement["measured"],
  before: readonly FixtureElement[] = []
) {
  const own: FixtureElement = { slot: "actions", classes };
  const children: readonly FixtureElement[] = [
    ...before,
    { slot: "body", classes: "w-[40px] h-[40px] bg-black" },
    measured === undefined ? own : { ...own, measured },
  ];
  return buildCaptured(
    chip({ parts: children.map((child) => part({ key: child.slot ?? "", slot: child.slot ?? "" })) }),
    rest({ slot: "chip", classes: "relative flex w-[100px] h-[40px]", children })
  );
}

describe("a part's stacking level", () => {
  it("drops where the capture measured the part over the whole root and the order draws it last", async () => {
    const { variant, coverage } = await raised("relative z-20 size-[8px] bg-white", { paintsLast: true });
    expect(variant?.root.children.map((child) => child.key)).toEqual(["body", "actions"]);
    expect(coverage.find((row) => row.property === "z-index")?.outcome).toBe("dropped");
    expect(unmapped(coverage)).toEqual([]);
  });

  it("stays unmapped with no measured fact, since another box of the root may paint over the part", async () => {
    const { coverage } = await raised("relative z-20 size-[8px] bg-white", undefined);
    expect(unmapped(coverage)).toEqual(["z-index"]);
  });

  it("stays unmapped where the order draws an earlier overlay after a flex item at a level", async () => {
    // CSS paints the item's level over the overlay at `auto`, and Figma paints the later overlay over it.
    const { variant, coverage } = await raised("z-20 size-[8px] bg-white", { paintsLast: true }, [
      { slot: "overlay", classes: "absolute inset-0 bg-white" },
    ]);
    expect(variant?.root.children.map((child) => child.key)).toEqual(["body", "actions", "overlay"]);
    expect(unmapped(coverage)).toEqual(["z-index"]);
  });
});

describe("a painting ::before", () => {
  it("draws as a layer of its own, placed by its offsets, where the capture measured its box", async () => {
    const { variant, coverage } = await connector({ pseudoBoxes: ["before"] });
    const line = variant?.root.children[0];
    expect(line?.kind === "frame" ? [line.key, line.placement, line.fill !== undefined] : line).toEqual([
      "::before",
      edges({ kind: "start", start: 4 }, { kind: "stretch", start: 32, end: -32 }),
      true,
    ]);
    expect(unmapped(coverage)).toEqual([]);
  });

  // Oracle: CSS Display 3 §2.5. A `::before` whose `display` is `none` generates no box, as a
  // Table body's `not-framed-table:before:hidden` leaves its shadow outside a frame.
  it("draws no layer and drops its rows as generating no box where its display is none", async () => {
    const { variant, coverage } = await connector(undefined, true);
    expect(variant?.root.children).toEqual([]);
    expect(unmapped(coverage)).toEqual([]);
    expect([
      ...new Set(
        coverage
          .filter((row) => row.className.startsWith("absolute") || row.property === "display")
          .map((row) => row.detail)
      ),
    ]).toEqual(["the `::before` pseudo-element generates no box, since its `display` is `none`"]);
  });

  it("draws no layer and keeps its rows unmapped where the capture measured no box", async () => {
    const { variant, coverage } = await connector(undefined);
    expect(variant?.root.children).toEqual([]);
    expect(unmapped(coverage)).toEqual([
      "background-color",
      "content",
      "height",
      "left",
      "position",
      "top",
      "width",
    ]);
  });
});

describe("a block's vertical margins", () => {
  /** A block column of two blocks with the given classes. */
  const column = (first: string, second: string) =>
    buildCaptured(
      chip({ parts: [part({ key: "a", slot: "a" }), part({ key: "b", slot: "b" })] }),
      rest({
        slot: "chip",
        classes: "block w-[100px]",
        children: [
          { slot: "a", classes: `block h-4 ${first}` },
          { slot: "b", classes: `block h-4 ${second}` },
        ],
      })
    );

  it("keeps a bottom margin above a block with no top margin, which leaves it its length", async () => {
    const { variant, coverage } = await column("mb-10", "");
    const first = frameOf(variant?.root);
    expect([first?.key, first?.paddingBottom]).toEqual(["a", literal(40)]);
    expect(unmapped(coverage)).toEqual([]);
  });

  it("leaves two adjoining margins unmapped, which collapse to the larger", async () => {
    const { coverage } = await column("mb-10", "mt-4");
    expect(unmapped(coverage)).toEqual(["margin-bottom", "margin-top"]);
  });
});

/**
 * A child a row holds, in the order the markup holds them: an icon, on its side of the label, or a
 * frame part, before the label or after it, each with its key and classes.
 */
type RowChild =
  | {
      readonly kind: "icon";
      readonly key: string;
      readonly side: "start" | "end";
      readonly classes: string;
    }
  | {
      readonly kind: "part";
      readonly key: string;
      readonly at: "before" | "after";
      readonly classes: string;
    };

/**
 * What a row's build reads besides its classes: declarations written on the row, variables, and
 * whether the row holds the label.
 */
type RowOptions = {
  readonly written?: readonly Written[];
  readonly variables?: VariableIndex;
  readonly label?: "none";
};

/** The font variable every row's label binds. */
const FONT_SANS = { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" };

/**
 * A row holding the label `Share`, unless the options leave it out, and its children in the order
 * given, with the row's classes and each child's. The label's text follows every start icon and
 * part before it.
 */
function iconsRow(row: string, children: readonly RowChild[], options: RowOptions = {}) {
  const afterLabel = (child: RowChild) =>
    child.kind === "icon" ? child.side === "end" : child.at === "after";
  const textIndex = children.findIndex(afterLabel);
  const labelled = options.label !== "none";
  const root: FixtureElement = {
    slot: "chip",
    classes: `${row} w-[200px] font-sans text-[14px] leading-[20px] text-[#000000]`,
    written: options.written ?? [],
    children: children.map((child) =>
      child.kind === "icon"
        ? { tag: "svg", classes: child.classes }
        : { slot: `chip-${child.key}`, classes: child.classes }
    ),
  };
  return buildCaptured(
    chip({
      label: labelled
        ? { key: "label", name: "label", characters: "Share", textProperty: "Label", shownIn: () => true }
        : undefined,
      iconsFor: () =>
        children.flatMap((child) =>
          child.kind === "icon" ? [{ ...ICON, key: child.key, name: child.key, side: child.side }] : []
        ),
      parts: children.flatMap((child) => {
        if (child.kind === "icon") {
          return [];
        }
        const own = part({ key: child.key, slot: `chip-${child.key}` });
        return [child.at === "after" ? { ...own, after: "label" as const } : own];
      }),
    }),
    rest(
      labelled ? { ...root, text: "Share", textIndex: textIndex === -1 ? children.length : textIndex } : root
    ),
    { variables: options.variables ?? makeVariableIndex([FONT_SANS]) }
  );
}

/** A row holding the label `Share` and one icon at its end, with the row's and the icon's classes. */
function iconRow(row: string, icon: string, options: RowOptions = {}) {
  return iconsRow(row, [{ kind: "icon", key: "icon", side: "end", classes: icon }], options);
}

/** The keys of a box's layers, each with its place where it has one. */
const placesOf = (variant: Awaited<ReturnType<typeof iconRow>>["variant"]) =>
  variant?.root.children.map((layer) => [layer.key, layer.kind === "text" ? undefined : layer.placement]);

/** The outcome of a class's row for a property, and whether its detail starts with a reason. */
function noteFor(coverage: readonly CoverageRow[], className: string, property: string, reason: string) {
  const [, outcome, detail] = notesOf(coverage, className).find(([each]) => each === property) ?? [];
  return [outcome, String(detail).startsWith(reason)];
}

/** The outcome of a layer's row for a property, and whether its detail starts with a reason. */
function noteOn(coverage: readonly CoverageRow[], layer: string, property: string, reason: string) {
  const row = coverage.find((each) => each.part === layer && each.property === property);
  return [row?.outcome, row?.detail.startsWith(reason) === true];
}

describe("an absolute icon in a flex row", () => {
  // The row's content box runs from 10px below its top edge (a 4px border and 6px of padding) to 2px
  // above its bottom, so a centred icon's centre sits (10 - 2) / 2 = 4px below the row's centre. The
  // icon's `right` measures from the padding edge, inside the row's 2px right border: 5px.
  const ROW = "relative flex items-center border-t-[4px] border-r-[2px] border-black pt-[6px] pb-[2px]";

  it("sits at its end offset across and centred down, out of the flow after the label", async () => {
    const { variant, coverage } = await iconRow(ROW, "absolute right-[3px] size-[16px]");
    expect(placesOf(variant)).toEqual([
      ["label", undefined],
      ["icon", edges({ kind: "end", end: 5 }, { kind: "centre", offset: 4 })],
    ]);
    expect(unmapped(coverage)).toEqual([]);
  });

  it("keeps that place through a half turn, which leaves its square box where it was", async () => {
    const { variant, coverage } = await iconRow(ROW, "absolute right-[3px] size-[16px] rotate-180");
    const icon = variant?.root.children.at(-1);
    expect([icon?.kind === "icon" ? icon.rotation : undefined, placesOf(variant)?.at(-1)]).toEqual([
      180,
      ["icon", edges({ kind: "end", end: 5 }, { kind: "centre", offset: 4 })],
    ]);
    expect(unmapped(coverage)).toEqual([]);
  });

  // An icon's own `align-self` places it at its static position before the row's `align-items`
  // (CSS Flexbox 1 §4.1, CSS Box Alignment 3 §6.1). A left-to-right row's inline end is its right
  // (CSS Logical Properties 1 §4), so `border-e-[6px]` sets the icon's `right-[3px]` 9px in.
  it.each([
    [
      "aligns itself centred in a row that packs its items at its top",
      "relative flex items-start border-t-[4px] border-r-[2px] border-black pt-[6px] pb-[2px]",
      edges({ kind: "end", end: 5 }, { kind: "centre", offset: 4 }),
    ],
    [
      "sits in a row that sets its end border by its logical side",
      "relative flex items-center border-e-[6px] border-black",
      edges({ kind: "end", end: 9 }, { kind: "centre", offset: 0 }),
    ],
  ])("sits centred at its static position where it %s", async (_case, row, placed) => {
    const { variant, coverage } = await iconRow(row, "absolute right-[3px] self-center size-[16px]");
    expect([placesOf(variant)?.at(-1), noteFor(coverage, "self-center", "align-self", "")]).toEqual([
      ["icon", placed],
      ["literal", true],
    ]);
  });

  // CSS paints positioned boxes and stacking contexts in tree order after the in-flow boxes (CSS 2.1
  // Appendix E, step 8), so the `relative` part before the icon in the markup paints under it, as
  // Figma paints the icon, its row's last layer.
  it("draws last, over a relative part before it in the markup", async () => {
    const { variant } = await iconsRow(
      ROW,
      [
        { kind: "part", key: "mark", at: "before", classes: "relative size-[16px] bg-[#ff0000]" },
        { kind: "icon", key: "icon", side: "start", classes: "absolute left-0 top-0 size-[16px]" },
      ],
      { label: "none" }
    );
    expect(placesOf(variant)).toEqual([
      ["mark", undefined],
      ["icon", edges({ kind: "start", start: 0 }, { kind: "start", start: 4 })],
    ]);
  });

  // A `relative` icon or part is positioned, and a turn or an opacity below 1 makes a stacking context
  // (CSS Transforms 2 §4, CSS Color 4 §10.1), so CSS paints each one after the absolute icon in the
  // markup over it (CSS 2.1 Appendix E, step 8), where Figma would draw the icon over every layer of
  // its row. An absolute frame its offsets do not place is positioned too.
  it.each([
    ["a relative icon", [{ kind: "icon", key: "second", side: "end", classes: "relative size-[16px]" }]],
    ["a turned icon", [{ kind: "icon", key: "second", side: "end", classes: "rotate-180 size-[16px]" }]],
    ["a faded icon", [{ kind: "icon", key: "second", side: "end", classes: "opacity-50 size-[16px]" }]],
    [
      "a relative part after it and the label",
      [{ kind: "part", key: "mark", at: "before", classes: "relative size-[16px] bg-[#ff0000]" }],
    ],
    [
      "an absolute part its offsets do not place, then a static one",
      [
        { kind: "part", key: "mark", at: "after", classes: "absolute size-[8px] bg-[#ff0000]" },
        { kind: "part", key: "tail", at: "after", classes: "size-[8px] bg-[#00ff00]" },
      ],
    ],
  ] as const)("stays in the flow where CSS paints %s after it over it", async (_case, later) => {
    const icon: RowChild = {
      kind: "icon",
      key: "icon",
      side: "start",
      classes: "absolute left-0 top-0 size-[16px]",
    };
    const { variant, coverage } = await iconsRow(ROW, [icon, ...later]);
    const why = "a box after the absolute icon in the markup is positioned or makes a stacking context";
    expect([
      placesOf(variant)?.find(([key]) => key === "icon"),
      noteOn(coverage, "icon", "position", why),
    ]).toEqual([
      ["icon", undefined],
      ["unmapped", true],
    ]);
  });

  // Figma turns a free layer about the origin its `x` and `y` name, so a mode that grows a half-turned
  // 16px icon to 24px keeps that origin and moves the icon's box 8px up and left, where CSS keeps it.
  it("stays in the flow where a mode can change the size of a turned icon", async () => {
    const variables = makeVariableIndex([
      FONT_SANS,
      {
        ref: { collection: "Fuse density", name: "icon-size" },
        webSyntax: "var(--icon-size)",
        minimum: 16,
        maximum: 24,
      },
    ]);
    const { variant, coverage } = await iconRow(ROW, "absolute left-0 top-0 size-(--icon-size) rotate-180", {
      variables,
    });
    expect([
      placesOf(variant)?.at(-1),
      noteFor(coverage, "absolute", "position", "a mode can change the turned absolute icon's size"),
    ]).toEqual([
      ["icon", undefined],
      ["unmapped", true],
    ]);
  });

  // A variable whose least and greatest values are the same length is one length in every mode, so
  // the icon keeps its place at its parent's end and binds its size.
  it("sits at its end offset where its size variable holds one length in every mode", async () => {
    const variables = makeVariableIndex([
      FONT_SANS,
      {
        ref: { collection: "Fuse density", name: "icon-size" },
        webSyntax: "var(--icon-size)",
        minimum: 16,
        maximum: 16,
      },
    ]);
    const { variant } = await iconRow(ROW, "absolute right-[3px] size-(--icon-size)", { variables });
    const icon = variant?.root.children.at(-1);
    expect([placesOf(variant)?.at(-1), icon?.kind === "icon" ? icon.size : undefined]).toEqual([
      ["icon", edges({ kind: "end", end: 5 }, { kind: "centre", offset: 4 })],
      { kind: "variable", variable: { collection: "Fuse density", name: "icon-size" } },
    ]);
  });

  // The kit draws a turn only as a quarter or half turn (`kit-check.ts`), so a 45° icon that keeps no
  // place draws in the flow unturned, its turn unmapped with the reason.
  it("stays in the flow unturned where a turn other than a quarter or half moves its box", async () => {
    const { variant, coverage } = await iconRow(ROW, "absolute right-[3px] size-[16px] rotate-45");
    const icon = variant?.root.children.at(-1);
    const reason = "the absolute icon turns other than a quarter or half turn about its centre";
    expect([
      placesOf(variant)?.at(-1),
      icon?.kind === "icon" ? icon.rotation : "no icon",
      noteFor(coverage, "rotate-45", "rotate", reason),
      noteFor(coverage, "absolute", "position", reason),
    ]).toEqual([["icon", undefined], undefined, ["unmapped", true], ["unmapped", true]]);
  });

  it("sits its top offset below the row's top edge where it sets one", async () => {
    const { variant } = await iconRow(ROW, "absolute right-[3px] top-[1px] size-[16px]");
    expect(placesOf(variant)?.at(-1)).toEqual([
      "icon",
      edges({ kind: "end", end: 5 }, { kind: "start", start: 5 }),
    ]);
  });

  const NEITHER =
    "the absolute part's offsets and lengths place it neither by its parent's edges nor its centre";
  it.each([
    [
      "a static row, which is no containing block",
      "flex items-center",
      "absolute right-0 size-[16px]",
      "the absolute part's containing block lies above its parent",
    ],
    [
      "a row that packs its items at its top",
      "relative flex items-start",
      "absolute right-0 size-[16px]",
      NEITHER,
    ],
    [
      "a margin, which moves its margin box",
      "relative flex items-center",
      "absolute right-0 mr-[2px] size-[16px]",
      "the absolute icon sets a margin",
    ],
    ["both offsets across auto", "relative flex items-center", "absolute size-[16px]", NEITHER],
    [
      "a translate",
      "relative flex items-center",
      "absolute right-0 size-[16px] translate-y-[1px]",
      "a turn, a translate or a scale moves the absolute part off its offsets",
    ],
    [
      "an icon that aligns itself at the top of a row that centres its items",
      "relative flex items-center",
      "absolute right-0 self-start size-[16px]",
      NEITHER,
    ],
    // `place-self` sets `align-self` too (CSS Box Alignment 3 §6.1), which the build keeps whole.
    [
      "an icon whose place-self aligns it at the top of a row that centres its items",
      "relative flex items-center",
      "absolute right-0 place-self-start size-[16px]",
      "a `place-self` on the absolute icon or a `place-items` on its box",
    ],
    // A grid line makes the grid area the icon's containing block (CSS Grid 1 §9.1): in this 200px
    // grid of two columns, `col-start-2` puts `left-0` at 100px, where no layer draws the area.
    [
      "a grid line, which makes a grid area its containing block",
      "relative grid grid-cols-2",
      "absolute col-start-2 left-0 top-0 size-[16px]",
      "the absolute part's grid lines",
    ],
  ])("stays in the flow with its place unmapped beside %s", async (_case, row, icon, reason) => {
    const { variant, coverage } = await iconRow(row, icon);
    expect(placesOf(variant)).toEqual([
      ["label", undefined],
      ["icon", undefined],
    ]);
    expect(noteFor(coverage, "absolute", "position", reason)).toEqual(["unmapped", true]);
  });
});

/**
 * The refusals that keep an absolute icon in its box's flow where the build cannot prove the place
 * or the paint CSS gives it. Figma draws a placed icon over every other layer of its box, and CSS
 * paints it so only where every box after it in the markup is static and makes no stacking context,
 * no box of its box's subtree sets a `z-index` or an `order`, and the box is a flex row or column that
 * no flush run regroups (CSS 2.1 Appendix E, CSS Flexbox 1 §5.4.1).
 */
describe("an absolute icon whose place or paint the build cannot prove", () => {
  const MARK = { ...ICON, key: "mark", name: "mark" };
  const ABSOLUTE = "absolute left-0 top-0 size-[16px] text-[#000000]";
  const DOT = "relative size-[16px] bg-[#000000]";
  const LATER = "a box after the absolute icon in the markup is positioned or makes a stacking context";
  it.each([
    // A block box can paint its first layer on top (`stacksFirstOnTop`), which puts the icon, its
    // last layer, under the white panel CSS paints it over.
    [
      "a block box",
      {
        iconsFor: () => [{ ...MARK, side: "end" as const }],
        parts: [
          part({ key: "header", slot: "header", parts: [part({ key: "button", slot: "button" })] }),
          part({ key: "panel", slot: "panel" }),
        ],
      },
      {
        slot: "chip",
        classes: "relative block w-[100px]",
        children: [
          {
            slot: "header",
            classes: "flex",
            children: [{ slot: "button", classes: "size-[16px] ring-2 ring-[#000000]" }],
          },
          { slot: "panel", classes: "block size-[16px] bg-[#ffffff]" },
          { tag: "svg", classes: "absolute left-0 top-[16px] size-[16px] text-[#000000]" },
        ],
      },
      "the absolute icon's box is no flex container",
    ],
    // No probe has shown how a Figma grid draws an absolute layer among its items.
    [
      "a grid box",
      { iconsFor: () => [MARK], parts: [part()] },
      {
        slot: "chip",
        classes: "relative grid grid-cols-2 w-[100px]",
        children: [
          { slot: "chip-dot", classes: "size-[16px]" },
          { tag: "svg", classes: ABSOLUTE },
        ],
      },
      "the absolute icon's box is no flex container",
    ],
    // The flush run draws `a` and `dot` in one frame, which drops the keys the paint reads.
    [
      "a flush run a column's gap joins",
      { iconsFor: () => [MARK], parts: [part({ key: "a", slot: "a" }), part()] },
      {
        slot: "chip",
        classes: "relative flex flex-col gap-2",
        children: [
          { tag: "svg", classes: "absolute left-0 top-[16px] size-[16px] text-[#000000]" },
          { slot: "a", classes: "size-[16px]" },
          { slot: "chip-dot", classes: `${DOT} -mt-2` },
        ],
      },
      "a flex item of the absolute icon's box cancels the column's gap",
    ],
    // With no label, the definition's sides say nothing of the markup, where the dot follows the icon.
    [
      "a relative part after it in a box with no label",
      { iconsFor: () => [{ ...MARK, side: "end" as const }], parts: [part()] },
      {
        slot: "chip",
        classes: "relative flex size-[100px]",
        children: [
          { tag: "svg", classes: ABSOLUTE },
          { slot: "chip-dot", classes: DOT },
        ],
      },
      LATER,
    ],
    // A static wrapper paints in the flow, and the `relative` dot inside it after the icon (CSS 2.1
    // Appendix E, step 8).
    [
      "a relative part inside a static wrapper after it",
      { iconsFor: () => [MARK], parts: [part({ key: "wrapper", slot: "wrapper", parts: [part()] })] },
      {
        slot: "chip",
        classes: "relative flex size-[100px]",
        children: [
          { tag: "svg", classes: ABSOLUTE },
          { slot: "wrapper", classes: "size-[16px]", children: [{ slot: "chip-dot", classes: DOT }] },
        ],
      },
      LATER,
    ],
    // `will-change: scroll-position` makes no stacking context in Chromium, while other values do, so
    // the build cannot tell how the dot paints.
    [
      "a will-change after it",
      { iconsFor: () => [MARK], parts: [part()] },
      {
        slot: "chip",
        classes: "relative flex size-[100px]",
        children: [
          { tag: "svg", classes: ABSOLUTE },
          { slot: "chip-dot", classes: "will-change-scroll size-[16px] bg-[#000000]" },
        ],
      },
      "a box after the absolute icon in the markup sets a value that may or may not make a stacking context",
    ],
    // Chromium paints a box that runs a transform or opacity animation, as `animate-spin` does, over the
    // icon before it, and an animation of another property would not, so the build cannot tell.
    [
      "an animation after it",
      { iconsFor: () => [MARK], parts: [part()] },
      {
        slot: "chip",
        classes: "relative flex size-[100px]",
        children: [
          { tag: "svg", classes: ABSOLUTE },
          { slot: "chip-dot", classes: "animate-spin size-[16px] bg-[#000000]" },
        ],
      },
      "a box after the absolute icon in the markup sets a value that may or may not make a stacking context",
    ],
    // `transform-style: preserve-3d` and `content-visibility: auto` each make a stacking context
    // (CSS Transforms 2 §4, CSS Containment 2 §4), which Chromium paints over the icon before it.
    ...(
      [
        ["a preserved 3D context after it", "transform-style", "preserve-3d"],
        ["a content-visibility after it", "content-visibility", "auto"],
      ] as const
    ).map(
      ([name, property, value]) =>
        [
          name,
          { iconsFor: () => [MARK], parts: [part()] },
          {
            slot: "chip",
            classes: "relative flex size-[100px]",
            children: [
              { tag: "svg", classes: ABSOLUTE },
              {
                slot: "chip-dot",
                classes: "size-[16px] bg-[#000000]",
                written: [{ className: `[${property}:${value}]`, property, value }],
              },
            ],
          },
          LATER,
        ] as const
    ),
    // A reversed row lays its items out against the order Figma paints its layers in.
    [
      "a row that lays its items out in reverse",
      { iconsFor: () => [MARK] },
      {
        slot: "chip",
        classes: "relative flex flex-row-reverse size-[100px]",
        children: [{ tag: "svg", classes: ABSOLUTE }],
      },
      "the absolute icon's box lays its items out in reverse",
    ],
    // CSS paints flex items in order-modified document order (CSS Flexbox 1 §5.4.1), so the dot
    // before the icon in the markup paints after it.
    [
      "an order that paints a relative part before it last",
      { iconsFor: () => [MARK], parts: [part()] },
      {
        slot: "chip",
        classes: "relative flex size-[100px]",
        children: [
          { slot: "chip-dot", classes: `${DOT} order-last` },
          { tag: "svg", classes: ABSOLUTE },
        ],
      },
      "an item of the absolute icon's box sets an `order`",
    ],
    // A positive level paints the dot after every box at level 0, the icon included (CSS 2.1 §9.9.1).
    [
      "a z-index on a relative part before it",
      { iconsFor: () => [MARK], parts: [part()] },
      {
        slot: "chip",
        classes: "relative flex size-[100px]",
        children: [
          { slot: "chip-dot", classes: `${DOT} z-10` },
          { tag: "svg", classes: ABSOLUTE },
        ],
      },
      "a box in the absolute icon's box sets a `z-index`",
    ],
    // `place-items: start` can win over `align-items: center`, which puts the icon at the row's top,
    // and the build keeps the shorthand whole beside the longhand.
    [
      "a place-items on its box beside the static centre",
      { iconsFor: () => [MARK] },
      {
        slot: "chip",
        classes: "relative flex items-center place-items-start size-[100px]",
        children: [{ tag: "svg", classes: "absolute right-0 size-[16px] text-[#000000]" }],
      },
      "a `place-self` on the absolute icon or a `place-items` on its box",
    ],
    // The `relative` dot after the absolute icon paints over it, beside a second icon in the flow.
    [
      "a relative part after it and an icon in the flow",
      { iconsFor: () => [MARK, { ...ICON, key: "other", name: "other" }], parts: [part()] },
      {
        slot: "chip",
        classes: "relative flex size-[100px]",
        children: [
          { tag: "svg", classes: ABSOLUTE },
          { tag: "svg", classes: "size-[16px] text-[#000000]" },
          { slot: "chip-dot", classes: DOT },
        ],
      },
      LATER,
    ],
    // A top border whose style is `none` draws no width (CSS Backgrounds 3 §4.3), while the box's
    // sizing counts its 8px, so the row Figma draws and the row CSS lays out differ in height.
    [
      "a top border whose style draws none",
      { iconsFor: () => [MARK] },
      {
        slot: "chip",
        classes: "relative flex items-center size-[100px] border-t-[8px]",
        written: [{ className: "border-t-none", property: "border-top-style", value: "none" }],
        children: [{ tag: "svg", classes: "absolute right-0 size-[16px] text-[#000000]" }],
      },
      "the absolute icon's box sets a border on a side whose width or style the build cannot read",
    ],
    // In a left-to-right box, `border-inline-end-style` and `border-right-style` both set the right
    // border's style, and the build cannot tell which wins.
    [
      "a right border whose style two declarations set apart",
      { iconsFor: () => [MARK] },
      {
        slot: "chip",
        classes: "relative flex items-center size-[100px] border-r-[6px] border-[#000000]",
        written: [
          { className: "[border-inline-end-style:none]", property: "border-inline-end-style", value: "none" },
        ],
        children: [{ tag: "svg", classes: "absolute right-0 size-[16px] text-[#000000]" }],
      },
      "the absolute icon's box sets a border on a side whose width or style the build cannot read",
    ],
  ] as const)("stays in the flow beside %s", async (_case, manifest, root, reason) => {
    const { variant, coverage } = await buildCaptured(chip(manifest), rest(root));
    const icon = variant?.root.children.find((layer) => layer.key === "mark");
    expect([
      icon?.kind === "icon" ? icon.placement : "no icon",
      noteOn(coverage, "mark", "position", reason),
    ]).toEqual([undefined, ["unmapped", true]]);
  });

  // Tailwind compiles `border-x-[6px]` to `border-inline-width`, which sets the right border too
  // (CSS Logical Properties 1 §4), so `right-0` sits 6px inside the box's outer edge (CSS 2.1 §10.3.7).
  it("sits inside a right border its box sets by border-x", async () => {
    const { variant } = await buildCaptured(
      chip({ iconsFor: () => [MARK] }),
      rest({
        slot: "chip",
        classes: "relative flex items-center size-[100px] border-x-[6px] border-[#000000]",
        children: [{ tag: "svg", classes: "absolute right-0 size-[16px] text-[#000000]" }],
      })
    );
    const icon = variant?.root.children.find((layer) => layer.key === "mark");
    expect(icon?.kind === "icon" ? icon.placement : "no icon").toEqual(
      edges({ kind: "end", end: 6 }, { kind: "centre", offset: 0 })
    );
  });
});
