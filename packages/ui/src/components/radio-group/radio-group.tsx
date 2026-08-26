"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { SpinnerGap } from "../../icons/generated/spinner-gap";
import { cn } from "../../styles/cn";
import { focusRing } from "../../styles/utils";
import { Field } from "../field/field";
import { SelectionItem, SelectionItemGroup } from "../selection-item/selection-item";

const selfFocusRing = focusRing({ target: "self" }).root();

/**
 * Unlabeled 16px radio over the base-ui primitive (radio-group.md §2/§7). Client —
 * base-ui Radio owns checked state (performance.md §RSC classification). The
 * indicator is an 8px primary-foreground dot. Labeled usage composes `Radio` or
 * `RadioItem`.
 */
export function RadioGroupItem({
  className,
  ...props
}: ComponentProps<typeof RadioPrimitive.Root>): ReactElement {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={(state) =>
        cn(
          "group/radio-group-item peer relative flex aspect-square size-4 shrink-0 rounded-full border border-input transition-[color,box-shadow] outline-none after:absolute after:-inset-x-3 after:-inset-y-2 after:content-[''] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20 aria-invalid:aria-checked:border-primary data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground",
          selfFocusRing,
          className instanceof Function ? className(state) : className
        )
      }
      {...props}>
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex size-4 items-center justify-center">
        <span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
}

export type RadioGroupProps = {
  /** Fieldset legend, rendered as `Field.Legend variant="label"` in the header row. */
  label?: string;
  /** Supporting copy, rendered as `Field.Description`. */
  description?: string;
  /** Error copy, rendered as `Field.Error` when truthy. Accepts any `ReactNode`. */
  errorMessage?: ReactNode;
  /**
   * Decorative `SpinnerGap` at the header row's end. Sets `aria-busy` on the
   * radiogroup while true; omitted when pending is false or absent. The header
   * row renders when `label` or `isPending` is truthy — `isPending={false}` with
   * no label does not emit an empty legend.
   */
  isPending?: boolean;
  /**
   * Layout of the group primitive. Vertical is `flex-col gap-2`; horizontal is
   * `flex-wrap gap-4`. Not a recipe axis. Default `"vertical"`.
   */
  orientation?: "vertical" | "horizontal";
  /**
   * Controlled selected value. `null` is passed through to keep the primitive
   * controlled with nothing selected, so clearing a selected value does not
   * switch it to uncontrolled state.
   */
  value?: string | null;
  /** Uncontrolled initial selected value. */
  defaultValue?: string;
  /**
   * Called with the selected `string`, not the event. Mapped from base-ui
   * `onValueChange` with `String(next)`.
   */
  onChange?: (value: string) => void;
  /** Forwards `disabled` to `Field.Root` and the group primitive. */
  isDisabled?: boolean;
  /** Forwards `invalid` to `Field.Root`. */
  isInvalid?: boolean;
  /** Forwards `readOnly` to the group primitive. */
  isReadOnly?: boolean;
  /** Forwards `required` to the group primitive. */
  isRequired?: boolean;
  /**
   * Set directly on the base-ui radio-group primitive, which supports `name`.
   * CheckboxGroup threads `name` through Field instead — same external face,
   * different plumbing (radio-group.md §8.7).
   */
  name?: string;
  /** Forwarded to the group primitive. */
  id?: string;
  /** Extra classes, merged onto the group primitive via `cn`. */
  className?: string;
  /** Group members — typically `Radio`, `RadioItem`, or `RadioIconButton`. */
  children?: ReactNode;
};

/**
 * Labeled radio group composite over Field + base-ui RadioGroup
 * (radio-group.md §2/§7). Client — Field validity wiring and the group primitive
 * (performance.md §RSC classification).
 */
export function RadioGroup({
  label,
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
    <Field.Root invalid={isInvalid} disabled={isDisabled}>
      <Field.Set>
        {label || isPending ? (
          <div className="flex items-center justify-between">
            <Field.Legend variant="label">{label}</Field.Legend>
            {isPending ? <SpinnerGap aria-hidden className="animate-spin size-3" /> : null}
          </div>
        ) : null}
        {description ? <Field.Description>{description}</Field.Description> : null}
        <RadioGroupPrimitive
          data-slot="radio-group"
          id={id}
          value={value}
          defaultValue={defaultValue}
          onValueChange={onChange ? (next) => onChange(String(next)) : undefined}
          disabled={isDisabled}
          readOnly={isReadOnly}
          required={isRequired}
          name={name}
          aria-busy={isPending ? true : undefined}
          className={cn(
            orientation === "horizontal" ? "flex flex-wrap gap-4" : "flex flex-col gap-2",
            className
          )}>
          {children}
        </RadioGroupPrimitive>
        {errorMessage ? <Field.Error>{errorMessage}</Field.Error> : null}
      </Field.Set>
    </Field.Root>
  );
}

/**
 * Stacked-card group: `RadioGroup` wrapping children in `Item.Group`
 * (`role="list"`, `gap-0 select-none`).
 */
export function RadioItemGroup({
  children,
  orientation = "vertical",
  ...props
}: RadioGroupProps): ReactElement {
  return (
    <RadioGroup orientation={orientation} {...props}>
      <SelectionItemGroup>{children}</SelectionItemGroup>
    </RadioGroup>
  );
}

