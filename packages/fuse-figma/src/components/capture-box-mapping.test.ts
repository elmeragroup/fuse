/**
 * How the build maps a box's own declarations, as a capture records the browser's winners: sizing,
 * percentages, limits, margins, position, alignment, corners, transforms, overflow and the outcomes of
 * the declarations that have no Figma form. The unit under test is `buildSetsInOrder` on hand-built
 * captures of one-cell `chip` sets (`test/capture-fixtures.ts`). Each case names its oracle: the CSS
 * specification that says what the browser draws, the Figma plugin typings or a probe that says what
 * Figma draws, or the coverage contract, under which a declaration that does not reach Figma is
 * `unmapped` and one that has nothing to draw is `dropped` with the reason.
 */
import { describe, expect, it } from "vitest";

import {
  buildCaptured,
  buildChip,
  chip,
  FILL,
  fixed,
  fixedSize,
  frameOf,
  HUG,
  ICON,
  instanceOf,
  literal,
  notesOf,
  part,
  rest,
  UNLIMITED,
} from "../../test/capture-fixtures";
import type { FixtureElement, FixtureOptions } from "../../test/capture-fixtures";
import type { MeasuredFacts } from "../capture/capture-format";
import type { PartManifest } from "../capture/manifest";
import type { CoverageRow } from "./coverage";
import { makeVariableIndex } from "./css-values";
import type { BooleanPropertySpec, FrameLayerSpec } from "./kit-spec";

/** Build a chip whose root wins `classes` and holds one `chip-dot` part that wins `dot`. */
function buildWithDot(classes: string, dot: string, options: FixtureOptions = {}) {
  return buildChip(classes, [{ slot: "chip-dot", classes: dot }], { parts: [part()] }, options);
}

// Oracle: the coverage contract. The stroke cannot draw without a color, so the missing color must
// fail the gate rather than vanish.
describe("a border with no color", () => {
  it("records the missing color as unmapped, under the class that drew the border", async () => {
    const { variant, coverage } = await buildChip("border");
    expect(variant?.root.stroke).toBeUndefined();
    expect(coverage).toContainEqual(
      expect.objectContaining({ className: "border", property: "border-color", outcome: "unmapped" })
    );
  });
});

// Oracle: the plugin typings (`@figma/plugin-typings`), where a text layer's `openTypeFeatures` is
// read-only, so `font-variant-numeric` has no Figma form and is dropped, not unmapped.
describe("tabular numerals", () => {
  it("drops font-variant-numeric", async () => {
    const { coverage } = await buildChip("tabular-nums");
    expect(
      coverage.filter((row) => row.property === "font-variant-numeric").map((row) => row.outcome)
    ).toEqual(["dropped"]);
  });
});

// Oracle: the Figma component model, where a component is one static frame per variant with no
// keyframes, so `animation` has no Figma form.
describe("an animation", () => {
  it("drops animate-pulse because Figma components do not animate", async () => {
    const { coverage } = await buildChip("animate-pulse");
    expect(notesOf(coverage, "animate-pulse")).toEqual([
      ["animation", "dropped", "Figma components do not animate"],
    ]);
  });
});

// Oracle: CSS, where a percentage width is a share of the containing block, which a Figma number
// field cannot hold, so the declaration fails the gate instead of passing as a fixed width.
describe("a percentage width", () => {
  it.each(["w-full", "w-[calc(100%-4px)]"])("leaves %s unmapped", async (className) => {
    const { variant, coverage } = await buildChip(className);
    expect(variant?.root.sizing.horizontal).toEqual(HUG);
    expect(coverage).toEqual([
      expect.objectContaining({ className, property: "width", outcome: "unmapped" }),
    ]);
  });
});

// Oracle: CSS Sizing 3, where a fit-content width with room to spare is the box's max-content width,
// the width of what it holds, which is a Figma hug.
describe("a fit-content width", () => {
  it("hugs the content", async () => {
    const { variant, coverage } = await buildChip("w-fit");
    expect(variant?.root.sizing.horizontal).toEqual(HUG);
    expect(coverage.map((row) => [row.className, row.property, row.outcome, row.detail])).toEqual([
      ["w-fit", "width", "literal", "the box hugs its content"],
    ]);
  });
});

// Oracle: CSS inheritance. An unregistered custom property inherits its parent's computed value, and
// a custom property Tailwind registers with `@property … { inherits: false }`, as it does
// `--tw-ring-offset-width` for `ring-2`, takes its initial value `0px` on every child. The coverage
// contract gives one row per distinct outcome of each declaration of each part.
describe("a part below the root", () => {
  it("reads a custom property its parent sets, which the parent's class reaches Figma through", async () => {
    const { variant, coverage } = await buildWithDot("[--chip-corner:6px]", "rounded-[var(--chip-corner)]");
    expect(frameOf(variant?.root)?.cornerRadius).toEqual(literal(6));
    expect(coverage.filter((row) => row.className === "[--chip-corner:6px]")).toEqual([
      expect.objectContaining({ part: "chip", property: "--chip-corner", outcome: "literal" }),
    ]);
  });

  it("records one class on the root and on the part as two rows, one per part", async () => {
    const { coverage } = await buildWithDot("bg-[#000000]", "bg-[#000000]");
    expect(
      coverage
        .filter((row) => row.className === "bg-[#000000]")
        .map((row) => `${row.part}: ${row.outcome}`)
        .toSorted()
    ).toEqual(["chip-dot: literal", "chip: literal"]);
  });

  it("does not inherit a custom property registered with inherits: false", async () => {
    const { variant } = await buildWithDot(
      "[--tw-ring-offset-width:4px]",
      "rounded-[var(--tw-ring-offset-width)]",
      {
        registered: ["ring-2"],
      }
    );
    expect(frameOf(variant?.root)?.cornerRadius).toEqual(literal(0));
  });
});

// Oracle: CSS Flexbox 1 §9.7. A row that hugs its width has no free space, so the one layer that
// grows keeps its own width; a zero minimum never widens the row.
describe("a part that grows along its row", () => {
  it("keeps its own width in a row that hugs its layers above a zero minimum", async () => {
    const { coverage } = await buildWithDot("flex min-w-0", "flex-1 h-[8px]");
    expect(coverage.filter((row) => row.className === "flex-1")).toEqual([
      expect.objectContaining({
        property: "flex",
        outcome: "dropped",
        detail: "the row hugs its layers, so the one layer that grows has no room to grow into",
      }),
    ]);
  });
});

// Oracle: CSS 2.1 §10.5 and §10.7. `max-height: 100%` takes the parent's content height, its fixed
// height less its border, and the used height is the part's height lowered to it, so a part at least
// that tall is exactly the parent's content height, which Figma's fill down draws.
describe("a part capped at its parent's height", () => {
  it("fills down where its literal height reaches the parent's content height", async () => {
    const { variant } = await buildWithDot(
      "flex items-center w-[100px] h-[40px] border border-[rgb(0_0_0)]",
      "w-[10px] h-[39px] max-h-full"
    );
    expect(frameOf(variant?.root)?.sizing.vertical).toEqual(FILL);
  });
});

// Oracle: CSS Flexbox 1 §9.4 step 11, where an unset `align-items` stretches an auto-width item across
// a column. A column that hugs its width is as wide as its widest layer, and Figma shrinks a layer
// that fills a hugging frame, so the stretch has no Figma form and the missing alignment fails the gate.
// A column that holds one layer is that layer's width (§9.2), so its stretch moves nothing.
describe("a flex column", () => {
  it("draws a column that hugs its one layer as it is, with no align-items missing", async () => {
    const { coverage } = await buildWithDot("flex flex-col", "h-[4px]");
    expect(coverage.filter((row) => row.property === "align-items" && row.outcome === "unmapped")).toEqual(
      []
    );
  });

  it("records the alignment a column that hugs its width is missing around two layers", async () => {
    const { variant, coverage } = await buildChip(
      "flex flex-col",
      [
        { slot: "chip-dot", classes: "h-[4px]" },
        { slot: "chip-end", classes: "h-[4px]" },
      ],
      { parts: [part(), part({ key: "end", slot: "chip-end" })] }
    );
    expect(
      variant?.root.children.map((child) => (child.kind === "frame" ? child.sizing.horizontal : undefined))
    ).toEqual([HUG, HUG]);
    expect(coverage).toContainEqual(
      expect.objectContaining({ className: "flex-col", property: "align-items", outcome: "unmapped" })
    );
  });
});

