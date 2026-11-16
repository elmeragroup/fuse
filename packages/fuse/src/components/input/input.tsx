"use client";

import { useEffect } from "react";
import type { ChangeEvent, ComponentProps, ReactElement } from "react";

import { Input as InputPrimitive } from "@base-ui/react/input";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { isThemeDevelopment } from "../../theme/validate-theme";
import { inputVariants } from "./input-class";

/**
 * The props of {@link InputControl}: the native input attributes, the native numeric `size`
 * included, and the digits-only filter.
 */
export type InputControlProps = ComponentProps<"input"> & {
  /**
   * Keeps digits only. The input strips every other character, typed, pasted or autofilled,
   * before `onChange` and Field validation read the value. It sets `inputMode="numeric"` unless
   * you pass `inputMode`. Use it with a text-like type, since under `type="number"` it also
   * strips the sign and the decimal separator.
   *
   * `maxLength` counts digits when the browser sends a cancelable `beforeinput` on a type with a
   * selection API (`text`, `tel`, `search`, `url`, `password`), so a pasted `912 34 567` fits
   * `maxLength={8}` whole. Elsewhere the browser cuts the text to `maxLength` before the input
   * strips it: under a type without a selection API, such as `email`, and for autofill that sends
   * no cancelable `beforeinput`. There a pasted `912 34 567` becomes `912345`. An uncontrolled
   * numeric input restores its
   * `defaultValue` on a native form reset without calling `onChange`.
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

/** Attaches {@link insertDigitsOnly} while the numeric filter is on. */
function listenForMixedInsertions(input: HTMLInputElement | null): (() => void) | undefined {
  if (!input) {
    return undefined;
  }
  input.addEventListener("beforeinput", insertDigitsOnly);
  return () => {
    input.removeEventListener("beforeinput", insertDigitsOnly);
  };
}

function warnIfNotNumeric(prop: "value" | "defaultValue", value: InputControlProps["value"]): void {
  if (!isThemeDevelopment()) {
    return;
  }
  if (value !== undefined && value !== "" && stripNonDigits(String(value)) !== String(value)) {
    console.warn(`Input: ${prop} is not a number`);
  }
}

/**
 * Input's control: the numeric filter, with the classes its caller passes. Package-private.
 * `Input` passes `inputVariants`, a field box that writes its size, and `InputGroup.Input` passes
 * `inputClass` inside `InputGroup.Root`, whose size it reads, so the group's input never resets the
 * group's size to its own.
 */
export function InputControl({
  type,
  filter,
  inputMode,
  onChange,
  ref,
  ...props
}: InputControlProps): ReactElement {
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
      {...definedProps({
        ...props,
        ref: inputRef,
        inputMode: inputMode ?? (isNumeric ? "numeric" : undefined),
        onChange: isNumeric ? handleChange : onChange,
      })}
    />
  );
}

/** The props of {@link Input}. */
export type InputProps = Omit<InputControlProps, "size" | "aria-label"> & {
  /**
   * The control size, also written as `data-size`. `default` is the md control size, and `sm`
   * the sm one. It replaces the native numeric `size` attribute, so set the width with a class.
   */
  size?: "sm" | "default";
  /**
   * The input's name when no visible label names it. For a visible label, put the input in a
   * `Field.Root` with a `Field.Label` instead.
   */
  "aria-label"?: ComponentProps<"input">["aria-label"];
};

/** A single-line text input in a field box. */
export function Input({ className, size = "default", ...props }: InputProps): ReactElement {
  return <InputControl data-size={size} className={cn(inputVariants({ size }), className)} {...props} />;
}

InputControl.displayName = "InputControl";
Input.displayName = "Input";
