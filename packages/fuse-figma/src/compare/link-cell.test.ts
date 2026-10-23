/**
 * The HTML the built Fuse Link renders for each cell of the `link` set, and the attributes the page
 * writes on the link when it forces the cell's state. Unit under test: the Link renderer, and the
 * classes the kit definition gives each cell, which copy what `react-aria/link/link.tsx` composes
 * from React Aria's render props. Oracle: the static markup of the real `Link`, whose `className`
 * function React Aria calls with `isFocusVisible` false and `isDisabled` as its prop says, and
 * Fuse's state focus ring, which answers `isFocusVisible` with `ring-2 ring-ring outline-hidden` in
 * place of the resting `outline-none` (`styles/utils.ts`). The markup check in `kit-markup.test.ts`
 * reads the attributes the kit's variants select and not the classes, so it cannot tell one variant
 * or weight from another, or check the class the page writes on a focused link.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { matrixCells } from "../components/component-spec";
import type { Cell } from "../components/component-spec";
import { LINK } from "../components/link-kit";
import { forcedAttributesFor, renderCellHtml } from "./cell-renderers";
import { link } from "./link-cell";

function classes(value: string): ReadonlySet<string> {
  return new Set(value.split(" "));
}

/** The classes of the one element marked `data-rac` that a cell renders. */
function renderedClasses(cell: Cell): ReadonlySet<string> {
  const links = elementsOf(renderCellHtml(link, cell)).filter((element) =>
    element.attributes.has("data-rac")
  );
  expect(links, JSON.stringify(cell)).toHaveLength(1);
  return classes(links[0]?.attributes.get("class") ?? "");
}

const CELLS = matrixCells(LINK.axes);

describe("the Link renderer", () => {
  it("renders the classes the kit gives a resting, hovered or disabled cell, at each variant and weight", () => {
    for (const cell of CELLS.filter(({ state }) => state !== "focus")) {
      expect(renderedClasses(cell), JSON.stringify(cell)).toEqual(classes(LINK.classesFor(cell)));
    }
  });

  it("writes React Aria's focus marks on a focused link, and its resting classes with the ring for the outline", () => {
    for (const cell of CELLS.filter(({ state }) => state === "focus")) {
      const ringed = new Set([
        ...[...renderedClasses({ ...cell, state: "rest" })].filter((name) => name !== "outline-none"),
        "ring-2",
        "ring-ring",
        "outline-hidden",
      ]);
      const { class: focused = "", ...marks } = forcedAttributesFor(link, cell);
      expect(marks, JSON.stringify(cell)).toEqual({ "data-focused": "true", "data-focus-visible": "true" });
      expect(classes(focused), JSON.stringify(cell)).toEqual(ringed);
      expect(classes(LINK.classesFor(cell)), JSON.stringify(cell)).toEqual(ringed);
    }
  });
});
