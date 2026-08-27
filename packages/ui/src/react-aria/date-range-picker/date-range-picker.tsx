"use client";

import type { ReactElement, ReactNode, RefObject } from "react";

import { DateRangePicker as AriaDateRangePicker } from "react-aria-components";
import type {
  DateRangePickerProps as AriaDateRangePickerProps,
  DateValue,
  ValidationResult,
} from "react-aria-components";

import { CalendarBlank } from "../../icons/generated/calendar-blank";
import { dateRangePickerVariants } from "../../styles/date-range-picker";
import { DateInput } from "../date-field/date-field";
import { Button } from "../internal/button";
import { Dialog } from "../internal/dialog";
import { Description, FieldError, FieldGroup, Label } from "../internal/field";
import { Popover } from "../internal/popover";
import { composeTailwindRenderProps } from "../internal/utils";
import { RangeCalendar } from "../range-calendar/range-calendar";

/**
 * Labeled date-range-picker composite over RAC `DateRangePicker` (date-range-picker.md
 * §2/§3): two public `DateInput` rows and the public `RangeCalendar`, joined by the
 * package-private popover/dialog/button chrome. Client — the interim react-aria cluster
 * owns segment state and overlay state.
 *
 * The dialog is the package-private styled `Dialog` with `closeButton={false}` (§8.2):
 * the reference reached for the raw RAC `Dialog` and so skipped the cluster's dialog
 * chrome entirely. It needs no `aria-labelledby` of its own — with no `title` the styled
 * Dialog renders no heading, so RAC's own `DialogContext` name ("Calendar" plus the field
 * label, published by `useDateRangePicker`) reaches the overlay unopposed. Unlike
 * DatePicker there is no focused-month sync — RAC's range state drives the grid's month
 * on its own, and the spec asks for no override.
 */
export type DateRangePickerProps<T extends DateValue> = {
  /** Visible label, rendered as the private RAC `Label`. */
  label?: string;
  /** Supporting copy, rendered as the private RAC `Description`. */
  description?: string;
  /**
   * Error copy, rendered as `FieldError` when the range is invalid — an end before its
   * start, or an endpoint outside the allowed dates. Accepts a node or a validation
   * render function (§8.8 widens the reference's string-only face).
   */
  errorMessage?: ReactNode | ((validation: ValidationResult) => ReactNode);
  /**
   * Pads day and month segments with a leading zero in both rows. The reference omits
   * this here while DatePicker and DateField default it on; §8.3 aligns it.
   * @default true
   */
  shouldForceLeadingZeros?: boolean;
  /**
   * Portal target for the popover. Defaults to the nearest `ThemeScope`, so the overlay
   * inherits the theme it was opened from (theming.md §7.4); an explicit element or ref
   * wins.
   */
  container?: HTMLElement | RefObject<HTMLElement | null>;
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
  const { base, calendar, dialog, group, icon, input, separator } = dateRangePickerVariants({
    isReadOnly,
  });

  return (
    <AriaDateRangePicker
      {...props}
      isReadOnly={isReadOnly}
      shouldForceLeadingZeros={shouldForceLeadingZeros}
      className={composeTailwindRenderProps(className, base())}>
      {label ? <Label>{label}</Label> : null}
      <FieldGroup className={group()}>
        <DateInput className={input()} slot="start" />
        {/* Decoration: RAC names the two rows "Start Date" / "End Date" on the segments
            themselves, so announcing the glyph would only repeat it (§7). */}
        <span aria-hidden="true" className={separator()}>
          –
        </span>
        <DateInput className={input({ class: "flex-1" })} slot="end" />
        {/* oxlint-disable-next-line elmera/require-icon-button-label -- date-range-picker.md §7: RAC's DateRangePicker fills this default Button slot and supplies the trigger's localized accessible name ("Calendar"); a local label would shadow it. Asserted in the browser suite. */}
        <Button size="icon-sm" variant="ghost">
          <CalendarBlank aria-hidden className={icon()} />
        </Button>
      </FieldGroup>
      {description ? <Description>{description}</Description> : null}
      <FieldError>{errorMessage}</FieldError>
      <Popover container={container} placement="bottom right">
        <Dialog className={dialog()} closeButton={false}>
          <RangeCalendar className={calendar()} />
        </Dialog>
      </Popover>
    </AriaDateRangePicker>
  );
}

DateRangePicker.displayName = "DateRangePicker";