// Oracle: CSS Sizing 3. A percentage takes the parent's content box. Where the parent's length is
// definite, `100%` is that whole length, which Figma's FILL draws across the parent's direction, and
// along it for the parent's only layer. Where the parent's length depends on its content, the
// percentage is cyclic and behaves as auto, which Figma cannot follow, so it stays unmapped. A share
// other than the whole has no Figma field.
describe("a part with a percentage length", () => {
  async function build(rootClasses: string, dot: string, siblings: readonly FixtureElement[] = []) {
    const parts = [part(), ...siblings.map((_, at) => part({ key: `end-${String(at)}`, slot: "chip-end" }))];
    const { variant, coverage } = await buildChip(
      rootClasses,
      [{ slot: "chip-dot", classes: dot }, ...siblings],
      {
        parts,
      }
    );
    return {
      frame: frameOf(variant?.root),
      rows: coverage
        .filter((row) => row.part === "chip-dot" && (row.property === "width" || row.property === "height"))
        .map((row) => [row.className, row.property, row.outcome]),
    };
  }

  it("fills a fixed row it holds alone", async () => {
    const { frame, rows } = await build("flex w-[100px]", "w-full h-[4px]");
    expect(frame?.sizing).toEqual({ horizontal: FILL, vertical: fixed(literal(4)) });
    expect(rows).toContainEqual(["w-full", "width", "literal"]);
  });

  it("fills across a fixed column it shares", async () => {
    const { frame } = await build("flex flex-col w-[100px]", "w-full h-[4px]", [
      { slot: "chip-end", classes: "w-[20px] h-[4px]" },
    ]);
    expect(frame?.sizing.horizontal).toEqual(FILL);
  });

  it("fills the height of a parent with a fixed height", async () => {
    const { frame } = await build("flex h-[20px]", "h-full w-[4px]");
    expect(frame?.sizing).toEqual({ horizontal: fixed(literal(4)), vertical: FILL });
  });

  it("stays unmapped in a parent that hugs its width", async () => {
    const { frame, rows } = await build("flex", "w-full h-[4px]");
    expect(frame?.sizing.horizontal).toEqual(HUG);
    expect(rows).toContainEqual(["w-full", "width", "unmapped"]);
  });

  it("leaves a share other than the whole unmapped", async () => {
    const { frame, rows } = await build("flex w-[100px]", "w-[50%] h-[4px]");
    expect(frame?.sizing.horizontal).toEqual(HUG);
    expect(rows).toContainEqual(["w-[50%]", "width", "unmapped"]);
  });
});

// Oracle: CSS Sizing 3, where a root's percentage width takes its container's width, which the
// manifest names as the width the preview gives it. A variant root sits in its component set, which
// has no auto layout, so the width is fixed. CSS 2.1 §10.3.3: a block-level box with no width fills
// its containing block, as a `flex` column does, while an `inline-flex` box shrinks to fit.
describe("a root's percentage width against the preview width", () => {
  it("resolves 100% to the preview width", async () => {
    const { variant, coverage } = await buildChip("w-full", [], { previewWidth: 384 });
    expect(variant?.root.sizing.horizontal).toEqual(fixed(literal(384)));
    expect(coverage.map((row) => [row.className, row.outcome, row.detail])).toEqual([
      ["w-full", "literal", "384px, the preview width that 100% takes"],
    ]);
  });

  it("resolves a share to that share of the preview width", async () => {
    const { variant, coverage } = await buildChip("w-1/2", [], { previewWidth: 384 });
    expect(variant?.root.sizing.horizontal).toEqual(fixed(literal(192)));
    expect(coverage.map((row) => [row.className, row.outcome, row.detail])).toEqual([
      ["w-1/2", "literal", "192px, 50% of the preview width"],
    ]);
  });

  it("leaves a length that depends on a percentage unmapped", async () => {
    const { coverage } = await buildChip("w-[calc(100%-4px)]", [], { previewWidth: 384 });
    expect(coverage.map((row) => row.outcome)).toEqual(["unmapped"]);
  });

  it.each([
    ["flex flex-col", fixed(literal(256))],
    ["inline-flex", HUG],
  ])("gives a %s root with no width %o", async (classes, horizontal) => {
    const { variant } = await buildChip(classes, [], { previewWidth: 256 });
    expect(variant?.root.sizing.horizontal).toEqual(horizontal);
  });
});

// Oracle: CSS Grid, where a grid with no template puts each child in a row of its own, and
// `place-content: center` centers the rows on both axes: one child is a box centered both ways, as an
// auto layout with CENTER on both axes draws it, while two stack in two rows, which it does not draw.
describe("a grid that centers its content", () => {
  async function build(icons: number) {
    const svgs = Array.from({ length: icons }, () => ({ tag: "svg", fromParent: "[&_svg]:size-[12px]" }));
    const manifestIcons = [ICON, { ...ICON, key: "second" }].slice(0, icons);
    const { variant, coverage } = await buildChip(
      "text-[#000000]",
      [{ slot: "chip-dot", classes: "grid place-content-center size-[16px]", children: svgs }],
      { parts: [part({ iconsFor: () => manifestIcons })] }
    );
    const rows = coverage
      .filter((row) => row.className === "grid" || row.className === "place-content-center")
      .map((row) => `${row.className}: ${row.outcome}`)
      .toSorted();
    return { frame: frameOf(variant?.root), rows };
  }

  it("centers its one layer on both axes", async () => {
    const { frame, rows } = await build(1);
    expect(frame).toEqual(expect.objectContaining({ primaryAlign: "CENTER", counterAlign: "CENTER" }));
    expect(rows).toEqual(["grid: literal", "place-content-center: literal"]);
  });

  it("is unmapped when it holds more than one layer", async () => {
    const { rows } = await build(2);
    expect(rows).toEqual(["grid: unmapped", "place-content-center: unmapped"]);
  });
});

