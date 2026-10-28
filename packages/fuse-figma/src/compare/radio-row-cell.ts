/**
 * The renderer of the `radio-row` set: each cell as the real Fuse `<Radio>` row in a `RadioGroup`
 * with no legend, as the docs Basic demo renders its rows: a horizontal group around a hugging row,
 * and a vertical one in a host 384px wide around a filling row, which the group stretches. `checked=on` sets the group's
 * `defaultValue` to the row's value, `disabled` sets the row's `isDisabled`, and `invalid` sets the
 * group's `isInvalid`, from which Base UI marks the radio `aria-invalid="true"` and `data-invalid`
 * and the Field root passes its `error` text color down.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Radio } from "../../../fuse/dist/radio-group.js";
import type { Cell } from "../components/component-spec.ts";
import { fillsWidth } from "../components/field-box-kit.ts";
import { RADIO_ROW_TEXT } from "../components/radio-row-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";
import { inFieldWidth } from "./field-text-cell.ts";
import { inRadioGroup } from "./radio-cell.ts";

/** The row's value. */
const VALUE = "fixed";

/** A `radio-row` cell: the labelled row, checked or not, disabled or in an invalid group. */
export const radioRow: CellRendering = {
  element: (cell: Cell) => {
    const fill = fillsWidth(cell);
    const radioGroup = inRadioGroup(
      cell,
      VALUE,
      createElement(Radio, { value: VALUE, isDisabled: cell.state === "disabled" }, RADIO_ROW_TEXT),
      { orientation: fill ? "vertical" : "horizontal" }
    );
    return fill ? inFieldWidth(radioGroup) : radioGroup;
  },
};
