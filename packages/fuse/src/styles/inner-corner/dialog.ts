import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Dialog. The rules every shell follows are in `corner-radius.ts`. Each
// constant pairs a part's rung or padding with the corner it publishes.

/**
 * The Dialog popup, AlertDialog's too: `rounded-xl` and the large surface padding,
 * `--surface-pad-lg`.
 */
export const dialogShellClass = cn(
  "rounded-xl p-(--surface-pad-lg) [--shell-inner:max(0px,--theme(--radius-xl)-var(--surface-pad-lg))]",
  publishShellBoundary
);
