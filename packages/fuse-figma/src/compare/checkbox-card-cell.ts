/**
 * The renderer of the `checkbox-card` set: each cell as the docs default demo's real Fuse
 * `CheckboxCard` in a `CheckboxGroup`, in a host as wide as the kit's preview width.
 *
 * - `checked=true` starts the group with the card's value, and `checked=false` with none. The page
 *   renders static HTML, so the state the markup draws is the one the props start with.
 * - `variant` sets the card's `variant`, and `state=disabled` its `isDisabled`.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { CheckboxCard } from "../../../fuse/dist/checkbox-card.js";
import { CheckboxGroup } from "../../../fuse/dist/checkbox.js";
import {
  CHECKBOX_CARD_DESCRIPTION,
  CHECKBOX_CARD_PREVIEW_WIDTH,
  CHECKBOX_CARD_TITLE,
  CHECKBOX_CARD_VALUE,
  checkboxCardChecked,
} from "../components/checkbox-card-kit.ts";
import type { Cell } from "../components/component-spec.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The group's label, the docs default demo's. */
const GROUP_LABEL = "Add-ons";

/** A `checkbox-card` cell: the default demo's card in the cell's variant, checked state and state. */
export const checkboxCard: CellRendering = {
  element: (cell: Cell) =>
    createElement(
      "div",
      { style: { width: `${CHECKBOX_CARD_PREVIEW_WIDTH}px` } },
      createElement(
        CheckboxGroup,
        { label: GROUP_LABEL, defaultValue: checkboxCardChecked(cell) ? [CHECKBOX_CARD_VALUE] : [] },
        createElement(CheckboxCard, {
          value: CHECKBOX_CARD_VALUE,
          title: CHECKBOX_CARD_TITLE,
          description: CHECKBOX_CARD_DESCRIPTION,
          variant: cell.variant === "muted" ? "muted" : "default",
          isDisabled: cell.state === "disabled",
        })
      )
    ),
};
