/**
 * The renderer of the `select-trigger` set: each cell as the real Fuse `Select.Trigger` around a
 * `Select.Value`, in a `Select.Root` that holds no `Select.Content`. The trigger hugs its value and
 * caret, so the cell needs no host width.
 *
 * - `size` sets the trigger's `size`, and `disabled` sets the root's `disabled`.
 * - The value shows the `placeholder` `select-trigger-kit.ts` draws while nothing is selected. A
 *   `content=value` cell selects the root's one item, whose label is the same text, so Base UI
 *   shows the label and drops `data-placeholder`.
 * - `open=on` sets the root's `defaultOpen`. Base UI then stamps on the trigger what it stamps while
 *   the popup is open, `data-popup-open`, `data-pressed` and `aria-expanded="true"`, and
 *   `data-popup-open` on the caret. The root holds no `Select.Content`, so no popup renders.
 * - `invalid` puts the root in an invalid `Field.Root`, the one source Base UI reads the trigger's
 *   validity from, which then marks it `aria-invalid="true"` and `data-invalid`, and passes its
 *   `data-invalid:text-error` down to a value.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Field } from "../../../fuse/dist/field.js";
import { Select } from "../../../fuse/dist/select.js";
import type { Cell } from "../components/component-spec.ts";
import { SELECT_TRIGGER_TEXT, showsOpen, sizeFor } from "../components/select-trigger-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The value of the root's one item, whose label is the text the kit draws. */
const ITEM = "choice";

/** A `select-trigger` cell: a trigger holding the placeholder or a value, disabled, invalid or open. */
export const selectTrigger: CellRendering = {
  element: (cell: Cell) => {
    const root = createElement(
      Select.Root,
      {
        items: { [ITEM]: SELECT_TRIGGER_TEXT },
        defaultValue: cell.content === "value" ? ITEM : null,
        disabled: cell.state === "disabled",
        defaultOpen: showsOpen(cell),
      },
      createElement(
        Select.Trigger,
        { size: sizeFor(cell) },
        createElement(Select.Value, { placeholder: SELECT_TRIGGER_TEXT })
      )
    );
    return cell.state === "invalid" ? createElement(Field.Root, { invalid: true }, root) : root;
  },
};
