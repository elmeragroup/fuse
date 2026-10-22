/**
 * The renderer of the `radio-icon-button` set: each cell as the real Fuse `<RadioIconButton>`
 * holding `<List />`, alone in a `<RadioGroup>`, since a radio renders checked only inside a
 * group.
 *
 * - `checked=on` sets the group's `defaultValue` to the button's value. The page renders static
 *   HTML, so the state the markup draws is the one the props start with.
 * - `disabled` sets the button's `isDisabled`.
 * - `invalid` sets the group's `isInvalid`. `RadioGroup` renders its own `Field.Root` and passes
 *   `isInvalid` to it, so the radio reads its validity from that root. An invalid `Field.Root`
 *   around the group would not reach the radio past the group's own root.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { radioIconButtonVariants } from "@elmeragroup/fuse/recipe-catalog";

import { List } from "../../../fuse/dist/icons.js";
import { RadioGroup, RadioIconButton } from "../../../fuse/dist/radio-group.js";
import type { RadioGroupProps } from "../../../fuse/dist/radio-group.js";
import type { Cell } from "../components/component-spec.ts";
import { ownKey } from "../components/own-key.ts";
import type { CellRendering } from "./cell-renderers.ts";

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
    const group: RadioGroupProps = { isInvalid: cell.state === "invalid" };
    if (cell.checked === "on") {
      group.defaultValue = VALUE;
    }
    return createElement(
      RadioGroup,
      group,
      createElement(
        RadioIconButton,
        { value: VALUE, "aria-label": CELL_LABEL, size, isDisabled: cell.state === "disabled" },
        createElement(List)
      )
    );
  },
};
