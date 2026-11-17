/**
 * Confirm button, a set of its own on the Button page. ConfirmButton renders a Button that arms on
 * the first press and confirms on the second. Only its destructive and success variants style the
 * armed state, so the set holds those two at Button's four label sizes, in four states, armed off
 * and on: 64 cells.
 *
 * - Disabling a ConfirmButton disarms it, so a disabled cell draws disarmed at `armed=on` too.
 *   Pending disarms it as well, and Button's set draws pending, so this set leaves it out.
 * - The label is the docs' Destructive demo's resting `Delete`. The demos swap in a label while
 *   armed, such as `Confirm delete`, and a designer types it on the instance, since one text
 *   property holds one default.
 */
import type { confirmButtonVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { SetManifest } from "../capture/manifest";
import { BUTTON_LABEL_SIZES } from "./button-kit";

type RecipeVariant = keyof typeof confirmButtonVariants.variants.variant;

/** The variants `confirmButtonVariants` gives an armed face. */
const VARIANTS = ["destructive", "success"] as const satisfies readonly RecipeVariant[];

/**
 * The label every cell shows, the default of the `Label` text property. The compare renderer
 * renders the same text.
 */
export const CONFIRM_BUTTON_LABEL = "Delete";

/**
 * The Confirm button's manifest, which the capture-backed build reads with
 * `captures/confirm-button.json`. Its label names no element. ConfirmButton wraps the text in a
 * `<span>` with no class, so the label takes the button's own type.
 */
export const CONFIRM_BUTTON_MANIFEST: SetManifest = {
  key: "confirm-button",
  name: "Confirm button",
  slot: "button",
  axes: [
    { name: "variant", values: VARIANTS },
    { name: "size", values: BUTTON_LABEL_SIZES },
    { name: "state", values: ["rest", "hover", "focus", "disabled"] },
    { name: "armed", values: ["off", "on"] },
  ],
  columnAxis: "state",
  label: {
    key: "label",
    name: "label",
    characters: CONFIRM_BUTTON_LABEL,
    textProperty: "Label",
    shownIn: () => true,
  },
  iconsFor: () => [],
  swapProperties: [],
};
