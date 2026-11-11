import type { FocusEvent, ReactElement, ReactNode } from "react";

import { definedProps } from "../../internal/defined-props";
import type { DateGranularity, TemporalValue } from "../../temporal/temporal-value";
import type { CalendarPageBehavior } from "../calendar/calendar-dates";
import type { CalendarFirstDayOfWeek } from "../calendar/calendar-input";
import type { DateInputValue } from "../date-field/date-input";
import type { KindFromValue, KindProps, PropsMadeValue } from "../date-field/date-kind-props";
import {
  DatePickerGroup,
  DatePickerPopup,
  DatePickerTrigger,
  PickerPopupPane,
} from "../date-picker/picker-shell";
import type { OverlayContainerProps } from "../overlay/overlay-props";
import { DateRangePickerRoot } from "./date-range-picker";
import type { DateRangePickerValue } from "./date-range-picker";
import {
  DateRangePickerDescription,
  DateRangePickerEndInput,
  DateRangePickerFieldCalendar,
  DateRangePickerError,
  DateRangePickerLabel,
  DateRangePickerSeparator,
  DateRangePickerStartInput,
} from "./date-range-picker-parts";

/**
 * DateRangePickerField's props: the interim React Aria DateRangePicker's names, over Temporal
 * values.
 *
 * @template T - The ends' kind: `Temporal.PlainDate` (the default), `PlainDateTime` or
 *   `ZonedDateTime`. Rendered, the field reads it from its `value` or `defaultValue`, and without
 *   either from `granularity` and `timeZone`, so `onChange` receives the kind the picker emits.
 */
export type DateRangePickerFieldProps<T extends DateInputValue = Temporal.PlainDate> = {
  /** Visible label. It names the group, both inputs' segments, the trigger and the popup. */
  label?: string;
  /** Supporting copy below the field box. */
  description?: string;
  /**
   * Error copy shown while the range is invalid, in place of its own messages (an end out of
   * bounds, an end before its start, the `Form` errors under `startName` and `endName`). Without
   * `isInvalid` it shows only once the range's own validation fails. A node that renders nothing
   * (`null`, `false`, `""`) keeps the range's own messages.
   */
  errorMessage?: ReactNode;
  /**
   * The range, when the parent owns it: each end a Temporal value of `T`'s kind, built in a client
   * component. `null` empties both ends.
   */
  value?: DateRangePickerValue<T> | null;
  /** The first range, when the picker owns its value. */
  defaultValue?: DateRangePickerValue<T> | null;
  /**
   * Called with this runtime's range once both ends hold a value and one changes, and `null` as soon
   * as a whole range loses an end, as React Aria reports it.
   */
  onChange?: NoInfer<(value: DateRangePickerValue<T> | null) => void>;
  /** The earliest valid value for either end, a Temporal value of any kind. */
  minValue?: TemporalValue;
  /** The latest valid value for either end. */
  maxValue?: TemporalValue;
  /** Values the picker refuses for either end. */
  isDateUnavailable?: NoInfer<(value: T) => boolean>;
  /** The smallest unit the inputs edit. Without a value it names the kind, as DateField's does. */
  granularity?: DateGranularity;
  /** The hour cycle shown. Defaults to the locale's. */
  hourCycle?: 12 | 24;
  /** Hides zoned values' zone names. */
  hideTimeZone?: boolean;
  /** The zone an empty zoned picker takes. New beside the interim names. */
  timeZone?: string;
  /** The weekday each calendar row starts on. */
  firstDayOfWeek?: CalendarFirstDayOfWeek;
  /** How many months the calendar shows. @default 1 */
  visibleMonths?: number;
  /** How the calendar pages a multi-month view. @default "visible" */
  pageBehavior?: CalendarPageBehavior;
  /**
   * The preset pane beside the calendar, normally `DateRangePicker.Presets`. With one, focus leaving
   * the calendar drops a half-picked range instead of completing it. A falsy node keeps the calendar
   * alone.
   */
  presetGroup?: ReactNode;
  /**
   * Whether completing a range in the calendar closes the popup. With a time `granularity`, the
   * popup shows a start and an end time input under the calendar; a range picked in an empty
   * picker that stays open commits once both have a time, or at midnight when the popup closes.
   * @default true
   */
  shouldCloseOnSelect?: boolean;
  /** Pads days, months and hours with a leading zero in both inputs. @default true */
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
  /** The name the start's ISO value submits and `Form` errors arrive under. */
  startName?: string;
  /** The name the end's ISO value submits and `Form` errors arrive under. */
  endName?: string;
  /** Disables the picker and leaves its values out of the form. */
  isDisabled?: boolean;
  /** Keeps the range; the segments stay focusable and the trigger is disabled. */
  isReadOnly?: boolean;
  /** Reports an empty or incomplete end invalid. */
  isRequired?: boolean;
  /** Shows the picker invalid, with `errorMessage`. */
  isInvalid?: boolean;
  /** Control size of the field box. @default "default" */
  size?: "default" | "sm";
  /** Names the picker when there is no visible `label`. */
  "aria-label"?: string;
  /** Portal target for the popup. Defaults to the nearest `ThemeScope`. */
  container?: OverlayContainerProps["container"];
  /** Extra classes, merged onto the picker's root. */
  className?: string;
};

