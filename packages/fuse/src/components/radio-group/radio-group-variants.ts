import { tv } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { controlSize } from "../../styles/control-size";
import { dataStateFaceClass } from "../../styles/state-face";

/**
 * Module-private recipe. Size axis for `RadioIconButton`; default
 * `icon`. Not exported from `@elmeragroup/fuse/radio-group`.
 *
 * Each size is the control-size recipe's `square`, like Button's icon sizes. `icon-xxs` and
 * `icon-xs` share the `xs` square and differ only by glyph size, which stays local. Svg sizes apply only to
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
      "icon-xxs": controlSize({ size: "xs", fit: "square", class: "[&_svg:not([class*='size-'])]:size-3" }),
      "icon-xs": controlSize({
        size: "xs",
        fit: "square",
        class: "[&_svg:not([class*='size-'])]:size-3.5",
      }),
      "icon-sm": controlSize({ size: "sm", fit: "square", class: "[&_svg:not([class*='size-'])]:size-4" }),
      icon: controlSize({ size: "md", fit: "square", class: "[&_svg:not([class*='size-'])]:size-4" }),
      "icon-lg": controlSize({ size: "lg", fit: "square", class: "[&_svg:not([class*='size-'])]:size-5" }),
    },
  },
  defaultVariants: {
    size: "icon",
  },
});
