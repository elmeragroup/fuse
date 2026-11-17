/**
 * How the build maps a box's own declarations, as a capture records the browser's winners: sizing,
 * percentages, limits, margins, position, alignment, corners, transforms, overflow and the outcomes of
 * the declarations that have no Figma form. The unit under test is `buildComponentSet` on hand-built
 * captures of one-cell `chip` sets (`test/capture-fixtures.ts`). Each case names its oracle: the CSS
 * specification that says what the browser draws, the Figma plugin typings or a probe that says what
 * Figma draws, or the coverage contract, under which a declaration that does not reach Figma is
 * `unmapped` and one that has nothing to draw is `dropped` with the reason.
 */
import { describe, expect, it } from "vitest";

import {
  buildCaptured,
  chip,
  FILL,
  fixed,
  fixedSize,
  frameOf,
  HUG,
  ICON,
  literal,
  notesOf,
  part,
  rest,
  UNLIMITED,
} from "../../test/capture-fixtures";
import type { FixtureElement, FixtureOptions } from "../../test/capture-fixtures";
import type { PartManifest } from "../capture/manifest";
import type { CoverageRow } from "./coverage";
import { makeVariableIndex } from "./css-values";
import type { BooleanPropertySpec, FrameLayerSpec } from "./kit-spec";

/** Build a chip whose root wins the given classes and holds the given elements. */
function buildChip(
  classes: string,
  children: readonly FixtureElement[] = [],
  manifest: Parameters<typeof chip>[0] = {},
  options: FixtureOptions = {}
) {
  return buildCaptured(chip(manifest), rest({ slot: "chip", classes, children }), options);
}

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
describe("a flex column", () => {
  it("records the alignment a column that hugs its width is missing", async () => {
    const { variant, coverage } = await buildWithDot("flex flex-col", "h-[4px]");
    expect(
      variant?.root.children.map((child) => (child.kind === "frame" ? child.sizing.horizontal : undefined))
    ).toEqual([HUG]);
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
    ["a margin beside a fill", "flex w-[100px]", "flex-1 h-[8px] ml-1", "ml-1", "margin-left"],
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

// Oracle: CSS 2.1 §10.1, §10.4 and §10.3.7 to §10.6.4. An absolute box's percentages take its
// containing block, the padding box of its nearest positioned ancestor, sized after its own limits: a
// bar that fills a 256px column up to `max-w-[128px]` is 128px wide, so 85% of it is 108.8px and
// `h-full` 6px, at its top left. A percentage width keeps its share when the parent grows, which
// Figma's SCALE draws, and a full height keeps both edges, which STRETCH draws (P8).
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
        absolute: { x: 0, y: 0, constraints: { horizontal: "SCALE", vertical: "STRETCH" } },
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
