import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shell of the date pickers' preset group. The rules every shell follows are in
// `corner-radius.ts`; the constant pairs the part's padding with the corner it publishes.

/**
 * The date pickers' preset group: the small surface tier, `--surface-pad-sm`, inside the popover's
 * corner and border.
 */
export const pickerPresetsShellClass = cn(
  "p-(--surface-pad-sm) [--shell-inner:max(0px,--theme(--radius-md)-1px-var(--surface-pad-sm))]",
  publishShellBoundary
);