// Oracle: CSS Grid 1 §11.5 and §11.8, CSS Box Alignment 3 §6.1, and Chromium. A grid's one `auto`
// column stretches to the grid's content width, but never below its widest item's least width:
// Chromium lays a 256px grid whose flex-column item holds a 400px box out with a 400px column and a
// 400px item. So the column draws only where the capture measured it as wide as the grid
// (`trackFits`). An `auto` row takes the free space of a grid of fixed height: in a 40px grid one
// 4px item's `auto` row is 40px in Chromium, and `items-center` centres the item in it, where a
// packed column would draw it at the top. Where the grid's height hugs its rows, each row is its
// item's height, so the row size and the alignment place nothing.
describe("a grid in one column", () => {
  async function build(classes: string, item: FixtureElement, measured: MeasuredFacts) {
    const { variant, coverage } = await buildCaptured(
      chip({ parts: [part({ parts: [part({ key: "inner", slot: "inner" })] })], previewWidth: 256 }),
      rest({ slot: "chip", classes, children: [item], measured })
    );
    const rows = coverage
      .filter(
        (row) => row.part === "chip" && ["display", "grid-auto-rows", "align-items"].includes(row.property)
      )
      .map((row) => `${row.property}: ${row.outcome}`)
      .toSorted();
    return { root: variant?.root, rows };
  }

  const ITEM: FixtureElement = { slot: "chip-dot", classes: "h-[4px]", children: [{ slot: "inner" }] };
  const FITS: MeasuredFacts = { trackFits: true };

  it("draws a column whose items fill across where its rows hug, and drops the row size and alignment", async () => {
    const { root, rows } = await build("grid auto-rows-min items-start", ITEM, FITS);
    expect(root?.direction).toEqual("VERTICAL");
    expect(
      root?.children.map((child) => (child.kind === "frame" ? child.sizing.horizontal : undefined))
    ).toEqual([FILL]);
    expect(rows).toEqual(["align-items: dropped", "display: literal", "grid-auto-rows: dropped"]);
  });

  it.each([
    [
      "hugs its rows",
      "grid auto-rows-auto items-center",
      ["align-items: dropped", "display: literal", "grid-auto-rows: dropped"],
    ],
    [
      "is 40px tall, where the row takes the free space",
      "grid auto-rows-auto items-center h-[40px]",
      ["align-items: unmapped", "display: unmapped", "grid-auto-rows: unmapped"],
    ],
  ])("with auto rows centring its item, maps only where it %s", async (_case, classes, expected) => {
    const { rows } = await build(classes, ITEM, FITS);
    expect(rows).toEqual(expected);
  });

  it("stays unmapped where its column is wider than the grid, as an item's least width makes it", async () => {
    const wide: FixtureElement = {
      slot: "chip-dot",
      classes: "flex flex-col",
      children: [{ slot: "inner", classes: "w-[400px] h-[10px]" }],
    };
    // The capture records no `trackFits` here, since the column is wider than the grid.
    const { root, rows } = await build("grid auto-rows-min items-start w-[256px]", wide, {});
    expect(rows).toContain("display: unmapped");
    expect(
      root?.children.map((child) => (child.kind === "frame" ? child.sizing.horizontal : undefined))
    ).not.toEqual([FILL]);
  });
});

// Oracle: CSS Containment 2 §3.2, CSS Flexbox 1 §4.5 and Chromium. Inline-size containment sizes a
// box's width as if it held nothing, and so drops a flex item's content-based minimum: in a 100px
// row, two `w-[100px]` items each holding a 200px box stay 100px wide, and with `@container` Chromium
// shrinks them to 50px. A width a column stretches across, or a block-level root's width in its
// block host, reads no content, so the containment changes nothing there. A box that hugs, a growing
// flex item and a declared width read content or a share of the row, so it stays unmapped.
describe("an inline-size container", () => {
  it("drops the containment on a block-level root its preview's host sets the width of", async () => {
    const { coverage } = await buildChip("@container flex flex-col", [], { previewWidth: 256 });
    expect(notesOf(coverage, "@container")).toEqual([
      [
        "container-type",
        "dropped",
        "the root is block-level in the preview's block host, which sets its width",
      ],
    ]);
  });

  it("drops the containment on a part a column stretches across", async () => {
    const { coverage } = await buildWithDot("flex flex-col w-[256px]", "@container h-[4px]");
    expect(notesOf(coverage, "@container")).toEqual([
      [
        "container-type",
        "dropped",
        "a column, a grid in one column or a block stretches the box across, which no content sizes",
      ],
    ]);
  });

  it.each([
    ["a root that hugs its width", () => buildChip("@container inline-flex")],
    ["a growing flex item", () => buildWithDot("flex w-[256px]", "@container flex-1 h-[4px]")],
    [
      "a shrinkable flex item of declared width",
      () =>
        buildCaptured(
          chip({ parts: [part({ parts: [part({ key: "inner", slot: "inner" })] })] }),
          rest({
            slot: "chip",
            classes: "flex w-[100px]",
            children: [
              {
                slot: "chip-dot",
                classes: "@container w-[100px] flex flex-col",
                children: [{ slot: "inner", classes: "w-[200px] h-[10px]" }],
              },
            ],
          })
        ),
    ],
  ])("leaves the containment unmapped on %s", async (_case, build) => {
    const { coverage } = await build();
    expect(notesOf(coverage, "@container").map(([, outcome]) => outcome)).toEqual(["unmapped"]);
  });
});

// Oracle: CSS. A `relative` box stays where the flow puts it and only anchors positioned descendants,
// which an auto layout has none of. `align-self` places a flex item across its parent's line, and a
// component's root sits in no line: `auto` asks for nothing, while `stretch` asks for a length the
// root does not have. `flex` grows or shrinks a flex item along its line (CSS Flexbox 1 §7).
describe("a box's position and alignment", () => {
  async function rowsOf(classes: string) {
    const { coverage } = await buildChip(classes);
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

  it("drops self-auto on the root, which sits in no row", async () => {
    expect(await rowsOf("self-auto")).toEqual([
      ["self-auto", "dropped", "the component's root sits in no row, and auto asks for no alignment"],
    ]);
  });

  it("leaves self-stretch unmapped", async () => {
    expect(await rowsOf("self-stretch")).toEqual([["self-stretch", "unmapped", expect.any(String)]]);
  });
});

// Oracle: CSS 2.1 §8.3 and §10.3.3, and CSS Logical Properties 1 §4. A margin lies outside the box's
// border; a left-to-right page puts `mx-1`'s inline sides on the left and the right, and a `margin`
// of two values sets the top and bottom to the first and the left and right to the second.
// A root that is a block whose width its container gives it is the container's width less its
// horizontal margins, and a block with a width of its own keeps it.
describe("a box's margin", () => {
  it("draws a logical margin as the physical sides it sets", async () => {
    const { variant } = await buildWithDot("flex", "size-[8px] mx-1");
    const frame = frameOf(variant?.root);
    expect([frame?.paddingLeft, frame?.paddingRight, frame?.paddingTop]).toEqual([
      literal(4),
      literal(4),
      literal(0),
    ]);
  });

  it("draws a margin shorthand's sides, vertical then horizontal, as the box's padding round the part", async () => {
    const { variant } = await buildChip(
      "flex",
      [
        {
          slot: "chip-dot",
          classes: "size-[8px]",
          written: [{ className: "inline style", property: "margin", value: "4px 2px", source: "inline" }],
        },
      ],
      { parts: [part()] }
    );
    const frame = frameOf(variant?.root);
    expect([frame?.paddingTop, frame?.paddingRight, frame?.paddingBottom, frame?.paddingLeft]).toEqual([
      literal(4),
      literal(2),
      literal(4),
      literal(2),
    ]);
  });

  it.each([
    ["a negative margin", "flex", "size-[8px] -mt-1", "-mt-1", "margin-top"],
    ["a margin in a parent that is no flex box", "block", "size-[8px] mt-1", "mt-1", "margin-top"],
    [
      "a margin beside a fill down a column",
      "flex flex-col h-[100px]",
      "flex-1 w-[8px] mt-1",
      "mt-1",
      "margin-top",
    ],
  ])("leaves %s on a part unmapped", async (_, parent, part, className, property) => {
    const { coverage } = await buildWithDot(parent, part);
    expect(notesOf(coverage, className)).toEqual([[property, "unmapped", expect.any(String)]]);
  });

  it("subtracts a margin that reads a variable holding one length in every mode", async () => {
    const variables = makeVariableIndex([
      {
        ref: { collection: "Fuse density", name: "surface-pad-sm" },
        webSyntax: "var(--surface-pad-sm)",
        minimum: 4,
        maximum: 4,
      },
    ]);
    const { variant } = await buildChip(
      "block -mx-(--surface-pad-sm)",
      [],
      { previewWidth: 144 },
      { variables }
    );
    expect(variant?.root.sizing.horizontal).toEqual(fixed(literal(152)));
  });

  // A flex item's margins add to the space around it (CSS Flexbox 1 §4.2), so Toast's `mt-0.5` icon
  // in an `items-start` row sits 2px below the row's top, where a frame padded 2px above it puts it.
  it("draws an icon's margin in a flex row as the padding of a frame that holds the icon", async () => {
    const { variant, coverage } = await buildChip(
      "flex items-start text-[#000000]",
      [{ tag: "svg", classes: "size-4 mt-0.5 shrink-0" }],
      { iconsFor: () => [ICON] }
    );
    const [frame] = variant?.root.children ?? [];
    expect(
      frame?.kind === "frame"
        ? [frame.name, frame.paddingTop, frame.paddingBottom, frame.children.map((child) => child.kind)]
        : frame
    ).toEqual(["Icon", literal(2), literal(0), ["icon"]]);
    expect(notesOf(coverage, "mt-0.5").map(([property, outcome]) => [property, outcome])).toEqual([
      ["margin-top", "literal"],
    ]);
  });

  // The icon draws as `box` inside its margin frame, so in an instance a changed glyph color is an
  // override at that layer, and a changed margin is the frame's padding, which no instance field
  // carries (Figma plugin typings: an instance overrides fills, not auto layout padding).
  describe("in an instance of a set that holds it", () => {
    const badge = chip({ key: "review-badge", name: "Review badge", slot: "badge", iconsFor: () => [ICON] });
    const icon = (classes: string): FixtureElement => ({
      slot: "badge",
      classes: "flex items-start",
      children: [{ tag: "svg", classes: `size-4 shrink-0 ${classes}` }],
    });
    const inOuter = (classes: string) =>
      buildCaptured(
        chip({
          parts: [instanceOf("badge", badge)],
        }),
        rest({ slot: "chip", classes: "flex", children: [icon(classes)] }),
        { inner: [{ manifest: badge, cells: rest(icon("mt-0.5 text-[#000000]")) }] }
      );

    it("overrides the color of the icon inside the frame", async () => {
      const { variant, coverage } = await inOuter("mt-0.5 text-[#ff0000]");
      const [instance] = variant?.root.children ?? [];
      expect(instance?.kind === "instance" ? instance.overrides : instance).toEqual([
        {
          path: ["icon", "box"],
          field: "glyph",
          color: { kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } },
        },
      ]);
      expect(notesOf(coverage, "text-[#ff0000]").map(([property, outcome]) => [property, outcome])).toEqual([
        ["color", "literal"],
      ]);
    });

    it("leaves a changed margin unmapped, since it is the frame's padding", async () => {
      const { variant, coverage } = await inOuter("mt-1 text-[#000000]");
      const [instance] = variant?.root.children ?? [];
      expect(instance?.kind === "instance" ? instance.overrides : instance).toBeUndefined();
      expect(notesOf(coverage, "mt-1").map(([property, outcome]) => [property, outcome])).toEqual([
        ["margin-top", "unmapped"],
      ]);
    });
  });

  it("leaves an icon's margin unmapped in a parent that is no flex box, where it sits in a line of text", async () => {
    const { variant, coverage } = await buildChip(
      "block text-[#000000]",
      [{ tag: "svg", classes: "size-4 mt-0.5" }],
      { iconsFor: () => [ICON] }
    );
    expect(variant?.root.children[0]?.kind).toBe("icon");
    expect(notesOf(coverage, "mt-0.5").map(([property, outcome]) => [property, outcome])).toEqual([
      ["margin-top", "unmapped"],
    ]);
  });

  it("drops the horizontal margins of a block whose width is its own", async () => {
    const { coverage } = await buildChip("block w-[200px] mx-[16px]", [], { previewWidth: 384 });
    expect(notesOf(coverage, "mx-[16px]").map(([property, outcome]) => [property, outcome])).toEqual([
      ["margin-left", "dropped"],
      ["margin-right", "dropped"],
    ]);
  });
});

