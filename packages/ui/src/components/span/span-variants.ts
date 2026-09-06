/**
 * PUBLIC recipe. Extends `textVariants` and only overrides the
 * `leading` default to `snug` for inline use. Type-scale, not a density
 * control-box rung.
 *
 * Internal composition imports `textVariants` from the Text recipe module —
 * not a grab-bag styles barrel. Consumers use `@elmeragroup/ui/span`.
 */
import { tv } from "tailwind-variants";

import { textVariants } from "../text/text-variants";

export const spanVariants = tv({
  extend: textVariants,
  // Keep an empty variants object so API extraction preserves the inherited text axes.
  variants: {},
  defaultVariants: {
    leading: "snug",
  },
});
