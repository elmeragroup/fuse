import { createElement } from "react";
import type { ComponentProps } from "react";

import { DateRangePickerField } from "../../../fuse/dist/date-range-picker.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import type { Cell } from "../components/component-spec.ts";
import { DATE_FIELD_VALUE } from "../components/date-field-kit.ts";
import {
  DATE_RANGE_PICKER_DESCRIPTION,
  DATE_RANGE_PICKER_END,
  DATE_RANGE_PICKER_ERROR,
  DATE_RANGE_PICKER_LABEL,
} from "../components/date-range-picker-kit.ts";
import { showsPlaceholder } from "../components/field-box-kit.ts";
import type { CellRendering } from "./cell-renderers.ts";
import { inFieldWidth } from "./field-text-cell.ts";

export const dateRangePicker: CellRendering = {
  element: (cell: Cell) => {
    const props: ComponentProps<typeof DateRangePickerField> = {
      label: DATE_RANGE_PICKER_LABEL,
      description: DATE_RANGE_PICKER_DESCRIPTION,
      isReadOnly: cell.state === "readonly",
      isDisabled: cell.state === "disabled",
      isInvalid: cell.state === "invalid",
    };
    if (!showsPlaceholder(cell)) {
      props.defaultValue = {
        start: Temporal.PlainDate.from(DATE_FIELD_VALUE),
        end: Temporal.PlainDate.from(DATE_RANGE_PICKER_END),
      };
    }
    if (cell.state === "invalid") {
      props.errorMessage = DATE_RANGE_PICKER_ERROR;
    }
    return createElement(LocaleProvider, {
      locale: "en-US",
      children: inFieldWidth(createElement(DateRangePickerField, props)),
    });
  },
};
