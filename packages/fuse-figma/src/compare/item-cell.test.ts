/**
 * The HTML the built Fuse Item renders for each cell. The unit under test is the Item and Item link
 * renderers. The oracle is Item's public contract and the docs Basic and As a link demos: the row
 * fills a 384px host, the width the kit draws it at, and writes its `variant` as `data-variant`, and
 * `Item.Media` writes its own `variant` the same way. The markup check in `kit-markup.test.ts` reads
 * no host width, no row variant and no media variant, so it cannot tell a row in a slot that shrinks
 * to its content, another row variant, or the frameless default media in place of the icon box.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import type { CellRendering } from "./cell-renderers";
import { item, itemLink } from "./item-cell";

/** The host, the row's variant and the media's variant a cell renders. */
function looks(renderer: CellRendering, cell: Record<string, string>) {
  const elements = elementsOf(renderCellHtml(renderer, cell));
  const slot = (name: string) => elements.find((element) => element.attributes.get("data-slot") === name);
  return [
    elements[0]?.attributes.get("style"),
    slot("item")?.attributes.get("data-variant"),
    slot("item-media")?.attributes.get("data-variant"),
  ];
}

describe("the Item renderers", () => {
  it.each([
    ["outline", "icon"],
    ["muted", "image"],
  ])("renders an %s row with %s media in a 384px host", (variant, media) => {
    expect(looks(item, { variant, size: "sm", described: "on", media })).toEqual([
      "width:384px",
      variant,
      media,
    ]);
  });

  it("renders an outline link row with icon media in a 384px host", () => {
    expect(looks(itemLink, { variant: "outline", state: "rest" })).toEqual([
      "width:384px",
      "outline",
      "icon",
    ]);
  });
});
