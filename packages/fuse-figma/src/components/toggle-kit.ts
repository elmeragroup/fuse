/**
 * Toggle, as two component sets. `Toggle` holds every variant of the recipe at its four sizes,
 * in four states, off and on, with no icon, a start icon or an end icon: 192 cells. `Icon
 * toggle` holds the same variants, sizes, states and pressed values around one icon with no
 * label, 64 cells.
 *
 * - The `pressed` axis turns the Toggle off and on, as Base UI's Toggle stamps `aria-pressed` and
 *   `data-pressed` while it is pressed.
 * - Each icon is Star, as the Toggle docs place it, and a swap property picks it.
 */
import { toggleVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { IconManifest, LabelManifest, SetManifest } from "../capture/manifest";
import { swapProperties } from "./component-spec";
import type { Cell } from "./component-spec";
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

const STATE_AXIS = { name: "state", values: ["rest", "hover", "focus", "disabled"] };

const PRESSED_AXIS = { name: "pressed", values: ["off", "on"] };

/** Star, the icon the Toggle docs place on either side. */
const START_ICON: IconManifest = {
  key: "icon-start",
  name: "Start icon",
  side: "start",
  direct: true,
  dataIcon: "inline-start",
  icon: "Star",
  swapProperty: "Start icon",
};

const END_ICON: IconManifest = {
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
const ONLY_ICON: IconManifest = {
  key: "icon-only",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: "inline-start",
  icon: "Star",
  swapProperty: "Icon",
};

function toggleIcons(cell: Cell): readonly IconManifest[] {
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

/** The label, which the `Label` text property sets. */
const LABEL: LabelManifest = {
  key: "label",
  name: "label",
  characters: TOGGLE_LABEL,
  textProperty: "Label",
  shownIn: () => true,
};

/**
 * The Toggle's manifest, which the capture-backed build reads with `captures/toggle.json`: a Toggle
 * with a label, as `<Toggle>Toggle</Toggle>`, and an icon on either side.
 */
export const TOGGLE_MANIFEST: SetManifest = {
  key: "toggle",
  name: "Toggle",
  slot: "toggle",
  axes: [
    { name: "variant", values: VARIANTS },
    { name: "size", values: SIZES },
    STATE_AXIS,
    PRESSED_AXIS,
    { name: "icon", values: ["none", "start", "end"] },
  ],
  columnAxis: "state",
  label: LABEL,
  iconsFor: toggleIcons,
  swapProperties: swapProperties([START_ICON, END_ICON]),
};

/**
 * The Icon toggle's manifest, which the capture-backed build reads with `captures/icon-toggle.json`:
 * a Toggle around one icon, as `<Toggle aria-label="…"><Star data-icon="inline-start" /></Toggle>`.
 */
export const ICON_TOGGLE_MANIFEST: SetManifest = {
  key: "icon-toggle",
  name: "Icon toggle",
  slot: "toggle",
  axes: [{ name: "variant", values: VARIANTS }, { name: "size", values: SIZES }, STATE_AXIS, PRESSED_AXIS],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [ONLY_ICON],
  swapProperties: swapProperties([ONLY_ICON]),
};
