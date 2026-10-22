/**
 * The HTML the built Fuse Loader renders for a cell. The unit under test is the Loader renderer.
 * The oracle is Loader's public contract: one `<div data-slot="loader" role="status">` holding a
 * decorative `<svg aria-hidden="true">` and then the visually hidden text, the `aria-label`
 * "Loading", in a `<span class="sr-only">`, with no client child.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { loader } from "./loader-cell";

describe("the Loader renderer", () => {
  it("renders a status div around a hidden spinner and the visually hidden label", () => {
    const html = renderCellHtml(loader, { size: "xl" });
    // The root and its children, without the glyph's paths inside the `<svg>`.
    const outer = elementsOf(html).filter((element) => element.parent === undefined || element.parent === 0);
    expect(
      outer.map((element) => [
        element.name,
        element.parent,
        element.attributes.get("data-slot"),
        element.attributes.get("role"),
        element.attributes.get("aria-hidden"),
        element.attributes.get("class"),
      ])
    ).toEqual([
      ["div", undefined, "loader", "status", undefined, expect.any(String)],
      ["svg", 0, undefined, undefined, "true", expect.any(String)],
      ["span", 0, undefined, undefined, undefined, "sr-only"],
    ]);
    expect(html).toMatch(/<span class="sr-only">Loading<\/span><\/div>$/);
  });
});
