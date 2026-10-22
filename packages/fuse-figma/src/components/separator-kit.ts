/**
 * Separator, as one component set: a horizontal and a vertical line, 2 cells. A Separator is a
 * non-interactive `<div role="separator" data-slot="separator">`, so the set has no state axis, and
 * its columns are the orientations.
 *
 * - The line is 1px thick and filled with the `border` role. Base UI stamps `data-orientation`,
 *   which fuse.css's `data-horizontal:` and `data-vertical:` variants read.
 * - The recipe takes the line's length from its container: `w-full` across a horizontal one and
 *   `self-stretch` along a vertical one's row. The kit draws no container, so each cell passes the
 *   length a docs demo gives as consumer classes: 256px horizontal, as the `w-64` column demo, and
 *   16px vertical, as the header demo's `data-vertical:h-4 data-vertical:self-auto`.
 */
import { cn, separatorClass } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition } from "./component-spec";

/**
 * The docs demos' lengths, as consumer classes. The kit merges them over the recipe as Separator
 * merges a consumer's `className`, and the compare renderer passes them as that `className`.
 */
export const DEMO_LENGTHS = "data-horizontal:w-64 data-vertical:h-4 data-vertical:self-auto";

/** A separator, as `<Separator orientation={orientation} className={DEMO_LENGTHS} />`. */
export const SEPARATOR: ComponentDefinition = {
  key: "separator",
  name: "Separator",
  slot: "separator",
  axes: [{ name: "orientation", values: ["horizontal", "vertical"] }],
  columnAxis: "orientation",
  classesFor: () => cn(separatorClass, DEMO_LENGTHS),
  states: {},
  // Base UI stamps `data-orientation` with the separator's orientation.
  facts: new Map([
    ["data-horizontal", (cell: Cell) => cell.orientation === "horizontal"],
    ["data-vertical", (cell: Cell) => cell.orientation === "vertical"],
  ]),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  swapProperties: [],
};
