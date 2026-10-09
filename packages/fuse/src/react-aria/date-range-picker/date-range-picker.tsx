"use client";

import { use } from "react";
import type { ReactElement, ReactNode } from "react";

import {
  DateRangePicker as AriaDateRangePicker,
  DateRangePickerStateContext,
  RangeCalendarContext,
  useSlottedContext,
} from "react-aria-components";
import type {
  DateRangePickerProps as AriaDateRangePickerProps,
  DateValue,
  ValidationResult,
} from "react-aria-components";

import type { OverlayContainerProps } from "../../components/overlay/overlay-props";
import { pickerVariants } from "../../styles/picker";
import { DateInput } from "../date-field/date-field";
import { composeTailwindRenderProps } from "../internal/compose-tailwind-render-props";
import { FormErrors, useClearFormErrors } from "../internal/form-errors";
import { useCommittedMonthFocus } from "../internal/picker-focused-month";
import { isRenderableNode, PickerPresetGroup, PickerPresetItem } from "../internal/picker-presets";
import type { PickerPresetGroupProps, PickerPresetItemProps } from "../internal/picker-presets";
import { PickerShell } from "../internal/picker-shell";
import { RangeCalendar } from "../range-calendar/range-calendar";
import type { RangeCalendarProps } from "../range-calendar/range-calendar";

/**
 * Labeled date-range-picker composite over RAC `DateRangePicker`: two public `DateInput` rows and the public `RangeCalendar`, handed to the same
 * package-private `PickerShell` DatePicker wears. In containers narrower than 24rem,
 * the dates stack beside the calendar trigger; wider containers use one row. Inside a flex row
 * the picker takes no width from its content, so give it `w-96 shrink-0` to keep one row.
 * Client — the interim react-aria cluster owns segment state and overlay state.
 *
 * What is left here is what a *range* picker owns and a single-date picker does not: two
 * segment rows and the en-dash between them. The optional preset pane and the
 * focused-month sync are shared with DatePicker; a preset's value is the caller's key, and
 * the caller maps it to a range.
 */
export type DateRangePickerProps<T extends DateValue> = {
  /** Visible label, rendered as the private RAC `Label`. */
  label?: string;
  /** Supporting copy, rendered as the private RAC `Description`. */
  description?: string;
  /**
   * Error copy, rendered as `FieldError` when the range is invalid — an end before its
   * start, or an endpoint outside the allowed dates. Accepts a node or a validation
   * render function. Without it or `isInvalid`, the picker shows the `Form` errors under its `startName` and
   * its `endName`, and a change to the range clears both.
   */
  errorMessage?: ReactNode | ((validation: ValidationResult) => ReactNode);
  /**
   * Quick-choice pane rendered beside the range calendar — normally a
   * `DateRangePickerPresetGroup`. A renderable node is what turns the dialog into two
   * panes; a falsy one (`false` from a `&&` guard, `null`, `""`) keeps the single pane.
   */
  presetGroup?: ReactNode;
  /**
   * Pads day and month segments with a leading zero in both rows, matching the default
   * behavior of DatePicker and DateField.
   * @default true
   */
  shouldForceLeadingZeros?: boolean;
  /**
   * Portal target for the popover. Defaults to the nearest `ThemeScope`, so the overlay
   * inherits the theme it was opened from; an explicit element or ref
   * wins.
   */
  container?: OverlayContainerProps["container"];
} & Omit<AriaDateRangePickerProps<T>, "shouldForceLeadingZeros">;

/**
 * The popover's range calendar, month-synced to the committed range through the RAC
 * `DateRangePickerStateContext`. RAC focuses the start only when the grid mounts, so
 * without this a preset that commits a range in another month with the dialog open would
 * leave the grid on the old month. A range the grid commits itself keeps the month and focus
 * the user finished on. The placeholder comes from the `RangeCalendarContext`
 * RAC fills, so a `placeholderValue` supplied through `DateRangePickerContext` counts too.
 */
function PickerRangeCalendar({
  className,
  commitBehavior,
}: {
  className: string;
  commitBehavior: RangeCalendarProps<DateValue>["commitBehavior"];
}): ReactElement {
  const state = use(DateRangePickerStateContext);
  const calendar = useSlottedContext(RangeCalendarContext);
  const focus = useCommittedMonthFocus(state?.value, calendar?.defaultFocusedValue);

  return <RangeCalendar className={className} commitBehavior={commitBehavior} {...focus} />;
}

export function DateRangePicker<T extends DateValue>({
  className,
  container,
  description,
  errorMessage,
  isReadOnly,
  label,
  onChange,
  presetGroup,
  shouldForceLeadingZeros = true,
  ...props
}: DateRangePickerProps<T>): ReactElement {
  const hasPresets = isRenderableNode(presetGroup);
  const { base, calendar, input, pane, separator } = pickerVariants({ range: true, hasPresets });
  const names = [props.startName, props.endName] as const;
  const clearingOnChange = useClearFormErrors(names, onChange);

  return (
    <FormErrors names={names}>
      <AriaDateRangePicker
        {...props}
        onChange={clearingOnChange}
        isReadOnly={isReadOnly}
        shouldForceLeadingZeros={shouldForceLeadingZeros}
        className={composeTailwindRenderProps(className, base())}>
        <PickerShell
          container={container}
          description={description}
          errorMessage={errorMessage}
          isReadOnly={isReadOnly}
          label={label}
          popover={
            <div className={pane()}>
              {presetGroup}
              {/* RAC commits a half-picked range as a one-day range when focus or a pointer
                release leaves the grid. With presets beside it, leaving the grid means
                reaching for a preset, so the draft is dropped instead. */}
              <PickerRangeCalendar className={calendar()} commitBehavior={hasPresets ? "reset" : "select"} />
            </div>
          }
          range>
          <DateInput className={input()} slot="start" />
          {/* Decoration: RAC names the two rows "Start Date" / "End Date" on the segments
            themselves, so announcing the glyph would only repeat it. */}
          <span aria-hidden="true" className={separator()}>
            –
          </span>
          <DateInput className={input()} slot="end" />
        </PickerShell>
      </AriaDateRangePicker>
    </FormErrors>
  );
}

export type DateRangePickerPresetGroupProps = PickerPresetGroupProps;

/**
 * The quick-choice pane beside the range calendar: a radio group whose options are the
 * caller's preset keys. Only one preset can be in effect at a time, which is why this is
 * a `radiogroup` and not a row of buttons. The caller maps the chosen key to a range in
 * `onChange`; the library never computes one.
 */
export function DateRangePickerPresetGroup(props: DateRangePickerPresetGroupProps): ReactElement {
  return <PickerPresetGroup data-slot="date-range-picker-preset-group" {...props} />;
}

export type DateRangePickerPresetItemProps = PickerPresetItemProps;

/**
 * One preset, closing the picker on double-click when the caller opts in. Styled as a
 * ghost `sm` button and named by its visible children — the library never synthesises
 * range copy from the item's `value`.
 */
export function DateRangePickerPresetItem(props: DateRangePickerPresetItemProps): ReactElement {
  const state = use(DateRangePickerStateContext);

  return <PickerPresetItem data-slot="date-range-picker-preset-item" {...props} state={state} />;
}

DateRangePicker.displayName = "DateRangePicker";
DateRangePickerPresetGroup.displayName = "DateRangePickerPresetGroup";
DateRangePickerPresetItem.displayName = "DateRangePickerPresetItem";
