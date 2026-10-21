/**
 * The HTML the built Fuse Badge renders for a cell. The unit under test is the Badge renderer.
 * The oracle is Badge's public contract: one `<div data-slot="badge">` holding the label as its
 * own text, with no child element for a selector such as `[&>span]` to reach.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { badge } from "./badge-cell";
import { renderCellHtml } from "./cell-renderers";

describe("the Badge renderer", () => {
  it("renders one badge div whose own text is the label", () => {
    const html = renderCellHtml(badge, { variant: "outline-warning", size: "lg" });
    expect(elementsOf(html).map((element) => [element.name, element.attributes.get("data-slot")])).toEqual([
      ["div", "badge"],
    ]);
    expect(html).toMatch(/>Badge<\/div>$/);
  });
});
