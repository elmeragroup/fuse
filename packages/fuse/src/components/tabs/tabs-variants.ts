import { tabsListShellClass } from "../../styles/inner-corner/tabs";
/**
 * The public recipe, exported from `@elmeragroup/fuse/tabs`.
 *
 * A horizontal list takes the `md` control height (`h-(--control-h-md)`). A vertical one stays
 * `h-fit`. The list's 4px track padding, which leaves room for a trigger's focus ring, and
 * its corner come from its inner-corner shell, which publishes the corner its triggers
 * round with. It is not `--control-px-*`. The recipe has no `size` axis.
 */
import { tv } from "../../styles/tv";

export const tabsListVariants = tv({
  base: [
    tabsListShellClass,
    "group/tabs-list inline-flex w-fit items-center justify-center text-muted-foreground group-data-horizontal/tabs:h-(--control-h-md) group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  ],
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
