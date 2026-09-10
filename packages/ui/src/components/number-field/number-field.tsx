"use client";

import type { ReactElement, ReactNode } from "react";

import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { CaretDown } from "../../icons/generated/caret-down";
import { CaretUp } from "../../icons/generated/caret-up";
import { cn } from "../../styles/cn";
import { controlInsetMdClass } from "../../styles/control-inset";
import { numberFieldGroupClass } from "../../styles/field-box";
import { withinFocusRingControlClass } from "../../styles/utils";
import { useElmeraGroupUi } from "../../theme/elmera-group-ui";
import { FieldFrame } from "../field/field-frame";
import { numberFieldStrings } from "./intl";

export type NumberFieldProps = {
  /** Visible label, rendered as `Field.Label`. */
  label?: string;
  /** Supporting copy, rendered as `Field.Description`. */
  description?: string;
  /** Error copy, rendered as `Field.Error` when truthy. Accepts any `ReactNode`. */
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
  /** Unit suffix rendered between the input and the steppers (visual only). */
  denomination?: string;
  /**
   * Controlled value. Omit for uncontrolled editing. `NaN` is empty.
   */
  value?: number;
  /** Uncontrolled initial value. */
  defaultValue?: number;
  /**
   * Called with the numeric value, not the event. A cleared input reports `NaN`
   * (`onChange?.(next ?? NaN)`).
   */
  onChange?: (value: number) => void;
  /** Lower bound, forwarded as base-ui `min`. */
  minValue?: number;
  /** Upper bound, forwarded as base-ui `max`. */
  maxValue?: number;
  /** Step amount for arrows and steppers. */
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

const stepperButton = cn(
  "box-border flex flex-1 cursor-default items-center justify-center border-0 bg-background px-0.5 py-0 text-foreground transition-colors hover:bg-muted disabled:bg-muted disabled:opacity-50"
);

/**
 * Labeled number field composite over Field + base-ui NumberField.
 * Client — it owns the change handler and reads locale from the provider
 * (performance.md §RSC classification).
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
  denomination,
  value,
  defaultValue,
  onChange,
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
  const { locale } = useElmeraGroupUi();
  const strings = useLocalizedStrings(numberFieldStrings);
  const controlledValue = value === undefined ? undefined : Number.isNaN(value) ? null : value;

  // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- label/control stack gap is layout, not a control rung
  const rootClassName = cn("gap-1", className);

  return (
    <FieldFrame
      className={rootClassName}
      invalid={isInvalid}
      disabled={isDisabled}
      label={label}
      isPending={isPending}
      isSuccess={isSuccess}
      description={description}
      errorMessage={errorMessage}>
      <NumberFieldPrimitive.Root
        name={name}
        value={controlledValue}
        defaultValue={defaultValue}
        onValueChange={(next) => onChange?.(next ?? NaN)}
        min={minValue}
        max={maxValue}
        step={step}
        format={formatOptions}
        locale={locale}
        disabled={isDisabled}
        readOnly={isReadOnly}
        required={isRequired}
        id={id}>
        <NumberFieldPrimitive.Group
          aria-invalid={isInvalid || undefined}
          className={cn(numberFieldGroupClass, {
            "bg-muted": isDisabled || isReadOnly,
          })}>
          <NumberFieldPrimitive.Input
            aria-label={ariaLabel}
            autoFocus={autoFocus}
            data-focus-ring-control=""
            className={cn(
              "box-border h-full w-full min-w-0 flex-1 border-0 bg-transparent py-0 tabular-nums",
              controlInsetMdClass,
              withinFocusRingControlClass
            )}
          />
          {denomination ? (
            <div className="text-sm px-2 py-1 text-muted-foreground">{denomination}</div>
          ) : null}
          <div className="flex h-full flex-col border-s">
            <NumberFieldPrimitive.Increment
              className={cn(stepperButton, "border-b")}
              aria-label={increaseLabel ?? strings.format("increase")}>
              <CaretUp aria-hidden className="size-4" />
            </NumberFieldPrimitive.Increment>
            <NumberFieldPrimitive.Decrement
              className={stepperButton}
              aria-label={decreaseLabel ?? strings.format("decrease")}>
              <CaretDown aria-hidden className="size-4" />
            </NumberFieldPrimitive.Decrement>
          </div>
        </NumberFieldPrimitive.Group>
      </NumberFieldPrimitive.Root>
    </FieldFrame>
  );
}

NumberField.displayName = "NumberField";
