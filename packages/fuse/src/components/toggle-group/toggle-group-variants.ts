import { controlMetrics } from "../../styles/control-size";
import { tv } from "../../styles/tv";

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

/**
 * The module-private recipe for the ToggleGroup root and the group's own classes on each item. It
 * is not exported from `@elmeragroup/fuse/toggle-group`, and the workspace-only recipe catalog
 * re-exports it for the Figma component sync. An item adds `toggleVariants` after its slot, and
 * {@link segmentedItemInset} after that in a segmented group.
 *
 * - `root` lays the items out in a row, or a stretched column when vertical, `--gap` spacing units
 *   apart. The root writes `--gap` from `spacing` in its inline style. At spacing 0 the outline
 *   variant's shadow moves from the items to the root.
 * - `item` keeps its size in the row and raises a focused item over its neighbours. At spacing 0
 *   it joins the segmented control: the items square off their inner corners, round the outer
 *   ones, drop their own shadow and press scale, and outline items share one border between
 *   neighbours.
 */
export const toggleGroupVariants = tv({
  slots: {
    root: "group/toggle-group data-[spacing=0]:data-[variant=outline]:shadow-xs flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-md data-vertical:flex-col data-vertical:items-stretch",
    item: "shrink-0 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:shadow-none focus:z-10 focus-visible:z-10 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-md group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-md group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-md group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-md group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t group-data-[spacing=0]/toggle-group:enabled-active:scale-100",
  },
});