// Oracle: CSS 2.1 §10.4 and §10.7. The used width is the width lowered to `max-width` and then raised
// to `min-width`, and the used height follows the same rule. Beside a fixed length a limit resolves
// into the length or changes nothing; beside a length that hugs or fills it bounds the length, as
// Figma's limits do. The plugin typings require a positive limit, and Figma's auto layout never
// shrinks a layer, so a zero minimum has nothing to keep.
describe("a box's limits", () => {
  async function build(classes: string, options: FixtureOptions = {}) {
    const { variant, coverage } = await buildChip(classes, [], {}, options);
    return {
      root: variant?.root,
      rows: coverage
        .filter((row) => /^(?:min|max)-(?:width|height)$/.test(row.property))
        .map((row) => [row.className, row.outcome, row.detail]),
    };
  }

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
    const { variant } = await buildWithDot("flex w-[100px]", "w-full max-w-[40px]");
    expect(frameOf(variant?.root)).toEqual(
      expect.objectContaining({
        sizing: { horizontal: FILL, vertical: HUG },
        limits: { ...UNLIMITED, maxWidth: literal(40) },
      })
    );
  });

  it.each(["max-w-[0px]", "max-h-[0px]"])("leaves %s unmapped beside a length that hugs", async (max) => {
    const { root, rows } = await build(max);
    expect(root?.limits).toEqual(UNLIMITED);
    expect(rows).toEqual([[max, "unmapped", expect.any(String)]]);
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

// Oracle: CSS Overflow 3, where `overflow: hidden` clips a box's content at its padding box, as a
// Figma frame's `clipsContent` does.
describe("a box that hides its overflow", () => {
  it("reads overflow-hidden on the root, which clips anyway", async () => {
    const { variant, coverage } = await buildChip("overflow-hidden");
    expect(variant?.root.clips).toBe(true);
    expect(coverage.map((row) => [row.className, row.outcome])).toEqual([["overflow-hidden", "literal"]]);
  });
});

// Oracle: Tailwind emits no CSS for `group`, `group/<name>`, `peer` or `peer/<name>`. Each only names
// an element another element's variant reads, so it has nothing to draw.
describe("a marker class", () => {
  it.each(["group", "group/chip", "peer", "peer/chip"])(
    "drops %s, which styles nothing",
    async (className) => {
      const { coverage } = await buildCaptured(chip(), rest({ slot: "chip", carried: className }));
      expect(coverage).toEqual([expect.objectContaining({ className, outcome: "dropped" })]);
    }
  );
});

// Oracle: CSS Backgrounds 3, which scales down corner radii whose sum exceeds a side, so any radius
// above half the shorter side draws as that half: 8px on a 16px side, 3px on a 6px one. Probe P10
// (2026-10-22) showed Figma draws a radius the same way. A box that hugs both sides has no length to
// halve before layout.
describe("a pill corner", () => {
  async function build(classes: string) {
    const { variant, coverage } = await buildChip(classes);
    return {
      corner: variant?.root.cornerRadius,
      rows: coverage
        .filter((row) => row.className === "rounded-full")
        .map((row) => [row.outcome, row.detail]),
    };
  }

  it("reads as half the fixed side of a box that hugs the other side", async () => {
    expect(await build("h-[16px] rounded-full")).toEqual({
      corner: literal(8),
      rows: [["literal", "8px, half the fixed height, which Figma and CSS cap at half the shorter side"]],
    });
  });

  it("reads as half the fixed side of a part that fills the other side", async () => {
    const { variant } = await buildWithDot("flex w-[100px]", "w-full h-[6px] rounded-full");
    expect(frameOf(variant?.root)?.cornerRadius).toEqual(literal(3));
  });

  it("is unmapped on a box that hugs both sides", async () => {
    expect((await build("rounded-full")).rows).toEqual([["unmapped", expect.any(String)]]);
  });
});

// Oracle: CSS Sizing 4, under which `aspect-ratio` sizes a box only through a side it leaves
// automatic: with both sides fixed it changes nothing, and with one side hugging it would size that
// side, which a Figma frame cannot follow.
describe("an aspect ratio", () => {
  it.each([
    ["size-[16px] aspect-square", "dropped"],
    ["h-[16px] aspect-square", "unmapped"],
  ])("on %s is %s", async (classes, outcome) => {
    const { coverage } = await buildChip(classes);
    expect(coverage.filter((row) => row.className === "aspect-square").map((row) => row.outcome)).toEqual([
      outcome,
    ]);
  });
});

/** A synced line height, which a box's `lh` lengths read as its text style does. */
const LEADING = makeVariableIndex([
  {
    ref: { collection: "Fuse density", name: "paragraph-leading-base" },
    webSyntax: "var(--paragraph-leading-base)",
    minimum: 24,
    maximum: 28,
  },
]);

/** The number field that binds the variable of {@link LEADING}. */
const PARAGRAPH_LEADING = {
  kind: "variable",
  variable: { collection: "Fuse density", name: "paragraph-leading-base" },
} as const;

// Oracle: CSS Sizing 4 §4.2 and §4.3, CSS Flexbox 1 §9.7 and probe PG18. A box with a preferred
// aspect ratio and an automatic height takes its height from its width, so a 200px `aspect-16/9` box
// is 112.5px tall and a 40px `aspect-square` box 40px, and content taller than that grows an
// `overflow: visible` box past it. A flex row can shrink the box below its `width`, and the height
// follows the shrunk width, so a 200px box the capture measured at 100 by 56.25 is no 112.5px box.
// The capture's `ratio` holds the height set and the border box the browser drew in every mode, so
// without it, with a box of another width, or with a minimum or maximum height of the box's own, the
// ratio stays unmapped. A height of `auto` is no height of the box's own. Figma's `lockAspectRatio()`
// on a 448 by 252 main reads back as that width and height, so the lock is the box's own lengths.
describe("an aspect ratio beside a fixed width", () => {
  /** Build a chip that wins `classes`, with the capture's facts on its root. */
  async function build(classes: string, measured: MeasuredFacts) {
    const { variant, coverage } = await buildCaptured(chip(), rest({ slot: "chip", classes, measured }));
    const rows = coverage.filter((row) => row.property === "aspect-ratio").map((row) => row.outcome);
    return { sizing: variant?.root.sizing, lock: variant?.root.aspectLock, rows };
  }

  /** The capture's fact for a box of `width` by `height`. */
  const drawn = (width: number, height: number): MeasuredFacts => ({
    ratio: { sets: "height", width, height },
  });

  it.each([
    ["w-[200px] aspect-16/9", 200, 112.5],
    ["w-[40px] aspect-square", 40, 40],
    ["w-[90px] aspect-[2/3]", 90, 135],
  ])("draws %s as %spx wide and %spx tall, locked at that ratio", async (classes, width, height) => {
    expect(await build(classes, drawn(width, height))).toEqual({
      sizing: fixedSize(literal(width), literal(height)),
      lock: { width, height },
      rows: ["literal"],
    });
  });

  it("draws an auto height as the ratio's, and says so on its row", async () => {
    const { variant, coverage } = await buildCaptured(
      chip(),
      rest({ slot: "chip", classes: "w-[40px] h-auto aspect-square", measured: drawn(40, 40) })
    );
    expect({ sizing: variant?.root.sizing, rows: notesOf(coverage, "h-auto") }).toEqual({
      sizing: fixedSize(literal(40), literal(40)),
      rows: [["height", "literal", "auto, so the aspect ratio sets the height from the width"]],
    });
  });

  it.each([
    ["the capture measured no ratio height", "w-[200px] aspect-16/9", {}],
    ["a flex row shrank the box to 100px", "w-[200px] aspect-16/9", drawn(100, 56.25)],
    ["the box hugs its width", "aspect-16/9", drawn(200, 112.5)],
    ["the box sets a minimum height", "w-[200px] min-h-[10px] aspect-16/9", drawn(200, 112.5)],
    ["the box sets a maximum height", "w-[200px] max-h-[200px] aspect-16/9", drawn(200, 112.5)],
  ])("stays unmapped, with the height hugging, where %s", async (_case, classes, measured) => {
    const { sizing, lock, rows } = await build(classes, measured);
    expect({ vertical: sizing?.vertical, lock, rows }).toEqual({
      vertical: HUG,
      lock: undefined,
      rows: ["unmapped"],
    });
  });
});

// Oracle: CSS Sizing 4 §4.2 and §5.1, CSS Flexbox 1 §9.7. A box with a preferred aspect ratio and an
// automatic width takes its width from a definite height, so a 24px `aspect-square` box is 24px wide
// and a 90px `aspect-[2/3]` box 60px. Content wider than that keeps the box wider through its
// automatic minimum, and a flex row can shrink it, so the build takes the width only where the
// capture's `ratio` holds the width set and the border box the browser drew in every mode, and only
// on a box with no width, minimum or maximum width of its own.
describe("an aspect ratio beside a fixed height", () => {
  /** Build a chip that wins `classes`, with the capture's facts on its root. */
  async function build(classes: string, measured: MeasuredFacts) {
    const { variant, coverage } = await buildCaptured(chip(), rest({ slot: "chip", classes, measured }));
    const rows = coverage.filter((row) => row.property === "aspect-ratio").map((row) => row.outcome);
    return { sizing: variant?.root.sizing, lock: variant?.root.aspectLock, rows };
  }

  /** The capture's fact for a box of `width` by `height`. */
  const drawn = (width: number, height: number): MeasuredFacts => ({
    ratio: { sets: "width", width, height },
  });

  it.each([
    ["h-[24px] aspect-square", 24, 24],
    ["h-[90px] aspect-[2/3]", 60, 90],
  ])("draws %s as %spx wide and %spx tall, locked at that ratio", async (classes, width, height) => {
    expect(await build(classes, drawn(width, height))).toEqual({
      sizing: fixedSize(literal(width), literal(height)),
      lock: { width, height },
      rows: ["literal"],
    });
  });

  it("says on an auto width's row that the ratio sets it", async () => {
    const { coverage } = await buildCaptured(
      chip(),
      rest({ slot: "chip", classes: "w-auto h-[24px] aspect-square", measured: drawn(24, 24) })
    );
    expect(notesOf(coverage, "w-auto")).toEqual([
      ["width", "literal", "auto, so the aspect ratio sets the width from the height"],
    ]);
  });

  // A synced line height gives the height a variable, which no literal width from the ratio follows,
  // so the auto width hugs and its row says so.
  it("stays unmapped, with the width hugging, beside a height a synced line height binds", async () => {
    const { variant, coverage } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "leading-(--paragraph-leading-base) h-lh w-auto aspect-square",
        measured: drawn(24, 24),
      }),
      { variables: LEADING }
    );
    expect({
      sizing: variant?.root.sizing,
      lock: variant?.root.aspectLock,
      rows: coverage.filter((row) => row.property === "aspect-ratio").map((row) => row.outcome),
      auto: notesOf(coverage, "w-auto"),
    }).toEqual({
      sizing: { horizontal: HUG, vertical: fixed(PARAGRAPH_LEADING) },
      lock: undefined,
      rows: ["unmapped"],
      auto: [["width", "literal", "the box hugs its content"]],
    });
  });

  // A minimum width of the box's own keeps the ratio from the width in the build, so the auto width
  // hugs, though the capture measured the ratio setting it.
  it("says an auto width hugs beside a minimum width of the box's own", async () => {
    const { variant, coverage } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "inline-flex w-auto min-w-0 h-[24px] aspect-square",
        measured: drawn(24, 24),
      })
    );
    expect({
      horizontal: variant?.root.sizing.horizontal,
      rows: coverage.filter((row) => row.property === "aspect-ratio").map((row) => row.outcome),
      auto: notesOf(coverage, "w-auto"),
    }).toEqual({
      horizontal: HUG,
      rows: ["unmapped"],
      auto: [["width", "literal", "the box hugs its content"]],
    });
  });

  it.each([["the capture measured no ratio width", "h-[24px] aspect-square", {}]])(
    "stays unmapped, with the width hugging, where %s",
    async (_case, classes, measured) => {
      const { sizing, lock, rows } = await build(classes, measured);
      expect({ horizontal: sizing?.horizontal, lock, rows }).toEqual({
        horizontal: HUG,
        lock: undefined,
        rows: ["unmapped"],
      });
    }
  );
});

