/**
 * The HTML the built Fuse Alert renders for a cell. Unit under test: the Alert definition's classes,
 * which compose Item's recipes with Alert's as `alert.tsx` does, and the renderer's host. Oracle: the
 * `class` attribute each part of the real Alert carries, and the kit's 512px preview width. The
 * markup check in `kit-markup.test.ts` reads a box's conditions and parts, not its classes, so it
 * cannot tell a definition that composes another Item variant, size or text face than Alert renders.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { ALERT } from "../components/alert-kit";
import type { BoxDefinition, Cell } from "../components/component-spec";
import { framePartsOf } from "../components/definition-parts";
import { alert } from "./alert-cell";
import { renderCellHtml } from "./cell-renderers";

/** The classes the definition gives each box a cell shows, by `data-slot`. */
function definedClasses(
  box: BoxDefinition,
  slot: string,
  cell: Cell
): readonly (readonly [string, string])[] {
  return [
    [slot, box.classesFor(cell)],
    ...framePartsOf(box)
      .filter((part) => part.shownIn(cell))
      .flatMap((part) => definedClasses(part, part.slot ?? part.key, cell)),
  ];
}

describe("the Alert renderer", () => {
  it.each([
    { variant: "warning", described: "on" },
    { variant: "default", described: "off" },
  ])("renders the $variant alert, described $described, with the classes the definition composes", (cell) => {
    const elements = elementsOf(renderCellHtml(alert, cell));
    const rendered = elements.flatMap((element): [string, string][] => {
      const slot = element.attributes.get("data-slot");
      return slot === undefined || slot === "alert-icon"
        ? []
        : [[slot, element.attributes.get("class") ?? ""]];
    });
    expect(elements[0]?.attributes.get("style")).toBe("width:512px");
    const bySlot = (left: readonly [string, string], right: readonly [string, string]) =>
      left[0].localeCompare(right[0]);
    expect(rendered.toSorted(bySlot)).toEqual(definedClasses(ALERT, ALERT.slot, cell).toSorted(bySlot));
  });
});
