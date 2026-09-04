import { tv } from "tailwind-variants";

const docsNavList = tv({
  slots: {
    list: "m-0 list-none p-0",
  },
});

/** Shared reset for docs chrome nav lists (SideNav and QuickNav). */
export const docsNavListSlots = docsNavList();
