import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Tooltip. The rules every shell follows are in `corner-radius.ts`. Each
// constant pairs a part's rung or padding with the corner it publishes.

/**
 * The Tooltip popup: `rounded-md`, padded inline with the medium surface tier, `--surface-pad-md`,
 * and on the block axis with the row inset, `--row-py`. Its text and gap stay fixed.
 */
export const tooltipShellClass = cn(
  "rounded-md px-(--surface-pad-md) py-(--row-py) [--shell-inner:max(0px,--theme(--radius-md)-var(--surface-pad-md))]",
  publishShellBoundary
);
