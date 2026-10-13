import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shell of Toolbar. The rules every shell follows are in `corner-radius.ts`. The
// constant pairs the root's rung and inset with the corner it publishes.

/**
 * The Toolbar root: `rounded-lg`, a 1px border and `p-1`, around items it publishes the corner less
 * that inset to, so an item that rounds with `rounded-inner` sits concentric in the bar.
 */
export const toolbarShellClass = cn(
  "rounded-lg border p-1 [--shell-inner:max(0px,--theme(--radius-lg)-1px-var(--spacing))]",
  publishShellBoundary
);
