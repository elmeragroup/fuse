import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Tooltip. The rules every shell follows are in `corner-radius.ts`. Each
// constant pairs a part's rung or padding with the corner it publishes.

/**
 * The Tooltip popup: `rounded-md` and 12px inline padding.
 */
export const tooltipShellClass = cn(
  "rounded-md px-3 py-1.5 [--shell-inner:max(0px,--theme(--radius-md)-3*var(--spacing))]",
  publishShellBoundary
);
