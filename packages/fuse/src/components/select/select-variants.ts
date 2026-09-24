import { tv } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { controlMetrics } from "../../styles/control-size";

/**
 * A trigger's label box at one control size: height, gap, inset and type. The trigger has
 * never mapped icon children onto the icon edge, so it leaves that part out.
 */
function triggerBox(size: "sm" | "md"): string {
  const parts = controlMetrics({ size });
  return cn(parts.height(), parts.gap(), parts.inset(), parts.type());
}

/**
 * `Select.Trigger` size axis — module-private, never a facade export. `"default"` is the md
 * control size and `"sm"` the sm one.
 */
export const selectTriggerSize = tv({
  variants: {
    size: {
      sm: triggerBox("sm"),
      default: triggerBox("md"),
    },
  },
  defaultVariants: {
    size: "default",
  },
});
