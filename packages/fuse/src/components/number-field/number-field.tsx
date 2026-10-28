"use client";

import { useRef } from "react";
import type { ReactElement, ReactNode } from "react";

import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { useResetRemount } from "../../hooks/use-reset-remount";
import { Minus } from "../../icons/generated/minus";
import { Plus } from "../../icons/generated/plus";
import { useLocale } from "../../intl/locale-context";
import { FieldFrame } from "../field/field-frame";
import { numberFieldStrings } from "./intl";
import { numberFieldVariants } from "./number-field-variants";

export type NumberFieldProps = {
  /** Visible label, rendered as `Field.Label`. */
  label?: string;
  /** Supporting copy, rendered as `Field.Description`. */
  description?: string;
  /**
   * Error copy, rendered as `Field.Error` when truthy. Accepts any `ReactNode`. Falsy, the
   * field shows its own validation error instead, such as a native constraint message.
   */
  errorMessage?: ReactNode;
  /** Shows a spinner in the label row. Forces that row to exist even without `label`. */
  isPending?: boolean;
  /** Shows a check in the label row and wins the crossfade over `isPending`. */
  isSuccess?: boolean;
  /** Forwards `invalid` to `Field.Root` and `aria-invalid` to the group. */
  isInvalid?: boolean;
  /** Forwards `disabled` to `Field.Root` and `NumberField.Root`; the group uses `bg-muted`. */
  isDisabled?: boolean;
  /** Forwards `readOnly` to `NumberField.Root`; the group uses `bg-muted`. */
  isReadOnly?: boolean;
  /** Forwards `required` to `NumberField.Root`. */
  isRequired?: boolean;
  /**
   * Control size of the field box, the group around the input and the steppers. Emitted as
   * `data-size`. `"default"` maps to the `md` control size; `"sm"` maps to the `sm` control size.
   * The steppers fill the box's height at both sizes.
   * @default "default"
   */
  size?: "sm" | "default";
  /** Unit suffix rendered between the input and the steppers (visual only). */
  denomination?: string;
  /**
   * Controlled value; `NaN` is the controlled empty state. `undefined` — passed or
   * omitted — is uncontrolled, as with React's own inputs.
   */
  value?: number;
  /** Uncontrolled initial value. */
  defaultValue?: number;
  /**
   * Called with the numeric value, not the event. A cleared input reports `NaN`
   * (`onChange?.(next ?? NaN)`).
   */
  onChange?: (value: number) => void;
  /**
   * Called once with the numeric value when the user finishes a change: when the input blurs
   * after typing, when a stepper press ends, and on each arrow, Home or End key press. It does
   * not fire on each typed character, and Enter does not commit. A cleared input reports `NaN`.
   */
  onValueCommitted?: (value: number) => void;
  /** Lower bound, forwarded as base-ui `min`. */
  minValue?: number;
  /** Upper bound, forwarded as base-ui `max`. */
  maxValue?: number;
  /**
   * Step amount for arrows and steppers. Omitted, they step by 1 and a typed value is held to no
   * step grid. Given with `minValue`, a typed value must also land on the step grid counted from
   * `minValue`, or native validation blocks submission, as with `<input type="number" min step>`;
   * pass `step={1}` to accept whole numbers only. Without `minValue`, a step never constrains a
   * typed value.
   */
  step?: number;
  /** Formatting options, forwarded as base-ui `format`. Locale comes from the provider. */
  formatOptions?: Intl.NumberFormatOptions;
  /** Native `name` forwarded to the primitive (hidden input for form submission). */
  name?: string;
  /** Extra classes, merged onto the root via `cn`. */
  className?: string;
  /** Accessible name forwarded to the input for label-less usage. */
  "aria-label"?: string;
  /** Accessible name of the increment stepper. Defaults to the locale dictionary. */
  increaseLabel?: string;
  /** Accessible name of the decrement stepper. Defaults to the locale dictionary. */
  decreaseLabel?: string;
  /** Native `autoFocus` forwarded to the input. */
  autoFocus?: boolean;
  /** Forwarded to `NumberField.Root`. */
  id?: string;
};

/**
 * Labeled number field composite over Field + base-ui NumberField.
 * Client — it owns the reset remount and change handler, and reads locale
 * from the provider.
 */
export function NumberField({
  label,
  description,
  errorMessage,
  isPending = false,
  isSuccess = false,
  isInvalid = false,
  isDisabled = false,
  isReadOnly = false,
  isRequired = false,
  size = "default",
  denomination,
  value,
  defaultValue,
  onChange,
  onValueCommitted,
  minValue,
  maxValue,
  step,
  formatOptions,
  name,
  className,
  id,
  autoFocus,
  "aria-label": ariaLabel,
  increaseLabel,
  decreaseLabel,
}: NumberFieldProps): ReactElement {
  const { locale } = useLocale();
  const strings = useLocalizedStrings(numberFieldStrings);
  const numberInputRef = useRef<HTMLInputElement>(null);
  const isControlled = value !== undefined;
  // base-ui does not observe native form reset; the hook remounts the primitive instead.
  const reset = useResetRemount(numberInputRef, !isControlled);
  const controlledValue = value === undefined ? undefined : Number.isNaN(value) ? null : value;
  const slots = numberFieldVariants({ size, isMuted: isDisabled || isReadOnly });

  return (
    <FieldFrame
      className={className}
      invalid={isInvalid}
      disabled={isDisabled}
      label={label}
      isPending={isPending}
      isSuccess={isSuccess}
      description={description}
      errorMessage={errorMessage}>
      <NumberFieldPrimitive.Root
        key={reset.key}
        name={name}
        value={controlledValue}
        defaultValue={defaultValue}
        onValueChange={(next) => onChange?.(next ?? NaN)}
        onValueCommitted={(next) => onValueCommitted?.(next ?? NaN)}
        min={minValue}
        max={maxValue}
        // base-ui defaults `step` to 1 and puts it on the hidden validation input, so with `min`
        // an omitted step would reject any typed value off the 1-step grid from `min`, such as
        // 99.5 under a min of 1. "any" still steps by 1 but drops that step constraint.
        step={step ?? "any"}
        format={formatOptions}
        locale={locale}
        disabled={isDisabled}
        readOnly={isReadOnly}
        required={isRequired}
        id={id}>
        <NumberFieldPrimitive.Group
          aria-invalid={isInvalid || undefined}
          data-size={size}
          className={slots.group()}>
          <NumberFieldPrimitive.Input
            // The reset hook needs the visible control; Root's `inputRef` prop is the
            // validation input, not this one.
            ref={numberInputRef}
            aria-label={ariaLabel}
            // Base UI hard-codes the English "Number field"; announce it in the provider locale.
            aria-roledescription={strings.format("roleDescription")}
            autoFocus={autoFocus && reset.isInitialMount}
            data-focus-ring-control=""
            className={slots.input()}
          />
          {denomination ? <div className={slots.denomination()}>{denomination}</div> : null}
          <div className={slots.steppers()}>
            <NumberFieldPrimitive.Decrement
              className={slots.stepper()}
              aria-label={decreaseLabel ?? strings.format("decrease")}>
              <Minus aria-hidden className="size-4" />
            </NumberFieldPrimitive.Decrement>
            <NumberFieldPrimitive.Increment
              className={slots.stepper()}
              aria-label={increaseLabel ?? strings.format("increase")}>
              <Plus aria-hidden className="size-4" />
            </NumberFieldPrimitive.Increment>
          </div>
        </NumberFieldPrimitive.Group>
      </NumberFieldPrimitive.Root>
    </FieldFrame>
  );
}

NumberField.displayName = "NumberField";
