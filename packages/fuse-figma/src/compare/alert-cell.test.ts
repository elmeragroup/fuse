/**
 * The HTML the built Fuse Alert renders for a cell. Unit under test: the Alert definition's classes,
 * which compose Item's recipes with Alert's as `alert.tsx` does, and the renderer's host. Oracle: the
 * `class` attribute each part of the real Alert carries, and the kit's 512px preview width. The
 * markup check in `kit-markup.test.ts` reads a box's conditions and parts, not a frame's classes, so
 * it cannot tell a definition that composes another Item variant, size or text face than Alert
 * renders. It does read the class of the action's Button, an instance part, so this suite leaves the
 * Button out.
 */
import { describe, expect, it } from "vitest";

import { rendersIn } from "../../test/markup-tree";
import { elementsOf } from "../../test/static-markup";
import { ALERT } from "../components/alert-kit";
import type { BoxDefinition, Cell } from "../components/component-spec";
import { framePartsOf } from "../components/definition-parts";
import { alert } from "./alert-cell";
import { renderCellHtml } from "./cell-renderers";

/** The classes the definition gives each frame a cell shows with the given properties on, by `data-slot`. */
function definedClasses(
  box: BoxDefinition,
  slot: string,
  cell: Cell,
  turnedOn: ReadonlySet<string>
): readonly (readonly [string, string])[] {
  return [
    [slot, box.classesFor(cell)],
    ...framePartsOf(box)
      .filter((part) => rendersIn(part, cell, turnedOn))
      .flatMap((part) => definedClasses(part, part.slot ?? part.key, cell, turnedOn)),
  ];
}

describe("the Alert renderer", () => {
  it.each([
    { cell: { variant: "warning", described: "on" }, on: [] },
    { cell: { variant: "default", described: "off" }, on: [] },
    { cell: { variant: "destructive", described: "on" }, on: ["Action"] },
  ])(
    "renders the $cell.variant alert, described $cell.described, with $on on, with the classes the definition composes",
    ({ cell, on }) => {
      const turnedOn = new Set(on);
      const elements = elementsOf(renderCellHtml(alert, cell, turnedOn));
      const rendered = elements.flatMap((element): [string, string][] => {
        const slot = element.attributes.get("data-slot");
        return slot === undefined || slot === "alert-icon" || slot === "button"
          ? []
          : [[slot, element.attributes.get("class") ?? ""]];
      });
      expect(elements[0]?.attributes.get("style")).toBe("width:512px");
      const bySlot = (left: readonly [string, string], right: readonly [string, string]) =>
        left[0].localeCompare(right[0]);
      expect(rendered.toSorted(bySlot)).toEqual(
        definedClasses(ALERT, ALERT.slot, cell, turnedOn).toSorted(bySlot)
      );
    }
  );
});
