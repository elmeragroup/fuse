import { tv } from "tailwind-variants";

import { nativeStateFaceClass } from "../../styles/state-face";
import { selfFocusRingClass } from "../../styles/utils";

/**
 * `Sidebar.MenuButton` recipe — module-private, never a facade export.
 * The ref's template strings verbatim (`cva` → `tv`), with two locked rewrites: the
 * `group-has-data-[sidebar=menu-action]` selector keys on `data-slot`, and the
 * `ring-sidebar-ring` focus literals are the canonical `focusRing`.
 *
 * The `h-8` / `h-7` / `h-12` ladder is shell-local navigation-rail geometry, exempt from
 * the `--control-*` density rungs. Collapse motion animates colour and shadow only. The
 * shell width is the one sidebar layout transition `source-contracts.test.ts` allows.
 * The row is a native `<button>` or a `render`ed link, so the state face composes the
 * `native` target, whose `aria-disabled` arm covers a link row, and hover and press sit
 * behind the `enabled-*` gate.
 */
export const sidebarMenuButtonVariants = tv({
  base: [
    "peer/menu-button group/menu-button text-sm data-active:font-medium flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left transition-[color,background-color,box-shadow] group-has-data-[slot=sidebar-menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground enabled-hover:bg-sidebar-accent enabled-hover:text-sidebar-accent-foreground data-open:enabled-hover:bg-sidebar-accent data-open:enabled-hover:text-sidebar-accent-foreground enabled-active:bg-sidebar-accent enabled-active:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate",
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
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- navigation-rail row height, not a control rung
      default: "text-sm h-8",
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- navigation-rail row height, not a control rung
      sm: "text-xs h-7",
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- navigation-rail row height, not a control rung
      lg: "text-sm h-12 group-data-[collapsible=icon]:p-0!",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

/**
 * `Sidebar.MenuSubButton` size axis — module-private. `md` pins the md
 * control rung and the control-type pair; `sm` pins the sm rung with size-owned `text-sm`.
 */
export const sidebarMenuSubButtonVariants = tv({
  base: [
    "flex min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground transition-colors group-data-[collapsible=icon]:hidden data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground enabled-hover:bg-sidebar-accent enabled-hover:text-sidebar-accent-foreground enabled-active:bg-sidebar-accent enabled-active:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
    selfFocusRingClass,
    nativeStateFaceClass,
  ],
  variants: {
    size: {
      md: "h-(--control-h-md) [font-size:var(--control-text)] [line-height:var(--control-leading)]",
      sm: "text-sm h-(--control-h-sm)",
    },
  },
  defaultVariants: { size: "md" },
});
