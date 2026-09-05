/**
 * PUBLIC recipe (tabs.md §4/§8.5). Consumers borrow it from `@elmeragroup/ui/tabs`.
 *
 * Horizontal list pins the `md` field-box rung (`h-(--control-h-md)`). Vertical stays
 * `h-fit`. `p-[3px]` is optical track padding, not `--control-px-*`. No `size` axis.
 */
import { tv } from "tailwind-variants";

export const tabsListVariants = tv({
  base: "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-(--control-h-md) group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  variants: {
    variant: {
      default: "bg-muted",
      line: "gap-1 bg-transparent",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});
