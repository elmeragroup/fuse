import { cn } from "../../styles/cn";
import { menuPopupShellClass } from "../../styles/inner-corner/menu";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";
import { menuGroupLabelClass, menuItemClass, menuItemInsetClass } from "../overlay/menu-row-classes";
import { overlayPositionerClass, overlayTimedPopupClass } from "../overlay/overlay-classes";

const itemClass = cn(
  selfFocusRingClass,
  menuItemClass,
  menuItemInsetClass,
  "group/dropdown-menu-item focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-[variant=destructive]:text-error data-[variant=destructive]:focus:bg-error/10 data-[variant=destructive]:focus:text-error data-[variant=destructive]:*:[svg]:text-error"
);

/**
 * The module-private recipe for the menu's parts. It is not exported from
 * `@elmeragroup/fuse/dropdown-menu`, and the workspace-only recipe catalog re-exports it for the
 * Figma component sync. Geometry, the disabled face and icon sizing come from `menuItemClass`; the
 * highlight face is this family's, because Base UI spells it `focus:` on menu items.
 *
 * - `positioner` is the shared positioner, which never shows an outline.
 * - `content` and `subContent` are the shared timed popup on the menu shell, which rounds, pads and
 *   publishes `--inner-corner`. A submenu raises its shadow and is at least 96px wide.
 * - `item` is the row Item, LinkItem, CheckboxItem and RadioItem render, with the destructive tone.
 * - `subTrigger` is the row, which keeps the highlight while its submenu is open.
 * - `subTriggerCaret` pushes CaretRight to the row's end.
 * - `label` is the shared group label, inset with the rows, at Medium weight.
 * - `shortcut` sets its keys at 12px with wide tracking at the row's end, muted until the row
 *   takes focus.
 */
export const dropdownMenuVariants = tv({
  slots: {
    // oxlint-disable-next-line elmera/no-local-focus-ring -- positioner is not a focus target
    positioner: [overlayPositionerClass, "outline-none"],
    content: [
      overlayTimedPopupClass,
      menuPopupShellClass,
      // oxlint-disable-next-line elmera/no-local-focus-ring -- popup chrome; items own the adapter
      "max-h-(--available-height) min-w-32 overflow-x-hidden overflow-y-auto outline-none data-closed:overflow-hidden",
    ],
    subContent: [overlayTimedPopupClass, menuPopupShellClass, "shadow-lg w-auto min-w-[96px]"],
    item: itemClass,
    subTrigger: [
      itemClass,
      "data-popup-open:bg-accent data-popup-open:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground",
    ],
    subTriggerCaret: "ml-auto",
    label: [menuGroupLabelClass, menuItemInsetClass, "font-medium"],
    shortcut:
      "text-xs tracking-widest ml-auto text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground",
  },
});
