import { cn } from "../../styles/cn";
import { controlMetrics } from "../../styles/control-size";
import { sidebarRowShellClass, sidebarSurfaceShellClass } from "../../styles/inner-corner/sidebar";
import { nativeStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";

/**
 * A menu row in the collapsed icon rail: a fixed 32px square padded 8px, so its 16px icon sits
 * centered in the 48px rail at both densities. Every menu button size and the menu skeleton
 * collapse to the 32px square. The `lg` button overrides the padding with `p-0!`, so its content
 * fills the square.
 */
// oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- the icon rail's fixed square, not a control size
const sidebarRowCollapsedClass = cn(
  "group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2!"
);

/**
 * The box of a default Sidebar menu row: the row metrics `--row-h` and `--row-px`, and the
 * collapsed icon rail's 32px square padded 8px. The default menu button and the menu
 * skeleton share it, so a loading row matches the row it stands in for, expanded or collapsed.
 */
export const sidebarRowBoxClass = cn("box-border h-(--row-h) px-(--row-px)", sidebarRowCollapsedClass);

/**
 * The row lengths a menu row's action and badge read. Each part sets them on itself from the size
 * of the menu button before it, through `peer-data-[size=…]/menu-button`. They repeat the lengths
 * each `sidebarMenuButtonVariants` size sets on the button:
 * - `--menu-row-h`, the row's height: `--row-h` on a default row, and on the `sm` and `lg` rail
 *   rows `--spacing(7)` and `--spacing(12)`, each floored at the row's action.
 * - `--menu-action-size`, the action's square: the xs control square on a default row and
 *   `--spacing(6)` on a rail row, each floored at the 24px target.
 * - `--menu-row-mid`, the line the action and the badge center on: the row's middle, or
 *   `--spacing(5)` down on the `lg` row, clamped so the action stays inside the row.
 *
 * A default row's `--row-h` is at least its action's square at both densities from a 12px root.
 */
const sidebarMenuRowLengthsClass = cn(
  "[--menu-action-size:max(var(--control-h-xs),24px)] [--menu-row-h:var(--row-h)] [--menu-row-mid:calc(var(--menu-row-h)/2)]",
  "peer-data-[size=sm]/menu-button:[--menu-action-size:max(--spacing(6),24px)] peer-data-[size=sm]/menu-button:[--menu-row-h:max(--spacing(7),var(--menu-action-size))]",
  "peer-data-[size=lg]/menu-button:[--menu-action-size:max(--spacing(6),24px)] peer-data-[size=lg]/menu-button:[--menu-row-h:max(--spacing(12),var(--menu-action-size))] peer-data-[size=lg]/menu-button:[--menu-row-mid:clamp(var(--menu-action-size)/2,--spacing(5),var(--menu-row-h)-var(--menu-action-size)/2)]"
);

/**
 * The lengths a group label and its group action each set: `--group-action-size`, the xs control
 * square floored at the 24px target, and `--group-label-h`, `--spacing(8)` floored at that square,
 * so the action never reaches past the label.
 */
export const sidebarGroupLengthsClass = cn(
  "[--group-action-size:max(var(--control-h-xs),24px)] [--group-label-h:max(--spacing(8),var(--group-action-size))]"
);

/**
 * The top of a menu row's `--spacing(5)` badge: half its height above the `--menu-row-mid` line, so
 * the badge shares the row's middle, or the `lg` row's action line.
 */
export const sidebarMenuBadgeOffsetClass = cn(
  sidebarMenuRowLengthsClass,
  "top-[calc(var(--menu-row-mid)-(--spacing(5))/2)]"
);

/**
 * A menu row's action box: the `--menu-action-size` square, centered on the `--menu-row-mid` line.
 * Its `::after` hit area spans the `--menu-row-h` row from top to bottom, and the menu button's end
 * padding, the square plus `--spacing(2)`. It reaches neither the next row's action nor the label.
 */
export const sidebarMenuActionBoxClass = cn(
  sidebarMenuRowLengthsClass,
  "top-[calc(var(--menu-row-mid)-var(--menu-action-size)/2)] size-(--menu-action-size) after:absolute after:-inset-x-1 after:top-[calc(var(--menu-action-size)/2-var(--menu-row-mid))] after:bottom-[calc(var(--menu-row-mid)+var(--menu-action-size)/2-var(--menu-row-h))]"
);

/**
 * A group action's box: the `--group-action-size` square, centered on the `--group-label-h` group
 * label, which sits at the group's row inset, or the small surface tier in a floating Sidebar.
 * Its `::after` hit area reaches 8px past the square's sides and spans the label from top to
 * bottom, so it never covers the first menu row.
 */
export const sidebarGroupActionBoxClass = cn(
  sidebarGroupLengthsClass,
  "top-[calc(var(--row-px)+var(--group-label-h)/2-var(--group-action-size)/2)] size-(--group-action-size) in-data-[slot=sidebar-inner]:group-data-[variant=floating]:top-[calc(var(--surface-pad-sm)+var(--group-label-h)/2-var(--group-action-size)/2)]",
  "after:absolute after:-inset-x-2 after:inset-y-[calc(var(--group-action-size)/2-var(--group-label-h)/2)]"
);

/**
 * The `Sidebar.MenuButton` recipe. It is package-private and never a facade export, and the
 * workspace-only recipe catalog re-exports it for the Figma component sync. It keeps the shadcn
 * template's class strings, moved from `cva` to `tv`, with two fixed rewrites. The
 * `group-has-data-[sidebar=menu-action]` selector keys on `data-slot`, and the
 * `ring-sidebar-ring` focus literals are the shared `focusRing`.
 *
 * The default row reads the row metrics, as menu rows do: `--row-h` tall, padded inline with
 * `--row-px`. The `sm` and `lg` sizes are shell-local navigation-rail geometry, `fixed` at both
 * densities. Each size sets its own `--menu-action-size`, and the `sm` and `lg` sizes their
 * `--menu-row-h` height, the lengths `sidebarMenuRowLengthsClass` gives the action and badge. A row
 * with a `Sidebar.MenuAction` pads its end by `--menu-action-size` plus `--spacing(2)`, so a
 * truncated label stops before the action's hit area. Collapse motion animates color and shadow
 * only. The shell width is the one sidebar layout transition.
 * The row is a native `<button>` or a `render`ed link, so the state face composes the
 * `native` target, whose `aria-disabled` arm covers a link row, and hover and press sit
 * behind the `enabled-*` gate.
 */
export const sidebarMenuButtonVariants = tv({
  base: [
    "peer/menu-button group/menu-button text-sm data-active:font-medium flex w-full items-center gap-2 overflow-hidden border-0 p-2 text-left transition-[color,background-color,box-shadow] group-has-data-[slot=sidebar-menu-action]/menu-item:pr-[calc(var(--menu-action-size)+(--spacing(2)))] data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground data-active:not-disabled-state:forced-highlight enabled-hover:bg-sidebar-accent enabled-hover:text-sidebar-accent-foreground data-open:enabled-hover:bg-sidebar-accent data-open:enabled-hover:text-sidebar-accent-foreground enabled-active:bg-sidebar-accent enabled-active:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate",
    // A disabled row dims to half, and so would a Highlight fill, which the action and badge
    // beside the row would then sit on. A disabled active row draws a 2px Highlight frame on its
    // edge instead, clear of the action and badge, so they keep the forced colors of any other
    // row.
    "forced-colors:data-active:disabled-state:relative forced-colors:data-active:disabled-state:after:absolute forced-colors:data-active:disabled-state:after:inset-0 forced-colors:data-active:disabled-state:after:rounded-[inherit] forced-colors:data-active:disabled-state:after:border-2 forced-colors:data-active:disabled-state:after:border-[Highlight]",
    sidebarRowCollapsedClass,
    sidebarRowShellClass,
    selfFocusRingClass,
    nativeStateFaceClass,
  ],
  variants: {
    variant: {
      default: "enabled-hover:bg-sidebar-accent enabled-hover:text-sidebar-accent-foreground",
      outline:
        "bg-background shadow-[0_0_0_1px_var(--sidebar-border)] enabled-hover:bg-sidebar-accent enabled-hover:text-sidebar-accent-foreground enabled-hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
    },
    size: {
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- the row metrics' type; `--control-h-xs` here sizes the action's square the row reserves, not this row
      default: ["text-sm", sidebarRowBoxClass, "[--menu-action-size:max(var(--control-h-xs),24px)]"],
      sm: "text-xs h-(--menu-row-h) [--menu-action-size:max(--spacing(6),24px)] [--menu-row-h:max(--spacing(7),var(--menu-action-size))]",
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- the navigation-rail row's type, fixed at both densities, not a control size
      lg: "text-sm h-(--menu-row-h) [--menu-action-size:max(--spacing(6),24px)] [--menu-row-h:max(--spacing(12),var(--menu-action-size))] group-data-[collapsible=icon]:p-0!",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

/** A sub-button row's height and type at one control size. */
function subButtonSize(size: "sm" | "md"): string {
  const parts = controlMetrics({ size });
  return cn(parts.height(), parts.type());
}

/**
 * The `Sidebar.MenuSubButton` size axis. It is package-private, and the workspace-only recipe
 * catalog re-exports it for the Figma component sync. Each size takes the control size's
 * height and type: `md` the md height with the density type pair, `sm` the sm height with
 * the fixed `text-sm`. The row keeps its own inset and gap.
 */
export const sidebarMenuSubButtonVariants = tv({
  base: [
    "flex min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground transition-colors group-data-[collapsible=icon]:hidden data-active:forced-highlight data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground enabled-hover:bg-sidebar-accent enabled-hover:text-sidebar-accent-foreground enabled-active:bg-sidebar-accent enabled-active:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
    selfFocusRingClass,
    nativeStateFaceClass,
  ],
  variants: {
    size: {
      md: subButtonSize("md"),
      sm: subButtonSize("sm"),
    },
  },
  defaultVariants: { size: "md" },
});

/**
 * `Sidebar.Provider`'s wrapper: the row that holds the panel and the inset, on the sidebar fill
 * behind an `inset` panel, so the inset reads as a card on it. It is package-private, and the
 * workspace-only recipe catalog re-exports it for the Figma component sync.
 * - `page`: the full-height page row, at least the viewport's height.
 * - `container`: it fills its container's height instead of the viewport's and is the rail's
 *   containing block. It clips at its edges, so the collapsed offcanvas rail, which slides past the
 *   start edge, stays inside the container as it stays off a page's screen. It uses `overflow-clip`, not
 *   `overflow-hidden`, so it never becomes a scroll container.
 */
export const sidebarWrapperVariants = tv({
  base: "group/sidebar-wrapper flex w-full has-data-[variant=inset]:bg-sidebar",
  variants: {
    bounds: {
      page: "min-h-svh",
      container: "relative h-full min-h-0 overflow-clip",
    },
  },
  defaultVariants: { bounds: "page" },
});

/**
 * The collapsed width of a `floating` or `inset` icon rail: `--sidebar-width-icon` plus the
 * container's 8px padding on each side. Floating's ring takes no room. The gap and the container
 * share this width, so the rail fills its gap exactly.
 */
const sidebarPaddedRailWidthClass = cn(
  "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
);

/**
 * The desktop panel's parts. They are package-private, and the workspace-only recipe catalog
 * re-exports them for the Figma component sync.
 * - `root`: the `group peer` anchor that carries `data-state`, `data-collapsible`, `data-variant`
 *   and `data-side`. It shows from `md:`; below it the mobile Sheet stands in.
 * - `staticRoot`: the `collapsible="none"` panel, a full-height column at `--sidebar-width`.
 * - `gap`: the flow spacer that holds the rail's width beside the page and animates it.
 * - `container`: the rail box, viewport-tall and `fixed` at `bounds="page"`, and container-tall
 *   and `absolute` against the Provider's wrapper at `bounds="container"`. A flush `sidebar` draws
 *   its edge border; a `floating` or `inset` one pads its surface by 8px, so its icon rail is the
 *   icon width plus that padding.
 * - `inner`: the surface. Floating's shadow and ring stay as `group-data-[variant=floating]:`
 *   selectors, so the panel's markup is the same for every variant.
 *
 * The gap's and container's width tweens are the sidebar's layout transitions.
 */
export const sidebarPanelVariants = tv({
  slots: {
    root: "group peer md:block hidden text-sidebar-foreground",
    staticRoot: "group peer flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground",
    gap: [
      "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
      "group-data-[collapsible=offcanvas]:w-0",
      "group-data-[side=right]:rotate-180",
    ],
    container:
      "md:flex inset-y-0 z-10 hidden w-(--sidebar-width) transition-[width] duration-200 ease-linear data-[side=left]:left-0 data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)] data-[side=right]:right-0 data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
    inner: [
      sidebarSurfaceShellClass,
      "group-data-[variant=floating]:shadow-sm flex size-full flex-col bg-sidebar group-data-[collapsible=offcanvas]:invisible group-data-[variant=floating]:ring-1 group-data-[variant=floating]:ring-sidebar-border",
    ],
  },
  variants: {
    variant: {
      sidebar: {
        gap: "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
        container:
          "border-sidebar-border group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
      },
      floating: {},
      inset: {},
    },
    bounds: {
      page: { container: "fixed h-svh" },
      container: { container: "absolute h-full" },
    },
  },
  compoundVariants: [
    {
      variant: ["floating", "inset"],
      class: {
        gap: sidebarPaddedRailWidthClass,
        container: cn("p-2", sidebarPaddedRailWidthClass),
      },
    },
  ],
  defaultVariants: { variant: "sidebar", bounds: "page" },
});
