"use client";

import { useEffect } from "react";
import type { ChangeEvent, ComponentProps, ReactElement, ReactNode } from "react";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { cn } from "../../styles/cn";
import { isThemeDevelopment } from "../../theme/validate-theme";
import { FieldFrame } from "../field/field-frame";
import { Input } from "../input/input";
import { textFieldVariants } from "./text-field-variants";

export type TextFieldProps = {
  /** Visible label, rendered as `Field.Label`. */
  label?: string;
  /** Supporting copy, rendered as `Field.Description`. */
  description?: string;
  /**
   * Error copy, rendered as `Field.Error` when truthy. Accepts any `ReactNode`. Falsy, the
   * field shows its own validation error instead, such as a native constraint message.
   */
  errorMessage?: ReactNode;
  /** Controlled value. */
  value?: string;
  /** Uncontrolled initial value. `null` is coerced to `undefined` before reaching the input. */
  defaultValue?: string | null;
  /** Called with the string value, not the native event. */
  onChange?: (value: string) => void;
  /** Native `name` forwarded to the inner input. */
  name?: string;
  /** Native `placeholder` forwarded to the inner input. */
  placeholder?: string;
  /** Hides the root via the recipe and the inner input via the native `hidden` attribute. */
  hidden?: boolean;
  /** Forwards `readOnly` to the inner input. */
  isReadOnly?: boolean;
  /** Forwards `disabled` to `Field.Root` and the inner input. */
  isDisabled?: boolean;
  /** Forwards `invalid` to `Field.Root`. */
  isInvalid?: boolean;
  /** Forwards `required` to the inner input. */
  isRequired?: boolean;
  /** Shows a spinner in the label row. Forces that row to exist even without `label`. */
  isPending?: boolean;
  /** Shows a check in the label row and wins the crossfade over `isPending`. */
  isSuccess?: boolean;
  /** Trailing inline icon. Activates the `isIconActive` recipe axis. */
  icon?: ReactNode;
  /**
   * Digits-only guard (absorbs the external numeric-only wrapper). Non-digit characters are
   * stripped from every path — typing, paste, autofill — so only digits reach `onChange`.
   * `maxLength` counts digits, so a pasted `912 34 567` fits `maxLength={8}` whole.
   * Sets `inputMode="numeric"` unless the caller passes `inputMode` explicitly. An
   * uncontrolled numeric field restores its `defaultValue` on native form reset without
   * calling `onChange`.
   */
  filter?: "numeric";
  /** `card` composes `cardVariants`; `inline` restyles the input chrome. Unset is the plain Input. */
  variant?: "card" | "inline";
  /** Extra classes, merged onto the root via `cn`. */
  className?: string;
} & Omit<
  ComponentProps<"input">,
  "value" | "defaultValue" | "onChange" | "name" | "className" | "disabled" | "readOnly" | "required"
>;

/** One normalizer for the warning guards and the change handler, so they cannot drift. */
function stripNonDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function containsOnlyDigits(value: string): boolean {
  return stripNonDigits(value) === value;
}

/**
 * Under the numeric filter, an insertion that mixes digits with other characters, such as a
 * pasted `912 34 567`, is replaced by its digits before the browser applies `maxlength`, so the
 * limit counts digits rather than separators. The digits that fit land at the caret, and the
 * caret ends after them. An insertion of digits only, or of no digits at all, keeps the native
 * path: `maxlength` still blocks a full field, and the change handler strips the rest.
 */
function insertDigitsOnly(event: InputEvent): void {
  const input = event.currentTarget;
  if (!(input instanceof HTMLInputElement) || !event.cancelable || !event.inputType.startsWith("insert")) {
    return;
  }
  const inserted = event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
  const digits = stripNonDigits(inserted);
  if (digits === "" || digits === inserted) {
    return;
  }
  event.preventDefault();
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  const room = input.maxLength < 0 ? digits.length : input.maxLength - input.value.length + (end - start);
  const accepted = digits.slice(0, Math.max(0, room));
  if (accepted === "") {
    return;
  }
  input.setRangeText(accepted, start, end, "end");
  // setRangeText fires no input event; React and Base UI read the edit from this one.
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: event.inputType, data: accepted }));
}

function listenForMixedInsertions(input: HTMLInputElement | null): (() => void) | undefined {
  if (!input) {
    return undefined;
  }
  input.addEventListener("beforeinput", insertDigitsOnly);
  return () => {
    input.removeEventListener("beforeinput", insertDigitsOnly);
  };
}

function warnIfNotNumeric(prop: "value" | "defaultValue", value: string | null | undefined): void {
  if (!isThemeDevelopment()) {
    return;
  }
  if (value && !containsOnlyDigits(value)) {
    console.warn(`TextField: ${prop} is not a number`);
  }
}

/**
 * Labeled single-line field composite over Field and Input. Client component, because its
 * change handler normalizes numeric input.
 */
export function TextField({
  label,
  description,
  errorMessage,
  value,
  defaultValue,
  onChange,
  name,
  placeholder,
  hidden = false,
  isReadOnly = false,
  isDisabled = false,
  isInvalid = false,
  isRequired = false,
  isPending = false,
  isSuccess = false,
  icon,
  filter,
  variant,
  className,
  inputMode,
  ref,
  ...props
}: TextFieldProps): ReactElement {
  const isNumeric = filter === "numeric";
  const inputRef = useMergedRefs(ref, isNumeric ? listenForMixedInsertions : null);

  useEffect(() => {
    if (!isNumeric) {
      return;
    }
    warnIfNotNumeric("defaultValue", defaultValue);
    warnIfNotNumeric("value", value);
  }, [isNumeric, defaultValue, value]);

  const {
    base,
    input,
    fieldGroup,
    iconContainer,
    label: labelSlot,
    container,
    description: descriptionSlot,
  } = textFieldVariants({
    variant,
    hidden,
    isIconActive: Boolean(icon),
  });

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const next = event.currentTarget.value;
    if (!isNumeric) {
      onChange?.(next);
      return;
    }
    const digits = stripNonDigits(next);
    if (digits !== next) {
      // Hand the digits back to the input so an uncontrolled field drops the rejected
      // characters even when the caller has no `onChange` to re-render it.
      event.currentTarget.value = digits;
    }
    onChange?.(digits);
  }

  return (
    <FieldFrame
      className={cn(base(), className)}
      classNames={{
        label: labelSlot() || undefined,
        content: container(),
        description: descriptionSlot() || undefined,
      }}
      invalid={isInvalid}
      disabled={isDisabled}
      label={label}
      isPending={isPending}
      isSuccess={isSuccess}
      description={description}
      errorMessage={errorMessage}>
      <div className="relative">
        <Input
          ref={inputRef}
          name={name}
          value={value}
          defaultValue={defaultValue ?? undefined}
          onChange={handleChange}
          placeholder={placeholder}
          inputMode={inputMode ?? (isNumeric ? "numeric" : undefined)}
          // fieldGroup's default would override the input's w-full.
          className={cn(input(), variant ? fieldGroup() : null)}
          {...props}
          readOnly={isReadOnly}
          required={isRequired}
          hidden={hidden}
          disabled={isDisabled}
        />
        {icon ? <div className={iconContainer()}>{icon}</div> : null}
      </div>
    </FieldFrame>
  );
}

TextField.displayName = "TextField";
