import type { FocusEvent, ReactElement, ReactNode } from "react";

import { definedProps } from "../../internal/defined-props";
import type { DateGranularity, TemporalValue } from "../../temporal/temporal-value";
import type { CalendarPageBehavior } from "../calendar/calendar-dates";
import type { CalendarFirstDayOfWeek } from "../calendar/calendar-input";
import type { DateInputValue } from "../date-field/date-input";
import type { KindFromValue, KindProps, PropsMadeValue } from "../date-field/date-kind-props";
import { FieldFrame } from "../field/field-frame";
import type { OverlayContainerProps } from "../overlay/overlay-props";
import { DatePickerFieldCalendar, DatePickerInput, DatePickerRoot } from "./date-picker";
import { DatePickerGroup, DatePickerPopup, DatePickerTrigger, PickerPopupPane } from "./picker-shell";

/**
 * DatePickerField's props: React Aria's DatePicker prop names, over Temporal values.
 *
 * @template T - The value's kind: `Temporal.PlainDate` (the default), `PlainDateTime` or
 *   `ZonedDateTime`. Rendered, the field reads it from its `value` or `defaultValue`, and without
 *   either from `granularity` and `timeZone`, so `onChange` receives the kind the picker emits.
 */
export type DatePickerFieldProps<T extends DateInputValue = Temporal.PlainDate> = {
  /** Visible label, rendered as `Field.Label`. It names the group, the segments, the trigger and the popup. */
  label?: string;
  /** Supporting copy, rendered as `Field.Description`. */
  description?: string;
  /**
   * Error copy, rendered as `Field.Error` while the picker is invalid, in place of its own message.
   * Without `isInvalid` it shows only once the picker's own validation fails.
   */
  errorMessage?: ReactNode;
  /**
   * The value, when the parent owns it: a Temporal value of `T`'s kind, built in a client
   * component. `null` empties it.
   */
  value?: T | null;
  /** The first value, when the picker owns its value. */
  defaultValue?: T | null;
  /** Called with this runtime's value when a day is picked or the segments form one, `null` when cleared. */
  onChange?: NoInfer<(value: T | null) => void>;
  /** The earliest valid value, a Temporal value of any kind. */
  minValue?: TemporalValue;
  /** The latest valid value, a Temporal value of any kind. */
  maxValue?: TemporalValue;
  /** Values the picker refuses: focusable but unselectable days, an invalid typed value. */
  isDateUnavailable?: NoInfer<(value: T) => boolean>;
  /** The smallest unit the input edits. Without a value it names the kind, as DateField's does. */
  granularity?: DateGranularity;
  /** The hour cycle shown. Defaults to the locale's. */
  hourCycle?: 12 | 24;
  /** Hides a zoned value's zone name. */
  hideTimeZone?: boolean;
  /** The zone an empty zoned picker takes. New beside React Aria's names, as DateField's. */
  timeZone?: string;
  /** The weekday each calendar row starts on. */
  firstDayOfWeek?: CalendarFirstDayOfWeek;
  /** How many months the calendar shows. @default 1 */
  visibleMonths?: number;
  /** How the calendar pages a multi-month view. @default "visible" */
  pageBehavior?: CalendarPageBehavior;
  /**
   * The preset pane beside the calendar, normally `DatePicker.Presets`. A falsy node (`false` from
   * a `&&` guard, `null`, `""`) keeps the calendar alone.
   */
  presetGroup?: ReactNode;
  /**
   * Where the calendar trigger sits in the field box, in DOM, tab and visual order.
   * @default "end"
   */
  triggerPlacement?: "start" | "end";
  /**
   * Whether picking a day closes the popup. With a time `granularity`, the popup shows a time input
   * under the calendar (`DatePicker.TimeInput`); a day picked in an empty picker that stays open
   * commits at the time typed there, or at midnight when the popup closes first.
   * @default true
   */
  shouldCloseOnSelect?: boolean;
  /** Pads days, months and hours with a leading zero, as DateField does. @default true */
  shouldForceLeadingZeros?: boolean;
  /** Whether the popup is open, when the parent owns it. */
  isOpen?: boolean;
  /** Whether the popup starts open. */
  defaultOpen?: boolean;
  /** Called when the popup opens or closes. */
  onOpenChange?: (isOpen: boolean) => void;
  /**
   * Called when focus leaves the picker: the field box and the popup together. It receives the
   * `blur` that started the leave: its `relatedTarget` is where focus went, or, when focus left the
   * popup through one of Base UI's focus guards, that guard.
   */
  onBlur?: (event: FocusEvent<Element>) => void;
  /** The name the ISO value submits and `Form` errors arrive under. */
  name?: string;
  /** Disables the picker and leaves its value out of the form. */
  isDisabled?: boolean;
  /** Keeps the value; the segments stay focusable and the trigger is disabled. */
  isReadOnly?: boolean;
  /** Reports an empty or incomplete picker invalid. */
  isRequired?: boolean;
  /** Shows the picker invalid, with `errorMessage`. */
  isInvalid?: boolean;
  /** Control size of the field box. @default "default" */
  size?: "default" | "sm";
  /** Names the picker when there is no visible `label`. */
  "aria-label"?: string;
  /** Portal target for the popup. Defaults to the nearest `ThemeScope`. */
  container?: OverlayContainerProps["container"];
  /** Extra classes, merged onto `Field.Root`. */
  className?: string;
};

