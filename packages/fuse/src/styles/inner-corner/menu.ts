import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of DropdownMenu. The rules every shell follows are in `corner-radius.ts`.
// Each constant pairs a part's rung or padding with the corner it publishes.

/**
 * DropdownMenu Content and SubContent: the popup rounds, pads with the small surface tier,
 * `--surface-pad-sm`, and publishes.
 */
export const menuPopupShellClass = cn(
  "rounded-md p-(--surface-pad-sm) [--shell-inner:max(0px,--theme(--radius-md)-var(--surface-pad-sm))]",
  publishShellBoundary
);
