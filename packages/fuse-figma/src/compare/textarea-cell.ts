/**
 * The renderer of the `textarea` set: each cell as the real Fuse `<Textarea>`, rendered through
 * `<Field.Control render={<Textarea />}>` inside a `Field.Root`, as the docs' Field demo renders it,
 * in a host as wide as the kit's preview width, which the textarea's `w-full` takes.
 *
 * - `content=placeholder` sets `placeholder`, and `content=value` sets `defaultValue`, which static
 *   markup writes as the textarea's own text, both to the text `textarea-kit.ts` draws.
 * - `readonly` sets `readOnly`. `disabled` sets the control's `disabled`, from which Base UI marks
 *   the textarea `disabled` and `data-disabled`. `invalid` sets the Field root's `invalid`, from
 *   which Base UI marks it `aria-invalid="true"` and `data-invalid`, and the root passes its
 *   `data-invalid:text-error` down to a typed value. A plain `<textarea>` gets none of those data
 *   attributes. The root itself stays enabled, as the kit draws no disabled Field around the
 *   textarea, so no `group-data-disabled/field:` holds above it.
 * - Chromium draws a resize grip in the textarea's bottom-right corner, since preflight sets
 *   `resize: vertical` and Fuse's Textarea keeps it. The kit draws no grip, so a cell differs there
 *   by design. The README's comparison section lists it for triage.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { Field } from "../../../fuse/dist/field.js";
import { Textarea } from "../../../fuse/dist/textarea.js";
import type { Cell } from "../components/component-spec.ts";
import { FIELD_BOX_PREVIEW_WIDTH } from "../components/kit-lengths.ts";
import { TEXTAREA_TEXT } from "../components/textarea-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/**
 * Fuse's `Field.Control` marks the element it renders `data-slot="field-control"`, over the
 * textarea's own `data-slot`, and the page and the markup check find a cell's root by the
 * definition's slot. No Fuse style reads either slot, so the cell gives the textarea its own back.
 */
const TEXTAREA_SLOT = { "data-slot": "textarea" } as const;

/** A `textarea` cell: a textarea holding a placeholder or a value, read-only, disabled or invalid. */
export const textarea: CellRendering = {
  element: (cell: Cell) => {
    const control = createElement(Field.Control, {
      ...TEXTAREA_SLOT,
      render: createElement(Textarea),
      ...(cell.content === "placeholder" ? { placeholder: TEXTAREA_TEXT } : { defaultValue: TEXTAREA_TEXT }),
      readOnly: cell.state === "readonly",
      disabled: cell.state === "disabled",
    });
    const field = createElement(Field.Root, { invalid: cell.state === "invalid" }, control);
    return createElement("div", { style: { width: `${FIELD_BOX_PREVIEW_WIDTH}px` } }, field);
  },
};
