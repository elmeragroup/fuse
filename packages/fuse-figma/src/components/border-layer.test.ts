/**
 * When the build moves a box's border onto its `border` layer, so a placed layer's shadow can paint
 * over it as CSS paints a descendant's shadow over the box's border. The unit under test is
 * `buildSetsInOrder` on hand-built captures of a `chip` holding one 40 by 20 bordered part whose
 * `::before` casts a shadow (`test/capture-fixtures.ts`). Oracles:
 *
 * - CSS Backgrounds 3 §7.1 and §7.1.2: a sharp shadow paints the layer's border box moved by its offset and
 *   grown by its spread, outside the layer's own box only. It covers a border where that shape
 *   overlaps the border's band, as a layer at y 0 to 2 casting `0 1px` paints y 2 to 3 over a 4px top
 *   border, and Chromium paints (20,2) in the shadow's color.
 * - CSS Backgrounds 3 §7.1.1 blurs a shadow by a Gaussian of standard deviation half the blur radius, whose
 *   paint Chromium ends 1.5 times the radius past the sharp edge, as it paints a 12px blur 18px out and
 *   an 8px blur 12px out (measured on 2026-11-22). A blurred shadow that reaches a border keeps the
 *   stroke on the box and leaves the declaration that wins the border's width unmapped, a
 *   `border-bottom` shorthand included: the build does not draw its tail.
 * - A box whose height binds a variable paints the shadow as the literal height does where the
 *   variable is 20px in every mode. Where it is 20px in one mode and 40px in another, the shadow
 *   covers the top border at 20px only, so the build cannot pick one layer order, keeps the stroke and
 *   leaves the border's width unmapped. So it does where the variable's range is unknown.
 * - CSS Backgrounds 3 §7.1.2 clips an outer shadow to the outside of the layer's rounded border box,
 *   so a shadow can paint a border inside the layer's rectangle past a rounded corner: on a 40 by 20
 *   panel with a 3px black top border, a `::before` covering the panel, rounded 8px, with
 *   `box-shadow: 2px 0 #ff0000` paints (37,1) rgb(247,0,0) in Chromium (measured in review). The
 *   build does not trace the curve, so it keeps the stroke and leaves the border's width unmapped.
 * - CSS Overflow 3 §3: a box that clips its content clips the shadow at its padding box on each axis
 *   it clips, `clip` on one axis only, and `hidden` beside `visible` on both. Figma clips both axes
 *   or neither, so a box that clips while a shadow reaches its border keeps its stroke and leaves its
 *   `overflow` unmapped.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, part, rest } from "../../test/capture-fixtures";
import { makeVariableIndex } from "./css-values";
import type { VariableIndex } from "./css-values";

/** The written declaration that gives the `::before` an empty string, the box the layer draws. */
const EMPTY_CONTENT = { className: "before:content-['']", property: "content", value: '""' } as const;

/**
 * Build a chip around a 40px wide white part, 20px tall or as `height` sizes it, with the given
 * borders around a `::before` at the given insets casting the given shadow. Read whether the part's
 * border moved onto the `border` layer, and the coverage rows left unmapped, by class name and
 * property, with their details apart.
 */
async function bordered(
  borders: string,
  insets: string,
  shadow: string,
  { variables, height = "h-[20px]" }: { readonly variables?: VariableIndex; readonly height?: string } = {}
) {
  const { variant, coverage } = await buildCaptured(
    chip({ parts: [part({ key: "panel", slot: "panel" })] }),
    rest({
      slot: "chip",
      classes: "flex",
      children: [
        {
          slot: "panel",
          classes: `relative w-[40px] ${height} bg-white border-black ${borders}`,
          pseudo: { before: { classes: `absolute ${insets} ${shadow}`, written: [EMPTY_CONTENT] } },
          measured: { pseudoBoxes: ["before"] },
        },
      ],
    }),
    variables === undefined ? {} : { variables }
  );
  const [panel] = variant?.root.children ?? [];
  const rows = coverage.filter((row) => row.outcome === "unmapped");
  return {
    moves: panel?.kind === "frame" && panel.children.some((layer) => layer.key === "border"),
    unmapped: rows.map((row) => ({ className: row.className, property: row.property })),
    details: rows.map((row) => row.detail),
  };
}

/** A black shadow at half alpha with the given offsets, blur and spread, as Tailwind writes it. */
const shadowOf = (lengths: string): string => `shadow-[${lengths}_--theme(--color-black/50%)]`;

