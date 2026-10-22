/**
 * The HTML the built Fuse Pagination parts render for a link cell. The unit under test is the
 * Pagination link renderer, and the oracle is `Pagination.Link`'s JSDoc: the current page renders
 * `aria-current="page"`, and a link that is not current omits the attribute entirely. The markup
 * check in `kit-markup.test.ts` reads no `aria-current`, since no recipe variant selects it, so it
 * cannot tell a current cell from one that is not.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { renderCellHtml } from "./cell-renderers";
import { paginationLink } from "./pagination-cell";

/** The attributes of the HTML's one `<a>`, by name, without its class. */
function linkAttributes(html: string): ReadonlyMap<string, string> {
  const links = elementsOf(html).filter((element) => element.name === "a");
  const [only] = links;
  if (links.length !== 1 || only === undefined) {
    throw new Error(`not one <a> in ${html}`);
  }
  return new Map([...only.attributes].filter(([name]) => name !== "class"));
}

describe("the Pagination link renderer", () => {
  it("marks only the current link aria-current, and changes no other attribute", () => {
    const off = linkAttributes(renderCellHtml(paginationLink, { current: "off", state: "rest" }));
    const on = linkAttributes(renderCellHtml(paginationLink, { current: "on", state: "rest" }));
    expect(off.has("aria-current")).toBe(false);
    expect(on.get("aria-current")).toBe("page");
    expect(new Map([...on].filter(([name]) => name !== "aria-current"))).toEqual(off);
  });
});
