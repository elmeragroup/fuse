/**
 * How the build rounds the corners of a box whose height hugs its layers, as Selection item's shell
 * sets `first:rounded-t-lg last:rounded-b-lg` around rows whose height follows their text. The unit
 * under test is `buildSetsInOrder` on hand-built captures of one-cell `chip` sets
 * (`test/capture-fixtures.ts`). Oracles: CSS Backgrounds 3 §5.5, under which CSS scales every radius
 * down only where the radii along a side add up past it, and probe P10, under which Figma caps a
 * radius at half the shorter side. A 200px-wide column whose one layer is at least 40px tall in every
 * mode is at least that tall too, so radii up to 16px, two along a side, sum within each side and sit
 * within half of it: CSS scales none and Figma caps none, and each draws as written, a variable
 * bound. Where the layer may be 20px tall, two 16px radii along a side would scale, so the corners
 * stay unmapped.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, part, rest } from "../../test/capture-fixtures";
import type { LabelManifest } from "../capture/manifest";
import { makeVariableIndex } from "./css-values";

const RADIUS = { collection: "Fuse tokens", name: "radius-lg" } as const;

const ROW = { collection: "Fuse density", name: "row-h" } as const;

/**
 * A 200px column around one 20px-wide layer whose height binds `row-h`, which takes the given least
 * height and 8px more, so no literal height holds the column; its top corners `var(--radius-lg)`.
 */
function buildRounded(leastRow: number) {
  return buildCaptured(
    chip({ parts: [part({ key: "row", slot: "row" })] }),
    rest({
      slot: "chip",
      classes: "flex flex-col w-[200px]",
      written: ["border-top-left-radius", "border-top-right-radius"].map((property) => ({
        className: "rounded-t-lg",
        property,
        value: "var(--radius-lg)",
      })),
      children: [{ slot: "row", classes: "w-[20px] h-(--row-h)" }],
    }),
    {
      variables: makeVariableIndex([
        { ref: RADIUS, webSyntax: "var(--radius-lg)", minimum: 8, maximum: 16 },
        { ref: ROW, webSyntax: "var(--row-h)", minimum: leastRow, maximum: leastRow + 8 },
      ]),
    }
  );
}

