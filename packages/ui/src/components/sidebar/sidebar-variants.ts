import { tv } from "tailwind-variants";

import { focusRing } from "../../styles/utils";

/** Resolved once at module scope — the recipe below does the same (no per-render work). */
const selfFocusRing = focusRing({ target: "self" }).root();

/**
 * `Sidebar.MenuButton` recipe (sidebar.md §4) — module-private, never a facade export.
 * The ref's template strings verbatim (`cva` → `tv`), with two locked rewrites: the
 * `group-has-data-[sidebar=menu-action]` selector keys on `data-slot` (§8.1), and the
 * `ring-sidebar-ring` focus literals are the canonical `focusRing` (§8.13).
 *
 * The `h-8` / `h-7` / `h-12` ladder is shell-local navigation-rail geometry, exempt from
 * the `--control-*` density rungs (sidebar.md §4 "Density exemption", §8.14).
 */
export const sidebarMenuButtonVariants = tv({
  base: [
    "peer/menu-button group/menu-button text-sm data-active:font-medium flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left transition-[width,height,padding,color,background-color,box-shadow] group-has-data-[slot=sidebar-menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-open:hover:bg-sidebar-accent data-open:hover:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate",
    selfFocusRing,
  ],
  variants: {
    variant: {
      default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      outline:
        "bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
    },
    size: {
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- sidebar.md §4 shell-local exemption: navigation-rail row height, not a control rung
      default: "text-sm h-8",
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- sidebar.md §4 shell-local exemption: navigation-rail row height, not a control rung
      sm: "text-xs h-7",
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- sidebar.md §4 shell-local exemption: navigation-rail row height, not a control rung
      lg: "text-sm h-12 group-data-[collapsible=icon]:p-0!",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});
