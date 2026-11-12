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
  /** Forwards `invalid` to `Field.Root`, and `aria-invalid` to the field box for its invalid look. */
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
  /**
   * Accessible name forwarded to the input for label-less usage. Without a visible `label`, the
   * steppers' names end with it too ("Increase Quantity").
   */
  "aria-label"?: string;
  /**
   * The increment stepper's own name, which its accessible name follows with the field's name
   * ("Increase Quantity"). Defaults to the locale dictionary.
   */
  increaseLabel?: string;
  /**
   * The decrement stepper's own name, which its accessible name follows with the field's name
   * ("Decrease Quantity"). Defaults to the locale dictionary.
   */
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
