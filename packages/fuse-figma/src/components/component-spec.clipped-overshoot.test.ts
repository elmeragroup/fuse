/**
 * A part as wide as its column past a start margin, as `Sidebar.Separator`'s `data-horizontal:w-full
 * mx-2` sits in `Sidebar.Content`. Unit under test: `buildComponentSet`, through the `chip` fixture.
 * Oracle: CSS 2.1 §10.3.3, where a box with a definite width and margins that overconstrain its
 * containing block keeps its width and start margin, so it reaches the margin past the column's end,
 * and CSS Overflow 3 §3, where a column that clips cuts what reaches past its padding box. With no
 * padding across, the part shows from the start margin to the column's end, so a wrapper that pads the
 * start margin and holds the part at its fill draws the same pixels, and the end margin shows nothing.
 */
import { describe, expect, it } from "vitest";

import { FILL, literal } from "../../test/built-kit";
import { buildFixture, chip, dot } from "../../test/fixture-sets";
import type { PartDefinition } from "./component-spec";
import { makeVariableIndex } from "./css-values";
import type { BoxSpec, ChildLayerSpec, NumberSpec, SizingSpec } from "./kit-spec";

/** The 1px line, with its classes. */
const line = (classes: string): PartDefinition => ({
  ...dot(`h-px bg-[#cccccc] ${classes}`),
  key: "line",
  slot: "chip-line",
});

/** A frame's sizing across, its paddings across, and the key and sizing across of each layer it holds. */
type Across = {
  readonly width: SizingSpec["horizontal"];
  readonly padding: readonly NumberSpec[];
  readonly children: readonly (readonly [string, SizingSpec["horizontal"] | false])[];
};

/** A layer's sizing across, its paddings across, and what it holds, by key. */
function across(layer: BoxSpec | ChildLayerSpec | undefined): Across | undefined {
  return layer !== undefined && "kind" in layer && layer.kind === "frame"
    ? {
        width: layer.sizing.horizontal,
        padding: [layer.paddingLeft, layer.paddingRight],
        children: layer.children.map(
          (child) => [child.key, child.kind === "frame" && child.sizing.horizontal] as const
        ),
      }
    : undefined;
}

const VARIABLES = makeVariableIndex([
  {
    ref: { collection: "Fuse density", name: "row-px" },
    webSyntax: "var(--row-px)",
    minimum: 8,
    maximum: 12,
  },
]);

describe("a part as wide as its clipping column past a start margin", () => {
  it("draws in a frame that pads the start margin and holds the part at its fill", async () => {
    const { variant, coverage } = await buildFixture(
      chip("flex flex-col w-[100px] overflow-hidden", { parts: [line("w-full mx-2")] })
    );
    expect(across(variant?.root.children[0])).toEqual({
      width: FILL,
      padding: [literal(8), literal(0)],
      children: [["box", FILL]],
    });
    expect(
      coverage
        .filter((row) => row.className === "mx-2")
        .map((row) => [row.property, row.outcome, row.detail])
        .toSorted(([left = ""], [right = ""]) => (left < right ? -1 : 1))
    ).toEqual([
      [
        "margin-left",
        "literal",
        "8px of padding at the start of a frame around the part, which keeps its 100% width past the margin, so its column's clip cuts its end",
      ],
      [
        "margin-right",
        "dropped",
        "the part keeps its 100% width past its start margin, so it reaches past its column's end, which clips it, and the end margin shows nothing",
      ],
    ]);
  });

  it.each([
    ["a column that does not clip", "flex flex-col w-[100px]", "w-full mx-2"],
    ["a column that pads across", "flex flex-col w-[100px] px-[4px] overflow-hidden", "w-full mx-2"],
    ["a bound start margin", "flex flex-col w-[100px] overflow-hidden", "w-full mx-(--row-px)"],
    ["a negative start margin", "flex flex-col w-[100px] overflow-hidden", "w-full -ml-2"],
    ["a part with no 100% width", "flex flex-col w-[100px] overflow-hidden", "mx-2"],
  ])("leaves the margins unmapped with %s", async (_case, column, classes) => {
    const { coverage } = await buildFixture(chip(column, { parts: [line(classes)] }), {
      variables: VARIABLES,
    });
    expect(coverage.filter((row) => row.property === "margin-left").map((row) => row.outcome)).toEqual([
      "unmapped",
    ]);
  });
});
