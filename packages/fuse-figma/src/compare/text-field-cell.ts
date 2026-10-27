/**
 * The renderer of the `text-field` set: each cell as the real Fuse `<TextField>` with the docs Basic
 * demo's label and description, in a host as wide as the kit's preview width, which the Field root's
 * `w-full` takes.
 *
 * - `content=placeholder` sets the Basic demo's `placeholder`, and `content=value` sets the same
 *   text as `defaultValue`, which the markup holds in the input's `value`, as the Input renderer does.
 * - `readonly` sets `isReadOnly`, `disabled` sets `isDisabled`, and `invalid` sets `isInvalid` and the
 *   Error demo's `errorMessage`, which Base UI renders as the Field's error.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";
import type { ComponentProps } from "react";

import { TextField } from "../../../fuse/dist/text-field.js";
import type { Cell } from "../components/component-spec.ts";
import { showsPlaceholder } from "../components/field-box-kit.ts";
import { FIELD_BOX_PREVIEW_WIDTH } from "../components/kit-lengths.ts";
import {
  TEXT_FIELD_DESCRIPTION,
  TEXT_FIELD_ERROR,
  TEXT_FIELD_LABEL,
  TEXT_FIELD_PLACEHOLDER,
} from "../components/text-field-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** A `text-field` cell: the labelled input holding the placeholder or a value, read-only, disabled or invalid. */
export const textField: CellRendering = {
  element: (cell: Cell) => {
    const props: ComponentProps<typeof TextField> = {
      label: TEXT_FIELD_LABEL,
      description: TEXT_FIELD_DESCRIPTION,
      isReadOnly: cell.state === "readonly",
      isDisabled: cell.state === "disabled",
      isInvalid: cell.state === "invalid",
    };
    if (showsPlaceholder(cell)) {
      props.placeholder = TEXT_FIELD_PLACEHOLDER;
    } else {
      props.defaultValue = TEXT_FIELD_PLACEHOLDER;
    }
    if (cell.state === "invalid") {
      props.errorMessage = TEXT_FIELD_ERROR;
    }
    return createElement(
      "div",
      { style: { width: `${FIELD_BOX_PREVIEW_WIDTH}px` } },
      createElement(TextField, props)
    );
  },
};
