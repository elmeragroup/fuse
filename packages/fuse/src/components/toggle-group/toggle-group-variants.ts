import { tv } from "tailwind-variants";

import { controlMetrics } from "../../styles/control-size";

/**
 * A segmented `ToggleGroup.Item`'s inset at each toggle size — module-private, never a
 * facade export. Each size takes the control size's icon inset on both sides in place of
 * the label inset, so the joined segments sit tighter than free-standing toggles.
 * `"default"` is the md control size.
 */
export const segmentedItemInset = tv({
  variants: {
    size: {
      xs: controlMetrics({ size: "xs" }).iconInset(),
      sm: controlMetrics({ size: "sm" }).iconInset(),
      default: controlMetrics({ size: "md" }).iconInset(),
      lg: controlMetrics({ size: "lg" }).iconInset(),
    },
  },
  defaultVariants: {
    size: "default",
  },
});
