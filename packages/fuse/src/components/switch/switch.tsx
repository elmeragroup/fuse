"use client";

import type { ComponentProps, ReactElement } from "react";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { useCheckedResetSync } from "../../hooks/use-checked-reset-sync";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { switchVariants } from "./switch-variants";

export type SwitchProps = Omit<ComponentProps<typeof SwitchPrimitive.Root>, "className"> & {
  /**
   * Extra classes, merged via `cn` after the base classes, so a height or width here replaces the
   * track's size. The track caps its width at the size's, so a wider track also needs a `max-w-*`.
   */
  className?: string;
  /**
   * Optical size of the track and thumb, also emitted as `data-size`. Pixel-fixed at both density
   * stamps — not a control-box density rung.
   */
  size?: "sm" | "default";
};

/**
 * Unlabeled two-state switch. Client — base-ui Switch owns
 * checked state. The track takes `switchVariants`' `root` and `control` classes for its size,
 * and the thumb its `thumb` classes. Labeled usage composes
 * `Field.Root` + `Field.Label`. Native form reset, including React's reset after a form
 * action, keeps the current state and what the form submits in step; an uncontrolled switch
 * does not return to `defaultChecked`.
 */
export function Switch({ className, size = "default", inputRef, ...props }: SwitchProps): ReactElement {
  const syncedInputRef = useCheckedResetSync(inputRef);
  const slots = switchVariants({ size });
  return (
    <SwitchPrimitive.Root
      inputRef={syncedInputRef}
      data-slot="switch"
      data-size={size}
      className={cn(slots.root(), slots.control(), className)}
      {...definedProps(props)}>
      <SwitchPrimitive.Thumb data-slot="switch-thumb" className={slots.thumb()} />
    </SwitchPrimitive.Root>
  );
}

Switch.displayName = "Switch";
