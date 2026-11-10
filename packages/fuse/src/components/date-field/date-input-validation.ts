// Why a date input's value fails, and the words a form shows for it. Bounds and unavailable dates
// follow React Aria's `getValidationResult` (`@react-stately/datepicker`), whose comparison the core's
// `checkBounds` reproduces across kinds. React Aria leaves an empty required field to the browser
// and lets an incomplete one through as empty; this input reports both itself, since a field that
// shows half a date while it submits nothing, or an older value, misleads.

import type { LocalizedStringDictionary, LocalizedStringFormatter } from "@internationalized/string";

import { checkBounds } from "../../temporal/bounds";
import type { Bounds } from "../../temporal/bounds";
import type { TemporalValue } from "../../temporal/temporal-value";
import type { CalendarValidationError } from "../calendar/calendar-change-details";
import type { FieldFormat } from "./date-field-format";
import { formatBound } from "./date-field-format";
import type { dateFieldStrings } from "./intl";

/**
 * Why a date input fails: Calendar's words for a value against the rules, plus the input's own.
 *
 * - `valueMissing`: required and empty.
 * - `incomplete`: some segments filled and others not, or a value the field could not form.
 * - `rangeUnderflow` / `rangeOverflow`: before `minValue` or after `maxValue`.
 * - `unavailable`: a value `isDateUnavailable` refuses.
 */
export type DateInputValidationError = CalendarValidationError | "valueMissing" | "incomplete";

/** DateField's string formatter for one locale. */
export type DateFieldStrings =
  typeof dateFieldStrings extends LocalizedStringDictionary<infer K, infer T>
    ? LocalizedStringFormatter<K, T>
    : never;

/** What a value is checked against. */
export type DateInputRules = {
  readonly bounds: Bounds;
  readonly isDateUnavailable: ((value: TemporalValue) => boolean) | undefined;
};

/**
 * A committed value's error against the bounds and `isDateUnavailable`, minimum first.
 *
 * @param value - The value.
 * @param rules - The bounds and the unavailable check.
 * @returns The error, or `null`.
 */
export function valueError(value: TemporalValue, rules: DateInputRules): CalendarValidationError | null {
  switch (checkBounds(value, rules.bounds)) {
    case "underflow":
      return "rangeUnderflow";
    case "overflow":
      return "rangeOverflow";
    case "within":
      return rules.isDateUnavailable?.(value) === true ? "unavailable" : null;
  }
}

/** What the input shows, as far as validity goes. */
export type DateInputEntry =
  | { readonly kind: "empty" }
  | { readonly kind: "partial" }
  | { readonly kind: "value"; readonly value: TemporalValue };

/**
 * The input's error: an incomplete entry first, then a missing required value, then the value's
 * own.
 *
 * @param entry - What the segments show.
 * @param required - Whether the input needs a value.
 * @param rules - The bounds and the unavailable check.
 * @returns The error, or `null`.
 */
export function entryError(
  entry: DateInputEntry,
  required: boolean,
  rules: DateInputRules
): DateInputValidationError | null {
  switch (entry.kind) {
    case "partial":
      return "incomplete";
    case "empty":
      return required ? "valueMissing" : null;
    case "value":
      return valueError(entry.value, rules);
  }
}

/**
 * The message for an error, in the field's locale, with the bound written as React Aria writes it.
 *
 * @param error - The error.
 * @param strings - DateField's strings.
 * @param format - The field's format.
 * @param bounds - The bounds a range error names.
 * @returns The message, such as "Value must be 10/31/2026 or earlier."
 */
export function errorMessage(
  error: DateInputValidationError,
  strings: DateFieldStrings,
  format: FieldFormat,
  bounds: Bounds
): string {
  switch (error) {
    case "valueMissing":
      return strings.format("valueMissing");
    case "incomplete":
      return strings.format("incomplete");
    case "unavailable":
      return strings.format("unavailableDate");
    case "rangeUnderflow":
      return bounds.min === undefined
        ? strings.format("incomplete")
        : strings.format("rangeUnderflow", { minValue: formatBound(format, bounds.min) });
    case "rangeOverflow":
      return bounds.max === undefined
        ? strings.format("incomplete")
        : strings.format("rangeOverflow", { maxValue: formatBound(format, bounds.max) });
  }
}
