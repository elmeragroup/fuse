/**
 * The renderer of the `button` and `icon-button` sets: each cell as the real Fuse `<Button>`.
 *
 * - `icon=start` places `<Plus data-icon="inline-start" />` before the label, and `icon=end`
 *   places `<ArrowRight data-icon="inline-end" />` after it, the icons the kit's swap
 *   properties default to.
 * - An icon button holds a bare `<Plus />` and is named by `aria-label`.
 * - `disabled` sets `disabled`, and `pending` sets `isPending`, which renders the spinner.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build, the same `dist/`
 * that holds the CSS the page loads. `cell-renderers.ts` imports this module only after the run
 * found the build.
 */

import { createElement } from "react";
import type { ReactElement } from "react";

import { Button, buttonVariants } from "../../../fuse/dist/button.js";
import type { IconButtonSize, LabelButtonSize } from "../../../fuse/dist/button.js";
import { ArrowRight, Plus } from "../../../fuse/dist/icons.js";
import { BUTTON_LABEL } from "../components/button-kit.ts";
import type { Cell } from "../components/component-spec.ts";
import { ownKey } from "../components/own-key.ts";
import { markedIcon } from "./cell-renderers.ts";
import type { CellRendering } from "./cell-renderers.ts";

type ButtonVariant = keyof typeof buttonVariants.variants.variant;

function isVariant(value: string | undefined): value is ButtonVariant {
  return ownKey(buttonVariants.variants.variant, value);
}

function isLabelSize(value: string | undefined): value is LabelButtonSize {
  return ownKey(buttonVariants.variants.size, value) && !value.startsWith("icon");
}

function isIconSize(value: string | undefined): value is IconButtonSize {
  return ownKey(buttonVariants.variants.size, value) && value.startsWith("icon");
}

/** The recipe's variant, and the states the markup draws, for a parsed cell. */
function sharedProps(cell: Cell) {
  if (!isVariant(cell.variant)) {
    throw new Error(`Button has no variant ${cell.variant ?? ""}`);
  }
  return {
    variant: cell.variant,
    disabled: cell.state === "disabled",
    isPending: cell.state === "pending",
  };
}

function labelChildren(icon: string | undefined): readonly (ReactElement | string)[] {
  switch (icon) {
    case "start":
      return [markedIcon(Plus, "inline-start"), BUTTON_LABEL];
    case "end":
      return [BUTTON_LABEL, markedIcon(ArrowRight, "inline-end")];
    default:
      return [BUTTON_LABEL];
  }
}

/** A `button` cell: a label Button, with the icon its `icon` axis places. */
export const labelButton: CellRendering = {
  element: (cell) => {
    if (!isLabelSize(cell.size)) {
      throw new Error(`Button has no label size ${cell.size ?? ""}`);
    }
    return createElement(Button, { ...sharedProps(cell), size: cell.size }, ...labelChildren(cell.icon));
  },
};

/** An `icon-button` cell: a square Button around one icon. */
export const iconButton: CellRendering = {
  element: (cell) => {
    if (!isIconSize(cell.size)) {
      throw new Error(`Button has no square size ${cell.size ?? ""}`);
    }
    return createElement(
      Button,
      { ...sharedProps(cell), size: cell.size, "aria-label": BUTTON_LABEL },
      createElement(Plus)
    );
  },
};
