/**
 * The HTML the built Fuse Breadcrumb parts render for each Breadcrumb cell. The unit under test is
 * the four Breadcrumb renderers, and the oracle is Breadcrumb's composition in its docs demos: a
 * link, the page and the ellipsis sit in a `Breadcrumb.Item`, the separator sits beside the items,
 * and all of them sit in the `Breadcrumb.List` whose type and muted text color `breadcrumb-kit.ts`
 * passes to every set. The markup check in `kit-markup.test.ts` reads only the measured element and
 * what it holds, so it cannot tell a part rendered in its list from one rendered alone, which the
 * page would draw in its own 16px type and `foreground`.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { breadcrumbEllipsis, breadcrumbLink, breadcrumbPage, breadcrumbSeparator } from "./breadcrumb-cell";
import type { CellRendering } from "./cell-renderers";
import { renderCellHtml } from "./cell-renderers";

/** The tag and `data-slot` of the measured part and of each ancestor above it, the part first. */
function slotChain(rendering: CellRendering, slot: string): readonly string[] {
  const elements = elementsOf(renderCellHtml(rendering, {}));
  const chain = (index: number | undefined): readonly string[] => {
    const element = index === undefined ? undefined : elements[index];
    return element === undefined
      ? []
      : [`${element.name}[${element.attributes.get("data-slot") ?? ""}]`, ...chain(element.parent)];
  };
  const parts = elements.flatMap((element, index) =>
    element.attributes.get("data-slot") === slot ? [index] : []
  );
  expect(parts, slot).toHaveLength(1);
  return chain(parts[0]);
}

const ITEM_IN_TRAIL = ["li[breadcrumb-item]", "ol[breadcrumb-list]", "nav[breadcrumb]"];

describe("the Breadcrumb renderers", () => {
  it.each([
    ["breadcrumb-link", breadcrumbLink, ["a[breadcrumb-link]", ...ITEM_IN_TRAIL]],
    ["breadcrumb-page", breadcrumbPage, ["span[breadcrumb-page]", ...ITEM_IN_TRAIL]],
    ["breadcrumb-ellipsis", breadcrumbEllipsis, ["span[breadcrumb-ellipsis]", ...ITEM_IN_TRAIL]],
    [
      "breadcrumb-separator",
      breadcrumbSeparator,
      ["li[breadcrumb-separator]", "ol[breadcrumb-list]", "nav[breadcrumb]"],
    ],
  ] as const)("render %s inside its list, as the trail places it", (slot, rendering, chain) => {
    expect(slotChain(rendering, slot)).toEqual(chain);
  });
});