// Oracle: CSS Values 4 §6.1.1, under which `lh` is the element's own computed line height: a length,
// or a unitless number times the element's font size. A `normal` line height comes from the face's
// metrics, which the build does not know, so a length in `lh` beside it stays unmapped.
describe("a height in lh", () => {
  it.each([
    ["leading-[20px] h-lh", 20],
    ["text-[10px] leading-[1.5] h-lh", 15],
    ["leading-[20px] h-[2lh]", 40],
    // A length over a length is a number (CSS Values 4, type checking), so the line height is 1.5 times 16px.
    ["text-[16px] leading-[calc(24px/16px)] h-lh", 24],
    // A length times a length over a length is a length, so the line height is 48px whatever the font size.
    ["text-[16px] leading-[calc(24px*16px/8px)] h-lh", 48],
    ["text-[16px] leading-[calc(24px*2px/1px)] h-lh", 48],
  ])("draws %s %spx tall", async (classes, height) => {
    const { variant } = await buildChip(classes);
    expect(variant?.root.sizing.vertical).toEqual(fixed(literal(height)));
  });

  // Tailwind's `text-sm` sets its line height as `calc()` over two numbers, which multiplies its
  // 14px font size, so the 20px height reads the font size as well as the line height.
  it("reads the font size a calc() line height multiplies", async () => {
    const { variant, coverage } = await buildChip("text-sm h-lh");
    expect({
      height: variant?.root.sizing.vertical,
      rows: notesOf(coverage, "text-sm").map(([property, outcome]) => [property, outcome]),
    }).toEqual({
      height: fixed(literal(20)),
      rows: [
        ["font-size", "literal"],
        ["line-height", "literal"],
      ],
    });
  });

  // The build reads only a plain count of lines, so a `calc()` over `lh` stays unmapped: 1lh - 32px
  // is negative, which CSS clamps to zero (CSS Values 4, range checking), 1lh - 23.996px is 0.004px,
  // under Figma's 0.01px resize minimum, 1lh - 100% depends on the viewport's height, and beside a
  // negative line height, which CSS clamps to zero (CSS Inline 3, `line-height`), Chromium draws
  // 1lh + 12px 12px tall. A line height of 24px times 2px is an area, which no line height holds,
  // and one line of 0.004px is under the 0.01px too. A percentage line height computes against the
  // font size where it is declared, which the build does not follow.
  it.each([
    ["leading-[0.004px] h-lh", {}],
    ["text-[16px] leading-[150%] h-lh", {}],
    ["leading-[24px] h-[calc(1lh-32px)]", {}],
    ["leading-[24px] h-[calc(1lh-23.996px)]", {}],
    ["fixed leading-[24px] h-[calc(1lh-100%)]", { viewport: { width: 100, height: 100 } }],
    ["leading-[calc(-1*2px)] h-[calc(1lh+12px)]", {}],
    ["leading-[calc(24px*2px)] h-lh", {}],
  ])("stays unmapped as %s", async (classes, fields) => {
    const { variant, coverage } = await buildChip(classes, [], fields);
    expect({
      height: variant?.root.sizing.vertical,
      rows: coverage.filter((row) => row.property === "height").map((row) => row.outcome),
    }).toEqual({ height: HUG, rows: ["unmapped"] });
  });

  // An `em` line height computes on the element that declares it, and a child inherits that length
  // (CSS Inline 3, `line-height`): 1.25em at the parent's 20px is 25px, where the child's own 16px gives 20px.
  it("stays unmapped on a part that inherits an em line height", async () => {
    const { variant, coverage } = await buildWithDot("text-[20px] leading-[1.25em]", "text-[16px] h-lh");
    expect({
      part: frameOf(variant?.root)?.sizing.vertical,
      rows: notesOf(coverage, "h-lh").map(([property, outcome]) => [property, outcome]),
    }).toEqual({ part: HUG, rows: [["height", "unmapped"]] });
  });

  it("stays unmapped beside a normal line height", async () => {
    const { variant, coverage } = await buildChip("text-[10px] leading-[normal] h-lh");
    expect(variant?.root.sizing.vertical).toEqual(HUG);
    expect(coverage.filter((row) => row.property === "height").map((row) => row.outcome)).toEqual([
      "unmapped",
    ]);
  });

  // `inherit` takes the parent's computed height, and CSS computes the parent's `1lh` at the parent's
  // own 24px line height, so the part is 24px tall whatever its own 12px line height.
  it("stays unmapped on a part that inherits it", async () => {
    const { variant, coverage } = await buildWithDot("leading-[24px] h-lh", "leading-[12px] h-[inherit]");
    expect({
      part: frameOf(variant?.root)?.sizing.vertical,
      rows: notesOf(coverage, "h-[inherit]").map(([property, outcome]) => [property, outcome]),
    }).toEqual({ part: HUG, rows: [["height", "unmapped"]] });
  });

  // A synced line height holds a length per mode, so `1lh` is that variable's length in each mode.
  // Two lines are twice it, which no Figma field binds.

  it("binds the synced line height a box sets, one line tall", async () => {
    const { variant, coverage } = await buildChip(
      "leading-(--paragraph-leading-base) h-lh",
      [],
      {},
      {
        variables: LEADING,
      }
    );
    expect({
      height: variant?.root.sizing.vertical,
      rows: notesOf(coverage, "h-lh").map(([property, outcome]) => [property, outcome]),
    }).toEqual({
      height: fixed(PARAGRAPH_LEADING),
      rows: [["height", "bound"]],
    });
  });

  it("stays unmapped two synced lines tall", async () => {
    const { variant, coverage } = await buildChip(
      "leading-(--paragraph-leading-base) h-[2lh]",
      [],
      {},
      {
        variables: LEADING,
      }
    );
    expect({
      height: variant?.root.sizing.vertical,
      rows: notesOf(coverage, "h-[2lh]").map(([property, outcome]) => [property, outcome]),
    }).toEqual({ height: HUG, rows: [["height", "unmapped"]] });
  });
});

