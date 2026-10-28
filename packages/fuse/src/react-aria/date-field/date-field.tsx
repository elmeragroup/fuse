"use client";

import { useContext } from "react";
import type { ReactElement, ReactNode } from "react";

import {
  DateField as AriaDateField,
  DateFieldStateContext,
  DateInput as AriaDateInput,
  DateSegment,
  FormValidationContext,
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
import { useFormErrors } from "../internal/form-errors";

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
   * node or a validation render function. Without it or `isInvalid`, the field shows a `Form` error under
   * its `name`, which clears when the value changes.
   */
  errorMessage?: ReactNode | ((validation: ValidationResult) => ReactNode);
  /**
   * Pads day and month segments with a leading zero. The reference flips RAC's
   * locale-dependent default; this port keeps that flip.
   * @default true
   */
  shouldForceLeadingZeros?: boolean;
  /**
   * Control size of the field box, forwarded to `DateInput`. `"default"` maps to the `md`
   * control size; `"sm"` maps to the `sm` control size.
   * @default "default"
   */
  size?: DateInputProps["size"];
} & Omit<AriaDateFieldProps<T>, "shouldForceLeadingZeros">;

export function DateField<T extends DateValue>({
  label,
  description,
  errorMessage,
  shouldForceLeadingZeros = true,
  size = "default",
  className,
  onChange,
  ...props
}: DateFieldProps<T>): ReactElement {
  const { base } = dateFieldVariants();
  const { validationErrors, onChange: clearingOnChange } = useFormErrors([props.name], onChange);

  return (
    <FormValidationContext.Provider value={validationErrors}>
      <AriaDateField
        {...props}
        onChange={clearingOnChange}
        shouldForceLeadingZeros={shouldForceLeadingZeros}
        className={composeTailwindRenderProps(className, base())}>
        {label ? <Label>{label}</Label> : null}
        <DateInput size={size} />
        <FieldError>{errorMessage}</FieldError>
        {description ? <Description>{description}</Description> : null}
      </AriaDateField>
    </FormValidationContext.Provider>
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
  /**
   * Control size of the field box the row paints when it stands alone. Emitted as `data-size`.
   * `"default"` maps to the `md` control size; `"sm"` maps to the `sm` control size. Inside a
   * date picker the picker's field box owns the size, and the row reads it from there.
   * @default "default"
   */
  size?: "sm" | "default";
} & Omit<AriaDateInputProps, "children" | "slot" | "className">;

/** The `data-size` a DateInput writes when it paints its own field box. */
type DateInputSizeAttribute = { "data-size"?: NonNullable<DateInputProps["size"]> };

export function DateInput({ className, size = "default", ...props }: DateInputProps): ReactElement {
  const state = useContext(DateFieldStateContext);
  const hasGroupSurface = useContext(FieldGroupSurfaceContext);
  const { input, segment } = dateFieldVariants({ surface: hasGroupSurface ? "group" : "own" });
  // Only a row that paints its own box writes a size; in a picker the picker's box owns it.
  const sizeAttributes: DateInputSizeAttribute = {};
  if (!hasGroupSurface) {
    sizeAttributes["data-size"] = size;
  }

  return (
    <AriaDateInput
      {...props}
      {...sizeAttributes}
      className={composeRenderProps(className, (resolved, renderProps) =>
        cn(
          hasGroupSurface
            ? input()
            : fieldGroupVariants({
                size,
                isFocusVisible: renderProps.isFocusVisible,
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
