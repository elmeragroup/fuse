"use client";

import { useEffect } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

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
   * Digits-only guard (absorbs the external numeric-only wrapper). Non-digit insertions are
   * refused at `beforeinput`; a sanitizing `onChange` backstop covers paths that bypass it.
   * Non-digit characters never reach `onChange`. Sets `inputMode="numeric"` unless the
   * caller passes `inputMode` explicitly. An uncontrolled numeric field restores its
   * `defaultValue` on native form reset without calling `onChange`.
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

const DIGITS_ONLY = /^\d+$/;

function containsOnlyDigits(value: string): boolean {
  return DIGITS_ONLY.test(value);
}

/**
 * `beforeinput` carries the proposed insertion in `data`; refusing it keeps the field
 * uncontrolled. A null or empty `data` is a deletion or caret-only edit and must pass.
 */
function acceptsNumericInsertion(data: string | null): boolean {
  return data === null || data === "" || containsOnlyDigits(data);
}

function warnIfNotNumeric(prop: "value" | "defaultValue", value: string | null | undefined): void {
  if (!isThemeDevelopment()) {
    return;
  }
  if (value && !containsOnlyDigits(value)) {
    console.warn(`TextField: ${prop} is not a number`);
  }
}

/** Mounted only in numeric mode, so a plain TextField pays no warning effect. */
function NumericPropWarning({ value, defaultValue }: Pick<TextFieldProps, "value" | "defaultValue">): null {
  useEffect(() => {
    warnIfNotNumeric("defaultValue", defaultValue);
    warnIfNotNumeric("value", value);
  }, [defaultValue, value]);
  return null;
}

/**
 * Labeled single-line field composite over Field + Input.
 * Client — it refuses non-digit insertions and sanitizes the change backstop
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
  onBeforeInput,
  ref,
  ...props
}: TextFieldProps): ReactElement {
  const isNumeric = filter === "numeric";

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
      {isNumeric ? <NumericPropWarning value={value} defaultValue={defaultValue} /> : null}
      <div className="relative">
        <Input
          name={name}
          value={value}
          defaultValue={defaultValue ?? undefined}
          onChange={(event) => {
            const next = event.currentTarget.value;
            if (isNumeric) {
              const digits = next.replace(/\D/g, "");
              if (digits !== next) {
                // Backstop for paths `beforeinput` misses (autofill, programmatic writes).
                event.currentTarget.value = digits;
              }
              onChange?.(digits);
              return;
            }
            onChange?.(next);
          }}
          placeholder={placeholder}
          inputMode={inputMode ?? (isNumeric ? "numeric" : undefined)}
          // fieldGroup's default would override the input's w-full.
          className={cn(input(), variant ? fieldGroup() : null)}
          ref={ref}
          {...props}
          onBeforeInput={(event) => {
            onBeforeInput?.(event);
            if (!isNumeric || event.defaultPrevented) {
              return;
            }
            if (!acceptsNumericInsertion(event.data)) {
              event.preventDefault();
            }
          }}
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
