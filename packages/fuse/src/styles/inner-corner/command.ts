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
 * The boundary the list publishes. It is the palette's `rounded-xl` less the list's inset, which
 * is the small surface gap, `--surface-gap-sm`.
 */
const commandListBoundaryClass = cn(
  "[--shell-inner:max(0px,--theme(--radius-xl)-var(--surface-gap-sm))]",
  publishShellBoundary
);

/**
 * `Command.List`, with or without a render element. It pads its rows with the small surface gap
 * inside the palette's `rounded-xl` and publishes. An empty List drops its padding.
 * `CommandVirtual.List` drops the block padding, because its virtualizer pads the block axis so
 * the scroll offsets include the padding.
 */
export const commandListShellClass = cn("p-(--surface-gap-sm) data-empty:p-0", commandListBoundaryClass);
