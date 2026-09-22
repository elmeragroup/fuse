import type { VariantProps } from "tailwind-variants";
import { tv } from "tailwind-variants";

/**
 * The one orientation recipe for the selection-group family: `group` lays out the group primitive itself, `list` the private
 * stacked-card list inside it. CheckboxGroup and RadioGroup read `group`,
 * `SelectionItemGroup` reads `list`, and the three copies of these two strings that used
 * to sit in `checkbox.tsx`, `radio-group.tsx` and `selection-item.tsx` are gone
 *
 *
 * The option-stack `gap-2` is layout, not a control rung, which is why
 * it is a plain literal here and not a `--control-gap-*` read. The vertical group collapses
 * that gap to `0` via `has-[>[data-selection-item]]:gap-0` when its direct children are selection shells:
 * shells draw connected
 * edges, and a gap between connected edges was the bug this closes. Plain
 * `Checkbox`/`Radio` rows keep the `gap-2` stack.
 *
 * Package-private — not exported from `package.json#exports` or the `SelectionItem`
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
