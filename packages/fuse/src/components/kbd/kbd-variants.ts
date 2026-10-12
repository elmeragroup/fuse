import { tv } from "../../styles/tv";

/**
 * Module-private recipe for the key cap and the key combination. One size at both densities:
 * a cap annotates a control and never sets its height, so it reads no density metric.
 *
 * - `cap` is one key. It rounds with the `sm` rung of its own, and its colours come from the
 *   muted role pair. An icon inside it takes the cap's text size. `box-border` keeps the
 *   20px cap a border-box one without preflight.
 * - `group` lays out the caps of one combination. It rounds with the cap's rung too and hands
 *   its corner on to its caps, so where an InputGroup addon rounds the group, a direct `>kbd`
 *   child, with its inner corner, the caps inside follow it.
 */
export const kbdVariants = tv({
  slots: {
    cap: "text-xs font-medium box-border inline-flex h-5 min-w-5 shrink-0 items-center justify-center gap-1 rounded-sm border border-border bg-muted px-1 font-sans text-muted-foreground tabular-nums select-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3",
    group:
      "inline-flex shrink-0 items-center gap-1 rounded-sm font-sans select-none *:data-[slot=kbd]:rounded-[inherit]",
  },
});
