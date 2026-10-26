/**
 * The renderer of the `confirm-button` set: each cell as the real Fuse `<ConfirmButton>` around the
 * label `confirm-button-kit.ts` draws.
 *
 * - `variant` and `size` set the props of the same name, and `disabled` sets `disabled`.
 * - ConfirmButton arms only on a press, which static markup cannot make, and it writes its own
 *   `data-armed` after the props it passes on. So an `armed=on` cell hands Button a
 *   `<button data-armed="true">` through `render`: Base UI merges that element's props over its
 *   own, which marks the root as a first press would and leaves every other attribute as it was.
 *   With no `armedChildren`, armed label or `aria-label`, a press changes nothing else.
 * - A disabled ConfirmButton disarms, so a disabled cell renders disarmed at `armed=on` too.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import type { LabelButtonSize } from "../../../fuse/dist/button.js";
import { ConfirmButton } from "../../../fuse/dist/confirm-button.js";
import type { Cell } from "../components/component-spec.ts";
import { CONFIRM_BUTTON_LABEL } from "../components/confirm-button-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

const VARIANTS = ["destructive", "success"] as const;
const SIZES = ["default", "xs", "sm", "lg"] as const satisfies readonly LabelButtonSize[];

function isVariant(value: string | undefined): value is (typeof VARIANTS)[number] {
  return VARIANTS.some((variant) => variant === value);
}

function isSize(value: string | undefined): value is (typeof SIZES)[number] {
  return SIZES.some((size) => size === value);
}

/** Button's root as a first press leaves it, which Base UI renders in place of its own `<button>`. */
const ARMED_ROOT = createElement("button", { "data-armed": "true" });

/** A `confirm-button` cell: a ConfirmButton holding the label, disabled or armed. */
export const confirmButton: CellRendering = {
  element: (cell: Cell) => {
    const { variant, size } = cell;
    if (!isVariant(variant) || !isSize(size)) {
      throw new Error(`Confirm button has no variant ${variant ?? ""} or size ${size ?? ""}`);
    }
    const disabled = cell.state === "disabled";
    const props = { variant, size, disabled, onConfirm: () => undefined };
    return cell.armed === "on" && !disabled
      ? createElement(ConfirmButton, { ...props, render: ARMED_ROOT }, CONFIRM_BUTTON_LABEL)
      : createElement(ConfirmButton, props, CONFIRM_BUTTON_LABEL);
  },
};
