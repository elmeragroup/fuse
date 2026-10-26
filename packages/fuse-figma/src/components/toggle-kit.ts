/**
 * Toggle, as two component sets. `Toggle` holds every variant of the recipe at its four sizes,
 * in four states, off and on, with no icon, a start icon or an end icon: 192 cells. `Icon
 * toggle` holds the same variants, sizes, states and pressed values around one icon with no
 * label, 64 cells.
 *
 * - Both variants rest with no fill. `outline` draws an `input` border and casts `shadow-xs`.
 * - A pressed Toggle fills with `muted` through `aria-pressed:` and `data-pressed:`, which Base
 *   UI's Toggle stamps while it is pressed. Hover paints the same `muted`, so a pressed Toggle
 *   looks the same at rest and on hover.
 * - Each size is the control size's `min-square` fit. xs rounds with the compact corner, the
 *   synced `radius-compact`, and the other sizes with `radius-md`.
 * - `state-table.ts` gives hover, focus and disabled their variants and the icon edge its
 *   padding.
 */
import { toggleVariants } from "@elmeragroup/fuse/recipe-catalog";

import { swapProperties } from "./component-spec";
import type { Cell, ComponentDefinition, IconSlot } from "./component-spec";
import { ownKey } from "./own-key";

type ToggleVariant = keyof typeof toggleVariants.variants.variant;
type ToggleSize = keyof typeof toggleVariants.variants.size;

/** Every variant the recipe declares, in its order, so a new variant reaches Figma too. */
const VARIANTS = Object.keys(toggleVariants.variants.variant).filter(isVariant);

/** The sizes with the recipe's default first, the Toggle `<Toggle>` renders. */
const SIZES = ["default", "xs", "sm", "lg"] as const satisfies readonly ToggleSize[];

function isVariant(value: string | undefined): value is ToggleVariant {
  return ownKey(toggleVariants.variants.variant, value);
}

function isSize(value: string | undefined): value is ToggleSize {
  return ownKey(toggleVariants.variants.size, value);
}

function classesFor(cell: Cell): string {
  const { variant, size } = cell;
  if (!isVariant(variant) || !isSize(size)) {
    throw new Error(`Toggle has no variant ${variant ?? ""} or size ${size ?? ""}`);
  }
  return toggleVariants({ variant, size });
}

const STATE_AXIS = { name: "state", values: ["rest", "hover", "focus", "disabled"] };

const PRESSED_AXIS = { name: "pressed", values: ["off", "on"] };

const pressed = (cell: Cell): boolean => cell.pressed === "on";

/** Base UI's Toggle renders `aria-pressed="true"` and `data-pressed` while it is pressed. */
const FACTS = new Map([
  ["aria-pressed", pressed],
  ["data-pressed", pressed],
]);

/**
 * A disabled Toggle is a natively disabled `<button>`, which Base UI marks `data-disabled` and
 * never `aria-disabled`, so no cell shows the state face's `aria-disabled:` arm.
 */
const OMITTED_STATES = new Set(["aria-disabled"]);

/** Star, the icon the Toggle docs place on either side. */
const START_ICON: IconSlot = {
  key: "icon-start",
  name: "Start icon",
  side: "start",
  direct: true,
  dataIcon: "inline-start",
  icon: "Star",
  swapProperty: "Start icon",
};

const END_ICON: IconSlot = {
  key: "icon-end",
  name: "End icon",
  side: "end",
  direct: true,
  dataIcon: "inline-end",
  icon: "Star",
  swapProperty: "End icon",
};

/**
 * The one icon of an icon toggle, as the docs place it: `<Star data-icon="inline-start" />`
 * alone inside the Toggle, so it takes the start icon's padding.
 */
const ONLY_ICON: IconSlot = {
  key: "icon-only",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: "inline-start",
  icon: "Star",
  swapProperty: "Icon",
};

function toggleIcons(cell: Cell): readonly IconSlot[] {
  switch (cell.icon) {
    case "start":
      return [START_ICON];
    case "end":
      return [END_ICON];
    default:
      return [];
  }
}

/**
 * The label every `Toggle` cell shows, the default of the `Label` text property. The compare
 * renderer renders the same text, and names each icon toggle with it.
 */
export const TOGGLE_LABEL = "Toggle";

/** A Toggle with a label, as `<Toggle>Toggle</Toggle>`, and an icon on either side. */
export const TOGGLE: ComponentDefinition = {
  key: "toggle",
  name: "Toggle",
  slot: "toggle",
  rootKind: "native-control",
  axes: [
    { name: "variant", values: VARIANTS },
    { name: "size", values: SIZES },
    STATE_AXIS,
    PRESSED_AXIS,
    { name: "icon", values: ["none", "start", "end"] },
  ],
  columnAxis: "state",
  classesFor,
  states: {},
  facts: FACTS,
  omittedStates: OMITTED_STATES,
  label: {
    key: "label",
    name: "label",
    characters: TOGGLE_LABEL,
    textProperty: "Label",
    shownIn: () => true,
  },
  iconsFor: toggleIcons,
  swapProperties: swapProperties([START_ICON, END_ICON]),
};

/** A Toggle around one icon, as `<Toggle aria-label="…"><Star data-icon="inline-start" /></Toggle>`. */
export const ICON_TOGGLE: ComponentDefinition = {
  key: "icon-toggle",
  name: "Icon toggle",
  slot: "toggle",
  rootKind: "native-control",
  axes: [{ name: "variant", values: VARIANTS }, { name: "size", values: SIZES }, STATE_AXIS, PRESSED_AXIS],
  columnAxis: "state",
  classesFor,
  states: {},
  facts: FACTS,
  omittedStates: OMITTED_STATES,
  label: undefined,
  iconsFor: () => [ONLY_ICON],
  swapProperties: swapProperties([ONLY_ICON]),
};
