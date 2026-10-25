/**
 * The class strings of Sidebar's parts without an axis. The desktop panel's parts are slots of
 * `sidebarPanelVariants`, and the mobile Sheet's stay in `sidebar.tsx`. Package-private: not on
 * the `@elmeragroup/fuse/sidebar` facade. The workspace-only recipe catalog re-exports them for
 * the Figma component sync.
 */
import { cn } from "../../styles/cn";
import { sidebarRowShellClass, sidebarSectionShellClass } from "../../styles/inner-corner/sidebar";
import { selfFocusRingClass } from "../../styles/utils";
import { sidebarMenuBadgeOffsetClass, sidebarRowBoxClass } from "./sidebar-variants";

/**
 * `Sidebar.Provider`'s wrapper: the full-height page row that holds the panel and the inset. It
 * takes the sidebar fill behind an `inset` panel, so the inset reads as a card on it.
 */
export const sidebarWrapperClass = cn(
  "group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar"
);

/**
 * `Sidebar.Trigger`: the `icon-sm` ghost Button, with its hit area grown by 4px on each side.
 */
export const sidebarTriggerClass = cn("hit-area-1");

/**
 * `Sidebar.Rail`: a 16px hover strip on the panel's inner edge whose 2px middle line takes the
 * sidebar border on hover. Its cursor points the way a click moves the edge. In the collapsed
 * offcanvas panel it sits flush with the screen edge and takes the sidebar fill on hover.
 */
export const sidebarRailClass = cn(
  "md:flex visible absolute inset-y-0 z-20 hidden w-4 group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:start-1/2 after:w-[2px] after:transition-colors hover:after:bg-sidebar-border ltr:-translate-x-1/2 rtl:-translate-x-1/2",
  "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
  "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
  "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full hover:group-data-[collapsible=offcanvas]:bg-sidebar",
  "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
  "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2"
);

/**
 * `Sidebar.Inset`: the main column on the background fill. Beside an `inset` panel, from `md:`,
 * it becomes a rounded, shadowed card 8px from the page edges, and 8px from the collapsed panel.
 */
export const sidebarInsetClass = cn(
  "md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2 relative flex w-full flex-1 flex-col bg-background"
);

/** `Sidebar.Input`: the Input field box at the row height, full width, on the background fill. */
export const sidebarInputClass = cn("h-(--row-h) w-full bg-background shadow-none");

/**
 * `Sidebar.Header` and `Sidebar.Footer`: a padded column of rows 8px apart. In a floating
 * Sidebar the shell publishes `--inner-corner` for its rows.
 */
export const sidebarSectionClass = cn(sidebarSectionShellClass, "flex flex-col gap-2");

/** `Sidebar.Separator`: the hairline in the sidebar border colour, inset 8px from each side. */
export const sidebarSeparatorClass = cn("mx-2 w-auto bg-sidebar-border");

/**
 * `Sidebar.Content`: the column between header and footer that takes the remaining height and
 * scrolls without a scrollbar. The collapsed icon rail clips it instead.
 */
export const sidebarContentClass = cn(
  "no-scrollbar flex min-h-0 flex-1 flex-col gap-0 overflow-auto group-data-[collapsible=icon]:overflow-hidden"
);

/**
 * `Sidebar.Group`: a padded full-width column, positioned for its group action. In a floating
 * Sidebar the shell publishes `--inner-corner` for its rows.
 */
export const sidebarGroupClass = cn(sidebarSectionShellClass, "relative flex w-full min-w-0 flex-col");

/** `Sidebar.GroupContent`: a full-width wrapper in small text. */
export const sidebarGroupContentClass = cn("text-sm w-full");

/** `Sidebar.Menu`: a full-width column of rows with no gap. */
export const sidebarMenuClass = cn("flex w-full min-w-0 flex-col gap-0");

/** `Sidebar.MenuItem`: the `group/menu-item` row holder its action and badge position against. */
export const sidebarMenuItemClass = cn("group/menu-item relative");

/**
 * `Sidebar.MenuSkeleton`: a loading row in the default menu row's box. Its text bar's width
 * cycles five values in the 50–90% band by the row's position among its siblings.
 */
export const sidebarMenuSkeletonClass = cn(
  sidebarRowBoxClass,
  "flex items-center gap-2 rounded-md [--skeleton-width:70%] [:nth-child(5n)>&]:[--skeleton-width:55%] [:nth-child(5n+1)>&]:[--skeleton-width:50%] [:nth-child(5n+2)>&]:[--skeleton-width:90%] [:nth-child(5n+3)>&]:[--skeleton-width:65%] [:nth-child(5n+4)>&]:[--skeleton-width:80%]"
);

/** The menu skeleton's 16px icon square. */
export const sidebarMenuSkeletonIconClass = cn("size-4 rounded-md");

/** The menu skeleton's 16px text bar, capped at the row's `--skeleton-width`. */
export const sidebarMenuSkeletonTextClass = cn("h-4 max-w-(--skeleton-width) flex-1");

/**
 * `Sidebar.MenuSub`: the nested list, indented under its parent row's icon behind a border line.
 * It hides in the collapsed icon rail.
 */
export const sidebarMenuSubClass = cn(
  "mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5 group-data-[collapsible=icon]:hidden"
);

/** `Sidebar.MenuSubItem`: the `group/menu-sub-item` holder of a sub row. */
export const sidebarMenuSubItemClass = cn("group/menu-sub-item relative");

/**
 * `Sidebar.Icon`: centres a 20px brand mark, full width in the collapsed icon rail.
 */
export const sidebarIconClass = cn(
  "flex items-center justify-center group-data-[collapsible=icon]:w-full [&_svg]:size-5 [&_svg]:shrink-0"
);

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
