/**
 * The renderer of the `switch` set: each cell as the real Fuse `<Switch aria-label="Notifications">`.
 *
 * - `size` sets `size`, and `checked=on` sets `defaultChecked`. The page renders static HTML, so
 *   the state the markup draws is the one the props start with.
 * - `disabled` sets `disabled`.
 * - `invalid` wraps the switch in an invalid `Field.Root`, the only source Base UI reads a
 *   switch's validity from, which then marks it `aria-invalid="true"` and `data-invalid`.
 *   The field is horizontal because the vertical one stretches its children to its width, which in
 *   the compare page's unsized cell slot collapses the switch to its content width.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ComponentProps } from "react";

import { switchVariants } from "@elmeragroup/fuse/recipe-catalog";

import { Field } from "../../../fuse/dist/field.js";
import { Switch } from "../../../fuse/dist/switch.js";
import type { Cell } from "../components/component-spec.ts";
import { ownKey } from "../components/own-key.ts";
import type { CellRendering } from "./cell-renderers.ts";

type SwitchSize = keyof typeof switchVariants.variants.size;

/** The switch's accessible name. The kit draws no label. */
const CELL_LABEL = "Notifications";

function isSize(value: string | undefined): value is SwitchSize {
  return ownKey(switchVariants.variants.size, value);
}

/** A `switch` cell: a switch of one size, off or on, inside an invalid field when invalid. */
export const switchCell: CellRendering = {
  element: (cell: Cell) => {
    const { size } = cell;
    if (!isSize(size)) {
      throw new Error(`Switch has no size ${size ?? ""}`);
    }
    const props: ComponentProps<typeof Switch> = {
      "aria-label": CELL_LABEL,
      size,
      defaultChecked: cell.checked === "on",
      disabled: cell.state === "disabled",
    };
    const track = createElement(Switch, props);
    return cell.state === "invalid"
      ? createElement(Field.Root, { invalid: true, orientation: "horizontal" }, track)
      : track;
  },
};
