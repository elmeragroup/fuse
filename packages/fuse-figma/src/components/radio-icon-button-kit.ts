/**
 * Radio icon button, as one component set: the recipe's five square sizes, off and on, in five
 * states, around one icon with no label: 50 cells.
 *
 * - The root is Base UI's radio `<span data-slot="radio-icon-button">`, which renders checked only
 *   inside a `RadioGroup`.
 * - Invalid renders the button in an invalid Field.
 * - The icon is List, the first icon the docs demo places, which the `Icon` swap property picks.
 */
import type { radioIconButtonVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { IconManifest, SetManifest } from "../capture/manifest";
import { swapProperties } from "./component-spec";

type RadioIconButtonSize = keyof typeof radioIconButtonVariants.variants.size;

/** The sizes with the recipe's default first, the size `<RadioIconButton>` renders. */
const SIZES = [
  "icon",
  "icon-xxs",
  "icon-xs",
  "icon-sm",
  "icon-lg",
] as const satisfies readonly RadioIconButtonSize[];

/** List, the first icon the docs demo places. */
const ICON: IconManifest = {
  key: "icon",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "List",
  swapProperty: "Icon",
};

/**
 * The radio icon button's manifest, which the capture-backed build reads with
 * `captures/radio-icon-button.json`, as
 * `<RadioGroup><RadioIconButton value="list" aria-label="List"><List /></RadioIconButton></RadioGroup>`
 * renders it.
 */
export const RADIO_ICON_BUTTON_MANIFEST: SetManifest = {
  key: "radio-icon-button",
  name: "Radio icon button",
  slot: "radio-icon-button",
  axes: [
    { name: "size", values: SIZES },
    { name: "checked", values: ["off", "on"] },
    { name: "state", values: ["rest", "hover", "focus", "disabled", "invalid"] },
  ],
  columnAxis: "state",
  label: undefined,
  iconsFor: () => [ICON],
  swapProperties: swapProperties([ICON]),
};
