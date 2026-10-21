/**
 * The renderer of the `radio` set: each cell as the real Fuse `<RadioGroupItem value="a"
 * aria-label="Option">`, alone in a `<RadioGroup>`, since a radio renders checked only inside a
 * group.
 *
 * - `checked=on` sets the group's `defaultValue` to the item's value. The page renders static
 *   HTML, so the state the markup draws is the one the props start with.
 * - `disabled` sets the item's `disabled`.
 * - `invalid` sets the group's `isInvalid`. `RadioGroup` renders its own `Field.Root` and passes
 *   `isInvalid` to it, so the radio reads its validity from that root. An invalid `Field.Root`
 *   around the group would not reach the radio past the group's own root.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ReactElement } from "react";

import { RadioGroup, RadioGroupItem } from "../../../fuse/dist/radio-group.js";
import type { RadioGroupProps } from "../../../fuse/dist/radio-group.js";
import type { Cell } from "../components/component-spec.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The item's value and accessible name. The kit draws no label. */
const VALUE = "a";
const CELL_LABEL = "Option";

/**
 * One radio item alone in a `<RadioGroup>`, which checks it at `checked=on` and marks it invalid
 * at `invalid`, as the module docblock describes.
 *
 * @param cell - The cell.
 * @param value - The item's value, which the group starts with at `checked=on`.
 * @param item - The item, a `RadioGroupItem` or a `RadioIconButton`.
 * @returns The group around the item.
 */
export function inRadioGroup(cell: Cell, value: string, item: ReactElement): ReactElement {
  const group: RadioGroupProps = { isInvalid: cell.state === "invalid" };
  if (cell.checked === "on") {
    group.defaultValue = value;
  }
  return createElement(RadioGroup, group, item);
}

/** A `radio` cell: a radio in a group of its own. */
export const radio: CellRendering = {
  element: (cell: Cell) =>
    inRadioGroup(
      cell,
      VALUE,
      createElement(RadioGroupItem, {
        value: VALUE,
        "aria-label": CELL_LABEL,
        disabled: cell.state === "disabled",
      })
    ),
};
