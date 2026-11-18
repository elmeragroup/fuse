/**
 * The renderer of the `date-field` set: each cell as the real Fuse `<DateField>` with the docs default
 * demo's label and description, in the en-US locale, in a host as wide as the kit's preview width,
 * which the Field root's `w-full` takes.
 *
 * - `content=value` sets the Error demo's date as `defaultValue`; `content=placeholder` sets none.
 * - `readonly` sets `isReadOnly`, `disabled` sets `isDisabled`, and `invalid` sets `isInvalid` and the
 *   Error demo's `errorMessage`. The page forces focus on the month segment.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */
import { createElement } from "react";
import type { ComponentProps } from "react";

import { DateField } from "../../../fuse/dist/date-field.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import type { Cell } from "../components/component-spec.ts";
import {
  DATE_FIELD_DESCRIPTION,
  DATE_FIELD_ERROR,
  DATE_FIELD_LABEL,
  DATE_FIELD_VALUE,
} from "../components/date-field-kit.ts";
import { showsPlaceholder } from "../components/field-box-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";
import { inFieldWidth } from "./field-text-cell.ts";

/** A `date-field` cell: the labelled field, empty or holding the date, read-only, disabled or invalid. */
export const dateField: CellRendering = {
  element: (cell: Cell) => {
    const props: ComponentProps<typeof DateField> = {
      label: DATE_FIELD_LABEL,
      description: DATE_FIELD_DESCRIPTION,
      isReadOnly: cell.state === "readonly",
      isDisabled: cell.state === "disabled",
      isInvalid: cell.state === "invalid",
    };
    if (!showsPlaceholder(cell)) {
      props.defaultValue = Temporal.PlainDate.from(DATE_FIELD_VALUE);
    }
    if (cell.state === "invalid") {
      props.errorMessage = DATE_FIELD_ERROR;
    }
    return createElement(LocaleProvider, {
      locale: "en-US",
      children: inFieldWidth(createElement(DateField, props)),
    });
  },
};
