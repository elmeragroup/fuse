import { cn } from "../../styles/cn";
import { controlMetrics } from "../../styles/control-size";
import { sidebarRowShellClass, sidebarSurfaceShellClass } from "../../styles/inner-corner/sidebar";
import { nativeStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";

/**
 * A menu row in the collapsed icon rail: a fixed 32px square padded 8px, so its 16px icon sits
 * centred in the 48px rail at both densities. Every menu button size and the menu skeleton
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
 * The top of a menu row's 20px badge: 10px above the middle of a default row, which centres it on
 * `--row-h` at either density. The `sm` and `lg` rail rows are fixed, so they keep fixed offsets.
 */
export const sidebarMenuBadgeOffsetClass = cn(
  "top-[calc(var(--row-h)/2-0.625rem)] peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1"
);

/**
 * A menu row's action box: on a default row, the xs control square, floored at the 24px target,
 * centred on `--row-h` at either density. Its menu button reserves the same square plus 8px at its
 * end, so a truncated label stops before the action. The `sm` and `lg` rail rows are fixed, so their action
 * is a fixed 24px square, centred on the `sm` row and sharing the badge's middle on the `lg` row.
 */
export const sidebarMenuActionBoxClass = cn(
  controlMetrics({ size: "xs" }).square(),
  "top-[calc(var(--row-h)/2-max(var(--control-h-xs),24px)/2)] peer-data-[size=lg]/menu-button:top-2 peer-data-[size=lg]/menu-button:size-6 peer-data-[size=sm]/menu-button:top-0.5 peer-data-[size=sm]/menu-button:size-6"
);

/**
 * A group action's box: the xs control square, floored at the 24px target, centred on the 32px
 * group label, which sits at the group's row inset, or the small surface tier in a floating
 * Sidebar.
 */
export const sidebarGroupActionBoxClass = cn(
  controlMetrics({ size: "xs" }).square(),
  "top-[calc(var(--row-px)+1rem-max(var(--control-h-xs),24px)/2)] in-data-[slot=sidebar-inner]:group-data-[variant=floating]:top-[calc(var(--surface-pad-sm)+1rem-max(var(--control-h-xs),24px)/2)]"
);

/**
 * `Sidebar.MenuButton` recipe — package-private, never a facade export. The workspace-only
 * recipe catalog re-exports it for the Figma component sync.
 * The ref's template strings verbatim (`cva` → `tv`), with two locked rewrites: the
 * `group-has-data-[sidebar=menu-action]` selector keys on `data-slot`, and the
 * `ring-sidebar-ring` focus literals are the canonical `focusRing`.
 *
 * The default row reads the row metrics, as menu rows do: `--row-h` tall, padded inline with
 * `--row-px`. The `h-7` / `h-12` sizes are shell-local navigation-rail geometry, `fixed`
 * at both densities. Collapse motion animates colour and shadow only. The
 * shell width is the one sidebar layout transition `source-contracts.test.ts` allows.
 * The row is a native `<button>` or a `render`ed link, so the state face composes the
 * `native` target, whose `aria-disabled` arm covers a link row, and hover and press sit
 * behind the `enabled-*` gate.
 */
export const sidebarMenuButtonVariants = tv({
  base: [
    "peer/menu-button group/menu-button text-sm data-active:font-medium flex w-full items-center gap-2 overflow-hidden border-0 p-2 text-left transition-[color,background-color,box-shadow] group-has-data-[slot=sidebar-menu-action]/menu-item:pr-[calc(max(var(--control-h-xs),24px)+0.5rem)] data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground enabled-hover:bg-sidebar-accent enabled-hover:text-sidebar-accent-foreground data-open:enabled-hover:bg-sidebar-accent data-open:enabled-hover:text-sidebar-accent-foreground enabled-active:bg-sidebar-accent enabled-active:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate",
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
      default: ["text-sm", sidebarRowBoxClass],
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- navigation-rail row height and the 32px its fixed 24px action reserves, not a control size
      sm: "text-xs h-7 group-has-data-[slot=sidebar-menu-action]/menu-item:pr-8",
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- navigation-rail row height and the 32px its fixed 24px action reserves, not a control size
      lg: "text-sm h-12 group-has-data-[slot=sidebar-menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:p-0!",
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
 * `Sidebar.MenuSubButton` size axis — package-private, re-exported by the workspace-only recipe
 * catalog for the Figma component sync. Each size takes the control size's
 * height and type: `md` the md height with the density type pair, `sm` the sm height with
 * the fixed `text-sm`. The row keeps its own inset and gap.
 */
export const sidebarMenuSubButtonVariants = tv({
  base: [
    "flex min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground transition-colors group-data-[collapsible=icon]:hidden data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground enabled-hover:bg-sidebar-accent enabled-hover:text-sidebar-accent-foreground enabled-active:bg-sidebar-accent enabled-active:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
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
 * The desktop panel's parts — package-private, re-exported by the workspace-only recipe catalog
 * for the Figma component sync.
 * - `root`: the `group peer` anchor that carries `data-state`, `data-collapsible`, `data-variant`
 *   and `data-side`. It shows from `md:`; below it the mobile Sheet stands in.
 * - `staticRoot`: the `collapsible="none"` panel, a full-height column at `--sidebar-width`.
 * - `gap`: the flow spacer that holds the rail's width beside the page and animates it.
 * - `container`: the fixed rail box. A flush `sidebar` draws its edge border; a `floating` or
 *   `inset` one pads its surface by 8px, so its icon rail is the icon width plus that padding
 *   and the 2px the ring takes.
 * - `inner`: the surface. Floating's shadow and ring stay as `group-data-[variant=floating]:`
 *   selectors, so the panel's markup is the same for every variant.
 *
 * The gap's and container's width tweens are the sidebar's layout transitions that
 * `source-contracts.test.ts` allows.
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
      "md:flex fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[width] duration-200 ease-linear data-[side=left]:left-0 data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)] data-[side=right]:right-0 data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
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
  },
  compoundVariants: [
    {
      variant: ["floating", "inset"],
      class: {
        gap: "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]",
        container: "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]",
      },
    },
  ],
  defaultVariants: { variant: "sidebar" },
});
