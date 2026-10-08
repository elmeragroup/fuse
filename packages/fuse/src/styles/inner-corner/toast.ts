import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Toast. The rules every shell follows are in `corner-radius.ts`. Each
// constant pairs a part's rung or padding with the corner it publishes.

/**
 * A Toast: `rounded-lg` and 16px padding.
 */
export const toastShellClass = cn(
  "rounded-lg p-4 [--shell-inner:max(0px,--theme(--radius-lg)-4*var(--spacing))]",
  publishShellBoundary
);
