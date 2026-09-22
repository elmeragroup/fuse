"use client";

import type { ComponentProps, ReactElement } from "react";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { toggleVariants } from "./toggle-variants";

export type ToggleProps = Omit<ComponentProps<typeof TogglePrimitive>, "className"> & {
  /** Extra classes, merged via the recipe `className` slot inside `cn`. */
  className?: string;
} & VariantProps<typeof toggleVariants>;

/**
 * Two-state pressed button. Client — base-ui Toggle owns
 * pressed state.
 */
export function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: ToggleProps): ReactElement {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

Toggle.displayName = "Toggle";
