/**
 * The HTML the built Fuse Separator renders for a cell. The unit under test is the Separator
 * renderer. The oracle is Separator's public contract and Base UI's documented Separator
 * attributes: one empty `<div role="separator" data-slot="separator">` whose `aria-orientation`
 * and `data-orientation` both name the orientation it renders in.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { separator } from "./separator-cell";

describe("the Separator renderer", () => {
  it.each(["horizontal", "vertical"])("renders one empty %s separator div", (orientation) => {
    const elements = elementsOf(renderCellHtml(separator, { orientation }));
    expect(
      elements.map((element) => [
        element.name,
        element.attributes.get("role"),
        element.attributes.get("data-slot"),
        element.attributes.get("aria-orientation"),
        element.attributes.get("data-orientation"),
      ])
    ).toEqual([["div", "separator", "separator", orientation, orientation]]);
  });
});
