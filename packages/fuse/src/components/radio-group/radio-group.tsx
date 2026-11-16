"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import type { VariantProps } from "tailwind-variants";

import { useCheckedResetSync } from "../../hooks/use-checked-reset-sync";
import { SpinnerGap } from "../../icons/generated/spinner-gap";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { FieldItem } from "../field/field";
import { FieldFrame } from "../field/field-frame";
import { SelectionGroupLayout, SelectionItemGroup } from "../selection-item/selection-item";
import { selectionGroupOrientationVariants } from "../selection-item/selection-item-variants";
import { radioIconButtonVariants, radioRowVariants, radioVariants } from "./radio-group-variants";

const slots = radioVariants();
const rowSlots = radioRowVariants();

/**
 * A 16px radio with no label, built on Base UI's radio, which owns the checked state. A checked
 * radio shows an 8px dot. For a labeled option use `Radio` or `RadioItem`. A disabled radio dims
 * to 50% inside or outside a label.
 */
export function RadioGroupItem({
  className,
  value,
  inputRef,
  ...props
}: ComponentProps<typeof RadioPrimitive.Root>): ReactElement {
  const syncedInputRef = useCheckedResetSync(inputRef);
  return (
    <RadioPrimitive.Root
      inputRef={syncedInputRef}
      data-slot="radio-group-item"
      value={value}
      className={mergeClassName(className, slots.root())}
      {...definedProps(props)}>
      <RadioPrimitive.Indicator data-slot="radio-group-indicator" className={slots.indicator()}>
        <span className={slots.dot()} />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
}

export type RadioGroupProps = {
  /** The group's visible name, rendered as `Field.Legend variant="label"` in the header row. */
  label?: string;
  /**
   * Hides the legend visually and keeps it as the group's accessible name. Use it for a group
   * under a heading that already names it. The first option moves up into the legend's place.
   * While `isPending`, the spinner row stays visible.
   */
  isLabelHidden?: boolean;
  /** Supporting text under the options, rendered as `Field.Description`. */
  description?: string;
  /**
   * The error text, rendered as `Field.Error` when truthy. While it is falsy, the field shows
   * its own validation error instead, such as a native constraint message.
   */
  errorMessage?: ReactNode;
  /**
   * Shows a spinner at the end of the header row and sets `aria-busy` on the group, for options
   * that are still loading. The spinner is decorative. A pending group without a `label` still
   * renders the header row, with no legend.
   */
  isPending?: boolean;
  /**
   * How the options line up. `vertical` stacks them `--surface-gap-sm` apart, and joins
   * `RadioItem` rows into one card with a line between rows. `horizontal` wraps them in a row
   * `--surface-gap-lg` apart, and each `RadioItem` row is a card of its own. The cards share the
   * line in equal widths. A `basis-*` class on a row sets the width below which it wraps.
   */
  orientation?: "vertical" | "horizontal";
  /**
   * The selected value, for a controlled group. Pass `null` for no selection: the group stays
   * controlled, so clearing the selection does not make it uncontrolled.
   */
  value?: string | null;
  /** The value selected on mount, for an uncontrolled group. */
  defaultValue?: string;
  /** Called with the newly selected value as a `string`. */
  onChange?: (value: string) => void;
  /** Disables every option. */
  isDisabled?: boolean;
  /** Marks the field invalid, so the options show the invalid face. */
  isInvalid?: boolean;
  /** Makes the group read-only: it shows its selection but a click does not change it. */
  isReadOnly?: boolean;
  /** Requires a selection before the form submits. */
  isRequired?: boolean;
  /** The form field name the selected option submits its `value` under. */
  name?: string;
  /** The `id` of the element that holds the options. */
  id?: string;
  /** Extra classes for the element that holds the options. */
  className?: string;
  /** The options: `Radio`, `RadioItem` or `RadioIconButton`. */
  children?: ReactNode;
};

/**
 * A labeled group of radios, built on Field and Base UI's radio group. A native form reset,
 * including React's reset after a form action, keeps the selection of Fuse members and the
 * submitted value in step. An uncontrolled group does not return to `defaultValue`.
 */
export function RadioGroup({
  label,
  isLabelHidden = false,
  description,
  errorMessage,
  isPending,
  orientation = "vertical",
  value,
  defaultValue,
  onChange,
  isDisabled,
  isInvalid,
  isReadOnly,
  isRequired,
  name,
  id,
  className,
  children,
}: RadioGroupProps): ReactElement {
  return (
    <FieldFrame
      heading="legend"
      label={label}
      isLabelHidden={isLabelHidden}
      description={description}
      errorMessage={errorMessage}
      invalid={isInvalid}
      disabled={isDisabled}
      status={isPending ? <SpinnerGap aria-hidden className="animate-spin size-3" /> : null}>
      <RadioGroupPrimitive
        data-slot="radio-group"
        // The layout axis, as Card writes it: a vertical stack of selection shells is connected.
        data-direction={orientation}
        {...definedProps({
          id,
          value,
          defaultValue,
          disabled: isDisabled,
          readOnly: isReadOnly,
          required: isRequired,
          name,
          "aria-busy": isPending === true ? true : undefined,
        })}
        onValueChange={(next) => onChange?.(String(next))}
        className={cn(selectionGroupOrientationVariants({ orientation }).group(), className)}>
        <SelectionGroupLayout orientation={orientation}>{children}</SelectionGroupLayout>
      </RadioGroupPrimitive>
    </FieldFrame>
  );
}

/**
 * A `RadioGroup` for `RadioItem` rows, which it puts in a `role="list"`. A vertical group joins
 * the rows into one card. A horizontal group wraps them, `--surface-gap-lg` apart, each a card
 * of its own.
 */
export function RadioItemGroup({ orientation = "vertical", ...props }: RadioGroupProps): ReactElement {
  // The default is spelled here because the docs API extractor reads a part's
  // documented defaults out of its own destructuring.
  return (
    <RadioGroup {...props} orientation={orientation}>
      <SelectionItemGroup orientation={orientation}>{props.children}</SelectionItemGroup>
    </RadioGroup>
  );
}

export type RadioProps = {
  /** The value the group takes when this option is selected. */
  value: string;
  /** Disables the option and dims the radio and its label text. */
  isDisabled?: boolean;
  /** Extra classes for the row's `Field.Item`. */
  className?: string;
  /** The option's label. A click anywhere on it selects the option. */
  children?: ReactNode;
};

/** A radio with its label, in a `Field.Item`. A click anywhere on the label selects it. */
export function Radio({ value, isDisabled, className, children }: RadioProps): ReactElement {
  return (
    <FieldItem className={cn(rowSlots.root(), className)}>
      <FieldPrimitive.Label className={rowSlots.label()}>
        <RadioGroupItem value={value} disabled={isDisabled} />
        <span className={rowSlots.content()}>{children}</span>
      </FieldPrimitive.Label>
    </FieldItem>
  );
}

export type RadioIconButtonProps = Omit<
  ComponentProps<typeof RadioPrimitive.Root>,
  "value" | "disabled" | "className" | "children" | "aria-label"
> & {
  /** The value the group takes when this option is selected. */
  value: string;
  /** Disables the option. */
  isDisabled?: boolean;
  /**
   * The button's size, matching Button's icon sizes. `icon-xxs` and `icon-xs` take the `xs`
   * control height with a 12px and a 14px icon, `icon-sm` the `sm` height and `icon` the `md`
   * height with a 16px icon, and `icon-lg` the `lg` height with a 20px icon. An icon with its
   * own `size-*` class keeps it.
   */
  size?: NonNullable<VariantProps<typeof radioIconButtonVariants>["size"]>;
  /** Extra classes for the button. */
  className?: string;
  /** The icon. */
  children?: ReactNode;
  /** The option's accessible name. It is required, because the button shows only an icon. */
  "aria-label": string;
};

/** An icon-only radio button, built on Base UI's radio, for a row of icon choices. */
export function RadioIconButton({
  value,
  isDisabled,
  size = "icon",
  className,
  children,
  inputRef,
  ...props
}: RadioIconButtonProps): ReactElement {
  const syncedInputRef = useCheckedResetSync(inputRef);
  return (
    <RadioPrimitive.Root
      inputRef={syncedInputRef}
      data-slot="radio-icon-button"
      value={value}
      className={cn(radioIconButtonVariants({ size }), className)}
      {...definedProps({ disabled: isDisabled, ...props })}>
      {children}
    </RadioPrimitive.Root>
  );
}

RadioGroupItem.displayName = "RadioGroupItem";
RadioGroup.displayName = "RadioGroup";
RadioItemGroup.displayName = "RadioItemGroup";
Radio.displayName = "Radio";
RadioIconButton.displayName = "RadioIconButton";
