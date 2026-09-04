/**
 * Module-private slotted recipe (timeline-list.md §4). Not exported from the
 * public entry — there is no proven recipe-borrowing use (§8.3).
 *
 * Geometry follows the references. Tokens replace the ref's raw palette:
 * connector `bg-border`, dot `bg-foreground` (§8.4). The final item drops
 * bottom margin; the connector is `Item::before` on every non-last item.
 */
import { tv } from "tailwind-variants";

export const timelineListVariants = tv({
  slots: {
    root: "m-0 list-none p-0",
    item: "relative mb-10 ml-6 pl-6 not-last:before:absolute not-last:before:top-8 not-last:before:left-[4px] not-last:before:h-full not-last:before:w-px not-last:before:bg-border last:mb-0",
    dot: "absolute top-2 left-0 flex size-[8.75px] rounded-full bg-foreground",
    title: "",
    time: "text-sm block text-foreground",
    description: "",
  },
});
