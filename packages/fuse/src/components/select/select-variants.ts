import { tv } from "tailwind-variants";

import { controlLabel } from "../../styles/control-size";

/**
 * `Select.Trigger` size axis — module-private, never a facade export. `"default"` is the md
 * control size's label and `"sm"` the sm one. The trigger has never mapped icon children
 * onto the icon edge, so its label omits that part.
 */
export const selectTriggerSize = tv({
  variants: {
    size: {
      sm: controlLabel("sm", { iconEdge: "omit" }),
      default: controlLabel("md", { iconEdge: "omit" }),
    },
  },
  defaultVariants: {
    size: "default",
  },
});
