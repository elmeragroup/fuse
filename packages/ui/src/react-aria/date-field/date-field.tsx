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
import { tv } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { Description, FieldError, Label, fieldGroupVariants } from "../internal/field";
import { composeTailwindRenderProps } from "../internal/utils";

/**
 * Labeled date field composite over RAC `DateField` (date-field.md §2/§3).
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

const dateFieldVariants = tv({
  slots: {
    base: "flex flex-col gap-1",
    input: "text-sm block min-w-[150px] px-2 py-1.5",
    segment:
      "inline rounded-xs p-0.5 text-foreground caret-transparent outline outline-0 forced-color-adjust-none forced-colors:text-[ButtonText] type-literal:px-0",
  },
  variants: {
    isPlaceholder: {
      true: {
        segment: "text-muted-foreground italic",
      },
    },
    isDisabled: {
      true: {
        segment: "text-muted-foreground forced-colors:text-[GrayText]",
      },
    },
    isFocused: {
      true: {
        segment:
          "bg-primary text-primary-foreground forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]",
      },
    },
  },
});

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
 * forward through the intersection (date-field.md §3).
 */
export type DateInputProps = {
  /** Range-picker slot. `"start"` / `"end"` inside DateRangePicker. */
  slot?: AriaDateInputProps["slot"];
  /**
   * Extra classes, composed into `fieldGroupVariants` plus the `input` slot
   * class. A function may compute the class from DateInput render props.
   */
  className?: AriaDateInputProps["className"];
} & Omit<AriaDateInputProps, "children" | "slot" | "className">;

export function DateInput({ className, ...props }: DateInputProps): ReactElement {
  const { input, segment } = dateFieldVariants();
  const state = useContext(DateFieldStateContext);

  return (
    <AriaDateInput
      {...props}
      className={composeRenderProps(className, (resolved, renderProps) =>
        cn(
          fieldGroupVariants({
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
