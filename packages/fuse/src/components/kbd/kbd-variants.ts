import { tv } from "../../styles/tv";

/**
 * The module-private recipe for the key cap and the key combination. The recipe has one size
 * at both densities. A cap annotates a control and never sets its height, so it reads no
 * density metric.
 *
 * - `cap` is one key. It rounds with its own `sm` rung, and its colours come from the muted role
 *   pair. An icon inside it takes the cap's text size. `box-border` keeps the 20px cap
 *   border-box sized without preflight.
 * - `group` lays out the caps of one combination. It also rounds with the cap's rung, and its
 *   caps inherit its corner. An InputGroup addon rounds a direct `>kbd` child with its inner
 *   corner, so when the group is that child, the caps inside follow the addon's corner.
 */
export const kbdVariants = tv({
  slots: {
    cap: "text-xs font-medium box-border inline-flex h-5 min-w-5 shrink-0 items-center justify-center gap-1 rounded-sm border border-border bg-muted px-1 font-sans text-muted-foreground tabular-nums select-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3",
    group:
      "inline-flex shrink-0 items-center gap-1 rounded-sm font-sans select-none *:data-[slot=kbd]:rounded-[inherit]",
  },
});
