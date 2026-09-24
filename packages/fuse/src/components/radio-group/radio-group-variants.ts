import { tv } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { dataStateFaceClass } from "../../styles/state-face";

/**
 * Module-private recipe. Size axis for `RadioIconButton`; default
 * `icon`. Not exported from `@elmeragroup/fuse/radio-group`.
 *
 * Sizes read `size-(--control-h-*)` like Button's icon sizes. `icon-xxs` and `icon-xs`
 * share the `xs` height and differ only by glyph size. Svg sizes apply only to
 * `svg:not([class*='size-'])`. The radio root is a <span>, which never matches `:disabled`,
 * so the state face keys off Base UI's `data-disabled` and `data-invalid` attributes, plus a
 * consumer's `aria-invalid`. Hover and press sit behind the `enabled-*` gate, so a disabled
 * button neither repaints nor scales under the pointer.
 */
export const radioIconButtonVariants = tv({
  base: cn(
    // oxlint-disable-next-line elmera/no-local-focus-ring -- native outline off; ring comes from the shared adapter
    "ease-out inline-flex shrink-0 items-center justify-center rounded-lg border border-input bg-card text-foreground transition-[color,background-color,box-shadow,scale] duration-150 outline-none data-checked:border-primary data-checked:bg-muted enabled-hover:bg-muted enabled-active:scale-[0.96]",
    dataStateFaceClass
  ),
  variants: {
    size: {
      "icon-xxs": "size-(--control-h-xs) [&_svg:not([class*='size-'])]:size-3",
      "icon-xs": "size-(--control-h-xs) [&_svg:not([class*='size-'])]:size-3.5",
      "icon-sm": "size-(--control-h-sm) [&_svg:not([class*='size-'])]:size-4",
      icon: "size-(--control-h-md) [&_svg:not([class*='size-'])]:size-4",
      "icon-lg": "size-(--control-h-lg) [&_svg:not([class*='size-'])]:size-5",
    },
  },
  defaultVariants: {
    size: "icon",
  },
});
