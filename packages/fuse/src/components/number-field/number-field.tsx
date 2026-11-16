"use client";

import { useId, useRef } from "react";
import type { ReactElement, ReactNode } from "react";

import { useLabelableContext } from "@base-ui/react/internals/labelable-provider";
import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { useResetRemount } from "../../hooks/use-reset-remount";
import { Minus } from "../../icons/generated/minus";
import { Plus } from "../../icons/generated/plus";
import { definedProps } from "../../internal/defined-props";
import { fieldActionName } from "../../internal/field-action-name";
import { useLocale } from "../../intl/locale-context";
import { FieldFrame } from "../field/field-frame";
import { numberFieldStrings } from "./intl";
import { numberFieldVariants } from "./number-field-variants";

/** The props of {@link NumberField}. */
export type NumberFieldProps = {
  /** The visible label, rendered as `Field.Label`. Without it, name the field with `aria-label`. */
  label?: string;
  /** Supporting text, rendered as `Field.Description`. */
  description?: string;
  /**
   * The error message, rendered as `Field.Error` while it is truthy. Pass `isInvalid` with it, so
   * the input is marked invalid too. Without it, the field shows its own error, such as the
   * browser's constraint message.
   */
  errorMessage?: ReactNode;
  /** Shows a spinner at the end of the label row. The row shows even without `label`. */
  isPending?: boolean;
  /**
   * Shows a check at the end of the label row, in place of the `isPending` spinner. The row shows
   * even without `label`.
   */
  isSuccess?: boolean;
  /** Marks the field invalid, with the invalid look on the field box. */
  isInvalid?: boolean;
  /** Disables the field, with the muted fill. */
  isDisabled?: boolean;
  /** Makes the field read-only, with the muted fill. */
  isReadOnly?: boolean;
  /** Makes the field required, so the browser's constraint check blocks an empty submit. */
  isRequired?: boolean;
  /**
   * The control size of the field box around the input and the steppers, also written as
   * `data-size`. `default` is the md control size, and `sm` the sm one. The steppers fill the
   * box's height at both sizes.
   */
  size?: "sm" | "default";
  /**
   * A unit shown between the input and the steppers, such as `kWh`. It is not part of the input's
   * name or value, so say the unit in `label` or `description` too.
   */
  denomination?: string;
  /**
   * The value, for a controlled field. `NaN` is an empty controlled field. `undefined`, passed or
   * left out, makes the field uncontrolled, as with React's own inputs.
   */
  value?: number;
  /** The starting value of an uncontrolled field. */
  defaultValue?: number;
  /**
   * Called with the number on every change, each typed character included. A cleared input
   * reports `NaN`. To act once per change, such as to save or fetch, use `onValueCommitted`.
   */
  onChange?: (value: number) => void;
  /**
   * Called once with the number when the user finishes a change: when the input blurs after
   * typing, when a stepper press ends, and on each arrow, Home or End key press. It does not fire
   * on each typed character, and Enter does not commit. A cleared input reports `NaN`. Save or
   * fetch from it.
   */
  onValueCommitted?: (value: number) => void;
  /** The lowest value the field takes. */
  minValue?: number;
  /** The highest value the field takes. */
  maxValue?: number;
  /**
   * How far the arrow keys and steppers move the value. Left out, they step by 1 and a typed value
   * is held to no step grid. With `minValue`, a typed value must also land on the step grid
   * counted from `minValue`, or native validation blocks the submit, as with
   * `<input type="number" min step>`. Pass `step={1}` to accept whole numbers only. Without
   * `minValue`, a step never limits a typed value.
   */
  step?: number;
  /**
   * How the value is shown and announced, as `Intl.NumberFormatOptions`, such as
   * `{ style: "currency", currency: "NOK" }`. The locale, and with it the grouping and decimal
   * separators, comes from the `LocaleProvider`.
   */
  formatOptions?: Intl.NumberFormatOptions;
  /** The name the field submits its number under. */
  name?: string;
  /** Extra classes for the field's root. */
  className?: string;
  /**
   * The input's name when there is no `label`. The steppers' names then end with it too, as in
   * "Increase Quantity".
   */
  "aria-label"?: string;
  /**
   * The increase stepper's own word, which its name follows with the field's name, as in
   * "Increase Quantity". It defaults to the locale's word.
   */
  increaseLabel?: string;
  /**
   * The decrease stepper's own word, which its name follows with the field's name, as in
   * "Decrease Quantity". It defaults to the locale's word.
   */
  decreaseLabel?: string;
  /** Focuses the input when the field mounts, but not when a form reset remounts it. */
  autoFocus?: boolean;
  /** The id of Base UI's `NumberField.Root`. */
  id?: string;
};

