import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Empty. The rules every shell follows are in `corner-radius.ts`. Each
// constant pairs a part's rung or padding with the corner it publishes.

/**
 * Empty: `rounded-lg`, 24px padding and 48px from `md` up.
 */
export const emptyShellClass = cn(
  "md:p-12 md:[--shell-inner:max(0px,--theme(--radius-lg)-12*var(--spacing))] rounded-lg p-6 [--shell-inner:max(0px,--theme(--radius-lg)-6*var(--spacing))]",
  publishShellBoundary
);

/**
 * The bordered Empty variants: {@link emptyShellClass} behind a 1px border.
 */
export const emptyBorderedShellClass = cn(
  "md:[--shell-inner:max(0px,--theme(--radius-lg)-1px-12*var(--spacing))] [--shell-inner:max(0px,--theme(--radius-lg)-1px-6*var(--spacing))]",
  publishShellBoundary
);
