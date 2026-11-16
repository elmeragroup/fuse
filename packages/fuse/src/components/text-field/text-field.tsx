"use client";

import type { ChangeEvent, ComponentProps, ReactElement, ReactNode } from "react";

import { cn } from "../../styles/cn";
import { FieldFrame } from "../field/field-frame";
import { Input } from "../input/input";
import type { InputProps } from "../input/input";
import { textFieldVariants } from "./text-field-variants";

/** The props of {@link TextField}. */
export type TextFieldProps = {
  /** The visible label, rendered as `Field.Label`. Without it, name the field with `aria-label`. */
  label?: string;
  /** Supporting text, rendered as `Field.Description`. */
  description?: string;
  /**
   * The error message, rendered as `Field.Error` while it is truthy. Pass `isInvalid` with it, so
   * the input is marked invalid too. Without it, the field shows its own error, such as one `Form`
   * holds under its `name` or the browser's constraint message.
   */
  errorMessage?: ReactNode;
  /** The value, for a controlled field. */
  value?: string;
  /** The starting value of an uncontrolled field. `null` reads as no value. */
  defaultValue?: string | null;
  /** Called with the input's text on every edit. */
  onChange?: (value: string) => void;
  /** The input's `name`, which it submits under, and under which `Form` routes its errors. */
  name?: string;
  /** The input's placeholder text. */
  placeholder?: string;
  /** Hides the whole field and the input. */
  hidden?: boolean;
  /** Makes the input read-only, with the muted read-only fill. */
  isReadOnly?: boolean;
  /** Disables the field and the input. */
  isDisabled?: boolean;
  /** Marks the field invalid, with the invalid look. */
  isInvalid?: boolean;
  /** Makes the input required, so the browser's constraint check blocks an empty submit. */
  isRequired?: boolean;
  /** Shows a spinner at the end of the label row. The row shows even without `label`. */
  isPending?: boolean;
  /**
   * Shows a check at the end of the label row, in place of the `isPending` spinner. The row shows
   * even without `label`.
   */
  isSuccess?: boolean;
  /** An icon at the input's end. Mark it `aria-hidden` when it only decorates. */
  icon?: ReactNode;
  /**
   * Keeps digits only, forwarded to the inner `Input`. Only digits reach `onChange`. It sets
   * `inputMode="numeric"` unless you pass `inputMode`. `maxLength` counts digits when the browser
   * sends a cancelable `beforeinput` on a type with a selection API, so a pasted `912 34 567` fits
   * `maxLength={8}` whole. Under `type="email"`, and for autofill that sends no cancelable
   * `beforeinput`, the browser cuts the text to `maxLength` first. There a pasted `912 34 567`
   * becomes `912345`. Input's `filter` lists the types and paths.
   */
  filter?: InputProps["filter"];
  /**
   * The look. `card` puts the label, a large borderless input and the description beside it in a
   * card. `inline` hides the input's border and fill until hover, focus or an invalid state.
   * Unset is a plain `Input` under its label.
   */
  variant?: "card" | "inline";
  /**
   * The input's control size. `default` is the md control size, and `sm` the sm one. It
   * replaces the native numeric `size` attribute.
   */
  size?: InputProps["size"];
  /** Extra classes for the field's root. */
  className?: string;
} & Omit<
  ComponentProps<"input">,
  "value" | "defaultValue" | "onChange" | "name" | "className" | "disabled" | "readOnly" | "required" | "size"
>;

/**
 * A labeled single-line text field: a `Field.Root` with its label, an `Input`, and the
 * description and error. It is a client component, because its change handler reads the input.
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
  size = "default",
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
    inputContainer,
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
      variant={variant}
      className={cn(base(), className)}
      classNames={{
        label: labelSlot() || undefined,
        content: container(),
        description: descriptionSlot() || undefined,
      }}
      isDescriptionBeside={variant === "card"}
      invalid={isInvalid}
      disabled={isDisabled}
      label={label}
      isPending={isPending}
      isSuccess={isSuccess}
      description={description}
      errorMessage={errorMessage}>
      <div className={inputContainer()}>
        <Input
          name={name}
          value={value}
          defaultValue={defaultValue ?? undefined}
          onChange={handleChange}
          placeholder={placeholder}
          size={size}
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
