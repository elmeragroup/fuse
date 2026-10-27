import { listboxPopupShellClass } from "../../styles/inner-corner/listbox";
import { tv } from "../../styles/tv";
import { comboboxVariants } from "../combobox/combobox-variants";
import { menuItemClass } from "../overlay/menu-row-classes";
import { overlayTimedPopupClass } from "../overlay/overlay-classes";

const comboboxSlots = comboboxVariants();

/**
 * The module-private recipe for Autocomplete's input buttons and popup. It draws Combobox's look:
 * the caret, the trigger's icon size, the list, the group label and the separator are Combobox's
 * own slots. `content` and `item` compose the shared popup and row classes that Combobox's slots
 * compose, and `inputTrigger` repeats Combobox's rule for Autocomplete's clear button, so change
 * those three beside Combobox's.
 *
 * - `inputTrigger` is the caret button `Autocomplete.Input` renders with `showTrigger`. It hides
 *   while the group holds a clear button, and keeps no pressed fill while the popup is open.
 * - `content` is the shared timed popup on the listbox shell, as wide as its anchor. Base UI
 *   anchors it to the input's whole field box, so it lines up with the field's edges.
 * - `item` is the shared menu row, highlighted by Base UI's `data-highlighted`, which recolours
 *   its descendants. A suggestion is never selected, so the row keeps no room for a check.
 * - `empty` is a row for the empty list's states, such as loading, an error or no results. Base
 *   UI keeps it mounted as a live region and renders its children only while the list is empty,
 *   so it drops its padding while it has none.
 * - `status` is visually hidden, since the popup shows the list and its empty state.
 */
export const autocompleteVariants = tv({
  slots: {
    trigger: comboboxSlots.trigger(),
    inputTrigger: "group-has-data-[slot=autocomplete-clear]/input-group:hidden data-pressed:bg-transparent",
    caret: comboboxSlots.caret(),
    content: [
      overlayTimedPopupClass,
      listboxPopupShellClass,
      "relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) overflow-hidden",
    ],
    list: comboboxSlots.list(),
    item: [
      menuItemClass,
      "w-full data-highlighted:bg-accent data-highlighted:text-accent-foreground data-highlighted:**:text-accent-foreground",
    ],
    label: comboboxSlots.label(),
    separator: comboboxSlots.separator(),
    empty:
      "text-sm flex w-full items-center justify-center gap-2 px-(--row-px) py-(--row-py) text-center text-muted-foreground empty:p-0",
    status: "sr-only",
  },
});