// Oracle: CSS. `top-1/2 left-1/2` put an absolute part's corner at its containing block's center, and
// the -50% translate moves it back by half its own size, so its center lands on the block's center,
// which a parent that centers its one layer on both axes draws. A parent that packs it at the start
// does not, and a lone offset moves the part in a way no auto layout field holds.
describe("a part centered by absolute position", () => {
  const CENTERED = "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[8px]";
  const PLACEMENT = new Set(["position", "top", "left", "translate"]);

  async function build(parent: string, part: string) {
    const { variant, coverage } = await buildWithDot(parent, part);
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

// Oracle: CSS 2.1 §10.3.7 and CSS Values 4 §10, worked by hand for a 10px arrow in a 200px popup, and
// CSS Transforms 2 §6, under which a turn leaves the box's centre where it was. A `left` of
// `calc(50% - 5px)` puts the arrow's centre at 100px, the popup's centre, as does Tailwind's
// `left-1/2` less the arrow's half width through its translate, and `calc(85% - 35% - 5px)` and
// `calc(255% - 205% - 5px)`, whose shares sum to a half. A `bottom` of -10px and a translate of
// `calc(-50% - 2px)` up put the centre 2px inside the bottom edge, turned or not. A `left` of
// `min(50%, 60px)` puts the centre at 60px in a 200px popup, 40px left of its centre, and at 50px,
// on its centre, in a 100px popup, so no fixed offset from the centre holds it, and a turned arrow
// there has no place. The reader takes the popup's length only in a start inset, so a turned arrow
// at `right: calc(50% - 5px)` has no place either, though CSS centres it.
describe("an absolute part placed by its centre", () => {
  const POPUP = "relative w-[200px] h-[40px]";
  const ARROW = "absolute size-[10px] [bottom:-10px]";
  const AT_CENTRE = { kind: "pivot", edge: "bottom", along: 0, inset: 2 };

  it.each([
    ["[left:calc(50%-5px)] [translate:0px_calc(-50%-2px)] [rotate:-45deg]"],
    ["left-1/2 [translate:-50%_calc(-50%-2px)] [rotate:-45deg]"],
    ["[left:calc(85%-35%-5px)] [translate:0px_calc(-50%-2px)] [rotate:-45deg]"],
    ["[left:calc(255%-205%-5px)] [translate:0px_calc(-50%-2px)] [rotate:-45deg]"],
    ["[left:calc(50%-5px)] [translate:0px_calc(-50%-2px)]"],
    ["[left:calc(50%-5px)] [translate:0px_calc(-50%-2px)] [rotate:none]"],
  ])("hangs from the popup's centre with %s", async (insets) => {
    const { variant } = await buildWithDot(POPUP, `${ARROW} ${insets}`);
    expect(frameOf(variant?.root)?.placement).toEqual(AT_CENTRE);
  });

  // The centre takes the size the box lays out at. `aspect-square` makes an 8px-wide box 8px tall,
  // as the capture measured it, and `max-w-[6px]` makes an 8px square 6px wide, so a `-50% 50%`
  // translate moves the centre back onto the corner that `bottom-0 left-1/2` places. Unmoved, a
  // 4 × 8 box there has its centre 2px right of the popup's centre and 4px inside its bottom edge.
  it.each([
    [
      "an aspect ratio",
      "w-[8px] aspect-square [translate:-50%_50%] [rotate:45deg]",
      { ratio: { sets: "height", width: 8, height: 8 } },
      { edge: "bottom", along: 0, inset: 0 },
    ],
    [
      "a maximum width",
      "size-[8px] max-w-[6px] [translate:-50%_50%] [rotate:45deg]",
      {},
      { edge: "bottom", along: 0, inset: 0 },
    ],
    ["a maximum width and no move", "size-[8px] max-w-[4px]", {}, { edge: "bottom", along: 2, inset: 4 }],
  ] as const)(
    "hangs from the popup's bottom edge by the size %s lays it out at",
    async (_case, sized, measured, at) => {
      const { variant } = await buildChip(
        POPUP,
        [{ slot: "chip-dot", classes: `absolute bottom-0 left-1/2 ${sized}`, measured }],
        { parts: [part()] }
      );
      expect(frameOf(variant?.root)?.placement).toEqual({ kind: "pivot", ...at });
    }
  );

  // `.125turn` is 45deg (CSS Values 4 §7.1), an angle unit the kit does not read, so it cannot draw
  // the part turned about the centre it would place, and leaves the part to the other readers.
  it("leaves a part turned by an angle the kit does not read unplaced, with the build going on", async () => {
    const { variant, coverage } = await buildWithDot(
      POPUP,
      "absolute bottom-0 left-1/2 size-[8px] [rotate:.125turn]"
    );
    expect({
      placement: frameOf(variant?.root)?.placement,
      rows: coverage
        .filter(
          (row) => row.part === "chip-dot" && ["position", "left", "bottom", "rotate"].includes(row.property)
        )
        .map((row) => `${row.property}: ${row.outcome}`)
        .toSorted(),
    }).toEqual({
      placement: undefined,
      rows: ["bottom: unmapped", "left: unmapped", "position: unmapped", "rotate: unmapped"],
    });
  });

  it.each(["-45deg", "90deg"])(
    "fails the build where a cap on the start inset moves a part turned %s as the popup resizes",
    async (turn) => {
      await expect(
        buildWithDot(POPUP, `${ARROW} [left:min(50%,60px)] [translate:-50%_calc(-50%-2px)] [rotate:${turn}]`)
      ).rejects.toThrow("`left: min(50%, 60px)` is no half of the containing block's length");
    }
  );

  it("fails the build where a turned part reads the popup's width from its end inset", async () => {
    await expect(
      buildWithDot(POPUP, `${ARROW} [right:calc(50%-5px)] [translate:0px_calc(-50%-2px)] [rotate:-45deg]`)
    ).rejects.toThrow(
      "`right: calc(50% - 5px)` reads the containing block's length, which the reader takes only in a start inset, `left`"
    );
  });
});

// Oracle: CSS 2.1 §10.1, §10.4 and §10.3.7 to §10.6.4. An absolute box's percentages take its
// containing block, the padding box of its nearest positioned ancestor, sized after its own limits: a
// bar that fills a 256px column up to `max-w-[128px]` is 128px wide, so 85% of it is 108.8px and
// `h-full` 6px, at its top left. Each length is a share of the bar, which keeps it when the bar grows,
// as Figma's SCALE draws (P8): a whole share keeps both of the bar's edges, as STRETCH would.
describe("a part at its positioned parent's top left", () => {
  it("takes its share of a filling parent after the parent's maximum", async () => {
    const fill: PartManifest = part({ key: "fill", slot: "chip-fill" });
    const { variant } = await buildChip(
      "flex flex-col w-[256px]",
      [
        {
          slot: "chip-dot",
          classes: "relative w-full max-w-[128px] h-[6px]",
          children: [{ slot: "chip-fill", classes: "absolute top-0 left-0 w-[85%] h-full" }],
        },
      ],
      { parts: [part({ parts: [fill] })] }
    );
    expect(frameOf(frameOf(variant?.root))).toEqual(
      expect.objectContaining({
        sizing: fixedSize(literal(108.8), literal(6)),
        placement: {
          kind: "edges",
          within: "parent",
          horizontal: { kind: "scale", start: 0 },
          vertical: { kind: "scale", start: 0 },
        },
      })
    );
  });
});

// Oracle: CSS Display. A block box with nothing inside lays nothing out, so it draws as any frame of
// its size does; one that holds a layer stacks it in block flow, which a horizontal auto layout does
// not draw. `flow-root` is block-level (CSS Display 3 §2.1), so a block box stacks it as a `block`.
describe("a block box", () => {
  it.each([
    ["holds no layers", "literal", 0],
    ["holds a layer", "unmapped", 1],
  ])("that %s is %s", async (_case, outcome, icons) => {
    const svgs = Array.from({ length: icons }, () => ({ tag: "svg", fromParent: "[&_svg]:size-[12px]" }));
    const { coverage } = await buildChip("block size-[16px] text-[#000000]", svgs, {
      iconsFor: () => [ICON].slice(0, icons),
    });
    expect(coverage.filter((row) => row.className === "block").map((row) => row.outcome)).toEqual([outcome]);
  });

  it.each(["block", "flow-root"])("stacks a %s part as a block", async (display) => {
    const { coverage } = await buildWithDot("block w-[100px]", `${display} h-[8px]`);
    const root = coverage.filter((row) => row.part === "chip" && row.className === "block");
    expect(root.map((row) => row.outcome)).toEqual(["literal"]);
  });
});

// Oracle: CSS. A flex row with no `justify-content`, or `justify-start`, packs its child at the start
// of its content box, and a translate moves the child's border box by its length, a percentage taking
// the child's own width (CSS Transforms 1). In a 32px row with a 1px border the content box is 30px
// wide, so a 16px part moved 0px sits at the start and one moved 14px, or `calc(100% - 2px)` of
// itself, sits flush with the end, which Figma calls MIN and MAX. A grid with `place-content: center`
// centers its child before the move, so a move of 0 leaves it centered, which no row alignment read
// from the translate draws.
describe("a part translated along its parent's row", () => {
  const ROW = "inline-flex items-center w-[32px] h-[18.4px] border border-[#000000]";
  const AT_END = "at the end of its parent's row, flush with the end of the content box";
  const AT_START = "at the start of its parent's row, where it sits unmoved";

  async function build(row: string, part: string) {
    const { variant, coverage } = await buildWithDot(row, `size-[16px] ${part}`);
    return {
      align: variant?.root.primaryAlign,
      rows: coverage
        .filter((each) => each.part === "chip-dot" && each.property === "translate")
        .map((each) => [each.outcome, each.detail]),
    };
  }

  it.each([
    ["translate-x-[14px]", "MAX", AT_END],
    ["translate-x-[calc(100%-2px)]", "MAX", AT_END],
    ["translate-x-0", "MIN", AT_START],
  ])("reads %s as the row's %s alignment", async (translate, align, detail) => {
    expect(await build(ROW, translate)).toEqual({ align, rows: [["literal", detail]] });
  });

  it.each([
    ["translate-x-0", "MIN", AT_START],
    ["translate-x-[calc(100%-2px)]", "MAX", AT_END],
  ])(
    "reads %s in a row that packs its child at the start as the row's %s alignment",
    async (translate, align, detail) => {
      expect(await build(`${ROW} justify-start`, translate)).toEqual({ align, rows: [["literal", detail]] });
    }
  );

  it("leaves a move in a centering grid unmapped, with the part still centered", async () => {
    expect(await build("grid place-content-center size-[32px]", "block translate-x-0")).toEqual({
      align: "CENTER",
      rows: [["unmapped", expect.any(String)]],
    });
  });
});

// Oracle: CSS Transforms 2. `scale` draws the box's paint at that share of its size around its center
// and leaves its layout size. A 16px circle at 75% paints a 12px circle, radius 6, in the middle of its
// 16px place, and at no scale a 16px circle, radius 8. Figma draws that as a transparent 16px slot
// centering a dot in both cells, so both cells have one layer tree. A 1px dashed border paints 3px
// dashes and 2px gaps, so at 75% a 0.75px stroke with 2.25px dashes and 1.5px gaps.
describe("a part drawn at a scale", () => {
  const BLACK = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } } as const;
  const CENTERED_BOX = {
    direction: "HORIZONTAL",
    limits: UNLIMITED,
    paddingTop: literal(0),
    paddingRight: literal(0),
    paddingBottom: literal(0),
    paddingLeft: literal(0),
    itemSpacing: literal(0),
    primaryAlign: "CENTER",
    counterAlign: "CENTER",
    shadows: [],
    opacity: 1,
  } as const;

  /** The thumb's slot and dot, as the built set holds them in each cell, and the scale's rows. */
  async function build(thumb: string, offOnly: string) {
    const cell = (checked: string) => ({
      cell: { checked },
      root: {
        slot: "chip",
        classes: "inline-flex",
        children: [{ slot: "chip-thumb", classes: checked === "off" ? `${thumb} ${offOnly}` : thumb }],
      },
    });
    const { componentSet, coverage } = await buildCaptured(
      chip({
        axes: [{ name: "checked", values: ["off", "on"] }],
        columnAxis: "checked",
        parts: [part({ key: "thumb", slot: "chip-thumb" })],
      }),
      [cell("off"), cell("on")]
    );
    return {
      frames: componentSet.variants.map((variant) => frameOf(variant.root)),
      rows: coverage.filter((row) => row.property === "scale").map((row) => [row.className, row.outcome]),
    };
  }

  function frame(
    fields: Omit<FrameLayerSpec, "kind" | "clips" | "stroke" | keyof typeof CENTERED_BOX>
  ): FrameLayerSpec {
    return { kind: "frame", clips: false, stroke: undefined, ...CENTERED_BOX, ...fields };
  }

  function slot(dot: number): FrameLayerSpec {
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
          sizing: fixedSize(literal(dot), literal(dot)),
          cornerRadius: literal(dot / 2),
          fill: BLACK,
          children: [],
        }),
      ],
    });
  }

  it("is a slot its layout size, centering a dot at the scaled size, in every cell", async () => {
    const { frames, rows } = await build("size-[16px] rounded-full bg-[#000000]", "data-unchecked:scale-75");
    expect(frames).toEqual([slot(12), slot(16)]);
    expect(rows).toEqual([["data-unchecked:scale-75", "literal"]]);
  });

  it("leaves a scale that is not the same on both axes unmapped", async () => {
    const { rows } = await build("size-[16px] rounded-full bg-[#000000]", "data-unchecked:scale-x-75");
    expect(rows).toEqual([["data-unchecked:scale-x-75", "unmapped"]]);
  });

  it("draws a dashed border's weight and dashes at the scaled size", async () => {
    const { frames } = await build("size-[16px] border border-dashed border-[#000000] scale-75", "");
    const scaledStroke = { color: BLACK, weight: literal(0.75), dashPattern: [2.25, 1.5] };
    expect(frames.map((each) => frameOf(each)?.stroke)).toEqual([scaledStroke, scaledStroke]);
  });

  // The inner set has no kept capture on disk, so only the sources the build is given say that its
  // thumb wins a `scale`.
  it("draws the slot in an instance of the set that holds it, as the inner variant does", async () => {
    const thumbs = chip({
      key: "review-thumb",
      name: "Review thumb",
      slot: "thumbs",
      parts: [part({ key: "thumb", slot: "chip-thumb" })],
    });
    const root = {
      slot: "thumbs",
      classes: "inline-flex",
      children: [{ slot: "chip-thumb", classes: "size-[16px] rounded-full bg-[#000000] scale-75" }],
    };
    const { variant, coverage } = await buildCaptured(
      chip({
        parts: [instanceOf("thumbs", thumbs)],
      }),
      rest({ slot: "chip", classes: "flex", children: [root] }),
      { inner: [{ manifest: thumbs, cells: rest(root) }] }
    );
    const [instance] = variant?.root.children ?? [];
    expect(instance?.kind === "instance" ? instance.overrides : instance).toBeUndefined();
    expect(coverage.filter((row) => row.outcome === "unmapped")).toEqual([]);
  });
});

