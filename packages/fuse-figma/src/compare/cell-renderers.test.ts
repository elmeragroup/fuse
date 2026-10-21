/**
 * Every definition the kit builds has a renderer, and each cell its preview frames place renders
 * one element for the page to measure. Unit under test: each renderer's markup. Oracle: the
 * page's measured selector, `> [data-slot="<slot>"]`, which matches the slot's direct children
 * whose `data-slot` is the definition's `slot`. The page forces, signs and crops the one element
 * it matches, so none or two would compare the wrong box.
 */
import { describe, expect, it } from "vitest";

import { variantKey } from "../components/component-spec";
import { KIT } from "../components/kit-registry";
import { loadRenderers, renderCellHtml } from "./cell-renderers";

/** Elements HTML never closes. */
const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

/** The start tags of an HTML fragment's top-level elements, the slot's direct children. */
function topLevelTags(html: string): readonly string[] {
  const tags: string[] = [];
  let depth = 0;
  for (const [tag, closing, name = "", selfClosing] of html.matchAll(
    /<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g
  )) {
    if (closing === "/") {
      depth -= 1;
      continue;
    }
    if (depth === 0) {
      tags.push(tag);
    }
    if (selfClosing !== "/" && !VOID_ELEMENTS.has(name.toLowerCase())) {
      depth += 1;
    }
  }
  return tags;
}

describe("the cell renderers", () => {
  it("render every definition the kit builds, with one measured element per preview cell", async () => {
    const renderers = await loadRenderers();
    expect(KIT.map(({ definition }) => definition.key).filter((key) => !renderers.has(key))).toEqual([]);
    for (const { definition, previewCells } of KIT) {
      const renderer = renderers.get(definition.key);
      if (renderer === undefined) {
        continue;
      }
      for (const cell of previewCells) {
        const roots = topLevelTags(renderCellHtml(renderer, cell)).filter((tag) =>
          tag.includes(` data-slot="${definition.slot}"`)
        );
        expect(roots, variantKey(definition, cell)).toHaveLength(1);
      }
    }
  });
});
