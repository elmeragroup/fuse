import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of SearchField. The rules every shell follows are in `corner-radius.ts`.
// Each constant pairs a part's rung or padding with the corner it publishes.

/**
 * The SearchField box: its clear button sits 4px in from the border.
 */
export const searchBoxShellClass = cn(
  "[--shell-inner:max(0px,var(--field-corner)-1px-var(--spacing))]",
  publishShellBoundary
);

/**
 * The SearchField clear button, 4px in from the {@link searchBoxShellClass} border.
 */
export const searchClearShellClass = cn("mr-1 rounded-inner");
