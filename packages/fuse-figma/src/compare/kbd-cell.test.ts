/**
 * The HTML the built Fuse Kbd renders for a cell. The unit under test is the Kbd renderer. The
 * oracle is Kbd's public contract: one `<kbd data-slot="kbd">` that holds the label as its own
 * text in the text cell, and one `<svg>` child in the icon cell.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { kbd } from "./kbd-cell";

/** Each element's tag, `data-slot` and parent index, in document order. */
function nesting(html: string) {
  return elementsOf(html).map((element) => [
    element.name,
    element.attributes.get("data-slot"),
    element.parent,
  ]);
}

describe("the Kbd renderer", () => {
  it("renders one kbd whose own text is the label in the text cell", () => {
    const html = renderCellHtml(kbd, { content: "text" });
    expect(nesting(html)).toEqual([["kbd", "kbd", undefined]]);
    expect(html).toMatch(/>K<\/kbd>$/);
  });

  it("renders one kbd around one icon in the icon cell", () => {
    const html = renderCellHtml(kbd, { content: "icon" });
    expect(nesting(html).slice(0, 2)).toEqual([
      ["kbd", "kbd", undefined],
      ["svg", undefined, 0],
    ]);
    expect(elementsOf(html).filter((element) => element.name === "svg")).toHaveLength(1);
  });
});