export type RadioProps = {
  /** Member value in the group. */
  value: string;
  /** Forwards `disabled` to the inner `RadioGroupItem`. */
  isDisabled?: boolean;
  /** Extra classes, merged onto `Field.Item` via `cn`. */
  className?: string;
  /** Visible label content. The whole row is the click target. */
  children?: ReactNode;
};

/**
 * Compact labeled radio row over `Field.Item` + base-ui `Field.Label`
 * (radio-group.md §2/§7). The whole label is the click target.
 */
export function Radio({ value, isDisabled, className, children }: RadioProps): ReactElement {
  return (
    <Field.Item className={cn("flex", className)}>
      <FieldPrimitive.Label className="text-sm flex cursor-pointer items-center gap-2 has-disabled:cursor-not-allowed has-disabled:opacity-50">
        <RadioGroupItem value={value} disabled={isDisabled} />
        {children}
      </FieldPrimitive.Label>
    </Field.Item>
  );
}

export type RadioItemProps = {
  /** Member value in the group. Forwarded to the inner `RadioGroupItem`. */
  value: string;
  /** Forwards `disabled` to the inner control and applies disabled hatch styling on the shell. */
  isDisabled?: boolean;
  /**
   * Where the control sits in the labelled row. Forwarded to `SelectionItem.Shell`.
   * Default `"start"`.
   */
  controlPosition?: "start" | "end";
  /** Extra classes, merged onto the shell via `cn`. */
  className?: string;
  /**
   * Row children, partitioned by the shell. Direct `RadioItem.SubSection` (the
   * same object as `SelectionItem.SubSection`) children render outside the label.
   */
  children?: ReactNode;
};

/**
 * Labeled selection row over `SelectionItem.Shell` (radio-group.md §2/§7). Client —
 * Field.Item / label wiring (performance.md §RSC classification). Namespace
 * aliases `Title` / `Description` / `Content` / `Actions` / `SubSection` are the
 * exact `SelectionItem.*` objects so `child.type` partitioning works across both
 * spellings.
 */
export function RadioItem({
  value,
  isDisabled,
  controlPosition = "start",
  className,
  children,
}: RadioItemProps): ReactElement {
  return (
    <SelectionItem.Shell
      dataSlot="radio-item"
      isDisabled={isDisabled}
      controlPosition={controlPosition}
      className={className}
      control={<RadioGroupItem value={value} disabled={isDisabled} />}>
      {children}
    </SelectionItem.Shell>
  );
}

export type RadioIconButtonProps = Omit<
  ComponentProps<typeof RadioPrimitive.Root>,
  "value" | "disabled" | "className" | "children" | "aria-label"
> & {
  /** Member value in the group. */
  value: string;
  /** Forwards `disabled` to the radio root. */
  isDisabled?: boolean;
  /**
   * Decorative size map, not a density rung: `icon-xxs` size-6/svg-3, `icon-xs`
   * size-7/svg-3.5, `icon-sm` size-8/svg-4, `icon` size-9/svg-4, `icon-lg`
   * size-10/svg-5. Svg sizes apply only to `svg:not([class*='size-'])`. Default
   * `"icon"`.
   */
  size?: "icon" | "icon-xxs" | "icon-xs" | "icon-sm" | "icon-lg";
  /** Extra classes, merged via `cn`. */
  className?: string;
  /** The icon. */
  children?: ReactNode;
  /**
   * Required accessible name. `RadioIconButton` is mechanically icon-only
   * (accessibility.md §3).
   */
  "aria-label": string;
};

const iconButtonSizes = {
  "icon-xxs": "size-6 [&_svg:not([class*='size-'])]:size-3",
  "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
  "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-4",
  icon: "size-9 [&_svg:not([class*='size-'])]:size-4",
  "icon-lg": "size-10 [&_svg:not([class*='size-'])]:size-5",
} as const satisfies Record<NonNullable<RadioIconButtonProps["size"]>, string>;

/**
 * Icon-only segmented radio over the base-ui radio root (radio-group.md §2/§7).
 * Client — base-ui Radio owns checked state (performance.md §RSC classification).
 */
export function RadioIconButton({
  value,
  isDisabled,
  size = "icon",
  className,
  children,
  ...props
}: RadioIconButtonProps): ReactElement {
  return (
    <RadioPrimitive.Root
      data-slot="radio-icon-button"
      value={value}
      disabled={isDisabled}
      className={cn(
        "ease-out inline-flex shrink-0 items-center justify-center rounded-lg border border-input bg-card text-foreground transition-[color,background-color,box-shadow,scale] duration-150 outline-none hover:bg-muted active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 data-invalid:border-error data-checked:border-primary data-checked:bg-muted",
        iconButtonSizes[size],
        selfFocusRing,
        className
      )}
      {...props}>
      {children}
    </RadioPrimitive.Root>
  );
}

RadioGroupItem.displayName = "RadioGroupItem";
RadioGroup.displayName = "RadioGroup";
RadioItemGroup.displayName = "RadioItemGroup";
Radio.displayName = "Radio";
RadioItem.displayName = "RadioItem";
RadioIconButton.displayName = "RadioIconButton";

RadioItem.Title = SelectionItem.Title;
RadioItem.Description = SelectionItem.Description;
RadioItem.Content = SelectionItem.Content;
RadioItem.Actions = SelectionItem.Actions;
RadioItem.SubSection = SelectionItem.SubSection;
