import { tv } from "tailwind-variants";

/**
 * PUBLIC slot recipe (loader.md §4). Consumers composing their own pending
 * states borrow it from `@elmeragroup/ui/loader`.
 *
 * - `variant` is intentionally single-valued (`default`) so future arms
 *   (muted/inverse) are additive, not breaking (loader.md §8.4).
 * - `size` is a decorative icon-glyph axis, not a density rung
 *   (conventions.md §Density metrics): wrapper padding stays `p-4`.
 */
export const loaderVariants = tv({
  slots: {
    base: "flex items-center justify-center p-4",
    icon: "animate-spin",
  },
  variants: {
    variant: {
      default: {
        base: "text-foreground",
      },
    },
    size: {
      default: {
        icon: "size-4",
      },
      small: {
        icon: "size-3",
      },
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- loader.md §4 decorative icon-glyph axis, not a control-box rung
      medium: {
        icon: "size-6",
      },
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- loader.md §4 decorative icon-glyph axis, not a control-box rung
      large: {
        icon: "size-8",
      },
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- loader.md §4 decorative icon-glyph axis, not a control-box rung
      xl: {
        icon: "size-10",
      },
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});