// Oracle: the property model of the Figma plugin typings, where a set lists a BOOLEAN property once,
// with the one default the parts that hide behind it name, and a set with no optional part lists none.
describe("an optional part", () => {
  const DETAIL: BooleanPropertySpec = { name: "Detail", defaultValue: true };
  const parts = (optional: boolean) => [
    part({ key: "title", slot: "chip-title" }),
    ...(optional ? [part({ key: "detail", slot: "chip-detail", optional: DETAIL })] : []),
  ];
  const children = [
    { slot: "chip-title", classes: "size-[4px]" },
    { slot: "chip-detail", classes: "size-[4px]" },
  ];

  it("leaves the properties out of a set with no optional part, as a set built before them", async () => {
    const { componentSet } = await buildChip("flex", children.slice(0, 1), { parts: parts(false) });
    expect(componentSet.booleanProperties).toBeUndefined();
  });

  it("lists the property an optional part hides behind", async () => {
    const { componentSet } = await buildChip("flex", children, { parts: parts(true) });
    expect(componentSet.booleanProperties).toEqual([DETAIL]);
  });
});

// Oracle: Tailwind's compile, `rotate: 180deg` for `rotate-180`, CSS, which turns a box clockwise
// about its center and leaves its layout as it was, and the typings, under which Figma counts
// `rotation` counterclockwise. A variant root sits in its set outside any auto layout, and a turn in
// another unit than `deg` has no reading.
describe("a turned icon or part", () => {
  const rotateRows = (coverage: readonly CoverageRow[]) =>
    coverage.filter((row) => row.property === "rotate").map((row) => [row.part, row.outcome]);

  it("turns a part", async () => {
    const { variant } = await buildWithDot("inline-flex", "size-[4px] rotate-180");
    expect(frameOf(variant?.root)?.rotation).toBe(180);
  });

  it("leaves a turn of the root unmapped, since a variant sits in its set outside any auto layout", async () => {
    const { coverage } = await buildChip("inline-flex rotate-180");
    expect(rotateRows(coverage)).toEqual([["chip", "unmapped"]]);
  });

  it("leaves a turn in another unit unmapped", async () => {
    const { variant, coverage } = await buildChip(
      "text-[#000000]",
      [{ tag: "svg", classes: "size-4 rotate-[0.5turn]" }],
      { iconsFor: () => [ICON] }
    );
    const [icon] = variant?.root.children ?? [];
    expect(icon?.kind === "icon" ? icon.rotation : icon).toBeUndefined();
    expect(rotateRows(coverage)).toEqual([["Icon", "unmapped"]]);
  });
});
