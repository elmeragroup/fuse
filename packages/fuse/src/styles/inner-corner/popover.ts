import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Popover. The rules every shell follows are in `corner-radius.ts`. Each
// constant pairs a part's rung or padding with the corner it publishes.

/**
 * The Popover popup, PopoverInfoButton's too: `rounded-md` and the medium surface padding,
 * `--surface-pad-md`.
 */
export const popoverShellClass = cn(
  "rounded-md p-(--surface-pad-md) [--shell-inner:max(0px,--theme(--radius-md)-var(--surface-pad-md))]",
  publishShellBoundary
);
