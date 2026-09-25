"use client";

import { useRef, useState } from "react";
import type { ChangeEvent, ComponentProps, ReactElement, ReactNode } from "react";

import { useFormReset } from "../../hooks/use-form-reset";
import { useMergedRefs } from "../../hooks/use-merged-refs";
import { Field } from "../field";
import { FieldFrame } from "../field/field-frame";
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
  /** Uncontrolled initial value, restored with its counter by native form reset. */
  defaultValue?: string;
  /** Called with the string value, not the native event. */
  onChange?: (value: string) => void;
  /** Native `maxLength`, also drives the `current/max` character counter. `0` is set. */
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
 * Labeled multiline field composite over Field + Textarea.
 * Client — it owns the uncontrolled counter length and the value-not-event change
 * handler.
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
  ref,
  ...props
}: TextareaFieldProps): ReactElement {
  const isControlled = value !== undefined;
  const [uncontrolledLength, setUncontrolledLength] = useState(() => (defaultValue ?? "").length);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mergedRef = useMergedRefs(ref, textareaRef);
  useFormReset(
    textareaRef,
    isControlled
      ? null
      : () => {
          setUncontrolledLength(textareaRef.current?.value.length ?? 0);
        }
  );
  const currentLength = value === undefined ? uncontrolledLength : value.length;

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    const next = event.currentTarget.value;
    if (!isControlled) {
      setUncontrolledLength(next.length);
    }
    onChange?.(next);
  }

  return (
    <FieldFrame
      invalid={isInvalid}
      disabled={isDisabled}
      label={label}
      classNames={{ labelRow: "gap-2" }}
      status={
        maxLength === undefined ? undefined : (
          <span className="text-xs text-muted-foreground">
            {currentLength}/{maxLength}
          </span>
        )
      }
      description={description}
      errorMessage={errorMessage}>
      <Field.Control
        render={
          <Textarea
            {...props}
            ref={mergedRef}
            className={className}
            value={isControlled ? value : undefined}
            defaultValue={isControlled ? undefined : defaultValue}
            maxLength={maxLength}
            required={isRequired}
            disabled={isDisabled}
            onChange={handleChange}
          />
        }
      />
    </FieldFrame>
  );
}

TextareaField.displayName = "TextareaField";
