"use client";

import type { ComponentProps, ReactElement } from "react";

import {
  FieldError as AriaFieldError,
  Group as AriaGroup,
  Input as AriaInput,
  Label as AriaLabel,
  Text as AriaText,
  composeRenderProps,
} from "react-aria-components";
import { tv } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { focusRing } from "../../styles/utils";
import { composeTailwindRenderProps } from "./utils";

/**
 * The interim tier's field chrome (date-picker.md §2). All of it is package-private:
 * the public field family is the base-ui `@elmeragroup/ui/field` entry, and none of
 * these names appear in `package.json#exports`.
 *
 * `fieldGroupVariants` is a single-height field box: conventions.md ruling 2 pins the
 * `md` rung (`h-(--control-h-md)`) without growing a `size` axis, so a comfortable
 * DateField box matches a comfortable Button. date-picker.md §8.10 records the swap
 * from the reference's literal `h-9`; §8.9 records `bg-card` replacing `bg-background`.
 * The focus ring is the shared `focusRing({ target: "state", isFocusVisible })` recipe,
 * never a local outline.
 */
export const fieldGroupVariants = tv({
  base: cn(
    "group flex h-(--control-h-md) items-center overflow-hidden rounded-lg border border-input bg-card text-foreground transition-[color,border-color,box-shadow]",
    focusRing({ target: "state" }).root()
  ),
  variants: {
    isFocusVisible: {
      true: focusRing({ target: "state", isFocusVisible: true }).root(),
      false: "",
    },
    isFocusWithin: {
      true: "border-ring",
      false: "",
    },
    isInvalid: {
      true: "border-error",
      false: "",
    },
    isDisabled: {
      true: "opacity-50",
      false: "",
    },
    isReadOnly: {
      true: "bg-muted",
      false: "",
    },
  },
  defaultVariants: {
    isFocusVisible: false,
    isFocusWithin: false,
    isInvalid: false,
    isDisabled: false,
    isReadOnly: false,
  },
});

export type FieldGroupProps = ComponentProps<typeof AriaGroup>;

export function FieldGroup({ className, ...props }: FieldGroupProps): ReactElement {
  return (
    <AriaGroup
      data-slot="field-group"
      className={composeRenderProps(className, (resolved: string | undefined, renderProps) =>
        cn(
          fieldGroupVariants({
            isFocusVisible: renderProps.isFocusVisible,
            isFocusWithin: renderProps.isFocusWithin,
            isInvalid: renderProps.isInvalid,
            isDisabled: renderProps.isDisabled,
            isReadOnly: props.isReadOnly ?? false,
          }),
          resolved
        )
      )}
      {...props}
    />
  );
}

export type LabelProps = ComponentProps<typeof AriaLabel>;

export function Label({ className, ...props }: LabelProps): ReactElement {
  return (
    <AriaLabel
      data-slot="field-label"
      className={cn("text-sm font-medium w-fit cursor-default", className)}
      {...props}
    />
  );
}

export type InputProps = ComponentProps<typeof AriaInput>;

export function Input({ className, ...props }: InputProps): ReactElement {
  return (
    <AriaInput
      data-slot="field-input"
      className={composeTailwindRenderProps(
        className,
        // The FieldGroup owns the surface (bg-card, §8.9), so the inner control never
        // paints a second one — that is what keeps the read-only `bg-muted` fill honest.
        "min-w-0 flex-1 bg-transparent px-(--control-px-md) [font-size:var(--control-text)] [line-height:var(--control-leading)] text-foreground outline-none placeholder:text-muted-foreground disabled:text-muted-foreground"
      )}
      {...props}
    />
  );
}

export type DescriptionProps = ComponentProps<typeof AriaText>;

export function Description({ className, ...props }: DescriptionProps): ReactElement {
  return (
    <AriaText
      data-slot="field-description"
      slot="description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export type FieldErrorProps = ComponentProps<typeof AriaFieldError>;

export function FieldError({ className, ...props }: FieldErrorProps): ReactElement {
  return (
    <AriaFieldError
      data-slot="field-error"
      className={composeTailwindRenderProps(className, "text-sm whitespace-break-spaces text-error")}
      {...props}
    />
  );
}

FieldGroup.displayName = "ReactAriaInternal.FieldGroup";
Label.displayName = "ReactAriaInternal.Label";
Input.displayName = "ReactAriaInternal.Input";
Description.displayName = "ReactAriaInternal.Description";
FieldError.displayName = "ReactAriaInternal.FieldError";