/**
 * Labeled date picker composite over Field and `DatePicker`'s parts, with React Aria's
 * DatePicker prop names: a label, the field box with the segments and the calendar trigger, the
 * error, the description, and the calendar popup with an optional preset pane. Values are Temporal
 * values, which a client component builds. The composite itself holds no state, so a server
 * component can render it without a value.
 *
 * @template P - The props, inferred: only their `granularity` and `timeZone` count.
 * @template T - The value's kind, inferred as `DateInput.Root`'s is.
 */
export function DatePickerField<P = object, T extends DateInputValue = PropsMadeValue<P>>({
  label,
  description,
  errorMessage,
  onChange,
  presetGroup,
  triggerPlacement = "end",
  shouldForceLeadingZeros = true,
  isOpen,
  onBlur,
  name,
  isDisabled = false,
  isReadOnly = false,
  isRequired = false,
  isInvalid = false,
  size = "default",
  container,
  className,
  ...props
}: DatePickerFieldProps<T> & KindProps<P, DatePickerFieldProps<DateInputValue>>): ReactElement {
  const trigger = <DatePickerTrigger />;
  return (
    <FieldFrame
      className={className}
      name={name}
      invalid={isInvalid}
      disabled={isDisabled}
      label={label}
      description={description}
      errorMessage={errorMessage}
      // Without `isInvalid`, `errorMessage` shows only once the field's own validation fails, as in
      // React Aria.
      isErrorMessageAlwaysShown={isInvalid}>
      <DatePickerRoot<KindFromValue, T>
        {...definedProps({
          ...props,
          // The extra details argument is ignored by the `onChange(value)` signature.
          onValueChange: onChange,
          open: isOpen,
          onFocusLeave: onBlur,
        })}
        readOnly={isReadOnly}
        disabled={isDisabled}
        required={isRequired}
        invalid={isInvalid}
        size={size}>
        <DatePickerGroup>
          {triggerPlacement === "start" ? trigger : null}
          <DatePickerInput shouldForceLeadingZeros={shouldForceLeadingZeros} />
          {triggerPlacement === "end" ? trigger : null}
        </DatePickerGroup>
        <DatePickerPopup {...definedProps({ container })}>
          <PickerPopupPane presets={presetGroup}>
            <DatePickerFieldCalendar shouldForceLeadingZeros={shouldForceLeadingZeros} />
          </PickerPopupPane>
        </DatePickerPopup>
      </DatePickerRoot>
    </FieldFrame>
  );
}

DatePickerField.displayName = "DatePickerField";
