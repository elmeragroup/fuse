"use client";

import { useContext } from "react";
import type { ReactElement, ReactNode } from "react";

import {
  DateField as AriaDateField,
  DateFieldStateContext,
  DateInput as AriaDateInput,
  DateSegment,
  composeRenderProps,
} from "react-aria-components";
import type {
  DateFieldProps as AriaDateFieldProps,
  DateInputProps as AriaDateInputProps,
  DateValue,
  ValidationResult,
} from "react-aria-components";

import { cn } from "../../styles/cn";
import { dateFieldVariants } from "../../styles/date-field";
import { composeTailwindRenderProps } from "../internal/compose-tailwind-render-props";
import {
  Description,
  FieldError,
  FieldGroupSurfaceContext,
  Label,
  fieldGroupVariants,
} from "../internal/field";

/**
 * Labeled date field composite over RAC `DateField`.
 * Client — the interim react-aria cluster owns segment state and validation.
 */
export type DateFieldProps<T extends DateValue> = {
  /** Visible label, rendered as the private RAC `Label`. */
  label?: string;
  /** Supporting copy, rendered as the private RAC `Description`. */
  description?: string;
  /**
   * Error copy, rendered as `FieldError` when the field is invalid. Accepts a
   * node or a validation render function.
   */
  errorMessage?: ReactNode | ((validation: ValidationResult) => ReactNode);
  /**
   * Pads day and month segments with a leading zero. The reference flips RAC's
   * locale-dependent default; this port keeps that flip.
   * @default true
   */
  shouldForceLeadingZeros?: boolean;
} & Omit<AriaDateFieldProps<T>, "shouldForceLeadingZeros">;

export function DateField<T extends DateValue>({
  label,
  description,
  errorMessage,
  shouldForceLeadingZeros = true,
  className,
  ...props
}: DateFieldProps<T>): ReactElement {
  const { base } = dateFieldVariants();

  return (
    <AriaDateField
      {...props}
      shouldForceLeadingZeros={shouldForceLeadingZeros}
      className={composeTailwindRenderProps(className, base())}>
      {label ? <Label>{label}</Label> : null}
      <DateInput />
      {description ? <Description>{description}</Description> : null}
      <FieldError>{errorMessage}</FieldError>
    </AriaDateField>
  );
}

/**
 * Reusable segment-row surface. `children` is omitted; segments always render.
 * `slot` and `className` are the documented face; remaining RAC DateInput props
 * forward through the intersection.
 */
export type DateInputProps = {
  /** Range-picker slot. `"start"` / `"end"` inside DateRangePicker. */
  slot?: AriaDateInputProps["slot"];
  /**
   * Extra classes, composed with the segment row and its standalone field
   * surface. Inside a field group, the group owns the surface. A function may compute the class from DateInput render props.
   */
  className?: AriaDateInputProps["className"];
} & Omit<AriaDateInputProps, "children" | "slot" | "className">;

export function DateInput({ className, ...props }: DateInputProps): ReactElement {
  const { input, segment } = dateFieldVariants();
  const state = useContext(DateFieldStateContext);
  const hasGroupSurface = useContext(FieldGroupSurfaceContext);

  return (
    <AriaDateInput
      {...props}
      className={composeRenderProps(className, (resolved, renderProps) =>
        cn(
          hasGroupSurface
            ? input()
            : fieldGroupVariants({
                isFocusVisible: renderProps.isFocusVisible,
                isFocusWithin: renderProps.isFocusWithin,
                isInvalid: renderProps.isInvalid,
                isDisabled: renderProps.isDisabled,
                isReadOnly: state?.isReadOnly ?? false,
                class: input(),
              }),
          resolved
        )
      )}>
      {(dateSegment) => <DateSegment segment={dateSegment} className={(values) => segment(values)} />}
    </AriaDateInput>
  );
}

DateField.displayName = "DateField";
DateInput.displayName = "DateInput";
