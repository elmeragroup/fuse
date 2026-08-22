"use client";

import type { ComponentProps, ReactElement } from "react";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { VariantProps } from "tailwind-variants";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { usePredictedEvents } from "../../hooks/use-predicted-events";
import { cn } from "../../styles/cn";
import { buttonVariants } from "./button-variants";

type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;
type IconButtonSize = Extract<ButtonSize, `icon${string}`>;
type LabelButtonSize = Exclude<ButtonSize, IconButtonSize>;

type ButtonPrimitiveProps = Omit<ComponentProps<typeof ButtonPrimitive>, "className">;

type ButtonSharedProps = ButtonPrimitiveProps &
  Omit<VariantProps<typeof buttonVariants>, "size"> & {
    /** Extra classes, merged last through `cn`. */
    className?: string;
    /**
     * Renders the disabled treatment (`opacity-70`) and suppresses focus-on-press while
     * the button stays fully interactive — click, keyboard and focus-visible all still
     * work. For "looks disabled but explains itself on activation" flows.
     */
    isVisuallyDisabled?: boolean;
    /**
     * Disables the element and stamps `data-pending`, blocking activation entirely.
     * Effective disabled is `disabled || isPending`.
     */
    isPending?: boolean;
    /** Pixels the hit rect is inflated on every side when predicting pointer intent. */
    predictionZoneSize?: number;
    /**
     * Predictive-prefetch callback. Fires once when the pointer's predicted trajectory
     * lands inside the inflated hit rect; browsers without the prediction API fail soft.
     */
    onIntent?: () => void;
  };

export type ButtonProps =
  | (ButtonSharedProps & {
      /** Recipe size axis. The `icon*` sizes are square and additionally require an `aria-label`. */
      size?: LabelButtonSize;
    })
  | (ButtonSharedProps & {
      /** Recipe size axis. The `icon*` sizes are square and additionally require an `aria-label`. */
      size: IconButtonSize;
      "aria-label": string;
    });

export function Button({
  className,
  variant,
  size,
  isVisuallyDisabled = false,
  disabled = false,
  isPending = false,
  predictionZoneSize = 30,
  onIntent,
  onMouseDown,
  ref,
  ...props
}: ButtonProps): ReactElement {
  const { ref: predictedRef } = usePredictedEvents({
    predictionZoneSize,
    onIntent,
    enabled: !disabled && !isPending && !isVisuallyDisabled && onIntent !== undefined,
  });
  const mergedRef = useMergedRefs(ref, onIntent === undefined ? null : predictedRef);

  return (
    <ButtonPrimitive
      data-slot="button"
      data-pending={isPending || undefined}
      disabled={disabled || isPending}
      className={cn(buttonVariants({ variant, size }), isVisuallyDisabled && "opacity-70", className)}
      onMouseDown={(event) => {
        if (isVisuallyDisabled) {
          event.preventDefault();
        }
        onMouseDown?.(event);
      }}
      {...props}
      ref={mergedRef}
    />
  );
}

Button.displayName = "Button";
