import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Select. The rules every shell follows are in `corner-radius.ts`. Each
// constant pairs a part's rung or padding with the corner it publishes.

/**
 * The Select popup. It has no padding, so a row outside a group meets its corner and the popup
 * publishes the rung itself.
 */
export const selectPopupShellClass = cn(
  "rounded-lg [--shell-inner:--theme(--radius-lg)]",
  publishShellBoundary
);

/**
 * `Select.Group`: pads its rows 4px inside the popup's `rounded-lg` and publishes.
 */
export const selectGroupShellClass = cn(
  "p-1 [--shell-inner:max(0px,--theme(--radius-lg)-var(--spacing))]",
  publishShellBoundary
);
