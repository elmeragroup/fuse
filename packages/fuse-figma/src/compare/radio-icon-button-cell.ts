/**
 * The renderer of the `radio-icon-button` set: each cell as the real Fuse `<RadioIconButton>`
 * holding `<List />`, alone in a `<RadioGroup>` as `radio-cell.ts` wraps a radio, which checks it
 * at `checked=on` and marks it invalid at `invalid`. `disabled` sets the button's `isDisabled`.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { radioIconButtonVariants } from "@elmeragroup/fuse/recipe-catalog";

import { List } from "../../../fuse/dist/icons.js";
import { RadioIconButton } from "../../../fuse/dist/radio-group.js";
import type { Cell } from "../components/component-spec.ts";
import { ownKey } from "../components/own-key.ts";
import type { CellRendering } from "./cell-renderers.ts";
import { inRadioGroup } from "./radio-cell.ts";

type RadioIconButtonSize = keyof typeof radioIconButtonVariants.variants.size;

/** The button's value and accessible name, after the icon it holds. */
const VALUE = "list";
const CELL_LABEL = "List";

function isSize(value: string | undefined): value is RadioIconButtonSize {
  return ownKey(radioIconButtonVariants.variants.size, value);
}

/** A `radio-icon-button` cell: a radio icon button in a group of its own. */
export const radioIconButton: CellRendering = {
  element: (cell: Cell) => {
    const { size } = cell;
    if (!isSize(size)) {
      throw new Error(`Radio icon button has no size ${size ?? ""}`);
    }
    return inRadioGroup(
      cell,
      VALUE,
      createElement(
        RadioIconButton,
        { value: VALUE, "aria-label": CELL_LABEL, size, isDisabled: cell.state === "disabled" },
        createElement(List)
      )
    );
  },
};
