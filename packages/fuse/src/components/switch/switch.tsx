"use client";

import type { ComponentProps, ReactElement } from "react";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { useCheckedResetSync } from "../../hooks/use-checked-reset-sync";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { dataStateFaceClass } from "../../styles/state-face";
import { selfFocusRingClass } from "../../styles/utils";
import { switchVariants } from "./switch-variants";

const slots = switchVariants();

export type SwitchProps = Omit<ComponentProps<typeof SwitchPrimitive.Root>, "className"> & {
  /** Extra classes, merged via `cn` after the base classes. */
  className?: string;
  /**
   * Optical track size, emitted as `data-size`. Pixel-fixed at both density
   * stamps — not a control-box density rung.
   */
  size?: "sm" | "default";
};

/**
 * Unlabeled two-state switch. Client — base-ui Switch owns
 * checked state. Labeled usage composes
 * `Field.Root` + `Field.Label`. Native form reset, including React's reset after a form
 * action, keeps the current state and what the form submits in step; an uncontrolled switch
 * does not return to `defaultChecked`.
 */
export function Switch({ className, size = "default", inputRef, ...props }: SwitchProps): ReactElement {
  const syncedInputRef = useCheckedResetSync(inputRef);
  return (
    <SwitchPrimitive.Root
      inputRef={syncedInputRef}
      data-slot="switch"
      data-size={size}
      className={cn(
        // The control's own classes, which a picture of a switch leaves out: the `peer` marker for
        // a sibling's `peer-*` styles, the native outline off, and a 24px hit area around the track.
        // oxlint-disable-next-line elmera/no-local-focus-ring -- native outline off; ring comes from the shared adapter
        "peer outline-none after:absolute after:-inset-x-3 after:-inset-y-3 after:content-['']",
        slots.root(),
        selfFocusRingClass,
        dataStateFaceClass,
        className
      )}
      {...definedProps(props)}>
      <SwitchPrimitive.Thumb data-slot="switch-thumb" className={slots.thumb()} />
    </SwitchPrimitive.Root>
  );
}

Switch.displayName = "Switch";
