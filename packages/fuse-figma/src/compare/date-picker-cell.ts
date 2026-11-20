/**
 * The renderer of the `date-picker` set: each cell as the real Fuse `<DatePickerField>`, closed, with
 * the docs default demo's label and description, in the en-US locale, in a host as wide as the kit's
 * preview width, which the Field root's `w-full` takes.
 *
 * - `content=value` sets the demo's date as `defaultValue`; `content=placeholder` sets none.
 * - `readonly` sets `isReadOnly`, `disabled` sets `isDisabled`, and `invalid` sets `isInvalid` and the
 *   Error demo's `errorMessage`. The page forces focus on the month segment.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */
import { createElement } from "react";
import type { ComponentProps } from "react";

import { DatePickerField } from "../../../fuse/dist/date-picker.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import type { Cell } from "../components/component-spec.ts";
import { DATE_FIELD_VALUE } from "../components/date-field-kit.ts";
import {
  DATE_PICKER_DESCRIPTION,
  DATE_PICKER_ERROR,
  DATE_PICKER_LABEL,
} from "../components/date-picker-kit.ts";
import { showsPlaceholder } from "../components/field-box-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";
import { inFieldWidth } from "./field-text-cell.ts";

/** A `date-picker` cell: the labelled picker, closed, empty or holding the date, read-only, disabled or invalid. */
export const datePicker: CellRendering = {
  element: (cell: Cell) => {
    const props: ComponentProps<typeof DatePickerField> = {
      label: DATE_PICKER_LABEL,
      description: DATE_PICKER_DESCRIPTION,
      isReadOnly: cell.state === "readonly",
      isDisabled: cell.state === "disabled",
      isInvalid: cell.state === "invalid",
    };
    if (!showsPlaceholder(cell)) {
      props.defaultValue = Temporal.PlainDate.from(DATE_FIELD_VALUE);
    }
    if (cell.state === "invalid") {
      props.errorMessage = DATE_PICKER_ERROR;
    }
    return createElement(LocaleProvider, {
      locale: "en-US",
      children: inFieldWidth(createElement(DatePickerField, props)),
    });
  },
};
