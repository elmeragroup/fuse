"use client";

import type { ComponentProps, ReactElement } from "react";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "../../styles/cn";
import { selfFocusRingClass } from "../../styles/utils";

export type SwitchProps = Omit<ComponentProps<typeof SwitchPrimitive.Root>, "className"> & {
  /** Extra classes, merged via `cn` after the base classes. */
  className?: string;
  /**
   * Optical track size, emitted as `data-size`. Pixel-fixed at both density
   * stamps — not a control-box density rung (switch.md §4).
   */
  size?: "sm" | "default";
};

/**
 * Unlabeled two-state switch (switch.md §2/§7). Client — base-ui Switch owns
 * checked state (performance.md §RSC classification). Labeled usage composes
 * `Field.Root` + `Field.Label`.
 */
export function Switch({ className, size = "default", ...props }: SwitchProps): ReactElement {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        // oxlint-disable-next-line elmera/no-local-focus-ring -- switch.md §7: native outline off; ring comes from the shared adapter
        "peer group/switch shadow-xs relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-3 after:content-[''] aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] data-checked:bg-primary data-unchecked:bg-input data-disabled:cursor-not-allowed data-disabled:opacity-50",
        selfFocusRingClass,
        className
      )}
      {...props}>
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}

Switch.displayName = "Switch";
