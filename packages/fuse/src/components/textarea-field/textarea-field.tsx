"use client";

import { useRef, useState } from "react";
import type { ChangeEvent, ComponentProps, ReactElement, ReactNode } from "react";

import { useFormReset } from "../../hooks/use-form-reset";
import { useMergedRefs } from "../../hooks/use-merged-refs";
import { handoff } from "../../internal/part-handoff";
import { FieldControl } from "../field/field";
import { FieldFrame } from "../field/field-frame";
import { Textarea } from "../textarea/textarea";

type FieldControlProps = ComponentProps<typeof FieldControl>;

/** The textarea props TextareaField hands to Field.Control for its render target. */
type TextareaControlProps = Omit<
  ComponentProps<typeof Textarea>,
  "value" | "defaultValue" | "disabled" | "ref"
>;

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
  /** Extra classes, merged onto the root via `cn`. */
  className?: string;
  /** Extra classes, merged onto the inner `Textarea`. */
  textareaClassName?: string;
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
  textareaClassName,
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

  // Field.Root gets `isDisabled` through FieldFrame, and Field.Control computes the
  // textarea's `disabled` from it (a disabled Fieldset included), so nothing sets it here.
  const controlProps = handoff<TextareaControlProps>(
    { ...props, maxLength },
    {
      // TextareaField's value-not-event adapter. Field.Control chains any onChange in its
      // props with its own change tracking.
      defaults: { onChange: handleChange },
      classes: [textareaClassName],
      // Field.Control tracks a `value` it is given for dirty and validity state. It isn't
      // given one yet (deferred in the repo root's open-work list), so the value props go
      // on the textarea, after the props Field.Control hands it, and Field.Control treats
      // the textarea as uncontrolled.
      as: (partProps) => (
        <Textarea
          {...partProps}
          value={isControlled ? value : undefined}
          defaultValue={isControlled ? undefined : defaultValue}
        />
      ),
    }
  );

  return (
    <FieldFrame
      invalid={isInvalid}
      disabled={isDisabled}
      label={label}
      className={className}
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
      <FieldControl
        // SAFETY: handoff checked these props against the textarea they reach through `as`;
        // Field.Control forwards them unchanged, but Base UI types its handlers for <input>.
        {...(controlProps as FieldControlProps)}
        required={isRequired}
        ref={mergedRef}
      />
    </FieldFrame>
  );
}

TextareaField.displayName = "TextareaField";
