/**
 * The renderer of the `checkbox` set: each cell as the real Fuse `<Checkbox aria-label="Accept">`.
 *
 * - `checked=on` sets `defaultChecked` and `checked=mixed` sets `indeterminate`. The page renders
 *   static HTML, so the state the markup draws is the one the props start with.
 * - `disabled` sets `disabled`.
 * - `invalid` wraps the checkbox in an invalid `Field.Root`, the only source Base UI reads a
 *   checkbox's validity from, which then marks it `aria-invalid="true"` and `data-invalid`.
 *   The field is horizontal because the vertical one stretches its children to its width, which in
 *   the compare page's unsized cell slot collapses the checkbox to its content width.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ComponentProps } from "react";

import { Checkbox } from "../../../fuse/dist/checkbox.js";
import { Field } from "../../../fuse/dist/field.js";
import type { Cell } from "../components/component-spec.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The checkbox's accessible name. The kit draws no label. */
const CELL_LABEL = "Accept";

/** A `checkbox` cell: a checkbox off, checked or mixed, inside an invalid field when invalid. */
export const checkbox: CellRendering = {
  element: (cell: Cell) => {
    const props: ComponentProps<typeof Checkbox> = {
      "aria-label": CELL_LABEL,
      defaultChecked: cell.checked === "on",
      indeterminate: cell.checked === "mixed",
      disabled: cell.state === "disabled",
    };
    const box = createElement(Checkbox, props);
    return cell.state === "invalid"
      ? createElement(Field.Root, { invalid: true, orientation: "horizontal" }, box)
      : box;
  },
};
