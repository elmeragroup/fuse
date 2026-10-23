/**
 * The HTML the built Fuse Accordion renders for an Accordion item cell. Unit under test: the
 * renderer's root props and host, and the definition's classes, which call `accordionVariants` with
 * the cell's variant and radius as `accordion.tsx` does. Oracle: the `class` attribute each part of
 * the real Accordion carries, and the kit's 384px preview width. The markup check in
 * `kit-markup.test.ts` reads the item's conditions, parts and caret classes, not the item's classes,
 * so it cannot tell a renderer that drops the radius or a definition that reads another one.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { ACCORDION_ITEM } from "../components/accordion-kit";
import type { BoxDefinition, Cell } from "../components/component-spec";
import { accordionItem } from "./accordion-cell";
import { renderCellHtml } from "./cell-renderers";

/** The classes the definition gives each box with a `data-slot` that a cell shows, by `data-slot`. */
function definedClasses(
  box: BoxDefinition,
  slot: string | undefined,
  cell: Cell
): readonly (readonly [string, string])[] {
  return [
    ...(slot === undefined ? [] : [[slot, box.classesFor(cell)] as const]),
    ...(box.parts ?? [])
      .filter((part) => part.shownIn(cell))
      .flatMap((part) => definedClasses(part, part.slot, cell)),
  ];
}

describe("the Accordion item renderer", () => {
  it.each([
    { variant: "card", radius: "xl", open: "on", state: "rest" },
    { variant: "default", radius: "lg", open: "off", state: "disabled" },
  ])(
    "renders the $variant item at radius $radius, open $open, with the classes the definition gives it",
    (cell) => {
      const elements = elementsOf(renderCellHtml(accordionItem, cell));
      const rendered = elements.flatMap((element): [string, string][] => {
        const slot = element.attributes.get("data-slot");
        return slot === undefined || slot === "accordion"
          ? []
          : [[slot, element.attributes.get("class") ?? ""]];
      });
      expect(elements[0]?.attributes.get("style")).toBe("width:384px");
      expect(rendered).toEqual(definedClasses(ACCORDION_ITEM, ACCORDION_ITEM.slot, cell));
    }
  );
});
