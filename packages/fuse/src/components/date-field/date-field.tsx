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
  /**
   * The visible label, rendered as `Field.Label`. It names the segment group, and each segment's
   * name is its unit and the label, such as "month, Moving date". Each segment is a
   * `spinbutton`, or a `textbox` on iOS, where VoiceOver cannot focus a spinbutton.
   */
  label?: string;
  /**
   * Supporting copy, rendered as `Field.Description`. The description, the error and the selected
   * value ("Selected Date: October 05, 2026") describe the first segment, and every segment while
   * the field is invalid.
   */
  description?: string;
  /**
   * Error copy, rendered as `Field.Error` while the field is invalid, in place of its own message.
   * Without `isInvalid` it shows only once the field's own validation fails. Falsy, the field shows
   * its own message: an error `Form` holds under its `name`, or why the value fails ("Value must be
   * 10/31/2026 or earlier.").
   */
  errorMessage?: ReactNode;
  /**
   * The value, when the parent owns it: a `Temporal.PlainDate`, `PlainDateTime` or
   * `ZonedDateTime` from any implementation. Its kind picks the segments: a `PlainDate` edits the
   * date, the other two the date and time. A server component cannot pass one, since it reaches
   * the client as ISO text, which the field refuses with a `TypeError`: build the value in a
   * client component. `null` empties it.
   *
   * Import `@elmeragroup/fuse/temporal-polyfill` on the server and in the browser for engines
   * without `Temporal`, and type-check with TypeScript 6 and an `esnext` lib, as
   * `/quick-start#temporal` shows.
   */
  value?: T | null;
  /**
   * The first value, when the field owns its value. Takes what `value` takes. The field holds no
   * state of its own, so a server component can render it without a value.
   */
  defaultValue?: T | null;
  /**
   * Called with this runtime's Temporal value once the segments form a new one, or with `null`
   * when every segment is cleared. Its kind is typed from `value` or `defaultValue`, and without
   * either from `granularity` and `timeZone`, as the field resolves it: no granularity or `"day"`
   * gives a `PlainDate`, a time granularity a `PlainDateTime`, and a time granularity with
   * `timeZone` a `ZonedDateTime`. It takes no type argument.
   *
   * Typing fills a segment and moves on when it is full: `10052026` in en-US, `05102026` in nb-NO.
   * Arrow Up and Down step a segment and wrap, Page Up and Page Down step by 5 years, 2 months,
   * 7 days, 2 hours or 15 minutes, Home and End go to its ends, and Backspace removes a digit.
   * Those keys with Ctrl, Cmd or Alt are left to the browser. An arrow key on an empty segment
   * starts from today, read when the user presses it. The value commits once every segment is
   * filled; a date the segments cannot form, such as February 30, commits on blur as the month's
   * last day. On a phone the segments open the numeric keyboard with a Next key.
   */
  onChange?: NoInfer<(value: T | null) => void>;
  /**
   * The earliest valid value, a Temporal value of any kind, independent of the value's. A zoned
   * bound compares as an instant, and a plain one as wall-clock time in the value's zone, as React
   * Aria compares them. An earlier value still commits, and on blur the field shows it invalid
   * with React Aria's words, such as "Value must be 07/01/2026 or later.", in the
   * `LocaleProvider`'s locale.
   */
  minValue?: TemporalValue;
  /**
   * The latest valid value, taking what `minValue` takes. A later value commits and shows "Value
   * must be 07/31/2026 or earlier." on blur.
   */
  maxValue?: TemporalValue;
  /** Values the field shows invalid on blur, with "Selected date unavailable.". */
  isDateUnavailable?: NoInfer<(value: T) => boolean>;
  /**
   * The smallest unit edited. Defaults to `"day"` for a date and `"minute"` for a value with a
   * time. A time granularity needs a value with a time. Without a value it names the kind, as
   * `onChange` lists. Changing it while segments are half-typed drops what was typed, so the field
   * shows its value again.
   */
  granularity?: DateGranularity;
  /**
   * The hour cycle shown: `12` with an AM/PM segment, `24` without. Defaults to the locale's, 12
   * in en-US and 24 in the Nordic locales. Typing the first letter of the day period sets it.
   * Changing `hourCycle` while segments are half-typed drops what was typed.
   */
  hourCycle?: 12 | 24;
  /** Hides the zone name a `ZonedDateTime` field shows after the time. */
  hideTimeZone?: boolean;
  /**
   * The zone an empty field takes. React Aria reads the zone from a value, so a field that starts
   * empty needs `timeZone` with a time `granularity` to emit `ZonedDateTime`s, in this zone. The
   * field names the zone as it is today, read once the field has mounted, and emptying the field
   * keeps its kind and zone. Stepping the hour moves through real hours: on a night the clocks go
   * back the repeated hour comes twice, and on a night they go forward the missing hour never
   * comes.
   */
  timeZone?: string;
  /**
   * Pads days, months and hours with a leading zero whatever the locale writes. React Aria's
   * DateField defaults to the locale's padding.
   * @default true
   */
  shouldForceLeadingZeros?: boolean;
  /**
   * The name the ISO value submits and `Form` errors arrive under. Inside `Form`, the ISO text
   * reaches `onFormSubmit` and native `FormData` under it. A required, incomplete or
   * out-of-bounds field blocks the submit and takes focus on its first segment, and an error the
   * form holds under this name shows below the field until the value changes.
   */
  name?: string;
  /**
   * Disables the field and leaves its value out of the form. Pass a form library's `disabled`
   * here. The field accepts no undeclared prop, a spread object's keys included, so destructure
   * what it does not take, such as the library's `ref`, before you spread the rest.
   */
  isDisabled?: boolean;
  /** Keeps the value. The segments stay focusable and take the muted read-only fill. */
  isReadOnly?: boolean;
  /** Reports an empty field missing, and a half-typed one incomplete. */
  isRequired?: boolean;
  /** Shows the field invalid, with `errorMessage` under the box. */
  isInvalid?: boolean;
  /**
   * The field box's control size: `"default"` the `md` one, `"sm"` the `sm` one.
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
 * the description, with React Aria's DateField prop names.
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
      // Without `isInvalid`, `errorMessage` shows only once the field's own validation fails.
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
