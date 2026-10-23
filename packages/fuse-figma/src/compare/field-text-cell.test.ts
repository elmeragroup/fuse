/**
 * The HTML the built Fuse Field renders for each Field text cell. The unit under test is the four
 * Field text renderers. The oracle is Field's public contract and the docs Field demos: the
 * description, the error and the legend are block boxes that fill a Field 384px wide, the width the
 * kit draws them at, and `Field.Legend` writes its `variant` as `data-variant`. The markup check in
 * `kit-markup.test.ts` reads no host width and no class of the measured element, so it cannot tell a
 * block part in a slot that shrinks to its text, or a legend in the wrong variant.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import type { CellRendering } from "./cell-renderers";
import { fieldDescription, fieldError, fieldLegend, fieldTitle } from "./field-text-cell";

/** A cell's outermost element as its tag and `style`, and the element carrying a `data-slot`. */
function render(rendering: CellRendering, cell: Readonly<Record<string, string>>, slot: string) {
  const elements = elementsOf(renderCellHtml(rendering, cell));
  return {
    host: [elements[0]?.name, elements[0]?.attributes.get("style")],
    part: elements.find((element) => element.attributes.get("data-slot") === slot),
  };
}

describe("the Field text renderers", () => {
  it.each([
    ["field-description", fieldDescription, { state: "rest" }],
    ["field-error", fieldError, { state: "invalid" }],
    ["field-legend", fieldLegend, { variant: "legend" }],
  ] as const)("render %s in a 384px host, the Field's width", (slot, rendering, cell) => {
    expect(render(rendering, cell, slot).host).toEqual(["div", "width:384px"]);
  });

  it.each(["legend", "label"])("render the legend in its %s variant", (variant) => {
    expect(render(fieldLegend, { variant }, "field-legend").part?.attributes.get("data-variant")).toBe(
      variant
    );
  });

  // A host width would let the Field root's stretch widen the title past its text.
  it("renders the title's Field root outermost, so the root and the title shrink to the text", () => {
    const [outermost] = elementsOf(renderCellHtml(fieldTitle, { state: "rest" }));
    expect(outermost?.attributes.get("data-slot")).toBe("field");
  });
});