describe("a radius per corner on a box whose height hugs its layers", () => {
  it("binds each corner where the least height leaves every mode's radius unscaled and uncapped", async () => {
    const { variant } = await buildRounded(40);
    const bound = { kind: "variable", variable: RADIUS } as const;
    const zero = { kind: "literal", value: 0 } as const;
    expect(variant?.root.cornerRadius).toEqual({
      kind: "corners",
      topLeft: bound,
      topRight: bound,
      bottomRight: zero,
      bottomLeft: zero,
    });
  });

  it("stays unmapped where the box may be short enough for CSS to scale the radii", async () => {
    const { variant, coverage } = await buildRounded(20);
    expect([
      variant?.root.cornerRadius,
      coverage.filter((row) => row.className === "rounded-t-lg").map((row) => row.outcome),
    ]).toEqual([{ kind: "literal", value: 0 }, ["unmapped", "unmapped"]]);
  });

  // A 40px line inside 4px of padding is 48px tall with its sample text, room for two 16px top
  // radii. A label set by a TEXT property counts its realistic line, an emptied label being a known
  // limit; one a BOOLEAN property can hide counts as gone, which leaves 8px, where CSS scales the radii
  // to 8px and Figma caps them at 4px.
  it.each([
    ["holds a label no property sets", undefined, false, { kind: "literal", value: 16 }],
    ["holds a label a TEXT property sets", "Title", false, { kind: "literal", value: 16 }],
    ["holds a label a BOOLEAN property can hide", undefined, true, undefined],
  ])("rounds a padded box that %s by its realistic height", async (_case, textProperty, optional, corner) => {
    const label: LabelManifest = {
      key: "text",
      name: "text",
      characters: "x",
      textProperty,
      shownIn: () => true,
    };
    const text = optional
      ? part({ key: "text", slot: "text", label, optional: { name: "Text", defaultValue: true } })
      : part({ key: "text", slot: "text", label });
    const { variant } = await buildCaptured(
      chip({ parts: [text] }),
      rest({
        slot: "chip",
        classes: "flex flex-col w-[200px] py-[4px] font-sans text-[14px] leading-[40px] text-[#000000]",
        written: ["border-top-left-radius", "border-top-right-radius"].map((property) => ({
          className: "corners",
          property,
          value: "16px",
        })),
        children: [{ slot: "text", text: "x" }],
      }),
      {
        variables: makeVariableIndex([
          { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
        ]),
      }
    );
    const radius = variant?.root.cornerRadius;
    expect(radius?.kind === "corners" ? radius.topLeft : undefined).toEqual(corner);
  });
});

// CSS Backgrounds 3 §5.5 scales four equal radii r on a w by h box by min(1, w / 2r, h / 2r), so each
// draws min(r, w / 2, h / 2), the radius capped at half the shorter side, which is where Figma caps
// it (probe P10). Four equal radii therefore draw alike on a box of any size, as a Frame panel's
// `rounded-t-*` and `rounded-b-*` give it, and bind with no length proven. Written as is, they keep
// drawing alike once a designer resizes the box: four 40px radii on a 20px square draw 10px in both,
// and 40px in both at 80px. Unequal radii scale by a factor Figma does not apply, so on a box whose
// sides the build cannot tell they stay unmapped.
describe("a radius per corner on a box whose sides the build cannot tell", () => {
  const OTHER = { collection: "Fuse tokens", name: "radius-sm" } as const;

  /** A hugging column around one 20px-wide layer `row-h` tall, as short as 4px, with these corners. */
  function buildCornered(top: string, bottom: string) {
    return buildCaptured(
      chip({ parts: [part({ key: "row", slot: "row" })] }),
      rest({
        slot: "chip",
        classes: "flex flex-col",
        written: [
          ["border-top-left-radius", top],
          ["border-top-right-radius", top],
          ["border-bottom-right-radius", bottom],
          ["border-bottom-left-radius", bottom],
        ].map(([property = "", value = ""]) => ({ className: "corners", property, value })),
        children: [{ slot: "row", classes: "w-[20px] h-(--row-h)" }],
      }),
      {
        variables: makeVariableIndex([
          { ref: RADIUS, webSyntax: "var(--radius-lg)", minimum: 8, maximum: 16 },
          { ref: OTHER, webSyntax: "var(--radius-sm)", minimum: 4, maximum: 12 },
          { ref: ROW, webSyntax: "var(--row-h)", minimum: 4, maximum: 12 },
        ]),
      }
    );
  }

  it("binds four equal radii", async () => {
    const { variant, coverage } = await buildCornered("var(--radius-lg)", "var(--radius-lg)");
    const bound = { kind: "variable", variable: RADIUS } as const;
    expect([
      variant?.root.cornerRadius,
      coverage.filter((row) => row.className === "corners").map((row) => row.outcome),
    ]).toEqual([
      { kind: "corners", topLeft: bound, topRight: bound, bottomRight: bound, bottomLeft: bound },
      ["bound", "bound", "bound", "bound"],
    ]);
  });

  it("leaves unequal radii unmapped", async () => {
    const { coverage } = await buildCornered("var(--radius-lg)", "var(--radius-sm)");
    expect(coverage.filter((row) => row.className === "corners").map((row) => row.outcome)).toEqual([
      "unmapped",
      "unmapped",
      "unmapped",
      "unmapped",
    ]);
  });
});

describe("four equal radii on a box of literal sides they overrun", () => {
  it("keeps the written radius, which CSS and Figma both cap at half the shorter side", async () => {
    const { variant } = await buildCaptured(
      chip(),
      rest({
        slot: "chip",
        classes: "w-[20px] h-[20px]",
        written: [
          "border-top-left-radius",
          "border-top-right-radius",
          "border-bottom-right-radius",
          "border-bottom-left-radius",
        ].map((property) => ({ className: "corners", property, value: "40px" })),
      })
    );
    const written = { kind: "literal", value: 40 } as const;
    expect(variant?.root.cornerRadius).toEqual({
      kind: "corners",
      topLeft: written,
      topRight: written,
      bottomRight: written,
      bottomLeft: written,
    });
  });
});
