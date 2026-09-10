"use client";

import { useEffect, useState } from "react";

import { isThemeDevelopment } from "../../theme/validate-theme";

const DIGITS_ONLY = /^\d+$/;

function containsOnlyDigits(value: string): boolean {
  return DIGITS_ONLY.test(value);
}

function warnIfNotNumeric(prop: "value" | "defaultValue", value: string | null | undefined): void {
  if (!isThemeDevelopment()) {
    return;
  }
  if (value && !containsOnlyDigits(value)) {
    console.warn(`TextField: ${prop} is not a number`);
  }
}

export type NumericTextFieldOptions = {
  /** The field's controlled value, or `undefined` when the field is uncontrolled. */
  value: string | undefined;
  /** The field's uncontrolled initial value; `null` is coerced to `undefined`. */
  defaultValue: string | null | undefined;
  /** `"numeric"` turns the guard on. Anything else is a pass-through. */
  filter: "numeric" | undefined;
  /** The field's `onChange`, called only with accepted values. */
  onChange: ((value: string) => void) | undefined;
};

export type NumericTextFieldResult = {
  value: string | undefined;
  defaultValue: string | undefined;
  /** `"numeric"` in numeric mode; the caller's own `inputMode` still wins. */
  inputMode: "numeric" | undefined;
  /** Native form-reset handler restoring the shadow state, or null when the caller owns `value`. */
  onReset: (() => void) | null;
  onChange: (value: string) => void;
};

/**
 * The whole numeric-filter concern of `TextField`, in one place: the digits-only guard,
 * the dev-mode warnings, and the shadow state the guard forces.
 *
 * Rejecting a keystroke means the DOM value and React's value must disagree for a beat, so
 * numeric mode is always a controlled input: `defaultValue` is withheld from the DOM and
 * `value` comes from internal state when the caller does not own it. That is why an
 * uncontrolled numeric field needs `useFormReset` — native reset has no DOM `defaultValue`
 * to restore. The hook hands its `onReset` back and the component subscribes the ref it
 * owns, so reset ownership stays in one place. Every other field is a pass-through; the
 * hook still runs unconditionally.
 */
export function useNumericTextField({
  value,
  defaultValue,
  filter,
  onChange,
}: NumericTextFieldOptions): NumericTextFieldResult {
  const isNumeric = filter === "numeric";
  // Numeric mode without a caller-owned `value` is the one case with shadow state to keep.
  const ownsValue = isNumeric && value === undefined;
  const [internalValue, setInternalValue] = useState(() => defaultValue ?? "");

  useEffect(() => {
    if (!isNumeric) {
      return;
    }
    warnIfNotNumeric("defaultValue", defaultValue);
    warnIfNotNumeric("value", value);
  }, [defaultValue, isNumeric, value]);

  return {
    value: ownsValue ? internalValue : value,
    defaultValue: isNumeric ? undefined : (defaultValue ?? undefined),
    inputMode: isNumeric ? "numeric" : undefined,
    onReset: ownsValue ? () => setInternalValue(defaultValue ?? "") : null,
    onChange: (next) => {
      if (isNumeric && next !== "" && !containsOnlyDigits(next)) {
        return;
      }
      if (ownsValue) {
        setInternalValue(next);
      }
      onChange?.(next);
    },
  };
}
