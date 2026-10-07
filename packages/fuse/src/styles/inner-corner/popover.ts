import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Popover. The rules every shell follows are in `corner-radius.ts`. Each
// constant pairs a part's rung or padding with the corner it publishes.

/**
 * The Popover popup, PopoverInfoButton's too: `rounded-md` and 16px padding.
 */
export const popoverShellClass = cn(
  "rounded-md p-4 [--shell-inner:max(0px,--theme(--radius-md)-4*var(--spacing))]",
  publishShellBoundary
);
