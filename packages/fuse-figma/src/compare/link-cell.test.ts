/**
 * The HTML the built Fuse Link renders for each cell of the `link` set. Unit under test: the Link
 * renderer, and the classes the kit definition gives each cell. Oracle: the static markup of the
 * real `Link`, which must carry the classes the kit draws at the cell's variant and underline on its
 * one `<a data-slot="link">`. The markup check in `kit-markup.test.ts` reads the attributes the
 * kit's variants select and not the classes, so it cannot tell one variant or underline from
 * another.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { matrixCells } from "../components/component-spec";
import type { Cell } from "../components/component-spec";
import { LINK } from "../components/link-kit";
import { renderCellHtml } from "./cell-renderers";
import { link } from "./link-cell";

function classes(value: string): ReadonlySet<string> {
  return new Set(value.split(" "));
}

/** The one `<a>` a cell renders. */
function anchorOf(cell: Cell) {
  const anchors = elementsOf(renderCellHtml(link, cell)).filter((element) => element.name === "a");
  expect(anchors, JSON.stringify(cell)).toHaveLength(1);
  const [anchor] = anchors;
  if (anchor === undefined) {
    throw new Error(`no <a> for ${JSON.stringify(cell)}`);
  }
  return anchor;
}

describe("the Link renderer", () => {
  it("renders the classes the kit gives each cell on the link's one anchor", () => {
    for (const cell of matrixCells(LINK.axes)) {
      const anchor = anchorOf(cell);
      expect(anchor.attributes.get("data-slot"), JSON.stringify(cell)).toBe("link");
      expect(anchor.attributes.get("href"), JSON.stringify(cell)).toBe("/invoices/1042");
      expect(classes(anchor.attributes.get("class") ?? ""), JSON.stringify(cell)).toEqual(
        classes(LINK.classesFor(cell))
      );
    }
  });
});
