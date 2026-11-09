/**
 * The HTML the built Fuse Badge renders for a cell. The unit under test is the Badge renderer.
 * The oracle is Badge's public contract: one `<span data-slot="badge">` holding the label as its
 * own text, with no child element for a selector such as `[&>span]` to reach.
 */
import { describe, expect, it } from "vitest";

import { badge } from "./badge-cell";
import { renderCellHtml } from "./cell-renderers";
import { elementsOf } from "./static-markup";

describe("the Badge renderer", () => {
  it("renders one badge span whose own text is the label", () => {
    const html = renderCellHtml(badge, { variant: "outline-warning", size: "lg" });
    expect(elementsOf(html).map((element) => [element.name, element.attributes.get("data-slot")])).toEqual([
      ["span", "badge"],
    ]);
    expect(html).toMatch(/>Badge<\/span>$/);
  });
});
