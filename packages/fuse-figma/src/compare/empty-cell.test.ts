/**
 * The HTML the built Fuse Empty renders for each cell. The unit under test is the Empty renderer.
 * The oracle is Empty's public contract and the docs Basic demo: a block-level root that fills a
 * 512px host, the width the kit draws it at, and `Empty.Media` writes its `variant` as
 * `data-variant`, `icon` in the demo. The markup check in `kit-markup.test.ts` reads no host width
 * and no part's variant, so it cannot tell a root in a slot that shrinks to its content, or the
 * frameless default media in place of the icon box.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { empty } from "./empty-cell";

describe("the Empty renderer", () => {
  it.each(["default", "outline", "outline-dashed"])(
    "renders the %s frame in a 512px host, with the icon media",
    (variant) => {
      const elements = elementsOf(renderCellHtml(empty, { variant }));
      const slot = (name: string) => elements.find((element) => element.attributes.get("data-slot") === name);
      expect([elements[0]?.name, elements[0]?.attributes.get("style")]).toEqual(["div", "width:512px"]);
      expect(slot("empty-media")?.attributes.get("data-variant")).toBe("icon");
    }
  );
});
