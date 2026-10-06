/**
 * PUBLIC recipe. Other package modules import this file
 * relatively; consumers borrow it from `@elmeragroup/fuse/button-group`.
 *
 * `orientation` is a layout axis, not a density control-box rung: it does not read `--control-*`. Nested groups pick up `gap-2`
 * through `has-[>[data-slot=button-group]]`; `[data-slot]` children join the
 * silhouette so inner radii and shared borders collapse. The group rounds both outer ends
 * with `rounded-md`, whatever its first and last children round with on their own, so a
 * field at one end, which rounds with `--radius-field`, matches a button at the other.
 */
import { tv } from "tailwind-variants";

export const buttonGroupVariants = tv({
  base: "group/button-group flex w-fit items-stretch *:focus-visible:relative *:focus-visible:z-10 has-[>[data-slot=button-group]]:gap-2 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
  variants: {
    orientation: {
      horizontal:
        "*:data-slot:rounded-r-none [&>[data-slot]:not(:has(~[data-slot]))]:rounded-r-md! [&>[data-slot]:not([data-slot]~[data-slot])]:rounded-l-md! [&>[data-slot]~[data-slot]]:rounded-l-none [&>[data-slot]~[data-slot]]:border-l-0",
      vertical:
        "flex-col *:data-slot:rounded-b-none [&>[data-slot]:not(:has(~[data-slot]))]:rounded-b-md! [&>[data-slot]:not([data-slot]~[data-slot])]:rounded-t-md! [&>[data-slot]~[data-slot]]:rounded-t-none [&>[data-slot]~[data-slot]]:border-t-0",
    },
  },
  defaultVariants: {
    orientation: "horizontal",
  },
});
