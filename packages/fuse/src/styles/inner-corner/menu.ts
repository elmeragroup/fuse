import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of DropdownMenu. The rules every shell follows are in `corner-radius.ts`.
// Each constant pairs a part's rung or padding with the corner it publishes.

/**
 * DropdownMenu Content and SubContent: the popup rounds, pads 4px and publishes.
 */
export const menuPopupShellClass = cn(
  "rounded-md p-1 [--shell-inner:max(0px,--theme(--radius-md)-var(--spacing))]",
  publishShellBoundary
);
