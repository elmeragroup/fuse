"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { useFormReset } from "../../hooks/use-form-reset";
import { useMergedRefs } from "../../hooks/use-merged-refs";
import { FieldControl } from "../field/field";
import { FieldFrame } from "../field/field-frame";
import { Textarea } from "../textarea/textarea";
import type { TextareaProps } from "../textarea/textarea";
import { textareaFieldVariants } from "./textarea-field-variants";

const slots = textareaFieldVariants();

/** The props of {@link TextareaField}. */
export type TextareaFieldProps = {
  /** The visible label, rendered as `Field.Label`. Without it, name the field with `aria-label`. */
  label?: string;
  /** The textarea's name when there is no `label`. */
  "aria-label"?: ComponentProps<"textarea">["aria-label"];
  /** Supporting text, rendered as `Field.Description`. */
  description?: string;
  /**
   * The error message, rendered as `Field.Error` while it is truthy. Pass `isInvalid` with it, so
   * the textarea is marked invalid too. Without it, the field shows its own error, such as the
   * browser's constraint message.
   */
  errorMessage?: ReactNode;
  /** The value, for a controlled field. */
  value?: string;
  /** The starting value of an uncontrolled field. A native form reset restores it and its count. */
  defaultValue?: string;
  /** Called with the textarea's text on every edit. */
  onChange?: (value: string) => void;
  /**
   * The most characters the textarea takes. It also shows a `current/max` counter at the end of
   * the label row, including for `0`.
   */
  maxLength?: number;
  /** Makes the textarea required, so the browser's constraint check blocks an empty submit. */
  isRequired?: boolean;
  /** Marks the field invalid, with the invalid look. */
  isInvalid?: boolean;
  /** Disables the field and the textarea. */
  isDisabled?: boolean;
  /** Extra classes for the field's root. */
  className?: string;
  /** Extra classes for the inner `Textarea`. */
  textareaClassName?: string;
  /** The textarea's control size. `default` is the md control size, and `sm` the sm one. */
  size?: TextareaProps["size"];
} & Omit<
  ComponentProps<typeof Textarea>,
  "value" | "defaultValue" | "onChange" | "disabled" | "required" | "className" | "size" | "aria-label"
>;

/**
 * A labeled multiline text field with an optional character counter. It is a client component,
 * because it counts an uncontrolled value and calls `onChange` with the text.
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
  size = "default",
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
  // Text typed (or restored by the browser) before hydration stays in the DOM, but the count
  // starts from `defaultValue`. Read the DOM on mount and whenever the field becomes
  // uncontrolled; on a client mount, or a hydration without an early edit, the lengths are equal,
  // and setting the same length again bails out.
  useLayoutEffect(() => {
    if (isControlled) return;
    const length = textareaRef.current?.value.length;
    if (length !== undefined) {
      setUncontrolledLength(length);
    }
  }, [isControlled]);
  const currentLength = value === undefined ? uncontrolledLength : value.length;
  // SAFETY: Base UI types Field.Control's props for an <input>. It forwards every prop to
  // the rendered Textarea, so textarea-only attributes such as rows, cols and wrap, and
  // each handler's textarea event, reach the element their types describe.
  const controlProps = props as ComponentProps<typeof FieldControl>;

  function handleValueChange(next: string): void {
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
      className={className}
      classNames={{ labelRow: slots.labelRow() }}
      status={
        maxLength === undefined ? undefined : (
          <span className={slots.counter()}>
            {currentLength}/{maxLength}
          </span>
        )
      }
      description={description}
      errorMessage={errorMessage}>
      {/* State goes on the part: render-element props would beat a disabled Field.Set. */}
      <FieldControl
        value={value}
        defaultValue={isControlled ? undefined : defaultValue}
        onValueChange={handleValueChange}
        maxLength={maxLength}
        required={isRequired}
        disabled={isDisabled}
        {...controlProps}
        render={<Textarea ref={mergedRef} size={size} className={textareaClassName} />}
      />
    </FieldFrame>
  );
}

TextareaField.displayName = "TextareaField";
