/**
 * The HTML the built Fuse Select renders for a Menu separator cell. The unit under test is the Menu
 * separator renderer. The oracle is Select's public contract and Base UI's documented separator:
 * `Select.Separator` renders one empty `<div role="presentation" data-slot="select-separator">`
 * marked `data-orientation="horizontal"`, here alone in the host that pads it as a popup does.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { menuSeparator } from "./menu-cell";

describe("the Menu separator renderer", () => {
  it("renders one empty separator div in its host", () => {
    const elements = elementsOf(renderCellHtml(menuSeparator, { size: "default" }));
    expect(
      elements.map((element) => [
        element.name,
        element.parent,
        element.attributes.get("role"),
        element.attributes.get("data-slot"),
        element.attributes.get("data-orientation"),
      ])
    ).toEqual([
      ["div", undefined, undefined, undefined, undefined],
      ["div", 0, "presentation", "select-separator", "horizontal"],
    ]);
  });
});
