import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Item and SelectionItem. The rules every shell follows are in
// `corner-radius.ts`. Each constant pairs a part's rung or padding with the corner it publishes.

/**
 * The Item root: `rounded-md` behind a 1px border, transparent in the default variant.
 */
export const itemShellClass = cn("rounded-md border");

/**
 * A default-size Item: the medium surface tier, `--surface-pad-md`, on every side.
 */
export const itemDefaultShellClass = cn(
  "p-(--surface-pad-md) [--shell-inner:max(0px,--theme(--radius-md)-1px-var(--surface-pad-md))]",
  publishShellBoundary
);

/**
 * A small Item: the default size's inline edge, `--surface-pad-md`, so it lines up with default
 * Items and Cards, with the row inset, `--row-px`, on the block axis.
 */
export const itemSmShellClass = cn(
  "px-(--surface-pad-md) py-(--row-px) [--shell-inner:max(0px,--theme(--radius-md)-1px-var(--surface-pad-md))]",
  publishShellBoundary
);

/**
 * An extra-small Item: a list row, padded with the row metrics `--row-px` and `--row-py`, so a
 * one-line Item matches a menu row. It pads none inside a DropdownMenu.
 */
export const itemXsShellClass = cn(
  "px-(--row-px) py-(--row-py) [--shell-inner:max(0px,--theme(--radius-md)-1px-var(--row-px))] in-data-[slot=dropdown-menu-content]:p-0 in-data-[slot=dropdown-menu-content]:[--shell-inner:max(0px,--theme(--radius-md)-1px)]",
  publishShellBoundary
);

/**
 * A default-size Item in a compact Item.Group: the medium surface tier, `--surface-pad-md`.
 */
export const itemCompactShellClass = cn(
  "p-(--surface-pad-md) [--shell-inner:max(0px,--theme(--radius-md)-1px-var(--surface-pad-md))]",
  publishShellBoundary
);

/**
 * A small Item in a compact Item.Group: the row inset, `--row-px`.
 */
export const itemCompactSmShellClass = cn(
  "p-(--row-px) [--shell-inner:max(0px,--theme(--radius-md)-1px-var(--row-px))]",
  publishShellBoundary
);

/**
 * A SelectionItem: `rounded-lg` behind a 1px border, 16px inline padding.
 */
export const selectionItemShellClass = cn(
  "px-4 [--shell-inner:max(0px,--theme(--radius-lg)-1px-4*var(--spacing))]",
  publishShellBoundary
);
