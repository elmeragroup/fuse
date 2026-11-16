import type { VariantProps } from "tailwind-variants";

import { tv } from "../../styles/tv";

/**
 * The orientation recipe for the selection-group family. `group` lays out the group
 * primitive and `list` the private stacked-card list inside it. CheckboxGroup and
 * RadioGroup read `group`, and `SelectionItemGroup` reads `list`.
 *
 * The surface gaps space a group's options: a vertical stack by
 * `--surface-gap-sm`, and options in a line by `--surface-gap-lg`. The vertical group drops
 * that gap to `0` through `has-[>[data-selection-item]]:gap-0` when its direct children are
 * selection shells, because shells draw connected edges and a gap would break the join. Plain
 * `Checkbox` and `Radio` rows keep the stack gap.
 *
 * It is package-private. Neither `package.json#exports` nor the `SelectionItem` namespace
 * exports it.
 */
export const selectionGroupOrientationVariants = tv({
  slots: {
    group: "",
    list: "",
  },
  variants: {
    orientation: {
      vertical: {
        group: "flex flex-col gap-(--surface-gap-sm) has-[>[data-selection-item]]:gap-0",
        list: "gap-0",
      },
      horizontal: {
        group: "flex flex-wrap gap-(--surface-gap-lg)",
        list: "flex-row flex-wrap gap-(--surface-gap-lg)",
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
