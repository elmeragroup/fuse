import type { VariantProps } from "tailwind-variants";
import { tv } from "tailwind-variants";

/**
 * The orientation recipe for the selection-group family. `group` lays out the group
 * primitive and `list` the private stacked-card list inside it. CheckboxGroup and
 * RadioGroup read `group`, and `SelectionItemGroup` reads `list`.
 *
 * The option-stack `gap-2` is layout, not a control rung, so it is a plain literal rather
 * than a `--control-gap-*` read. The vertical group drops that gap to `0` through
 * `has-[>[data-selection-item]]:gap-0` when its direct children are selection shells,
 * because shells draw connected edges and a gap would break the join. Plain `Checkbox`
 * and `Radio` rows keep the `gap-2` stack.
 *
 * Package-private: not exported from `package.json#exports` or the `SelectionItem`
 * namespace.
 */
export const selectionGroupOrientationVariants = tv({
  slots: {
    group: "",
    list: "",
  },
  variants: {
    orientation: {
      vertical: {
        group: "flex flex-col gap-2 has-[>[data-selection-item]]:gap-0",
        list: "gap-0",
      },
      horizontal: {
        group: "flex flex-wrap gap-4",
        list: "flex-row flex-wrap gap-4",
      },
    },
  },
  defaultVariants: {
    orientation: "vertical",
  },
});

export type SelectionItemGroupOrientation = NonNullable<
  VariantProps<typeof selectionGroupOrientationVariants>["orientation"]
>;
