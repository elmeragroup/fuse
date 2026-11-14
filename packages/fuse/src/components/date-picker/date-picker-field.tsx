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
  /**
   * The visible label, rendered as `Field.Label`. It names the field box's `group` and the
   * segments, as DateField's label does, and the trigger and the popup, a `dialog`: "Calendar
   * Moving date" for the label "Moving date".
   */
  label?: string;
  /** Supporting copy, rendered as `Field.Description`, which describes the segments as DateField's does. */
  description?: string;
  /**
   * Error copy, rendered as `Field.Error` while the picker is invalid, in place of its own message.
   * Without `isInvalid` it shows only once the picker's own validation fails.
   */
  errorMessage?: ReactNode;
  /**
   * The value, when the parent owns it: a `Temporal.PlainDate`, `PlainDateTime` or
   * `ZonedDateTime` from any implementation. A server component cannot pass one, since it reaches
   * the client as ISO text, which the picker refuses with a `TypeError`: build the value in a
   * client component. `null` empties it. Picking a day keeps the value's time and zone.
   *
   * Import `@elmeragroup/fuse/temporal-polyfill` on the server and in the browser for engines
   * without `Temporal`, and type-check with TypeScript 6 and an `esnext` lib, as
   * `/quick-start#temporal` shows.
   */
  value?: T | null;
  /**
   * The first value, when the picker owns its value. Takes what `value` takes. The composite holds
   * no state of its own, so a server component can render it without a value.
   */
  defaultValue?: T | null;
  /**
   * Called with this runtime's value when a day is picked or the segments form one, `null` when
   * cleared. Its kind is typed as DateField's `onChange` is, with no type argument. The segments
   * take DateField's keys.
   */
  onChange?: NoInfer<(value: T | null) => void>;
  /**
   * The earliest valid value, a Temporal value of any kind, compared as DateField compares it.
   * Earlier days are disabled in the calendar.
   */
  minValue?: TemporalValue;
  /** The latest valid value, taking what `minValue` takes. Later days are disabled in the calendar. */
  maxValue?: TemporalValue;
  /** Values the picker refuses: focusable but unselectable days, an invalid typed value. */
  isDateUnavailable?: NoInfer<(value: T) => boolean>;
  /**
   * The smallest unit the input edits. A time granularity needs a value with a time, and the popup
   * then shows the time under the calendar, in an input where typing changes only the time.
   * Without a value it names the kind, as DateField's does, and until a value names its kind an
   * empty picker follows changes to `granularity` and `timeZone`.
   */
  granularity?: DateGranularity;
  /** The hour cycle the field and the popup's time input show. Defaults to the locale's. */
  hourCycle?: 12 | 24;
  /** Hides a zoned value's zone name in the field and in the popup's time input. */
  hideTimeZone?: boolean;
  /** The zone an empty zoned picker takes, as DateField's `timeZone`. */
  timeZone?: string;
  /** The weekday each calendar row starts on. Defaults to the locale's. */
  firstDayOfWeek?: CalendarFirstDayOfWeek;
  /** How many months the calendar shows, as Calendar's `visibleMonths`. */
  visibleMonths?: number;
  /** How the calendar pages a multi-month view, as Calendar's `pageBehavior`. */
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
   * Whether picking a day closes the popup. Picking a day commits it. With a time `granularity`,
   * a day picked in an empty picker that stays open commits at the time typed under the calendar,
   * or at midnight when the popup closes first. A time typed before any day waits for one.
   */
  shouldCloseOnSelect?: boolean;
  /** Pads days, months and hours with a leading zero, as DateField does. */
  shouldForceLeadingZeros?: boolean;
  /** Whether the popup is open, when the parent owns it. */
  isOpen?: boolean;
  /** Whether the popup starts open. */
  defaultOpen?: boolean;
  /**
   * Called when the popup opens or closes. The trigger or Alt+ArrowDown in the field opens it, and
   * focus moves to the selected day, or today. Escape closes it, and focus goes back to the field.
   */
  onOpenChange?: (isOpen: boolean) => void;
  /**
   * Called when focus leaves the picker: the field box and the popup together. It receives the
   * `blur` that started the leave: its `relatedTarget` is where focus went, or, when focus left the
   * popup through one of Base UI's focus guards, that guard.
   */
  onBlur?: (event: FocusEvent<Element>) => void;
  /**
   * The name the ISO value submits and `Form` errors arrive under. Inside `Form`, the ISO text
   * reaches `onFormSubmit` and native `FormData` under it. A required, incomplete or
   * out-of-bounds value blocks the submit and takes focus on the first segment, and an error the
   * form holds under this name shows below the picker until the value changes.
   */
  name?: string;
  /** Disables the picker and leaves its value out of the form. */
  isDisabled?: boolean;
  /**
   * Keeps the value. The segments stay focusable and take the muted read-only fill, and the
   * trigger is disabled.
   */
  isReadOnly?: boolean;
  /** Reports an empty picker missing, and a half-typed one incomplete. */
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
  /** Extra classes, merged onto `Field.Root`. */
  className?: string;
};

/**
 * Labeled date picker composite over Field and `DatePicker`'s parts, with React Aria's
 * DatePicker prop names: a label, the field box with the segments and the calendar trigger, the
 * error, the description, and the calendar popup with an optional preset pane.
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
  shouldCloseOnSelect = true,
  visibleMonths = 1,
  pageBehavior = "visible",
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
      // Without `isInvalid`, `errorMessage` shows only once the field's own validation fails.
      isErrorMessageAlwaysShown={isInvalid}>
      <DatePickerRoot<KindFromValue, T>
        {...definedProps({
          ...props,
          // The extra details argument is ignored by the `onChange(value)` signature.
          onValueChange: onChange,
          open: isOpen,
          onFocusLeave: onBlur,
        })}
        shouldCloseOnSelect={shouldCloseOnSelect}
        visibleMonths={visibleMonths}
        pageBehavior={pageBehavior}
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
