import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Command. The rules every shell follows are in `corner-radius.ts`.
// Each constant pairs a part's rung or padding with the corner it publishes. The palette is a
// `rounded-xl` box that pads nothing itself. Its input, list and footer each pad their own edge.

/**
 * The `Command.Content` palette box, `rounded-xl`. It publishes no corner; its List pads the rows
 * and publishes.
 */
export const commandContentShellClass = cn("rounded-xl [--shell-inner:initial]", publishShellBoundary);

/**
 * The boundary that both lists publish. It is the palette's `rounded-xl` less the lists' inset,
 * which is the small surface gap, `--surface-gap-sm`.
 */
const commandListBoundaryClass = cn(
  "[--shell-inner:max(0px,--theme(--radius-xl)-var(--surface-gap-sm))]",
  publishShellBoundary
);

/**
 * `Command.List`. It pads its rows with the small surface gap inside the palette's `rounded-xl`
 * and publishes. An empty List drops its padding.
 */
export const commandListShellClass = cn("p-(--surface-gap-sm) data-empty:p-0", commandListBoundaryClass);

/**
 * A `Command.List` that passes its rows to a render element, such as `CommandVirtual.List`. It
 * publishes the same corner as {@link commandListShellClass} but pads only the inline axis. The
 * render element places the rows, so it pads the block axis itself. A virtualizer pads it, so its
 * scroll offsets include the padding.
 */
export const commandRowsHandedOffListShellClass = cn(
  "px-(--surface-gap-sm) data-empty:px-0",
  commandListBoundaryClass
);
