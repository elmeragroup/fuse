"use client";

import type { ComponentProps, ReactElement } from "react";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { useCheckedResetSync } from "../../hooks/use-checked-reset-sync";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { switchVariants } from "./switch-variants";

export type SwitchProps = Omit<ComponentProps<typeof SwitchPrimitive.Root>, "className"> & {
  /**
   * Extra classes for the track. A height or width class replaces the track's size. The track
   * caps its width at the size's, so a wider track also needs a `max-w-*` class.
   */
  className?: string;
  /**
   * The size of the track and thumb, also written as `data-size`. `default` is a 32px by 18.4px
   * track, and `sm` a 24px by 14px one. The pixel sizes stay the same at both densities, since
   * the switch takes no control size.
   */
  size?: "sm" | "default";
};

/**
 * An on and off switch with no label, built on Base UI's switch, which owns the checked state.
 * The track takes `switchVariants`' `root` and `control` classes, and the thumb its `thumb`
 * classes. Label it with `Field.Root` and `Field.Label`. A native form reset, including React's
 * reset after a form action, keeps the shown state and the submitted value in step. An
 * uncontrolled switch does not return to `defaultChecked`.
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
