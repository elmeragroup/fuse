import { cn } from "./cn";
import { tv } from "./tv";
import { stateFocusRingClass, stateFocusRingVisibleClass } from "./utils";

/**
 * GridList's recipe. Package-private — no entry re-exports it, and
 * the interim tier has no public recipe surface. It lives here rather than beside the
 * component because every RAC entry keeps its recipe in `src/styles/`
 *
 * The list root is invariant. Empty-state plugin variants from the reference are
 * rewritten as explicit `data-[empty]:`.
 */
export const gridListVariants = tv({
  slots: {
    base: "data-[empty]:text-sm relative overflow-auto data-[empty]:flex data-[empty]:items-center data-[empty]:justify-center",
  },
});

/**
 * Module-private item recipe. Composes
 * the resolved `state` focus-ring constants from `styles/utils` — RAC hands
 * `isFocusVisible` in as a render prop and this recipe turns it into a variant arm — so
 * `styles/utils` stays the only module that spells or resolves a focus class.
 *
 * A row reads the row metrics: at least `--row-h` tall, padded with `--row-px` and `--row-py`.
 * Its text and the gap between its cells stay fixed, so a row grows in height and padding only.
 */
export const itemStyles = tv({
  base: cn(
    "text-sm relative box-border flex min-h-(--row-h) cursor-default gap-3 border-t border-transparent px-(--row-px) py-(--row-py) -outline-offset-2 select-none first:rounded-t-lg first:border-t-0 last:mb-0 last:rounded-b-lg",
    stateFocusRingClass
  ),
  variants: {
    isFocusVisible: {
      true: stateFocusRingVisibleClass,
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
