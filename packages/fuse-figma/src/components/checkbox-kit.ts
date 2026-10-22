/**
 * Checkbox, as one component set: off, on and mixed, in four states, with no label: 12 cells.
 *
 * - The root is Base UI's checkbox `<span data-slot="checkbox">`, a fixed 16px box at both
 *   densities. Checked and mixed fill it with `primary` and give it a `primary` border, through
 *   `data-checked:` and `data-indeterminate:`, which Base UI stamps on the root while it is
 *   checked or indeterminate. It rounds with `radius-checkbox`, `radius-md` capped at 4px.
 * - The indicator, `<span data-slot="checkbox-indicator">`, is a part below the root. Base UI
 *   mounts it only while the box is checked or mixed, so the off cells have no layer inside the
 *   box. It holds `Check` when checked and `Minus` when mixed, at 14px in the root's
 *   `primary-foreground`. The state picks the icon, so the set has no swap property.
 * - A span never matches `:disabled`, so `state-table.ts` holds `aria-disabled:` and
 *   `data-disabled:` at disabled, as Base UI stamps them. The recipe has no hover face.
 * - Invalid draws the `error` ring of a checkbox inside an invalid Field. `aria-checked:` holds
 *   only for `aria-checked="true"`, so a checked invalid box keeps its `primary` border, and a
 *   mixed one, which Base UI marks `aria-checked="mixed"`, takes the `error` border.
 * - The recipe's invalid focus ring needs invalid and focus at once, which no cell draws.
 * - The `after:` classes draw a hit area around the box, which paints nothing.
 */
import { checkboxVariants } from "@elmeragroup/fuse/recipe-catalog";

import { BASE_UI_CHECKED_FACTS } from "./component-spec";
import type { Cell, ComponentDefinition, IconSlot, PartDefinition } from "./component-spec";

const SLOTS = checkboxVariants();

const checked = (cell: Cell): boolean => cell.checked === "on";
const mixed = (cell: Cell): boolean => cell.checked === "mixed";

/** The glyph the indicator holds, a child of it. Checkbox renders `Check` or `Minus` itself. */
function glyph(icon: "Check" | "Minus"): IconSlot {
  return {
    key: "icon",
    name: "Icon",
    side: "start",
    direct: true,
    dataIcon: undefined,
    icon,
    swapProperty: undefined,
  };
}

const CHECK = glyph("Check");
const MINUS = glyph("Minus");

/** The indicator Base UI mounts while the box is checked or mixed. */
const INDICATOR: PartDefinition = {
  key: "indicator",
  slot: "checkbox-indicator",
  shownIn: (cell) => checked(cell) || mixed(cell),
  classesFor: () => SLOTS.indicator(),
  label: undefined,
  iconsFor: (cell) => [mixed(cell) ? MINUS : CHECK],
};

/** A checkbox, as `<Checkbox aria-label="Accept" />` with `defaultChecked` or `indeterminate`. */
export const CHECKBOX: ComponentDefinition = {
  key: "checkbox",
  name: "Checkbox",
  slot: "checkbox",
  rootKind: "base-ui-span",
  axes: [
    { name: "checked", values: ["off", "on", "mixed"] },
    { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
  ],
  columnAxis: "state",
  classesFor: () => SLOTS.root(),
  states: {},
  // Base UI also stamps `data-indeterminate` and `aria-checked="mixed"` on a mixed box.
  facts: new Map([...BASE_UI_CHECKED_FACTS, ["data-indeterminate", mixed]]),
  omittedStates: new Set(),
  omittedPseudoElements: new Map([["after", "a hit area around the box, which paints nothing"]]),
  label: undefined,
  iconsFor: () => [],
  parts: [INDICATOR],
  swapProperties: [],
};
