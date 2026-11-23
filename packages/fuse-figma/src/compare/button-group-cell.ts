/**
 * The renderer of the `button-group` set: each cell as a docs demo's real Fuse `<ButtonGroup.Root>`.
 * The horizontal cell is the default demo's `Archive`, `Snooze` and `Report`, each an outline
 * `<Button>`, and the vertical cell the Vertical demo's two outline `size="icon"` Buttons, named
 * `Increase` and `Decrease`, around `<CaretUp />` and `<CaretDown />`.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { ButtonGroup } from "../../../fuse/dist/button-group.js";
import { Button } from "../../../fuse/dist/button.js";
import { CaretDown, CaretUp } from "../../../fuse/dist/icons.js";
import { BUTTON_GROUP_LABELS, BUTTON_GROUP_STEPS } from "../components/button-group-kit.ts";
import type { Cell } from "../components/component-spec.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The caret each step's `Icon` property names, by that name. */
const CARETS = new Map([
  ["CaretUp", CaretUp],
  ["CaretDown", CaretDown],
]);

/** A `button-group` cell: the default demo's row, or the Vertical demo's column. */
export const buttonGroup: CellRendering = {
  element: (cell: Cell) =>
    cell.orientation === "vertical"
      ? createElement(ButtonGroup.Root, {
          orientation: "vertical",
          "aria-label": "Quantity",
          children: BUTTON_GROUP_STEPS.map((step) => {
            const caret = CARETS.get(step.icon);
            if (caret === undefined) {
              throw new Error(`The Vertical demo shows no ${step.icon}.`);
            }
            return createElement(Button, {
              key: step.key,
              variant: "outline",
              size: "icon",
              "aria-label": step.label,
              children: createElement(caret),
            });
          }),
        })
      : createElement(ButtonGroup.Root, {
          "aria-label": "Message actions",
          children: BUTTON_GROUP_LABELS.map((label) =>
            createElement(Button, { key: label, variant: "outline", children: label })
          ),
        }),
};