/**
 * Labeled date range picker composite over `DateRangePicker`'s parts, with the interim React Aria
 * DateRangePicker's prop names: a label, the field box with the start and end segments and the
 * calendar trigger, the merged error, the description, and the range calendar popup with an
 * optional preset pane. Each end is a Field of its own under `startName` and `endName`. Values are
 * Temporal values, which a client component builds. The composite itself holds no state, so a
 * server component can render it without a value.
 *
 * @template P - The props, inferred: only their `granularity` and `timeZone` count.
 * @template T - The ends' kind, inferred as `DateInput.Root`'s is.
 */
export function DateRangePickerField<P = object, T extends DateInputValue = PropsMadeValue<P>>({
  label,
  description,
  errorMessage,
  value,
  defaultValue,
  onChange,
  presetGroup,
  shouldForceLeadingZeros = true,
  isOpen,
  onBlur,
  isDisabled = false,
  isReadOnly = false,
  isRequired = false,
  isInvalid = false,
  container,
  className,
  ...props
}: DateRangePickerFieldProps<T> & KindProps<P, DateRangePickerFieldProps<DateInputValue>>): ReactElement {
  return (
    <DateRangePickerRoot<KindFromValue, T>
      {...definedProps({
        ...props,
        value,
        defaultValue,
        onValueChange: onChange,
        open: isOpen,
        onFocusLeave: onBlur,
        className,
      })}
      disabled={isDisabled}
      readOnly={isReadOnly}
      required={isRequired}
      invalid={isInvalid}>
      {label ? <DateRangePickerLabel>{label}</DateRangePickerLabel> : null}
      <DatePickerGroup>
        <DateRangePickerStartInput shouldForceLeadingZeros={shouldForceLeadingZeros} />
        <DateRangePickerSeparator />
        <DateRangePickerEndInput shouldForceLeadingZeros={shouldForceLeadingZeros} />
        <DatePickerTrigger className="ms-auto" />
      </DatePickerGroup>
      {/* Without `isInvalid`, React Aria shows `errorMessage` only once the range's validation fails;
          an `errorMessage` that renders nothing keeps the range's own messages. */}
      <DateRangePickerError>{errorMessage}</DateRangePickerError>
      {description ? <DateRangePickerDescription>{description}</DateRangePickerDescription> : null}
      <DatePickerPopup {...definedProps({ container })}>
        <PickerPopupPane presets={presetGroup}>
          <DateRangePickerFieldCalendar shouldForceLeadingZeros={shouldForceLeadingZeros} />
        </PickerPopupPane>
      </DatePickerPopup>
    </DateRangePickerRoot>
  );
}

DateRangePickerField.displayName = "DateRangePickerField";
