"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { useFormReset } from "../../hooks/use-form-reset";
import { useMergedRefs } from "../../hooks/use-merged-refs";
import { cn } from "../../styles/cn";
import { isThemeDevelopment } from "../../theme/validate-theme";
import { FieldFrame } from "../field/field-frame";
import { Input } from "../input/input";
import { textFieldVariants } from "./text-field-variants";

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

export type TextFieldProps = {
  /** Visible label, rendered as `Field.Label`. */
  label?: string;
  /** Supporting copy, rendered as `Field.Description`. */
  description?: string;
  /** Error copy, rendered as `Field.Error` when truthy. Accepts any `ReactNode`. */
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
   * Digits-only guard (absorbs the external numeric-only wrapper). Rejected changes never
   * reach `onChange` or uncontrolled state. Sets `inputMode="numeric"` unless the caller
   * passes `inputMode` explicitly.
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

/**
 * Labeled single-line field composite over Field + Input.
 * Client — it owns the numeric filter's internal state and change handler
 * (performance.md §RSC classification).
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
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(() => defaultValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const mergedRef = useMergedRefs(ref, inputRef);
  const ownsNumericState = filter === "numeric" && !isControlled;
  useFormReset(inputRef, ownsNumericState ? () => setInternalValue(defaultValue ?? "") : null);

  useEffect(() => {
    if (filter !== "numeric") {
      return;
    }
    warnIfNotNumeric("defaultValue", defaultValue);
    warnIfNotNumeric("value", value);
  }, [defaultValue, filter, value]);

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

  function handleChange(next: string): void {
    if (filter === "numeric" && next !== "" && !containsOnlyDigits(next)) {
      return;
    }
    if (filter === "numeric" && !isControlled) {
      setInternalValue(next);
    }
    onChange?.(next);
  }

  const resolvedValue = filter === "numeric" ? (isControlled ? value : internalValue) : value;
  const resolvedDefaultValue = filter === "numeric" ? undefined : (defaultValue ?? undefined);

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
          name={name}
          value={resolvedValue}
          defaultValue={resolvedDefaultValue}
          onChange={(event) => {
            handleChange(event.currentTarget.value);
          }}
          placeholder={placeholder}
          inputMode={inputMode ?? (filter === "numeric" ? "numeric" : undefined)}
          // fieldGroup's default would override the input's w-full.
          className={cn(input(), variant ? fieldGroup() : null)}
          ref={mergedRef}
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
