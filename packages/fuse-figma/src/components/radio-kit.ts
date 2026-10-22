/**
 * Radio, as one component set: off and on, in four states, with no label: 8 cells.
 *
 * - The root is Base UI's radio `<span data-slot="radio-group-item">`, a fixed 16px circle at
 *   both densities, which renders checked only inside a `RadioGroup`. Checked fills it with
 *   `primary` and gives it a `primary` border, through `data-checked:`, which Base UI stamps on
 *   the root while it is checked. `rounded-full` draws as an 8px corner, half its side.
 * - The indicator, `<span data-slot="radio-group-indicator">`, is a 16px part below the root that
 *   centers the dot. Base UI mounts it only while the radio is checked, so the off cells have no
 *   layer inside the circle.
 * - The dot is an 8px `primary-foreground` circle with no `data-slot`, so its layer takes its key
 *   as its name. It centers itself on the root with `absolute top-1/2 left-1/2` and a -50%
 *   translate, which the indicator's centered auto layout draws.
 * - A span never matches `:disabled`, so `state-table.ts` holds `aria-disabled:` and
 *   `data-disabled:` at disabled, as Base UI stamps them. The recipe has no hover face.
 * - Invalid draws the `error` ring of a radio in an invalid `RadioGroup`. `aria-checked:` holds
 *   for a checked radio, so a checked invalid radio keeps its `primary` border, and an unchecked
 *   one takes the `error` border.
 * - The recipe's invalid focus ring needs invalid and focus at once, which no cell draws.
 * - The `after:` classes draw a hit area around the circle, which paints nothing.
 */
import { radioVariants } from "@elmeragroup/fuse/recipe-catalog";

import { BASE_UI_CHECKED_FACTS } from "./component-spec";
import type { Cell, ComponentDefinition, PartDefinition } from "./component-spec";

const SLOTS = radioVariants();

const checked = (cell: Cell): boolean => cell.checked === "on";

/** The dot inside the indicator. It has no `data-slot`, so the markup check finds it by place. */
const DOT: PartDefinition = {
  key: "dot",
  slot: undefined,
  shownIn: () => true,
  classesFor: () => SLOTS.dot(),
  label: undefined,
  iconsFor: () => [],
};

/** The indicator Base UI mounts while the radio is checked. */
const INDICATOR: PartDefinition = {
  key: "indicator",
  slot: "radio-group-indicator",
  shownIn: checked,
  classesFor: () => SLOTS.indicator(),
  label: undefined,
  iconsFor: () => [],
  parts: [DOT],
};

/** A radio, as `<RadioGroupItem value="a" aria-label="Option" />` inside a `RadioGroup`. */
export const RADIO: ComponentDefinition = {
  key: "radio",
  name: "Radio",
  slot: "radio-group-item",
  rootKind: "base-ui-span",
  axes: [
    { name: "checked", values: ["off", "on"] },
    { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
  ],
  columnAxis: "state",
  classesFor: () => SLOTS.root(),
  states: {},
  facts: BASE_UI_CHECKED_FACTS,
  omittedStates: new Set(),
  omittedPseudoElements: new Map([["after", "a hit area around the circle, which paints nothing"]]),
  label: undefined,
  iconsFor: () => [],
  parts: [INDICATOR],
  swapProperties: [],
};
