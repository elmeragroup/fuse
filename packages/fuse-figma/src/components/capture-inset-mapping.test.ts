/**
 * How the build places an absolute part by its distances to its parent's edges, draws a painting
 * `::before` as a layer of its own, and keeps a block's margin beside a margin of zero. The unit under
 * test is `buildComponentSet` on hand-built captures of one-cell `chip` sets (`test/capture-fixtures.ts`).
 * Oracles: CSS 2.1 §10.3.7 and §10.6.4, under which an absolute box's offsets measure from its
 * containing block's padding edge, the box spans the room between two offsets at an `auto` length,
 * and a `100%` length is the containing block's padding box; Figma's constraints, where MIN keeps a
 * layer's distance to its parent's start, MAX to its end and STRETCH to both; CSS 2.1 §8.3.1, under
 * which two adjoining margins collapse to the larger; and the coverage contract, under which a part
 * the build cannot place, and a pseudo-element the capture did not measure, keep their rows unmapped.
 * A static parent the capture measured as spanning the part's containing block (`parentSpansBlock`)
 * has its outer edge on that block's padding edge, so each distance is the offset alone; a border on
 * the parent, or a wrapper the kit does not draw between the two, breaks that.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, fixed, frameOf, literal, part, rest } from "../../test/capture-fixtures";
import type { FixtureElement } from "../../test/capture-fixtures";
import type { CoverageRow } from "./coverage";
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
