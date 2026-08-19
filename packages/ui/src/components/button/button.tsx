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
    className?: string;
    isVisuallyDisabled?: boolean;
    isPending?: boolean;
    predictionZoneSize?: number;
    onIntent?: () => void;
  };

export type ButtonProps =
  | (ButtonSharedProps & {
      size?: LabelButtonSize;
    })
  | (ButtonSharedProps & {
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
