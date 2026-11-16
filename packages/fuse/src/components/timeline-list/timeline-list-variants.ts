/**
 * Module-private slotted recipe. The public entry does not export it, because no other
 * component borrows it.
 *
 * The geometry follows the reference design. Tokens replace its raw palette, with `bg-border`
 * for the connector and `bg-foreground` for the dot. The last item drops its bottom margin, and
 * the connector is `Item::before` on every item but the last.
 */
import { tv } from "../../styles/tv";

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
