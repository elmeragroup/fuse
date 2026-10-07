import { tabsListShellClass } from "../../styles/inner-corner/tabs";
/**
 * PUBLIC recipe. Consumers borrow it from `@elmeragroup/fuse/tabs`.
 *
 * Horizontal list pins the `md` control size (`h-(--control-h-md)`). Vertical stays
 * `h-fit`. The list's 4px track padding, which leaves room for a trigger's focus ring, and
 * its corner come from its inner-corner shell, which publishes the corner its triggers
 * round with. It is not `--control-px-*`. No `size` axis.
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
