/**
 * PUBLIC recipe (button-group.md §4). Other package modules import this file
 * relatively; consumers borrow it from `@elmeragroup/ui/button-group`.
 *
 * `orientation` is a layout axis, not a density control-box rung (conventions.md
 * §Density metrics): it does not read `--control-*`. Nested groups pick up `gap-2`
 * through `has-[>[data-slot=button-group]]`; `[data-slot]` children join the
 * silhouette so inner radii and shared borders collapse.
 */
import { tv } from "tailwind-variants";

export const buttonGroupVariants = tv({
  base: "group/button-group flex w-fit items-stretch *:focus-visible:relative *:focus-visible:z-10 has-[>[data-slot=button-group]]:gap-2 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
  variants: {
    orientation: {
      horizontal:
        "*:data-slot:rounded-r-none [&>[data-slot]:not(:has(~[data-slot]))]:rounded-r-md! [&>[data-slot]~[data-slot]]:rounded-l-none [&>[data-slot]~[data-slot]]:border-l-0",
      vertical:
        "flex-col *:data-slot:rounded-b-none [&>[data-slot]:not(:has(~[data-slot]))]:rounded-b-md! [&>[data-slot]~[data-slot]]:rounded-t-none [&>[data-slot]~[data-slot]]:border-t-0",
    },
  },
  defaultVariants: {
    orientation: "horizontal",
  },
});
