"use client";

import type { ReactElement, ReactNode } from "react";

import { DateRangePicker as AriaDateRangePicker } from "react-aria-components";
import type {
  DateRangePickerProps as AriaDateRangePickerProps,
  DateValue,
  ValidationResult,
} from "react-aria-components";

import type { OverlayContainerProps } from "../../components/overlay/overlay-props";
import { pickerVariants } from "../../styles/picker";
import { DateInput } from "../date-field/date-field";
import { PickerShell } from "../internal/picker-shell";
import { composeTailwindRenderProps } from "../internal/utils";
import { RangeCalendar } from "../range-calendar/range-calendar";

/**
 * Labeled date-range-picker composite over RAC `DateRangePicker`: two public `DateInput` rows and the public `RangeCalendar`, handed to the same
 * package-private `PickerShell` DatePicker wears. In containers narrower than 24rem,
 * the dates stack beside the calendar trigger; wider containers use one row. Client — the interim
 * react-aria cluster owns segment state and overlay state.
 *
 * What is left here is what a *range* picker owns and a single-date picker does not: two
 * segment rows and the en-dash between them. Unlike DatePicker there is no focused-month
 * sync — RAC's range state drives the grid's month on its own, and there is no
 * override.
 */
export type DateRangePickerProps<T extends DateValue> = {
  /** Visible label, rendered as the private RAC `Label`. */
  label?: string;
  /** Supporting copy, rendered as the private RAC `Description`. */
  description?: string;
  /**
   * Error copy, rendered as `FieldError` when the range is invalid — an end before its
   * start, or an endpoint outside the allowed dates. Accepts a node or a validation
   * render function.
   */
  errorMessage?: ReactNode | ((validation: ValidationResult) => ReactNode);
  /**
   * Pads day and month segments with a leading zero in both rows, matching the default
   * behavior of DatePicker and DateField.
   * @default true
   */
  shouldForceLeadingZeros?: boolean;
  /**
   * Portal target for the popover. Defaults to the nearest `ThemeScope`, so the overlay
   * inherits the theme it was opened from (theming.md §7.4); an explicit element or ref
   * wins.
   */
  container?: OverlayContainerProps["container"];
} & Omit<AriaDateRangePickerProps<T>, "shouldForceLeadingZeros">;

export function DateRangePicker<T extends DateValue>({
  className,
  container,
  description,
  errorMessage,
  isReadOnly,
  label,
  shouldForceLeadingZeros = true,
  ...props
}: DateRangePickerProps<T>): ReactElement {
  const { base, calendar, input, separator } = pickerVariants({ range: true });

  return (
    <AriaDateRangePicker
      {...props}
      isReadOnly={isReadOnly}
      shouldForceLeadingZeros={shouldForceLeadingZeros}
      className={composeTailwindRenderProps(className, base())}>
      <PickerShell
        container={container}
        description={description}
        errorMessage={errorMessage}
        isReadOnly={isReadOnly}
        label={label}
        popover={<RangeCalendar className={calendar()} />}
        range>
        <DateInput className={input()} slot="start" />
        {/* Decoration: RAC names the two rows "Start Date" / "End Date" on the segments
            themselves, so announcing the glyph would only repeat it. */}
        <span aria-hidden="true" className={separator()}>
          –
        </span>
        <DateInput className={input({ class: "flex-1" })} slot="end" />
      </PickerShell>
    </AriaDateRangePicker>
  );
}

DateRangePicker.displayName = "DateRangePicker";
