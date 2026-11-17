/**
 * Button, as two component sets. `Button` holds every variant of the recipe at the four label
 * sizes, in five states, with no icon, a start icon or an end icon: 420 cells. `Icon button`
 * holds every variant at the four square sizes in five states, 140 cells, each an icon with no
 * label.
 *
 * - The `state` axis holds rest, hover, focus, disabled and pending. A pending cell shows a spinner
 *   in the leading slot, as `isPending` renders it.
 * - Each icon is an instance of the kit's icon components, which a swap property picks.
 * - `icon-inline` stays out. It takes its size from the surrounding text line, which a standalone
 *   component does not have.
 */
import { buttonVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { IconManifest, SetManifest } from "../capture/manifest";
import { swapProperties } from "./component-spec";
import type { Cell } from "./component-spec";
import { ownKey } from "./own-key";

type ButtonVariant = keyof typeof buttonVariants.variants.variant;
type ButtonSize = keyof typeof buttonVariants.variants.size;

/** Every variant the recipe declares, in its order, so a new variant reaches Figma too. */
const VARIANTS = Object.keys(buttonVariants.variants.variant).filter(isVariant);

/**
 * The sizes in the recipe's order, with its default first. Figma makes the top-left variant a
 * set's default, so an instance a designer places starts at the size `<Button>` renders.
 */
export const BUTTON_LABEL_SIZES = ["default", "xs", "sm", "lg"] as const satisfies readonly ButtonSize[];
const ICON_SIZES = ["icon", "icon-xs", "icon-sm", "icon-lg"] as const satisfies readonly ButtonSize[];

function isVariant(value: string | undefined): value is ButtonVariant {
  return ownKey(buttonVariants.variants.variant, value);
}

const STATE_AXIS = { name: "state", values: ["rest", "hover", "focus", "disabled", "pending"] };

/**
 * The spinner `isPending` renders in a span that carries `data-icon="inline-start"`, so a
 * pending cell takes the start icon's padding even with no icon of its own.
 */
const SPINNER: IconManifest = {
  key: "spinner",
  name: "Spinner",
  side: "start",
  direct: false,
  dataIcon: "inline-start",
  icon: "SpinnerGap",
  swapProperty: undefined,
};

const START_ICON: IconManifest = {
  key: "icon-start",
  name: "Start icon",
  side: "start",
  direct: true,
  dataIcon: "inline-start",
  icon: "Plus",
  swapProperty: "Start icon",
};

const END_ICON: IconManifest = {
  key: "icon-end",
  name: "End icon",
  side: "end",
  direct: true,
  dataIcon: "inline-end",
  icon: "ArrowRight",
  swapProperty: "End icon",
};

/** The one icon of an icon button, a bare `<svg>` child, as `<Button size="icon"><Plus /></Button>`. */
const ONLY_ICON: IconManifest = {
  key: "icon-only",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "Plus",
  swapProperty: "Icon",
};

/**
 * The icons the cell's `icon` value places, then the spinner when the cell is pending, in DOM
 * order. Button renders the spinner after its children and `order-first` draws it first.
 */
function buttonIcons(cell: Cell): readonly IconManifest[] {
  const pending = cell.state === "pending" ? [SPINNER] : [];
  switch (cell.icon) {
    case "start":
      return [START_ICON, ...pending];
    case "end":
      return [END_ICON, ...pending];
    default:
      return pending;
  }
}

/**
 * The label every `Button` cell shows, the default of the `Label` text property. The compare
 * renderer renders the same text, and names each icon button with it.
 */
export const BUTTON_LABEL = "Button";

/** The Button's manifest, which the capture-backed build reads with `captures/button.json`. */
export const BUTTON_MANIFEST: SetManifest = {
  key: "button",
  name: "Button",
  slot: "button",
  axes: [
    { name: "variant", values: VARIANTS },
    { name: "size", values: BUTTON_LABEL_SIZES },
    STATE_AXIS,
    { name: "icon", values: ["none", "start", "end"] },
  ],
  columnAxis: "state",
  label: {
    key: "label",
    name: "label",
    characters: BUTTON_LABEL,
    textProperty: "Label",
    shownIn: () => true,
  },
  iconsFor: buttonIcons,
  swapProperties: swapProperties([START_ICON, END_ICON]),
};

/**
 * The Icon button's manifest, which the capture-backed build reads with `captures/icon-button.json`.
 * Its square sizes are the ones `<Button size="icon">` renders around a lone icon.
 */
export const ICON_BUTTON_MANIFEST: SetManifest = {
  key: "icon-button",
  name: "Icon button",
  slot: "button",
  axes: [{ name: "variant", values: VARIANTS }, { name: "size", values: ICON_SIZES }, STATE_AXIS],
  columnAxis: "state",
  label: undefined,
  // The icons sit in DOM order. Button renders the spinner after its children, and the recipe
  // hides the icon while the spinner shows, so the kit draws the spinner alone.
  iconsFor: (cell) => (cell.state === "pending" ? [ONLY_ICON, SPINNER] : [ONLY_ICON]),
  swapProperties: swapProperties([ONLY_ICON]),
};
