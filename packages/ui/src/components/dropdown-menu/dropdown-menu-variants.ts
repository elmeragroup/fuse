/**
 * Module-private slotted recipe. Not exported from the
 * public entry — Item/LinkItem/CheckboxItem/RadioItem/SubTrigger compose the
 * item slot; Content and SubContent take the popup-chrome extras. Geometry,
 * disabled face, and icon sizing come from `menuItemClass`; the highlight
 * face is this family's, because base-ui spells it `focus:` on menu items.
 */
import { tv } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { selfFocusRingClass } from "../../styles/utils";
import { menuItemClass } from "../overlay/overlay-classes";

export const dropdownMenuVariants = tv({
  slots: {
    item: cn(
      selfFocusRingClass,
      menuItemClass,
      // oxlint-disable-next-line elmera/no-local-focus-ring -- highlight face, not native outline; ring comes from the shared adapter
      "group/dropdown-menu-item px-2 focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-8 data-[variant=destructive]:text-error data-[variant=destructive]:focus:bg-error/10 data-[variant=destructive]:focus:text-error data-[variant=destructive]:*:[svg]:text-error"
    ),
    content:
      // oxlint-disable-next-line elmera/no-local-focus-ring -- popup chrome; items own the adapter
      "max-h-(--available-height) min-w-32 overflow-x-hidden overflow-y-auto p-1 outline-none data-closed:overflow-hidden",
    subContent: "shadow-lg w-auto min-w-[96px] p-1",
  },
});
