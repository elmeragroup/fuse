/**
 * Switch, as one component set: two sizes, off and on, in four states, with no label: 16 cells.
 *
 * - The root is Base UI's switch `<span data-slot="switch">`, the track: 32px by 18.4px at
 *   `default` and 24px by 14px at `sm`, at both densities. Off, it is a `muted-foreground`
 *   outline. On fills it with `primary` and gives it a `primary` border, through `data-checked:`,
 *   which Base UI stamps on the track while it is checked. `rounded-full` draws as half its height.
 * - The thumb, `<span data-slot="switch-thumb">`, is a 16px or 12px circle below the track, always
 *   mounted. Base UI stamps the same `data-checked` or `data-unchecked` on it. Its translate
 *   places it: at the start of the track's row while off, and flush with the end while on, which
 *   the track's alignment draws, MIN off and MAX on.
 * - Off, `scale-75` draws the thumb at 75%, a 12px or 9px dot centered where the 16px or 12px
 *   thumb sits. The thumb is a transparent slot at its full size in every cell, holding a `dot`
 *   layer at the size it paints, so every cell has the same layer tree.
 * - A span never matches `:disabled`, so `state-table.ts` holds `aria-disabled:` and
 *   `data-disabled:` at disabled, as Base UI stamps them. The recipe has no hover face.
 * - Invalid draws the `error` border and ring of a switch inside an invalid Field.
 * - The recipe's invalid focus ring needs invalid and focus at once, which no cell draws.
 * - The `after:` classes draw a hit area around the track, which paints nothing.
 */
import { switchVariants } from "@elmeragroup/fuse/recipe-catalog";

import { BASE_UI_CHECKED_FACTS } from "./component-spec";
import type { Cell, ComponentDefinition, PartDefinition } from "./component-spec";
import { ownKey } from "./own-key";

type SwitchSize = keyof typeof switchVariants.variants.size;

/** Every size the recipe declares, in its order, the default first. */
const SIZES = Object.keys(switchVariants.variants.size).filter(isSize);

function isSize(value: string | undefined): value is SwitchSize {
  return ownKey(switchVariants.variants.size, value);
}

/** The recipe's slots for a cell's size. */
function slotsFor(cell: Cell) {
  const { size } = cell;
  if (!isSize(size)) {
    throw new Error(`Switch has no size ${size ?? ""}`);
  }
  return switchVariants({ size });
}

/** The thumb, which Base UI mounts in every cell. */
const THUMB: PartDefinition = {
  key: "thumb",
  slot: "switch-thumb",
  shownIn: () => true,
  classesFor: (cell) => slotsFor(cell).thumb(),
  label: undefined,
  iconsFor: () => [],
};

/** A switch, as `<Switch aria-label="Notifications" />` with `size` and `defaultChecked`. */
export const SWITCH: ComponentDefinition = {
  key: "switch",
  name: "Switch",
  slot: "switch",
  rootKind: "base-ui-span",
  axes: [
    { name: "size", values: SIZES },
    { name: "checked", values: ["off", "on"] },
    { name: "state", values: ["rest", "focus", "disabled", "invalid"] },
  ],
  columnAxis: "state",
  // The track takes the control's classes on top of the look, as `Switch` composes them.
  classesFor: (cell) => {
    const slots = slotsFor(cell);
    return slots.root({ class: slots.control() });
  },
  states: {},
  facts: BASE_UI_CHECKED_FACTS,
  omittedStates: new Set(),
  omittedPseudoElements: new Map([["after", "a hit area around the track, which paints nothing"]]),
  label: undefined,
  iconsFor: () => [],
  parts: [THUMB],
  swapProperties: [],
};
