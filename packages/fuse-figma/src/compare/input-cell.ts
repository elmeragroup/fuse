/**
 * The renderer of the `input` set: each cell as the real Fuse `<Input>`, in a host as wide as the
 * kit's preview width, which the input's `w-full` takes. The compare page's slot has no width of its
 * own.
 *
 * - `content=placeholder` sets `placeholder`, and `content=value` sets `defaultValue`, which static
 *   markup writes as the `value` attribute, both to the text `input-kit.ts` draws.
 * - `readonly` sets `readOnly` and `disabled` sets `disabled`.
 * - `invalid` wraps the input in an invalid `Field.Root`, the only source Base UI reads an input's
 *   validity from, which then marks it `aria-invalid="true"` and `data-invalid`, and passes its
 *   `data-invalid:text-error` down to a typed value. A vertical Field stretches the input to its
 *   width, the host's.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ComponentProps } from "react";

import { Field } from "../../../fuse/dist/field.js";
import { Input } from "../../../fuse/dist/input.js";
import type { Cell } from "../components/component-spec.ts";
import { INPUT_TEXT } from "../components/input-kit.ts";
import { FIELD_BOX_PREVIEW_WIDTH } from "../components/kit-lengths.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** An `input` cell: an input holding a placeholder or a value, read-only, disabled or invalid. */
export const input: CellRendering = {
  element: (cell: Cell) => {
    const text: ComponentProps<typeof Input> =
      cell.content === "placeholder" ? { placeholder: INPUT_TEXT } : { defaultValue: INPUT_TEXT };
    const field = createElement(Input, {
      ...text,
      readOnly: cell.state === "readonly",
      disabled: cell.state === "disabled",
    });
    return createElement(
      "div",
      { style: { width: `${FIELD_BOX_PREVIEW_WIDTH}px` } },
      cell.state === "invalid" ? createElement(Field.Root, { invalid: true }, field) : field
    );
  },
};
