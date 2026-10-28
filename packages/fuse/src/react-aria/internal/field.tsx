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

import { cn } from "../../styles/cn";
import { fieldBoxChromeClass } from "../../styles/field-box";
import { fieldEntryClass, fieldReads, fieldSize } from "../../styles/field-size";
import type { FieldSize } from "../../styles/field-size";
import { labelTypeClass } from "../../styles/label-type";
import { racDisabledStateFaceClass, racInvalidStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import {
  stateFocusRingClass,
  stateFocusRingVisibleClass,
  stateInvalidFocusRingVisibleClass,
} from "../../styles/utils";
import { composeTailwindRenderProps } from "./compose-tailwind-render-props";

/**
 * Package-private field chrome for the interim React Aria tier. Its `size` axis writes the field
 * size (`field-size.ts`) on the box, `"default"` the md control size and `"sm"` the sm one, and
 * the box reads its height from it, as the input, the segment rows and the inner buttons inside
 * it read theirs. Its shared `fieldBoxChromeClass` matches
 * Input's border, fill, radius, and shadow in mixed forms. The RAC Group is not focusable,
 * so it uses the shared state focus constants and receives disabled/invalid state through
 * render props, which the rac-target state face turns into the shared disabled and invalid
 * looks. A focused invalid group draws a solid error line inside the invalid halo through its
 * compound.
 * Descendant inputs borrow this surface instead of painting another fill.
 */
export const fieldGroupVariants = tv({
  base: cn(
    fieldBoxChromeClass,
    fieldReads.height(),
    "group flex items-center overflow-hidden text-foreground",
    stateFocusRingClass
  ),
  variants: {
    size: {
      default: fieldSize({ size: "default" }).box(),
      sm: fieldSize({ size: "sm" }).box(),
    },
    isFocusVisible: {
      true: stateFocusRingVisibleClass,
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
  compoundVariants: [
    {
      isInvalid: true,
      isFocusVisible: true,
      class: stateInvalidFocusRingVisibleClass,
    },
  ],
  defaultVariants: {
    size: "default",
    isFocusVisible: false,
    isInvalid: false,
    isDisabled: false,
    isReadOnly: false,
  },
});

/** Descendant segment rows borrow this group's field surface. */
export const FieldGroupSurfaceContext = createContext(false);

export type FieldGroupProps = ComponentProps<typeof AriaGroup> & {
  /** The field size the box writes, emitted as `data-size`. */
  size: FieldSize;
};

export function FieldGroup({ className, size, ...props }: FieldGroupProps): ReactElement {
  return (
    <FieldGroupSurfaceContext.Provider value={true}>
      <AriaGroup
        data-slot="field-group"
        data-size={size}
        className={composeRenderProps(className, (resolved: string | undefined, renderProps) =>
          cn(
            fieldGroupVariants({
              size,
              isFocusVisible: renderProps.isFocusVisible,
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
      className={cn(labelTypeClass, "font-medium w-fit cursor-default", className)}
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
          fieldEntryClass,
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
      className={cn(labelTypeClass, "text-muted-foreground", className)}
      {...props}
    />
  );
}

export type FieldErrorProps = ComponentProps<typeof AriaFieldError>;

export function FieldError({ className, ...props }: FieldErrorProps): ReactElement {
  return (
    <AriaFieldError
      data-slot="field-error"
      // Announce the error when it appears, as Fuse Field's error does. RAC's FieldError
      // filters `role` out of its DOM props, so the role goes on through its element.
      render={(domProps) => <span {...domProps} role="alert" />}
      className={composeTailwindRenderProps(
        className,
        cn(labelTypeClass, "whitespace-break-spaces text-error")
      )}
      {...props}
    />
  );
}

FieldGroup.displayName = "ReactAriaInternal.FieldGroup";
Label.displayName = "ReactAriaInternal.Label";
Input.displayName = "ReactAriaInternal.Input";
Description.displayName = "ReactAriaInternal.Description";
FieldError.displayName = "ReactAriaInternal.FieldError";
