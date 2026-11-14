import { tv } from "../../styles/tv";

/**
 * The public slot recipe. Consumers who build their own pending state import it from
 * `@elmeragroup/fuse/loader`.
 *
 * - `variant` has one value, `default`, so a later value, such as muted or inverse, adds to the
 *   type instead of breaking it.
 * - `size` sets a decorative icon glyph, not a control, so the wrapper padding stays `p-4`.
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
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- decorative icon-glyph axis, not a control size
      medium: {
        icon: "size-6",
      },
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- decorative icon-glyph axis, not a control size
      large: {
        icon: "size-8",
      },
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- decorative icon-glyph axis, not a control size
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
