/**
 * The renderer of the `textarea-field` set: each cell as the real Fuse `<TextareaField>` with the
 * docs Basic demo's label, description and placeholder, in a host as wide as the kit's preview
 * width, which the Field root's `w-full` takes.
 *
 * - `readonly` sets `readOnly`, which TextareaField forwards to the textarea. `disabled` sets
 *   `isDisabled`, which disables the Field root and the textarea. `invalid` sets `isInvalid` and the
 *   docs Error demo's `errorMessage`, which Base UI renders as the Field's error.
 * - With the `Counter` property on, the field takes the Counter demo's `maxLength`, so it renders
 *   `0/120` in its heading row. A preview keeps the property at its default, false, so the compare
 *   page renders none.
 * - Chromium draws the textarea's resize grip, as the `textarea` renderer says, so a cell differs
 *   there by design.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ComponentProps } from "react";

import { TextareaField } from "../../../fuse/dist/textarea-field.js";
import type { Cell } from "../components/component-spec.ts";
import { FIELD_BOX_PREVIEW_WIDTH } from "../components/kit-lengths.ts";
import {
  TEXTAREA_FIELD_COUNTER_PROPERTY,
  TEXTAREA_FIELD_DESCRIPTION,
  TEXTAREA_FIELD_ERROR,
  TEXTAREA_FIELD_LABEL,
  TEXTAREA_FIELD_MAX_LENGTH,
  TEXTAREA_FIELD_PLACEHOLDER,
} from "../components/textarea-field-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** A `textarea-field` cell: the labelled textarea read-only, disabled or invalid, with or without its counter. */
export const textareaField: CellRendering = {
  element: (cell: Cell, turnedOn: ReadonlySet<string>) => {
    const props: ComponentProps<typeof TextareaField> = {
      label: TEXTAREA_FIELD_LABEL,
      description: TEXTAREA_FIELD_DESCRIPTION,
      placeholder: TEXTAREA_FIELD_PLACEHOLDER,
      readOnly: cell.state === "readonly",
      isDisabled: cell.state === "disabled",
      isInvalid: cell.state === "invalid",
    };
    if (cell.state === "invalid") {
      props.errorMessage = TEXTAREA_FIELD_ERROR;
    }
    if (turnedOn.has(TEXTAREA_FIELD_COUNTER_PROPERTY)) {
      props.maxLength = TEXTAREA_FIELD_MAX_LENGTH;
    }
    return createElement(
      "div",
      { style: { width: `${FIELD_BOX_PREVIEW_WIDTH}px` } },
      createElement(TextareaField, props)
    );
  },
};
