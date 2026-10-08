import { cn } from "../../styles/cn";
import { controlMetrics } from "../../styles/control-size";
import { sidebarRowShellClass } from "../../styles/inner-corner/sidebar";
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
 * The box of a default Sidebar menu row: the sm control height and the xs control inset, 32px
 * and 8px dense and 36px and 12px comfortable, and the collapsed icon rail's 32px square padded
 * 8px. The default menu button and the menu skeleton share it, so a loading row matches the row
 * it stands in for, expanded or collapsed.
 */
export const sidebarRowBoxClass = cn(
  "box-border h-(--control-h-sm) px-(--control-px-xs)",
  sidebarRowCollapsedClass
);

/**
 * `Sidebar.MenuButton` recipe — module-private, never a facade export.
 * The ref's template strings verbatim (`cva` → `tv`), with two locked rewrites: the
 * `group-has-data-[sidebar=menu-action]` selector keys on `data-slot`, and the
 * `ring-sidebar-ring` focus literals are the canonical `focusRing`.
 *
 * The default row is a control, as menu rows are: the sm control height, padded inline with the
 * xs control inset, so 32px tall and 8px in dense and 36px and 12px comfortable. The `h-7` /
 * `h-12` sizes are shell-local navigation-rail geometry, exempt from the `--control-*` control
 * sizes. Collapse motion animates colour and shadow only. The
 * shell width is the one sidebar layout transition `source-contracts.test.ts` allows.
 * The row is a native `<button>` or a `render`ed link, so the state face composes the
 * `native` target, whose `aria-disabled` arm covers a link row, and hover and press sit
 * behind the `enabled-*` gate.
 */
export const sidebarMenuButtonVariants = tv({
  base: [
    "peer/menu-button group/menu-button text-sm data-active:font-medium flex w-full items-center gap-2 overflow-hidden border-0 p-2 text-left transition-[color,background-color,box-shadow] group-has-data-[slot=sidebar-menu-action]/menu-item:pr-8 data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground enabled-hover:bg-sidebar-accent enabled-hover:text-sidebar-accent-foreground data-open:enabled-hover:bg-sidebar-accent data-open:enabled-hover:text-sidebar-accent-foreground enabled-active:bg-sidebar-accent enabled-active:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate",
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
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- navigation-rail row height, not a control rung
      sm: "text-xs h-7",
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- navigation-rail row height, not a control rung
      lg: "text-sm h-12 group-data-[collapsible=icon]:p-0!",
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
 * `Sidebar.MenuSubButton` size axis — module-private. Each size takes the control size's
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
