import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Toast. The rules every shell follows are in `corner-radius.ts`. Each
// constant pairs a part's rung or padding with the corner it publishes.

/**
 * A Toast: `rounded-lg` and the medium surface padding, `--surface-pad-md`.
 */
export const toastShellClass = cn(
  "rounded-lg p-(--surface-pad-md) [--shell-inner:max(0px,--theme(--radius-lg)-var(--surface-pad-md))]",
  publishShellBoundary
);
