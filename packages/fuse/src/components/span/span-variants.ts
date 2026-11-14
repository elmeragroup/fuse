/**
 * PUBLIC recipe. Extends `textVariants` and changes only the `leading` default, to `snug`
 * for inline use. `size` is a type-scale axis, not a control size.
 *
 * Internal composition imports `textVariants` from the Text recipe module, not from a shared
 * styles barrel. Consumers use `@elmeragroup/fuse/span`.
 */
import { tv } from "../../styles/tv";
import { textVariants } from "../text/text-variants";

export const spanVariants = tv({
  extend: textVariants,
  // Keep an empty variants object so API extraction preserves the inherited text axes.
  variants: {},
  defaultVariants: {
    leading: "snug",
  },
});