describe("a placed layer's sharp shadow over a box's border", () => {
  it.each([
    // The layer's bottom edge sits 3px up, 2px above the 1px border.
    [
      "moves the border where a shadow 3px down covers it",
      "border-b",
      "inset-x-0 top-0 bottom-[2px]",
      "0_3px",
      true,
    ],
    [
      "keeps the stroke where a shadow 2px down ends on its inner edge",
      "border-b",
      "inset-x-0 top-0 bottom-[2px]",
      "0_2px",
      false,
    ],
    // No bottom border: a shadow down from the bottom edge covers no border, and none reaches the top.
    [
      "keeps the stroke where a shadow falls past a side with no border",
      "border-t",
      "inset-0",
      "0_1px",
      false,
    ],
    // The layer spans y 0 to 2 inside the 4px top border. Its shadow 1px down paints y 2 to 3, below
    // the layer's bottom edge, which is still in the top border.
    [
      "moves the border where a shadow from the layer's opposite edge covers it",
      "border-t-4",
      "-top-[4px] inset-x-0 bottom-[18px]",
      "0_1px",
      true,
    ],
    // The layer's top edge sits 1px down, inside the 3px top border, and its right edge 4px in from
    // the box's. A shadow 2px right covers the border's 2px past that edge, as Chromium paints
    // (36,1) and (37,1) in the border's color mixed with the shadow's.
    [
      "moves the border where a shadow along it, from a layer whose edge lies in it, covers it",
      "border-t-[3px]",
      "-top-[2px] inset-x-[4px] bottom-0",
      "2px_0",
      true,
    ],
    // The layer reaches the box's right edge, so the shadow 2px right of it falls outside the box.
    [
      "keeps the stroke where a shadow along a border falls past the box's edge",
      "border-t-[3px]",
      "-top-[2px] inset-x-0 bottom-0",
      "2px_0",
      false,
    ],
  ])("%s", async (_case, borders, insets, lengths, moves) => {
    expect(await bordered(borders, insets, shadowOf(lengths))).toMatchObject({ moves, unmapped: [] });
  });
});

describe("a placed layer's blurred shadow near a box's border", () => {
  // The layer's bottom edge sits 13px up, 12px above the 1px border.
  it("keeps the stroke where an 8px blur ends 12px out, on the border's inner edge", async () => {
    expect(await bordered("border-b", "inset-x-0 top-0 bottom-[12px]", shadowOf("0_0_8px"))).toMatchObject({
      moves: false,
      unmapped: [],
    });
  });

  it("keeps the stroke and leaves the border's width unmapped where a 10px blur reaches 15px out", async () => {
    const { moves, unmapped, details } = await bordered(
      "border-b",
      "inset-x-0 top-0 bottom-[12px]",
      shadowOf("0_0_10px")
    );
    expect({ moves, unmapped }).toEqual({
      moves: false,
      unmapped: [{ className: "border-b", property: "border-bottom-width" }],
    });
    expect(details.join()).toContain("blurred shadow");
  });
});

describe("a placed layer's shadow on a box that clips", () => {
  it.each([
    ["`overflow: hidden`", "border overflow-hidden", "0_1px", "overflow-hidden", "overflow"],
    // `overflow-x: clip` clips across only, and the shadow down paints over the bottom border, which
    // the stroke over the layers hides.
    [
      "`overflow-x: clip` beside a shadow down",
      "border overflow-x-clip",
      "0_1px",
      "overflow-x-clip",
      "overflow-x",
    ],
    [
      "`overflow-y: clip` beside a shadow down",
      "border overflow-y-clip",
      "0_1px",
      "overflow-y-clip",
      "overflow-y",
    ],
    // `hidden` beside an unset `overflow-y` makes that axis `auto`, which clips too.
    ["`overflow-x: hidden`", "border overflow-x-hidden", "0_1px", "overflow-x-hidden", "overflow-x"],
    // Chromium paints (20,22), 2px below the box, which clips across only.
    [
      "`overflow-x: clip` beside a shadow past the box",
      "border overflow-x-clip",
      "0_4px",
      "overflow-x-clip",
      "overflow-x",
    ],
    [
      "`overflow-x: clip` beside a blurred shadow",
      "border overflow-x-clip",
      "0_2px_1px",
      "overflow-x-clip",
      "overflow-x",
    ],
  ])(
    "keeps the stroke and leaves %s unmapped where a shadow reaches the border",
    async (_case, borders, lengths, className, property) => {
      const { moves, unmapped, details } = await bordered(borders, "inset-0", shadowOf(lengths));
      expect({ moves, unmapped }).toEqual({ moves: false, unmapped: [{ className, property }] });
      expect(details.join()).toContain("the box clips its content");
    }
  );

  it("keeps the stroke and maps the clip where no shadow reaches the border", async () => {
    expect(
      await bordered("border-b overflow-hidden", "inset-x-0 top-0 bottom-[2px]", shadowOf("0_2px"))
    ).toMatchObject({ moves: false, unmapped: [] });
  });
});

