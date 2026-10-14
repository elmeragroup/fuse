"use client";

import type { ComponentProps, ReactElement } from "react";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { useCheckedResetSync } from "../../hooks/use-checked-reset-sync";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { dataStateFaceClass } from "../../styles/state-face";
import { selfFocusRingClass } from "../../styles/utils";

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
        // The root is a <span>, so the state face keys off Base UI's `data-disabled` and
        // `data-invalid` attributes, plus a consumer's `aria-invalid`. The unchecked track is an
        // outline: its edge and thumb take `muted-foreground`, held to 3:1 on every surface by the
        // matrix rule in `contrast-matrix.test.ts`, and the surface shows through. The checked
        // track is the `primary` fill with a `background` thumb, so on versus off reads as outline
        // versus fill in every palette, as on Checkbox and Radio.
        // oxlint-disable-next-line elmera/no-local-focus-ring -- native outline off; ring comes from the shared adapter
        "peer group/switch shadow-xs relative inline-flex shrink-0 items-center rounded-full border border-muted-foreground transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-3 after:content-[''] data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] data-checked:border-primary data-checked:bg-primary",
        selfFocusRingClass,
        dataStateFaceClass,
        className
      )}
      {...definedProps(props)}>
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-muted-foreground ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-checked:bg-background group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] data-unchecked:scale-75 group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}

Switch.displayName = "Switch";
