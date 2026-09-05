import { tv } from "tailwind-variants";

/** Shared reset for docs chrome nav lists (SideNav and QuickNav). */
const docsNavList = tv({
  slots: {
    list: "m-0 list-none p-0",
  },
});

export { docsNavList };
