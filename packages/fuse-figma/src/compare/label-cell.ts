/**
 * The renderer of the `label` set: each cell as the real Fuse
 * `<Field.Root disabled={…}><Field.Label>Email</Field.Label></Field.Root>`, the docs' field label.
 * The page measures the label, the one element with `data-slot="field-label"`. `disabled` sets the
 * root's `disabled`, which marks the root and the label `data-disabled`.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Field } from "../../../fuse/dist/field.js";
import type { Cell } from "../components/component-spec.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** A `label` cell: the field label at rest, or inside a disabled Field. */
export const label: CellRendering = {
  element: (cell: Cell) =>
    createElement(
      Field.Root,
      { disabled: cell.state === "disabled" },
      createElement(Field.Label, null, "Email")
    ),
};
