import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Command. The rules every shell follows are in `corner-radius.ts`.
// Each constant pairs a part's rung or padding with the corner it publishes. The palette is a
// `rounded-xl` box that pads nothing itself: its input, list and footer each pad their own edge.

/**
 * `Command.Content`: the palette box, `rounded-xl`. It publishes no corner; its List pads the
 * rows and publishes.
 */
export const commandContentShellClass = cn("rounded-xl [--shell-inner:initial]", publishShellBoundary);

/**
 * The boundary both lists publish: the palette's `rounded-xl` less the small surface tier,
 * `--surface-pad-sm`, that pads their rows.
 */
const commandListBoundaryClass = cn(
  "[--shell-inner:max(0px,--theme(--radius-xl)-var(--surface-pad-sm))]",
  publishShellBoundary
);

/**
 * `Command.List`: pads its rows with the small surface tier inside the palette's `rounded-xl`
 * and publishes. An empty List drops its padding.
 */
export const commandListShellClass = cn("p-(--surface-pad-sm) data-empty:p-0", commandListBoundaryClass);

/**
 * `Command.List` that hands its rows to a render element, such as `CommandVirtual.List`: the same
 * corner as {@link commandListShellClass}, padded only on the inline axis. The element places the
 * rows, so it pads the block axis itself; a virtualizer does, so its scroll offsets include the
 * padding.
 */
export const commandRowsHandedOffListShellClass = cn(
  "px-(--surface-pad-sm) data-empty:px-0",
  commandListBoundaryClass
);
