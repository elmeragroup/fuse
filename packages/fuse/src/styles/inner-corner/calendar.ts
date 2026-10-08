import { cn } from "../cn";
import { fixedCornerClass, publishShellBoundary } from "../corner-radius";

// The inner-corner shells of the standalone Calendar. The rules every shell follows are in
// `corner-radius.ts`. Each constant pairs a part's rung or padding with the corner it publishes.

/**
 * The standalone Calendar: its fixed corner behind a 1px border, padded with the small surface
 * tier, `--surface-pad-sm`, around its control-sized cells.
 */
export const calendarShellClass = cn(
  fixedCornerClass,
  "p-(--surface-pad-sm) [--shell-inner:max(0px,clamp(var(--radius)-1000*var(--radius-step,0px),4px,var(--radius)+1000*var(--radius-step,0px))-1px-var(--surface-pad-sm))]",
  publishShellBoundary
);
