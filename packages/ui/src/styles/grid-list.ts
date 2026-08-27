import { tv } from "tailwind-variants";

import { cn } from "./cn";
import { focusRing } from "./utils";

/**
 * GridList's recipe (grid-list.md §4). Package-private — no entry re-exports it, and
 * the interim tier has no public recipe surface. It lives here rather than beside the
 * component because every RAC entry keeps its recipe in `src/styles/`
 * (range-calendar.md §8.2's locked ruling).
 *
 * The list root is invariant. Empty-state plugin variants from the reference are
 * rewritten as explicit `data-[empty]:` (grid-list.md §8.5).
 */
export const gridListVariants = tv({
  slots: {
    base: "data-[empty]:text-sm relative overflow-auto data-[empty]:flex data-[empty]:items-center data-[empty]:justify-center",
  },
});

/**
 * Module-private item recipe (grid-list.md §4). Composes
 * `focusRing({ target: "state", isFocusVisible })` from RAC's render props so
 * `styles/utils` stays the only module that spells a focus class.
 *
 * Row padding and gap are not a control-box rung (conventions.md §Density ladder),
 * so they stay the reference's literals and read no `--control-*` variable.
 */
export const itemStyles = tv({
  base: cn(
    "text-sm relative flex cursor-default gap-3 border-t border-transparent px-1.5 py-1 -outline-offset-2 select-none first:rounded-t-lg first:border-t-0 last:mb-0 last:rounded-b-lg",
    focusRing({ target: "state" }).root()
  ),
  variants: {
    isFocusVisible: {
      true: focusRing({ target: "state", isFocusVisible: true }).root(),
      false: "",
    },
    isSelected: {
      false: "hover:bg-muted",
      true: "z-20 border bg-muted hover:bg-muted/80",
    },
    isDisabled: {
      true: "z-10 text-muted-foreground forced-colors:text-[GrayText]",
    },
  },
});
