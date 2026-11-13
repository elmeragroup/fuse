import type { ReactElement, ReactNode } from "react";

import { definedProps } from "../../internal/defined-props";
import type { DateGranularity, TemporalValue } from "../../temporal/temporal-value";
import { FieldFrame } from "../field/field-frame";
import { DateInputRoot } from "./date-input";
import type { DateInputValue } from "./date-input";
import type { KindFromValue, KindProps, PropsMadeValue } from "./date-kind-props";

/**
 * DateField's props: React Aria's DateField prop names, over Temporal values.
 *
 * @template T - The value's kind: `Temporal.PlainDate` (the default), `PlainDateTime` or
 *   `ZonedDateTime`. Rendered, DateField reads it from its `value` or `defaultValue`, and without
 *   either from `granularity` and `timeZone`, so `onChange` receives the kind the field emits.
 */
export type DateFieldProps<T extends DateInputValue = Temporal.PlainDate> = {
  /** Visible label, rendered as `Field.Label`. It names the segment group and every segment. */
  label?: string;
  /** Supporting copy, rendered as `Field.Description`. */
  description?: string;
  /**
   * Error copy, rendered as `Field.Error` while the field is invalid, in place of its own message.
   * Without `isInvalid` it shows only once the field's own validation fails. Falsy, the field shows
   * its own message: an error `Form` holds under its `name`, or why the value fails ("Value must be
   * 10/31/2026 or earlier.").
   */
  errorMessage?: ReactNode;
  /**
   * The value, when the parent owns it: a Temporal value of `T`'s kind, built in a client
   * component. `null` empties it.
   */
  value?: T | null;
  /** The first value, when the field owns its value. */
  defaultValue?: T | null;
  /**
   * Called with this runtime's Temporal value once the segments form a new one, or with `null`
   * when every segment is cleared.
   */
  onChange?: NoInfer<(value: T | null) => void>;
  /** The earliest valid value, a Temporal value of any kind. An earlier value still commits and shows as invalid. */
  minValue?: TemporalValue;
  /** The latest valid value, a Temporal value of any kind. */
  maxValue?: TemporalValue;
  /** Values the field reports as unavailable. */
  isDateUnavailable?: NoInfer<(value: T) => boolean>;
  /**
   * The smallest unit edited. Defaults to `"day"` for a date and `"minute"` for a value with a
   * time. Without a value it names the kind, as DateInput's does.
   */
  granularity?: DateGranularity;
  /** The hour cycle shown. Defaults to the locale's. */
  hourCycle?: 12 | 24;
  /** Hides a zoned value's zone name. */
  hideTimeZone?: boolean;
  /**
   * The zone an empty zoned field takes. New beside React Aria's names: React Aria reads the zone
   * from a value, so an empty field needs it to emit a ZonedDateTime.
   */
  timeZone?: string;
  /**
   * Pads days, months and hours with a leading zero, which flips React Aria's locale default.
   * @default true
   */
  shouldForceLeadingZeros?: boolean;
  /** The name the ISO value submits and `Form` errors arrive under. */
  name?: string;
  /** Disables the field and leaves its value out of the form. */
  isDisabled?: boolean;
  /** Keeps the value; the segments stay focusable. */
  isReadOnly?: boolean;
  /** Reports an empty or incomplete field invalid. */
  isRequired?: boolean;
  /** Shows the field invalid, with `errorMessage`. */
  isInvalid?: boolean;
  /**
   * Control size of the field box. `"default"` maps to the `md` control size; `"sm"` to the `sm` one.
   * @default "default"
   */
  size?: "default" | "sm";
  /** Names the segment group when there is no visible `label`. */
  "aria-label"?: string;
  /** Extra classes, merged onto `Field.Root`. */
  className?: string;
};

/**
 * Labeled date field composite over Field and `DateInput`: a label, the segments, the error and
 * the description, with React Aria's DateField prop names. Values are Temporal values,
 * which a client component builds. The composite itself holds no state, so a server component can
 * render it without a value.
 *
 * @template P - The props, inferred: only their `granularity` and `timeZone` count.
 * @template T - The value's kind, inferred as `DateInput.Root`'s is.
 */
export function DateField<P = object, T extends DateInputValue = PropsMadeValue<P>>({
  label,
  description,
  errorMessage,
  value,
  defaultValue,
  onChange,
  minValue,
  maxValue,
  isDateUnavailable,
  granularity,
  hourCycle,
  hideTimeZone,
  timeZone,
  shouldForceLeadingZeros = true,
  name,
  isDisabled = false,
  isReadOnly = false,
  isRequired = false,
  isInvalid = false,
  size = "default",
  className,
  ...props
}: DateFieldProps<T> & KindProps<P, DateFieldProps<DateInputValue>>): ReactElement {
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
      <DateInputRoot<KindFromValue, T>
        {...definedProps({
          value,
          defaultValue,
          // The extra details argument is ignored by the `onChange(value)` signature.
          onValueChange: onChange,
          minValue,
          maxValue,
          isDateUnavailable,
          granularity,
          hourCycle,
          hideTimeZone,
          timeZone,
          "aria-label": props["aria-label"],
        })}
        shouldForceLeadingZeros={shouldForceLeadingZeros}
        readOnly={isReadOnly}
        required={isRequired}
        invalid={isInvalid}
        size={size}
      />
    </FieldFrame>
  );
}

DateField.displayName = "DateField";
