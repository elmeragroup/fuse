"use client";

import { createContext } from "react";
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
import { controlMdInsetTypeClass } from "../../styles/control-size-md";
import { fieldBoxChromeClass } from "../../styles/field-box";
import { racDisabledStateFaceClass, racInvalidStateFaceClass } from "../../styles/state-face";
import { stateFocusRingClass, stateFocusRingVisibleClass } from "../../styles/utils";
import { composeTailwindRenderProps } from "./compose-tailwind-render-props";

/**
 * Package-private field chrome for the interim React Aria tier. FieldGroup pins the md
 * control height without adding a size axis. Its shared `fieldBoxChromeClass` matches
 * Input's border, fill, radius, and shadow in mixed forms. The RAC Group is not focusable,
 * so it uses the shared state focus constants and receives disabled/invalid state through
 * render props, which the rac-target state face turns into the shared disabled and invalid
 * looks. Descendant inputs borrow this surface instead of painting another fill.
 */
export const fieldGroupVariants = tv({
  base: cn(
    fieldBoxChromeClass,
    "group flex h-(--control-h-md) items-center overflow-hidden text-foreground",
    stateFocusRingClass
  ),
  variants: {
    isFocusVisible: {
      true: stateFocusRingVisibleClass,
      false: "",
    },
    isFocusWithin: {
      true: "border-ring",
      false: "",
    },
    isInvalid: {
      true: racInvalidStateFaceClass,
      false: "",
    },
    isDisabled: {
      true: racDisabledStateFaceClass,
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

/** Descendant segment rows borrow this group's field surface. */
export const FieldGroupSurfaceContext = createContext(false);

export type FieldGroupProps = ComponentProps<typeof AriaGroup>;

export function FieldGroup({ className, ...props }: FieldGroupProps): ReactElement {
  return (
    <FieldGroupSurfaceContext.Provider value={true}>
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
    </FieldGroupSurfaceContext.Provider>
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
        // The FieldGroup owns the surface (bg-card), so the inner control never
        // paints a second one — that is what keeps the read-only `bg-muted` fill honest.
        cn(
          "min-w-0 flex-1 bg-transparent",
          controlMdInsetTypeClass,
          // oxlint-disable-next-line elmera/no-local-focus-ring -- within-adapter control outline
          "text-foreground outline-none placeholder:text-muted-foreground disabled:text-muted-foreground"
        )
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
