/**
 * The class strings of Sidebar's row parts without an axis: `Sidebar.GroupLabel` and
 * `Sidebar.MenuBadge`. Package-private: not on the `@elmeragroup/fuse/sidebar` facade. The
 * workspace-only recipe catalog re-exports them for the Figma component sync.
 */
import { cn } from "../../styles/cn";
import { sidebarRowShellClass } from "../../styles/inner-corner/sidebar";
import { selfFocusRingClass } from "../../styles/utils";
import { sidebarMenuBadgeOffsetClass } from "./sidebar-variants";

/**
 * `Sidebar.GroupLabel`: a 32px row of muted small text at the row inset, rounded as a menu row.
 * In the collapsed icon rail it fades out and pulls the group's rows up by its own height.
 */
export const sidebarGroupLabelClass = cn(
  sidebarRowShellClass,
  "text-xs font-medium flex h-8 shrink-0 items-center px-(--row-px) text-sidebar-foreground/70 transition-opacity duration-200 ease-linear group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 [&>svg]:size-4 [&>svg]:shrink-0",
  selfFocusRingClass
);

/**
 * `Sidebar.MenuBadge`: a 20px count at the end of its menu item, centred on the menu button's
 * row. It takes the accent text while the menu button beside it is hovered or active, and hides in
 * the collapsed icon rail.
 */
export const sidebarMenuBadgeClass = cn(
  sidebarMenuBadgeOffsetClass,
  "text-xs font-medium pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-sidebar-foreground tabular-nums select-none group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-active/menu-button:text-sidebar-accent-foreground"
);
