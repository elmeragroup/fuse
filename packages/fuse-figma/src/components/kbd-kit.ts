/**
 * Kbd, as one component set: a key cap that holds a label or one icon, 2 cells. The recipe
 * declares no axes, so the set's one property is what the cap holds, `content`, which is also
 * its column axis.
 *
 * - The cap is the recipe's `cap` slot, a 20px `<kbd data-slot="kbd">` with a muted fill and a
 *   border hairline. It reads no density metric.
 * - The text cap holds the `Label` text, `K` by default, as the docs demos place `Ctrl`, `K` or
 *   `Enter`. The icon cap holds one icon at the cap's 12px icon size, picked by `Icon`.
 * - `tabular-nums` has no Figma form, so the label keeps the font's default numerals.
 * - Kbd group lays out caps in a row, which waits for kit components that hold instances.
 */
import { kbdVariants } from "@elmeragroup/fuse/recipe-catalog";

import { swapProperties } from "./component-spec";
import type { Cell, ComponentDefinition, IconSlot } from "./component-spec";

const CAP = kbdVariants().cap();

/** Backspace, a roster icon that reads as a key. The roster has no Command icon. */
const ICON: IconSlot = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "Backspace",
  swapProperty: "Icon",
};

const holdsIcon = (cell: Cell): boolean => cell.content === "icon";

/** A key cap, as `<Kbd>K</Kbd>`, or around one icon, as `<Kbd><Backspace /></Kbd>`. */
export const KBD: ComponentDefinition = {
  key: "kbd",
  name: "Kbd",
  slot: "kbd",
  axes: [{ name: "content", values: ["text", "icon"] }],
  columnAxis: "content",
  classesFor: () => CAP,
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: {
    key: "label",
    name: "label",
    characters: "K",
    textProperty: "Label",
    shownIn: (cell) => !holdsIcon(cell),
  },
  iconsFor: (cell) => (holdsIcon(cell) ? [ICON] : []),
  swapProperties: swapProperties([ICON]),
};
