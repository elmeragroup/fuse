import { listboxListShellClass, listboxPopupShellClass } from "../../styles/inner-corner/listbox";
import { tv } from "../../styles/tv";
import {
  menuGroupLabelClass,
  menuItemClass,
  menuItemIndicatorClass,
  menuItemIndicatorRoomClass,
  menuSeparatorClass,
} from "../overlay/menu-row-classes";
import { overlayTimedPopupClass } from "../overlay/overlay-classes";

/**
 * The module-private recipe for the Combobox caret and the parts of its open popup. It is not
 * exported from `@elmeragroup/fuse/combobox`, and the workspace-only recipe catalog re-exports it
 * for the Figma component sync. The chips field keeps its classes in `combobox.tsx`.
 *
 * - `caret` draws CaretDown at 16px in the muted color, and turns it half a turn while the popup
 *   is open.
 * - `content` is the shared timed popup on the listbox shell. It is at least the anchor's width
 *   plus 28px, or the anchor's width against an external anchor. A search group the popup
 *   directly owns takes its own 4px inline margin and a width that fits inside it, which
 *   overrides the group's `w-full` (the phone field's), and the popup pads only above it. The
 *   popup pads nothing on the inline axis, so the List's own padding is the one inset its
 *   `--inner-corner` assumes.
 * - `list` is the listbox list shell, which pads the rows and publishes their corner, scrolling
 *   below 252px or the available height less 36px.
 * - `item` is the shared menu row with room for the trailing check, highlighted by Base UI's
 *   `data-highlighted`, which recolours its descendants.
 * - `itemIndicator` is the shared trailing check slot at 16px.
 * - `label` is the shared group label and `separator` the shared hairline.
 * - `empty` is a row: the row inset pads it, and its text stays fixed. It shows while the popup
 *   carries `data-empty`.
 */
export const comboboxVariants = tv({
  slots: {
    caret:
      "ease-in-out pointer-events-none size-4 text-muted-foreground transition-transform duration-200 in-data-popup-open:rotate-180",
    content: [
      overlayTimedPopupClass,
      listboxPopupShellClass,
      "group/combobox-content relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] overflow-hidden has-[>[data-slot=input-group]]:pt-1.5 data-[external-anchor=true]:min-w-(--anchor-width) *:data-[slot=input-group]:mx-1 *:data-[slot=input-group]:h-(--control-h-sm) *:data-[slot=input-group]:w-[calc(100%---spacing(2))] *:data-[slot=input-group]:border-input/30 *:data-[slot=input-group]:bg-input/30 *:data-[slot=input-group]:shadow-none",
    ],
    list: [
      listboxListShellClass,
      "no-scrollbar max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] scroll-py-1 overflow-y-auto overscroll-contain",
    ],
    item: [
      menuItemClass,
      menuItemIndicatorRoomClass,
      "w-full data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:**:text-accent-foreground",
    ],
    itemIndicator: [menuItemIndicatorClass, "size-4"],
    label: menuGroupLabelClass,
    separator: menuSeparatorClass,
    empty:
      "text-sm hidden w-full justify-center px-(--row-px) py-(--row-py) text-center text-muted-foreground group-data-empty/combobox-content:flex",
  },
});
