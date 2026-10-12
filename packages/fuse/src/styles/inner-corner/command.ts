import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Command. The rules every shell follows are in `corner-radius.ts`.
// Each constant pairs a part's rung or padding with the corner it publishes. The palette is a
// `rounded-xl` box that pads nothing itself: its input, list and footer each pad their own edge.

/**
 * `Command.Dialog`: the palette box, `rounded-xl`. It publishes no corner; its List pads the rows
 * and publishes.
 */
export const commandDialogShellClass = cn("rounded-xl [--shell-inner:initial]", publishShellBoundary);

/**
 * `Command.List`: pads its rows with the small surface tier, `--surface-pad-sm`, inside the
 * palette's `rounded-xl` and publishes. An empty List drops its padding.
 */
export const commandListShellClass = cn(
  "p-(--surface-pad-sm) [--shell-inner:max(0px,--theme(--radius-xl)-var(--surface-pad-sm))] data-empty:p-0",
  publishShellBoundary
);

/**
 * `CommandVirtual.List`: the same corner as {@link commandListShellClass}, padded only on the
 * inline axis. The virtualizer pads the block axis, so its scroll offsets include the padding.
 */
export const commandVirtualListShellClass = cn(
  "px-(--surface-pad-sm) [--shell-inner:max(0px,--theme(--radius-xl)-var(--surface-pad-sm))] data-empty:px-0",
  publishShellBoundary
);
