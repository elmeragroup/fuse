import { cn } from "../cn";
import { publishShellBoundary } from "../corner-radius";

// The inner-corner shells of the floating Sidebar. The rules every shell follows are in
// `corner-radius.ts`. Each constant pairs a part's rung or padding with the corner it publishes.

/**
 * The Sidebar's inner surface. Floating, it rounds `rounded-lg` and pads nothing, so it publishes
 * its rung. The other variants have no corner and publish none.
 */
export const sidebarSurfaceShellClass = cn(
  "[--shell-inner:initial] group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:[--shell-inner:--theme(--radius-lg)]",
  publishShellBoundary
);

/**
 * A Sidebar header, footer or group: 8px padding, publishing only inside the floating Sidebar's
 * rounded surface. There it holds control-sized rows, so it pads with the small surface tier,
 * `--surface-pad-sm`, except in the icon rail, where the 8px centres the 32px icon buttons in
 * the 48px rail.
 */
export const sidebarSectionShellClass = cn(
  "p-2 [--shell-inner:initial] in-data-[slot=sidebar-inner]:group-data-[variant=floating]:p-(--surface-pad-sm) in-data-[slot=sidebar-inner]:group-data-[variant=floating]:[--shell-inner:max(0px,--theme(--radius-lg)-var(--surface-pad-sm))] in-data-[slot=sidebar-inner]:group-data-[variant=floating]:group-data-[collapsible=icon]:p-2 in-data-[slot=sidebar-inner]:group-data-[variant=floating]:group-data-[collapsible=icon]:[--shell-inner:max(0px,--theme(--radius-lg)-2*var(--spacing))]",
  publishShellBoundary
);

/**
 * A Sidebar menu button or group label: an inner part inside the floating Sidebar's rounded surface
 * and a `rounded-md` outer corner otherwise. Both weigh nothing, so a consumer's class wins.
 */
export const sidebarRowShellClass = cn(
  "[:where(&)]:rounded-md in-data-[slot=sidebar-inner]:group-data-[variant=floating]:[:where(&)]:rounded-inner"
);

/**
 * A Sidebar menu action, a third level 4px inside its menu button. Inside the floating Sidebar's
 * rounded surface it rounds inside the button's corner, and elsewhere it keeps `rounded-md`.
 */
export const sidebarMenuActionShellClass = cn(
  "[:where(&)]:rounded-md in-data-[slot=sidebar-inner]:group-data-[variant=floating]:[:where(&)]:rounded-[max(0px,var(--inner-corner,var(--radius))-var(--spacing))]"
);
