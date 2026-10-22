/**
 * Radio icon button, as one component set: the recipe's five square sizes, off and on, in five
 * states, around one icon with no label: 50 cells.
 *
 * - The root is Base UI's radio `<span data-slot="radio-icon-button">`, which renders checked only
 *   inside a `RadioGroup`. A checked button draws a `primary` border and fills with `muted`
 *   through `data-checked:`, which Base UI stamps while the radio is checked. Hover paints the
 *   same `muted`, so a checked button looks the same at rest and on hover.
 * - A span never matches `:disabled`, so `state-table.ts` holds `aria-disabled:` and
 *   `data-disabled:` at disabled, as Base UI stamps them, and gives hover, focus and invalid their
 *   variants. Invalid draws the `error` border and ring of a radio inside an invalid Field.
 * - The recipe's invalid focus ring needs invalid and focus at once, which no cell draws.
 * - Each size is the control size's `square` fit and reads its own row of the `Fuse density`
 *   control metrics. `icon-xxs` and `icon-xs` share the xs square and differ by icon size.
 */
import { radioIconButtonVariants } from "@elmeragroup/fuse/recipe-catalog";

import { swapProperties } from "./component-spec";
import type { Cell, ComponentDefinition, IconSlot } from "./component-spec";
import { ownKey } from "./own-key";

type RadioIconButtonSize = keyof typeof radioIconButtonVariants.variants.size;

/** The sizes with the recipe's default first, the size `<RadioIconButton>` renders. */
const SIZES = [
  "icon",
  "icon-xxs",
  "icon-xs",
  "icon-sm",
  "icon-lg",
] as const satisfies readonly RadioIconButtonSize[];

function isSize(value: string | undefined): value is RadioIconButtonSize {
  return ownKey(radioIconButtonVariants.variants.size, value);
}

function classesFor(cell: Cell): string {
  const { size } = cell;
  if (!isSize(size)) {
    throw new Error(`Radio icon button has no size ${size ?? ""}`);
  }
  return radioIconButtonVariants({ size });
}

/** List, the first icon the docs demo places. */
const ICON: IconSlot = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "List",
  swapProperty: "Icon",
};

/**
 * A radio icon button in a group, as
 * `<RadioGroup><RadioIconButton value="list" aria-label="List"><List /></RadioIconButton></RadioGroup>`.
 */
export const RADIO_ICON_BUTTON: ComponentDefinition = {
  key: "radio-icon-button",
  name: "Radio icon button",
  slot: "radio-icon-button",
  rootKind: "base-ui-span",
  axes: [
    { name: "size", values: SIZES },
    { name: "checked", values: ["off", "on"] },
    { name: "state", values: ["rest", "hover", "focus", "disabled", "invalid"] },
  ],
  columnAxis: "state",
  classesFor,
  states: {},
  // Base UI's radio renders `data-checked` and `aria-checked="true"` while it is checked.
  facts: new Map([
    ["data-checked", (cell: Cell) => cell.checked === "on"],
    ["aria-checked", (cell: Cell) => cell.checked === "on"],
  ]),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [ICON],
  swapProperties: swapProperties([ICON]),
};
