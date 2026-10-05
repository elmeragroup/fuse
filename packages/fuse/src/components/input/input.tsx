"use client";

import { useEffect } from "react";
import type { ChangeEvent, ComponentProps, ReactElement } from "react";

import { Input as InputPrimitive } from "@base-ui/react/input";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { fieldBox } from "../../styles/field-box";
import { isThemeDevelopment } from "../../theme/validate-theme";

export type InputProps = ComponentProps<"input"> & {
  /**
   * Digits-only guard. Non-digit characters are stripped from every path — typing, paste,
   * autofill — before `onChange` and Field validation read the value.
   * `maxLength` counts digits where the filter runs first: a cancelable `beforeinput` on an input
   * type with a selection API (`text`, `tel`, `search`, `url`, `password`), so a pasted
   * `912 34 567` fits `maxLength={8}` whole. Other paths keep the browser's own length handling
   * and are stripped afterwards: `type="email"`, or autofill that sends no cancelable
   * `beforeinput`, is cut to `maxLength` first. The filter is meant for text-like types:
   * under `type="number"` it also strips the sign and the decimal separator.
   * Sets `inputMode="numeric"` unless the caller passes `inputMode` explicitly. An
   * uncontrolled numeric input restores its `defaultValue` on native form reset without
   * calling `onChange`.
   */
  filter?: "numeric";
};

/** One normalizer for the warning guards and the change handler, so they cannot drift. */
function stripNonDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Under the numeric filter, an insertion that mixes digits with other characters, such as a
 * pasted `912 34 567`, is replaced by its digits before the browser applies `maxlength`, so the
 * limit counts digits rather than separators. The digits that fit land at the caret, and the
 * caret ends after them. An insertion of digits only, or of no digits at all, keeps the native
 * path: `maxlength` still blocks a full field, and the change handler strips the rest. So do a
 * read-only or disabled input, to which Chromium still sends `beforeinput` before it refuses the
 * edit, an input type without a selection API, such as `email`, where `setRangeText` throws, and
 * an insertion another listener has already cancelled. A host veto has to run before this
 * listener, in the capture phase or on the input before it mounts: once this listener has run,
 * the event is cancelled and the digits are in.
 */
function insertDigitsOnly(event: InputEvent): void {
  const input = event.currentTarget;
  if (
    !(input instanceof HTMLInputElement) ||
    !event.cancelable ||
    event.defaultPrevented ||
    !event.inputType.startsWith("insert")
  ) {
    return;
  }
  const start = input.selectionStart;
  const end = input.selectionEnd;
  if (input.readOnly || input.disabled || start === null || end === null) {
    return;
  }
  const inserted = event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
  const digits = stripNonDigits(inserted);
  if (digits === "" || digits === inserted) {
    return;
  }
  event.preventDefault();
  const room = input.maxLength < 0 ? digits.length : input.maxLength - input.value.length + (end - start);
  const accepted = digits.slice(0, Math.max(0, room));
  if (accepted === "") {
    return;
  }
  input.setRangeText(accepted, start, end, "end");
  // setRangeText fires no input event; React and Base UI read the edit from this one.
  input.dispatchEvent(
    new InputEvent("input", { bubbles: true, composed: true, inputType: event.inputType, data: accepted })
  );
}

/**
 * Attaches {@link insertDigitsOnly} while the numeric filter is on. `source-contracts.test.ts`
 * lists this module among the reviewed listener owners.
 */
function listenForMixedInsertions(input: HTMLInputElement | null): (() => void) | undefined {
  if (!input) {
    return undefined;
  }
  input.addEventListener("beforeinput", insertDigitsOnly);
  return () => {
    input.removeEventListener("beforeinput", insertDigitsOnly);
  };
}

function warnIfNotNumeric(prop: "value" | "defaultValue", value: InputProps["value"]): void {
  if (!isThemeDevelopment()) {
    return;
  }
  if (value !== undefined && value !== "" && stripNonDigits(String(value)) !== String(value)) {
    console.warn(`Input: ${prop} is not a number`);
  }
}

export function Input({
  className,
  type,
  filter,
  inputMode,
  onChange,
  ref,
  ...props
}: InputProps): ReactElement {
  const isNumeric = filter === "numeric";
  const inputRef = useMergedRefs(ref, isNumeric ? listenForMixedInsertions : null);

  useEffect(() => {
    if (!isNumeric) {
      return;
    }
    warnIfNotNumeric("defaultValue", props.defaultValue);
    warnIfNotNumeric("value", props.value);
  }, [isNumeric, props.defaultValue, props.value]);

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const next = event.currentTarget.value;
    const digits = stripNonDigits(next);
    if (digits !== next) {
      // Hand the digits back to the input before any reader sees the event, so an uncontrolled
      // input drops the rejected characters even when no `onChange` re-renders it, and Base UI's
      // own change handler, which runs after this one, validates the digits.
      event.currentTarget.value = digits;
    }
    onChange?.(event);
  }

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        fieldBox(),
        "file:text-sm file:font-medium min-w-0 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-foreground",
        className
      )}
      {...definedProps({
        ...props,
        ref: inputRef,
        inputMode: inputMode ?? (isNumeric ? "numeric" : undefined),
        onChange: isNumeric ? handleChange : onChange,
      })}
    />
  );
}

Input.displayName = "Input";
