"use client";

import { use } from "react";
import type { ReactElement, ReactNode } from "react";

import {
  CalendarContext,
  DatePicker as AriaDatePicker,
  DatePickerStateContext,
  useSlottedContext,
} from "react-aria-components";
import type {
  DatePickerProps as AriaDatePickerProps,
  DateValue,
  ValidationResult,
} from "react-aria-components";

import type { OverlayContainerProps } from "../../components/overlay/overlay-props";
import { pickerVariants } from "../../styles/picker";
import { Calendar } from "../calendar/calendar";
import { DateInput } from "../date-field/date-field";
import { composeTailwindRenderProps } from "../internal/compose-tailwind-render-props";
import { useCommittedMonthFocus } from "../internal/picker-focused-month";
import { isRenderableNode, PickerPresetGroup, PickerPresetItem } from "../internal/picker-presets";
import type { PickerPresetGroupProps, PickerPresetItemProps } from "../internal/picker-presets";
import { PickerShell } from "../internal/picker-shell";

/**
 * Labeled date-picker composite over RAC `DatePicker`: the public
 * `DateInput` and `Calendar`, handed to the package-private `PickerShell` that both date
 * pickers wear. Client — the interim react-aria cluster owns segment state, overlay state
 * and the focused-month sync below.
 *
 * What is left here is what a *single-date* picker owns and a range picker does not: one
 * segment row, the optional preset pane, and the focused-month sync. The label, field box,
 * trigger, help text, popover and dialog — and the accessible-name reasoning behind an
 * untitled dialog — live in `internal/picker-shell.tsx`.
 */
export type DatePickerProps<T extends DateValue> = {
  /** Visible label, rendered as the private RAC `Label`. */
  label?: string;
  /** Supporting copy, rendered as the private RAC `Description`. */
  description?: string;
  /**
   * Error copy, rendered as `FieldError` when the picker is invalid. Accepts a node or a
   * validation render function.
   */
  errorMessage?: ReactNode | ((validation: ValidationResult) => ReactNode);
  /**
   * The default value (uncontrolled). Widened to allow an explicit `null` so a form can
   * reset the picker to empty without dropping the prop.
   */
  defaultValue?: T | null;
  /**
   * Quick-choice pane rendered beside the calendar — normally a
   * `DatePickerPresetGroup`. A renderable node is what turns the dialog into two panes;
   * a falsy one (`false` from a `&&` guard, `null`, `""`) keeps the single pane.
   */
  presetGroup?: ReactNode;
  /**
   * Pads day and month segments with a leading zero. The reference flips RAC's
   * locale-dependent default; this port keeps that flip.
   * @default true
   */
  shouldForceLeadingZeros?: boolean;
  /**
   * Portal target for the popover. Defaults to the nearest `ThemeScope`, so the overlay
   * inherits the theme it was opened from; an explicit element or ref
   * wins.
   */
  container?: OverlayContainerProps["container"];
  /**
   * Where the calendar trigger sits in the field box. `"start"` puts it ahead of the
   * segments in DOM, tab and visual order, for a field whose calendar button leads.
   * Clicking the label then focuses the trigger, the field box's first focusable part.
   * @default "end"
   */
  triggerPlacement?: "start" | "end";
} & Omit<AriaDatePickerProps<T>, "defaultValue" | "shouldForceLeadingZeros">;

/**
 * The popover's calendar, month-synced to the picker's own committed value through the
 * RAC `DatePickerStateContext`, where `state.value` is the committed value in both the
 * controlled and the uncontrolled mode. The placeholder comes from the `CalendarContext`
 * RAC fills, so a `placeholderValue` supplied through `DatePickerContext` counts too.
 */
function PickerCalendar({ className }: { className: string }): ReactElement {
  const state = use(DatePickerStateContext);
  const calendar = useSlottedContext(CalendarContext);
  const focus = useCommittedMonthFocus(state?.value, calendar?.defaultFocusedValue);

  return <Calendar className={className} {...focus} />;
}

export function DatePicker<T extends DateValue>({
  className,
  container,
  description,
  errorMessage,
  isReadOnly,
  label,
  presetGroup,
  shouldForceLeadingZeros = true,
  triggerPlacement = "end",
  ...props
}: DatePickerProps<T>): ReactElement {
  const { base, calendar, input, pane } = pickerVariants({
    hasPresets: isRenderableNode(presetGroup),
  });

  return (
    <AriaDatePicker
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
        triggerPlacement={triggerPlacement}
        popover={
          <div className={pane()}>
            {presetGroup}
            <PickerCalendar className={calendar()} />
          </div>
        }>
        <DateInput className={input()} />
      </PickerShell>
    </AriaDatePicker>
  );
}

export type DatePickerPresetGroupProps = PickerPresetGroupProps;

/**
 * The quick-choice pane beside the calendar: a radio group whose options are dates.
 * Only one preset can be in effect at a time, which is why this is a `radiogroup` and
 * not a row of buttons.
 *
 * In the picker popover it publishes `--inner-corner` for its presets, the popover corner less its
 * border and padding.
 */
export function DatePickerPresetGroup(props: DatePickerPresetGroupProps): ReactElement {
  return <PickerPresetGroup data-slot="date-picker-preset-group" {...props} />;
}

export type DatePickerPresetItemProps = PickerPresetItemProps;

/**
 * One preset, closing the picker on double-click when the caller opts in. Styled as a
 * ghost `sm` button and named by its visible children — the library never synthesises
 * copy from the item's `value`.
 */
export function DatePickerPresetItem(props: DatePickerPresetItemProps): ReactElement {
  const state = use(DatePickerStateContext);

  return <PickerPresetItem data-slot="date-picker-preset-item" {...props} state={state} />;
}

DatePicker.displayName = "DatePicker";
DatePickerPresetGroup.displayName = "DatePickerPresetGroup";
DatePickerPresetItem.displayName = "DatePickerPresetItem";
