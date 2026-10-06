"use client";

import type { ChangeEvent, ComponentProps, ReactElement, ReactNode } from "react";

import { cn } from "../../styles/cn";
import { FieldFrame } from "../field/field-frame";
import { Input } from "../input/input";
import type { InputProps } from "../input/input";
import { textFieldVariants } from "./text-field-variants";

export type TextFieldProps = {
  /** Visible label, rendered as `Field.Label`. */
  label?: string;
  /** Supporting copy, rendered as `Field.Description`. */
  description?: string;
  /**
   * Error copy, rendered as `Field.Error` when truthy. Accepts any `ReactNode`. Falsy, the
   * field shows its own validation error instead, such as an error `Form` holds under its
   * `name` or a native constraint message.
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
  /** Forwards `readOnly` to the inner input, which then takes the muted read-only fill. */
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
   * Digits-only guard, forwarded to the inner `Input`. Non-digit characters are stripped from
   * typing, paste and autofill, so only digits reach `onChange`, and `maxLength` counts digits,
   * so a pasted `912 34 567` fits `maxLength={8}` whole. Sets `inputMode="numeric"` unless the
   * caller passes `inputMode`. Input's `filter` lists the paths where the browser's own length
   * handling still applies.
   */
  filter?: InputProps["filter"];
  /** `card` composes `cardVariants`; `inline` restyles the input chrome. Unset is the plain Input. */
  variant?: "card" | "inline";
  /** Extra classes, merged onto the root via `cn`. */
  className?: string;
} & Omit<
  ComponentProps<"input">,
  "value" | "defaultValue" | "onChange" | "name" | "className" | "disabled" | "readOnly" | "required"
>;

/**
 * Labeled single-line field composite over Field and Input. Client component, because its
 * change handler reads the input's value for `onChange`.
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
  variant,
  className,
  ...props
}: TextFieldProps): ReactElement {
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
    onChange?.(event.currentTarget.value);
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
          name={name}
          value={value}
          defaultValue={defaultValue ?? undefined}
          onChange={handleChange}
          placeholder={placeholder}
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
