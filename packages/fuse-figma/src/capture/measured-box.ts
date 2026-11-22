/**
 * What the capture measured of a box's element, as the mapping reads it through {@link MeasuredBox}:
 * Chromium's layout facts for the element, and how far above it the blocks of the elements below it
 * sit.
 */

import type { MeasuredBox } from "../components/box-cascade.ts";
import type { CapturedDeclaration, CapturedElement } from "./capture-format.ts";

/** Why the build draws a box's text, or its wrapping row, on one line. */
const MEASURED_ONE_LINE = "the capture measured it on one line in this cell";

/** Why the build draws a box under its `max-height`. */
const MEASURED_UNDER_MAX_HEIGHT = "the capture measured it under its max-height";

/**
 * What the capture measured of a box's element, as the mapping reads it. A `max-height` that reads
 * Base UI's measured `--available-height` is the page's room, not the box's, so the box's measured
 * height under it says nothing about the set. `parentSpansBlock` speaks of the element's parent, so
 * it holds only where `drawnParent` says the kit draws that parent as the box's frame.
 */
export function measuredBox(
  element: CapturedElement,
  declarations: readonly CapturedDeclaration[],
  drawnParent: boolean
): MeasuredBox {
  const facts = element.measured;
  const maxHeight = element.declarations
    .map((index) => declarations[index])
    .findLast((declaration) => declaration?.longhands.includes("max-height") === true);
  const holds = (each: CapturedElement): boolean =>
    each.measured?.widest === true || each.children.some(holds);
  // For each element below with `blockSteps`, how far above this element its block sits, and whether
  // it is a child of this element whose parent spans the block.
  const blocks = (each: CapturedElement, down: number): readonly (readonly [number, boolean])[] =>
    each.children.flatMap((child) => {
      const steps = child.measured?.blockSteps;
      const own =
        steps === undefined || steps < down + 1
          ? []
          : [[steps - down - 1, down === 0 && child.measured?.parentSpansBlock === true] as const];
      return [...own, ...blocks(child, down + 1)];
    });
  const below = blocks(element, 0);
  return {
    fitsOneLine: facts?.oneLine === true ? MEASURED_ONE_LINE : undefined,
    underMaxHeight:
      facts?.underMaxHeight === true && maxHeight?.value.includes("--available-") !== true
        ? MEASURED_UNDER_MAX_HEIGHT
        : undefined,
    underMaxWidth: facts?.underMaxWidth === true,
    cornersFit: facts?.cornersFit === true,
    freeAlongMain: facts?.freeAlongMain === true,
    fitsAlongMain: facts?.fitsAlongMain === true,
    oneFlexLine: facts?.oneFlexLine === true,
    itemsAtContent: facts?.itemsAtContent === true,
    tableTiles: facts?.tableTiles === true,
    bordersCollapse: facts?.bordersCollapse === true,
    otherFlow: facts?.otherFlow ?? [],
    zeroWidths: facts?.zeroWidths === true,
    inlineRow: facts?.inlineRow === true,
    widest: facts?.widest === true,
    holdsWidest: holds(element),
    lineFits: facts?.lineFits === true,
    ellipsisFits: facts?.ellipsisFits === true,
    trackFits: facts?.trackFits === true,
    ratio: facts?.ratio,
    gridHugs: facts?.gridHugs ?? [],
    gridHolds: facts?.gridHolds ?? [],
    gridWidest: facts?.gridWidest ?? [],
    gridTallest: facts?.gridTallest ?? [],
    gridItems: facts?.gridItems,
    gridItem: facts?.gridItem,
    noBox: facts?.noBox === true,
    parentSpansBlock: drawnParent && facts?.parentSpansBlock === true,
    blockSteps: facts?.blockSteps,
    blocksBelow: new Set(below.flatMap(([above, spanned]) => (spanned ? [] : [above]))),
    spannedBelow: new Set(below.flatMap(([above, spanned]) => (spanned ? [above] : []))),
    oneLength: new Set(facts?.oneLength ?? []),
    spansBeside: facts?.spansBeside,
    paintsLast: facts?.paintsLast === true,
    identityTransform: facts?.identityTransform === true,
  };
}
