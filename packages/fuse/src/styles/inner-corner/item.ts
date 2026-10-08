import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of Item and SelectionItem. The rules every shell follows are in
// `corner-radius.ts`. Each constant pairs a part's rung or padding with the corner it publishes.

/**
 * The Item root: `rounded-md` behind a 1px border, transparent in the default variant.
 */
export const itemShellClass = cn("rounded-md border");

/**
 * A default-size Item: 16px inline padding.
 */
export const itemDefaultShellClass = cn(
  "px-4 py-3.5 [--shell-inner:max(0px,--theme(--radius-md)-1px-4*var(--spacing))]",
  publishShellBoundary
);

/**
 * A small Item: 12px inline padding.
 */
export const itemSmShellClass = cn(
  "px-3 py-2.5 [--shell-inner:max(0px,--theme(--radius-md)-1px-3*var(--spacing))]",
  publishShellBoundary
);

/**
 * An extra-small Item: 10px inline padding, none inside a DropdownMenu.
 */
export const itemXsShellClass = cn(
  "px-2.5 py-2 [--shell-inner:max(0px,--theme(--radius-md)-1px-2.5*var(--spacing))] in-data-[slot=dropdown-menu-content]:p-0 in-data-[slot=dropdown-menu-content]:[--shell-inner:max(0px,--theme(--radius-md)-1px)]",
  publishShellBoundary
);

/**
 * A default-size Item in a compact Item.Group: 12px padding.
 */
export const itemCompactShellClass = cn(
  "p-3 [--shell-inner:max(0px,--theme(--radius-md)-1px-3*var(--spacing))]",
  publishShellBoundary
);

/**
 * A small Item in a compact Item.Group: 8px padding.
 */
export const itemCompactSmShellClass = cn(
  "p-2 [--shell-inner:max(0px,--theme(--radius-md)-1px-2*var(--spacing))]",
  publishShellBoundary
);

/**
 * A SelectionItem: `rounded-lg` behind a 1px border, 16px inline padding.
 */
export const selectionItemShellClass = cn(
  "px-4 [--shell-inner:max(0px,--theme(--radius-lg)-1px-4*var(--spacing))]",
  publishShellBoundary
);
