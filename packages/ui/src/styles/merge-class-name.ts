import type { ClassValue } from "clsx";

import { cn } from "./cn";

/** Preserve Base UI's state callback while merging its result with library classes. */
export function mergeClassName<State>(
  className: string | ((state: State) => string | undefined) | undefined,
  ...classes: ClassValue[]
): string | ((state: State) => string) {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Base UI's public className contract explicitly accepts strings or state callbacks.
  if (typeof className === "function") {
    return (state) => cn(...classes, className(state));
  }
  return cn(...classes, className);
}