describe("a placed layer's shadow whose spread a variable binds", () => {
  /** The spread variable, with the given greatest value across its modes, or none known. */
  const spreadOf = (maximum: number | undefined): VariableIndex =>
    makeVariableIndex([
      {
        ref: { collection: "Fuse density", name: "surface-pad-sm" },
        webSyntax: "var(--surface-pad-sm)",
        minimum: maximum,
        maximum,
      },
    ]);
  // A layer flush with the box: a spread of 4px in some mode covers the 1px border, and one whose
  // greatest value the build does not know may.
  it.each([
    ["moves the border where the spread's greatest value covers it", 4],
    ["moves the border where the spread's greatest value is unknown", undefined],
  ])("%s", async (_case, maximum) => {
    expect(
      await bordered("border", "inset-0", "shadow-[0_0_0_var(--surface-pad-sm)_--theme(--color-black/50%)]", {
        variables: spreadOf(maximum),
      })
    ).toMatchObject({ moves: true, unmapped: [] });
  });
});

describe("a placed layer's shadow in a box whose height a variable binds", () => {
  /** The height variable, with the given least and greatest values across its modes, or none known. */
  const heightOf = (minimum: number | undefined, maximum: number | undefined): VariableIndex =>
    makeVariableIndex([
      {
        ref: { collection: "Fuse density", name: "control-h-md" },
        webSyntax: "var(--control-h-md)",
        minimum,
        maximum,
      },
    ]);
  /** The layer spans y 0 to 2 inside the 4px top border, 18px above the bottom of a 20px box. */
  const opposite = (variables: VariableIndex) =>
    bordered("border-t-4", "-top-[4px] inset-x-0 bottom-[18px]", shadowOf("0_1px"), {
      variables,
      height: "h-(--control-h-md)",
    });

  // Chromium paints (20,2) in the shadow's color at a height of 20px, as with `h-[20px]` above.
  it("moves the border where the height is 20px in every mode", async () => {
    expect(await opposite(heightOf(20, 20))).toMatchObject({ moves: true, unmapped: [] });
  });

  // At 40px the layer ends at y 22, and its shadow at y 23, far below the top border.
  it.each([
    ["the height ranges from 20px to 40px", 20, 40],
    // At 18px the layer holds no height, and its shadow paints nothing, at 40px neither, but at 20px
    // in between the shadow covers the border.
    ["the height ranges from 18px to 40px", 18, 40],
    ["the height's range is unknown", undefined, undefined],
  ])("keeps the stroke and leaves the border's width unmapped where %s", async (_case, minimum, maximum) => {
    const { moves, unmapped, details } = await opposite(heightOf(minimum, maximum));
    expect({ moves, unmapped }).toEqual({
      moves: false,
      unmapped: [{ className: "border-t-4", property: "border-top-width" }],
    });
    expect(details.join()).toContain("size binds a variable");
  });
});

describe("a placed layer's blurred shadow over a border a shorthand sets", () => {
  it.each([
    // The layer ends 4px above the 2px border, at y 14, and an 8px blur paints 12px past it.
    [
      "`border-bottom` beside an 8px blur",
      "[border-bottom:2px_solid] border-[#ff0000]",
      "0_0_8px",
      "[border-bottom:2px_solid]",
    ],
    // The layer ends 4px above the 3px border, at y 13, and a 4px blur 1px down paints to y 20.
    [
      "`border-bottom` beside a 4px blur 1px down",
      "[border-bottom:3px_solid] border-black",
      "0_1px_4px",
      "[border-bottom:3px_solid]",
    ],
  ])("leaves %s unmapped", async (_case, borders, lengths, className) => {
    const { moves, unmapped, details } = await bordered(
      borders,
      "inset-x-0 top-0 bottom-[4px]",
      shadowOf(lengths)
    );
    expect({ moves, unmapped }).toEqual({
      moves: false,
      unmapped: [{ className, property: "border-bottom" }],
    });
    expect(details.join()).toContain("blurred shadow");
  });
});

describe("a placed layer with rounded corners whose shadow reaches a border inside its box", () => {
  // The layer covers the panel, y 0 to 20, rounded 8px, and its shadow 2px right paints the top
  // border where the layer's top right corner curves away: Chromium paints (37,1) rgb(247,0,0).
  it("keeps the stroke and leaves the border's width unmapped", async () => {
    const { moves, unmapped, details } = await bordered(
      "border-t-[3px]",
      "-top-[3px] inset-x-0 bottom-0 rounded-[8px]",
      "shadow-[2px_0_#ff0000]"
    );
    expect({ moves, unmapped }).toEqual({
      moves: false,
      unmapped: [{ className: "border-t-[3px]", property: "border-top-width" }],
    });
    expect(details.join()).toContain("rounded corner");
  });

  // Square corners: the shadow inside the layer's box paints nothing CSS shows.
  it("keeps the stroke and maps the border where the layer's corners are square", async () => {
    expect(
      await bordered("border-t-[3px]", "-top-[3px] inset-x-0 bottom-0", "shadow-[2px_0_#ff0000]")
    ).toMatchObject({ moves: false, unmapped: [] });
  });
});
