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
 * DateRangePickerField's props: React Aria's DateRangePicker prop names, over Temporal values.
 *
 * @template T - The ends' kind: `Temporal.PlainDate` (the default), `PlainDateTime` or
 *   `ZonedDateTime`. Rendered, the field reads it from its `value` or `defaultValue`, and without
 *   either from `granularity` and `timeZone`, so `onChange` receives the kind the picker emits.
 */
export type DateRangePickerFieldProps<T extends DateInputValue = Temporal.PlainDate> = {
  /**
   * The visible label, for the whole picker. It names the field box's `group`, both inputs'
   * segments, by unit, end and label ("month, Start Date, Stay"), and the trigger and the popup, a
   * `dialog` ("Calendar Stay").
   */
  label?: string;
  /** Supporting copy below the field box, which describes both ends. */
  description?: string;
  /**
   * Error copy shown while the range is invalid, in place of its own messages (an end out of
   * bounds, an end before its start, the `Form` errors under `startName` and `endName`). Those
   * merge into one error, which describes the group and both ends. Without `isInvalid` it shows
   * only once the range's own validation fails. A node that renders nothing (`null`, `false`, `""`)
   * keeps the range's own messages.
   */
  errorMessage?: ReactNode;
  /**
   * The range, when the parent owns it: each end a `Temporal.PlainDate`, `PlainDateTime` or
   * `ZonedDateTime` from any implementation, typed as DateField's value is. A server component
   * cannot pass one, since it reaches the client as ISO text, which the picker refuses with a
   * `TypeError`: build the value in a client component. `null` empties both ends. Picking a range
   * in the calendar keeps each end's time and zone.
   *
   * Import `@elmeragroup/fuse/temporal-polyfill` on the server and in the browser for engines
   * without `Temporal`, and type-check with TypeScript 6 and an `esnext` lib, as
   * `/quick-start#temporal` shows.
   */
  value?: DateRangePickerValue<T> | null;
  /**
   * The first range, when the picker owns its value. Takes what `value` takes. The composite holds
   * no state of its own, so a server component can render it without a value.
   */
  defaultValue?: DateRangePickerValue<T> | null;
  /**
   * Called with this runtime's range once both ends hold a value and one changes, and `null` as soon
   * as a whole range loses an end, as React Aria reports it; the other end stays in its input.
   *
   * Each end takes DateField's keys. Typing the start's last segment moves on to the end's first,
   * and Backspace in the end's first empty segment goes back. In the calendar the first day
   * pressed anchors the range, and the second completes it. An end typed before its start, or a
   * start typed past its end, commits and shows invalid on the end once focus leaves: "Start date
   * must be before end date."
   */
  onChange?: NoInfer<(value: DateRangePickerValue<T> | null) => void>;
  /** The earliest valid value for either end, a Temporal value of any kind. */
  minValue?: TemporalValue;
  /** The latest valid value for either end. */
  maxValue?: TemporalValue;
  /** Values the picker refuses for either end. */
  isDateUnavailable?: NoInfer<(value: T) => boolean>;
  /**
   * The smallest unit the inputs edit. A time granularity needs values with a time, and the popup
   * then shows a start and an end time input under the calendar, where typing an end's time
   * changes only that end's time. Without a value it names the kind, as DateField's does.
   */
  granularity?: DateGranularity;
  /** The hour cycle the inputs and the popup's time inputs show. Defaults to the locale's. */
  hourCycle?: 12 | 24;
  /** Hides zoned values' zone names in the inputs and in the popup's time inputs. */
  hideTimeZone?: boolean;
  /** The zone an empty zoned picker takes, as DateField's `timeZone`. */
  timeZone?: string;
  /** The weekday each calendar row starts on. Defaults to the locale's. */
  firstDayOfWeek?: CalendarFirstDayOfWeek;
  /**
   * How many months the calendar shows, as RangeCalendar's `visibleMonths`. The range highlight
   * runs across them.
   */
  visibleMonths?: number;
  /** How the calendar pages a multi-month view, as RangeCalendar's `pageBehavior`. */
  pageBehavior?: CalendarPageBehavior;
  /**
   * The preset pane beside the calendar, normally `DateRangePicker.Presets`, a radio group of your
   * keys. Map the chosen key to a range in its `onValueChange` and set the picker's value, or give
   * each preset its range as `dateValue`, `{ start, end }`. With a pane, focus leaving the calendar
   * drops a half-picked range instead of completing it. A falsy node keeps the calendar alone.
   */
  presetGroup?: ReactNode;
  /**
   * Whether completing a range in the calendar closes the popup. With a time `granularity`, a
   * range picked in an empty picker that stays open commits once both ends have a time typed
   * under the calendar, or when the popup closes, with midnight for an end without one.
   */
  shouldCloseOnSelect?: boolean;
  /** Pads days, months and hours with a leading zero in both inputs. */
  shouldForceLeadingZeros?: boolean;
  /** Whether the popup is open, when the parent owns it. */
  isOpen?: boolean;
  /** Whether the popup starts open. */
  defaultOpen?: boolean;
  /**
   * Called when the popup opens or closes. The first Escape in the calendar drops a half-picked
   * range and keeps the popup open; the next closes it.
   */
  onOpenChange?: (isOpen: boolean) => void;
  /**
   * Called when focus leaves the picker: the field box and the popup together. It receives the
   * `blur` that started the leave: its `relatedTarget` is where focus went, or, when focus left the
   * popup through one of Base UI's focus guards, that guard.
   */
  onBlur?: (event: FocusEvent<Element>) => void;
  /**
   * The name the start's ISO value submits and `Form` errors arrive under. Each end is a Field of
   * its own: a `Form` error under this name shows in the picker's one error and focuses the
   * start's first segment.
   */
  startName?: string;
  /** The name the end's ISO value submits and `Form` errors arrive under, as `startName`'s. */
  endName?: string;
  /** Disables the picker and leaves its values out of the form. */
  isDisabled?: boolean;
  /**
   * Keeps the range. The segments stay focusable and take the muted read-only fill, and the
   * trigger is disabled.
   */
  isReadOnly?: boolean;
  /** Reports an empty or incomplete end invalid, and an empty end blocks a `Form` submit. */
  isRequired?: boolean;
  /** Shows the picker invalid, with `errorMessage` under the box. */
  isInvalid?: boolean;
  /**
   * The field box's control size: `"default"` the `md` one, `"sm"` the `sm` one.
   * @default "default"
   */
  size?: "default" | "sm";
  /** Names the picker when there is no visible `label`. */
  "aria-label"?: string;
  /** Portal target for the popup. Defaults to the nearest `ThemeScope`. */
  container?: OverlayContainerProps["container"];
  /** Extra classes, merged onto the picker's root. */
  className?: string;
};

/**
 * Labeled date range picker composite over `DateRangePicker`'s parts, with React Aria's
 * DateRangePicker prop names: a label, the field box with the start and end segments and the
 * calendar trigger, the merged error, the description, and the range calendar popup with an
 * optional preset pane.
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
  shouldCloseOnSelect = true,
  visibleMonths = 1,
  pageBehavior = "visible",
  size = "default",
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
      shouldCloseOnSelect={shouldCloseOnSelect}
      visibleMonths={visibleMonths}
      pageBehavior={pageBehavior}
      size={size}
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
      {/* Without `isInvalid`, `errorMessage` shows only once the range's validation fails; an
          `errorMessage` that renders nothing keeps the range's own messages. */}
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
