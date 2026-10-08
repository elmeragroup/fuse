import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Empty. The rules every shell follows are in `corner-radius.ts`. Each
// constant pairs a part's rung or padding with the corner it publishes.

/**
 * Empty: `rounded-lg` and the large surface padding, `--surface-pad-lg`, doubled from `md` up:
 * 32px dense and 48px comfortable there.
 */
export const emptyShellClass = cn(
  "md:p-[calc(2*var(--surface-pad-lg))] md:[--shell-inner:max(0px,--theme(--radius-lg)-2*var(--surface-pad-lg))] rounded-lg p-(--surface-pad-lg) [--shell-inner:max(0px,--theme(--radius-lg)-var(--surface-pad-lg))]",
  publishShellBoundary
);

/**
 * The bordered Empty variants: {@link emptyShellClass} behind a 1px border.
 */
export const emptyBorderedShellClass = cn(
  "md:[--shell-inner:max(0px,--theme(--radius-lg)-1px-2*var(--surface-pad-lg))] [--shell-inner:max(0px,--theme(--radius-lg)-1px-var(--surface-pad-lg))]",
  publishShellBoundary
);
