"use client";

import { useState } from "react";
import type { ChangeEvent, ComponentProps, ReactElement, ReactNode } from "react";

import { cn } from "../../styles/cn";
import { Field } from "../field/field";
import { Textarea } from "../textarea/textarea";

export type TextareaFieldProps = {
  /** Visible label, rendered as `Field.Label`. */
  label?: string;
  /** Supporting copy, rendered as `Field.Description`. */
  description?: string;
  /** Error copy, rendered as `Field.Error` when truthy. Accepts any `ReactNode`. */
  errorMessage?: ReactNode;
  /** Controlled value. */
  value?: string;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  /** Called with the string value, not the native event. */
  onChange?: (value: string) => void;
  /** Native `maxLength`, also drives the `current/max` character counter. */
  maxLength?: number;
  /** Forwards `required` to the inner textarea. */
  isRequired?: boolean;
  /** Forwards `invalid` to `Field.Root`. */
  isInvalid?: boolean;
  /** Forwards `disabled` to `Field.Root` and the inner textarea. */
  isDisabled?: boolean;
  /** Extra classes, merged onto the inner `Textarea`. */
  className?: string;
} & Omit<
  ComponentProps<typeof Textarea>,
  "value" | "defaultValue" | "onChange" | "disabled" | "required" | "className"
>;

/**
 * Labeled multiline field composite over Field + Textarea (textarea-field.md §2/§7).
 * Client — it owns the uncontrolled counter length and the value-not-event change
 * handler (performance.md §RSC classification).
 */
export function TextareaField({
  label,
  description,
  errorMessage,
  value,
  defaultValue,
  onChange,
  maxLength,
  isRequired = false,
  isInvalid = false,
  isDisabled = false,
  className,
  ...props
}: TextareaFieldProps): ReactElement {
  const isControlled = value !== undefined;
  const [uncontrolledLength, setUncontrolledLength] = useState(() => (defaultValue ?? "").length);
  const currentLength = value === undefined ? uncontrolledLength : value.length;

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    const next = event.currentTarget.value;
    if (!isControlled) {
      setUncontrolledLength(next.length);
    }
    onChange?.(next);
  }

  return (
    <Field.Root invalid={isInvalid} disabled={isDisabled}>
      {label || maxLength ? (
        <div className="flex items-center justify-between gap-2">
          {label ? <Field.Label>{label}</Field.Label> : null}
          {maxLength ? (
            <span className="text-xs text-muted-foreground">
              {currentLength}/{maxLength}
            </span>
          ) : null}
        </div>
      ) : null}
      <Field.Control
        render={
          <Textarea
            {...props}
            className={cn(className)}
            value={isControlled ? value : undefined}
            defaultValue={isControlled ? undefined : defaultValue}
            maxLength={maxLength}
            required={isRequired}
            disabled={isDisabled}
            onChange={handleChange}
          />
        }
      />
      {description ? <Field.Description>{description}</Field.Description> : null}
      <Field.Error>{errorMessage}</Field.Error>
    </Field.Root>
  );
}

TextareaField.displayName = "TextareaField";
