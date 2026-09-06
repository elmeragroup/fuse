import { tv } from "tailwind-variants";

/**
 * Module-private recipe. Size axis for `RadioIconButton`; default
 * `icon`. Not exported from `@elmeragroup/ui/radio-group`.
 *
 * Sizes read `size-(--control-h-*)` like Button's icon sizes. `icon-xxs` and `icon-xs`
 * share the `xs` height and differ only by glyph size. Svg sizes apply only to
 * `svg:not([class*='size-'])`.
 */
export const radioIconButtonVariants = tv({
  // oxlint-disable-next-line elmera/no-local-focus-ring -- native outline off; ring comes from the shared adapter
  base: "ease-out inline-flex shrink-0 items-center justify-center rounded-lg border border-input bg-card text-foreground transition-[color,background-color,box-shadow,scale] duration-150 outline-none hover:bg-muted active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 data-invalid:border-error data-checked:border-primary data-checked:bg-muted",
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