/**
 * A labeled number field with steppers and locale-aware formatting. It is a client component,
 * because it remounts on a native form reset, calls `onChange` with the number and reads the
 * locale.
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
        {...definedProps({
          name,
          value: controlledValue,
          defaultValue,
          min: minValue,
          max: maxValue,
          format: formatOptions,
          id,
        })}
        onValueChange={(next) => onChange?.(next ?? NaN)}
        onValueCommitted={(next) => onValueCommitted?.(next ?? NaN)}
        // base-ui defaults `step` to 1 and puts it on the hidden validation input, so with `min`
        // an omitted step would reject any typed value off the 1-step grid from `min`, such as
        // 99.5 under a min of 1. "any" still steps by 1 but drops that step constraint.
        step={step ?? "any"}
        locale={locale}
        disabled={isDisabled}
        readOnly={isReadOnly}
        required={isRequired}>
        {/* The field box, with no group role. Base UI takes the steppers out of the tab order
            (tabIndex -1, as React Aria's useNumberField does), so the spinbutton is the field's
            one tab stop and already carries the field's name; a group named after the field
            would announce that name twice, and an unnamed one adds nothing (WAI-ARIA APG
            spinbutton pattern: the steppers are optional pointer affordances). `role` overrides
            Base UI's default `role="group"`; the element keeps its state attributes and styling. */}
        <NumberFieldPrimitive.Group
          role={undefined}
          aria-invalid={isInvalid || undefined}
          data-size={size}
          className={slots.group()}>
          <NumberFieldPrimitive.Input
            // The reset hook needs the visible control; Root's `inputRef` prop is the
            // validation input, not this one.
            ref={numberInputRef}
            {...definedProps({ "aria-label": ariaLabel })}
            // Base UI hard-codes the English "Number field"; announce it in the provider locale.
            aria-roledescription={strings.format("roleDescription")}
            autoFocus={autoFocus === true && reset.isInitialMount}
            data-focus-ring-control=""
            className={slots.input()}
          />
          {denomination ? <div className={slots.denomination()}>{denomination}</div> : null}
          <NumberFieldSteppers
            className={slots.steppers()}
            stepperClassName={slots.stepper()}
            increaseLabel={increaseLabel ?? strings.format("increase")}
            decreaseLabel={decreaseLabel ?? strings.format("decrease")}
            fieldAriaLabel={ariaLabel}
          />
        </NumberFieldPrimitive.Group>
      </NumberFieldPrimitive.Root>
    </FieldFrame>
  );
}

NumberField.displayName = "NumberField";

type NumberFieldSteppersProps = {
  readonly className: string;
  readonly stepperClassName: string;
  /** The increment stepper's own name: the override, else the dictionary's. */
  readonly increaseLabel: string;
  /** The decrement stepper's own name: the override, else the dictionary's. */
  readonly decreaseLabel: string;
  /** The input's `aria-label`, which names the field when no visible label does. */
  readonly fieldAriaLabel: string | undefined;
};

/**
 * The steppers, each named by its own word and then the field's ("Increase Quantity"), as React
 * Aria's useNumberField names them: Base UI keeps them out of the tab order, but a touch screen
 * reader still swipes to them, and "Increase" alone does not say which field it changes. The field
 * has no group role to carry that context. They take DatePicker.Trigger's naming, through
 * `fieldActionName`, from what names the input: `Field.Label`, whose id Field's labelable context
 * holds once the label mounts and which Base UI's input references ahead of its own `aria-label`,
 * else that `aria-label`.
 *
 * It reads the context Field.Root provides, so it renders inside the composite's `FieldFrame`.
 */
function NumberFieldSteppers({
  className,
  stepperClassName,
  increaseLabel,
  decreaseLabel,
  fieldAriaLabel,
}: NumberFieldSteppersProps): ReactElement {
  const { labelId } = useLabelableContext();
  const baseId = useId();
  const increaseId = `${baseId}-increase`;
  const decreaseId = `${baseId}-decrease`;
  const nameOf = (id: string, name: string) =>
    fieldActionName({ id, name, fieldLabelId: labelId, fieldAriaLabel });

  return (
    <div className={className}>
      <NumberFieldPrimitive.Decrement
        id={decreaseId}
        data-slot="number-field-decrement"
        className={stepperClassName}
        {...definedProps(nameOf(decreaseId, decreaseLabel))}>
        <Minus aria-hidden className="size-4" />
      </NumberFieldPrimitive.Decrement>
      <NumberFieldPrimitive.Increment
        id={increaseId}
        data-slot="number-field-increment"
        className={stepperClassName}
        {...definedProps(nameOf(increaseId, increaseLabel))}>
        <Plus aria-hidden className="size-4" />
      </NumberFieldPrimitive.Increment>
    </div>
  );
}
