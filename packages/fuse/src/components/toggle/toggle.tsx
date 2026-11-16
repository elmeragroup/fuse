"use client";

import type { ComponentProps, ReactElement } from "react";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { toggleVariants } from "./toggle-variants";

type ToggleVariantProps = VariantProps<typeof toggleVariants>;

export type ToggleProps = Omit<ComponentProps<typeof TogglePrimitive>, "className"> & {
  /** Extra classes for the button, merged after the recipe's. */
  className?: string;
  /**
   * The resting look. `default` has no fill or border, and `outline` adds a border and a small
   * shadow. Pressed, either fills with the theme's `toggle-pressed` colours.
   */
  variant?: ToggleVariantProps["variant"];
  /**
   * The control size: `xs`, `sm`, `default` or `lg`, where `default` is the `md` control size. A
   * toggle is never narrower than it is tall. The size's padding still applies, so an icon-only
   * toggle can come out wider than tall, as a 16px icon does at `sm` in the dense density.
   */
  size?: ToggleVariantProps["size"];
};

/** A button that stays pressed until it is pressed again, built on Base UI's toggle. */
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
