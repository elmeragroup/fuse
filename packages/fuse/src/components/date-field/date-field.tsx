import type { ReactElement, ReactNode } from "react";

import { definedProps } from "../../internal/defined-props";
import type { DateGranularity, TemporalInput } from "../../temporal/temporal-value";
import { FieldFrame } from "../field/field-frame";
import { DateInputRoot } from "./date-input";
import type { DateInputValue } from "./date-input";

/**
 * DateField's props: the interim React Aria DateField's names, over Temporal values.
 *
 * @template T - The value's kind: `Temporal.PlainDate` (the default), `PlainDateTime` or
 *   `ZonedDateTime`. A Temporal `value` or `defaultValue` names it; ISO text alone does not, since
 *   its kind shows only at runtime, so pass the type argument (`<DateField<Temporal.PlainDate>>`)
 *   to narrow what `onChange` receives.
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
  /** The value, when the parent owns it: a Temporal value of `T`'s kind or its ISO text. `null` empties it. */
  value?: T | string | null;
  /** The first value, when the field owns its value. */
  defaultValue?: T | string | null;
  /**
   * Called with this runtime's Temporal value once the segments form a new one, or with `null`
   * when every segment is cleared.
   */
  onChange?: (value: T | null) => void;
  /** The earliest valid value, of any kind or its ISO text. An earlier value still commits and shows as invalid. */
  minValue?: TemporalInput;
  /** The latest valid value, of any kind or its ISO text. */
  maxValue?: TemporalInput;
  /** Values the field reports as unavailable. */
  isDateUnavailable?: (value: T) => boolean;
  /** The smallest unit edited. Defaults to `"day"` for a date and `"minute"` for a value with a time. */
  granularity?: DateGranularity;
  /** The hour cycle shown. Defaults to the locale's. */
  hourCycle?: 12 | 24;
  /** Hides a zoned value's zone name. */
  hideTimeZone?: boolean;
  /**
   * The zone an empty zoned field takes. New beside the interim names: React Aria reads the zone
   * from a value, so an empty field needs it to emit a ZonedDateTime.
   */
  timeZone?: string;
  /**
   * Pads days, months and hours with a leading zero. The interim DateField flipped React Aria's
   * locale default; this one keeps the flip.
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
 * the description, with the interim React Aria DateField's prop names. Values are Temporal values,
 * or their ISO text, which a server component can pass: the composite itself holds no state.
 *
 * @template T - The value's kind.
 */
export function DateField<T extends DateInputValue = Temporal.PlainDate>({
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
}: DateFieldProps<T>): ReactElement {
  return (
    <FieldFrame
      className={className}
      name={name}
      invalid={isInvalid}
      disabled={isDisabled}
      label={label}
      description={description}
      errorMessage={errorMessage}
      // Without `isInvalid`, React Aria shows `errorMessage` only once its own validation fails.
      isErrorMessageAlwaysShown={isInvalid}>
      <DateInputRoot<T>
        {...definedProps({
          value,
          defaultValue,
          // The extra details argument is ignored by the interim `onChange(value)` signature.
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
