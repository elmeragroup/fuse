/**
 * Package-private menu-row classes shared by Select, Combobox and DropdownMenu. They read
 * row metrics, so they live apart from the overlay chrome in `overlay-classes.ts`.
 */

import { tv } from "../../styles/tv";

/**
 * Menu-row slots shared by Select, Combobox, and DropdownMenu. The *highlight* face is
 * deliberately not on `item`: base-ui publishes it as `focus:` on menu items and
 * `data-highlighted:` on listbox options, so each family passes its own as the extra
 * `cn` argument. A row reads the row metrics: it is at least `--row-h` tall and pads with
 * `--row-px` and `--row-py`, and a multi-line row grows. A row with a trailing indicator adds
 * `indicatorRoom`, and an inset row or label adds `inset`, both the row inset plus the 16px
 * indicator and its 8px gap. A row is an inner part: it rounds with `rounded-inner`, from the
 * `--inner-corner` its family's padded popup part publishes.
 */
const overlayMenuVariants = tv({
  slots: {
    item:
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics, elmera/no-local-focus-ring -- the 8px icon gap is row layout, not a control rung; `outline-hidden` only clears the UA outline; this constant carries no highlight face and no ring, both of which stay with the consuming family
      "text-sm relative box-border flex min-h-(--row-h) cursor-default items-center gap-2 rounded-inner px-(--row-px) py-(--row-py) outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    /** The trailing check slot on a selectable option row, positioned once for all three menu families. */
    indicator: "pointer-events-none absolute right-(--row-px) flex items-center justify-center",
    /** The end padding of a row with a trailing indicator. */
    indicatorRoom: "pr-[calc(var(--row-px)+1.5rem)]",
    /** The start padding of an inset row or label, which lines its text up with indicator rows. */
    inset: "data-inset:pl-[calc(var(--row-px)+1.5rem)]",
    /** The hairline rule between option groups, shared by Select, Combobox, and DropdownMenu. */
    separator: "-mx-(--surface-pad-sm) my-1 h-px bg-border",
    groupLabel: "text-xs px-(--row-px) py-1.5 text-muted-foreground",
  },
});

const overlayMenuSlots = overlayMenuVariants();

/** A menu row: its control box, inner corner, disabled face and icon sizing. */
export const menuItemClass = overlayMenuSlots.item();
/** The trailing check slot of a selectable menu row. */
export const menuItemIndicatorClass = overlayMenuSlots.indicator();
/** The end padding of a menu row with a trailing indicator. */
export const menuItemIndicatorRoomClass = overlayMenuSlots.indicatorRoom();
/** The start padding of an inset menu row or label, aligned with indicator rows. */
export const menuItemInsetClass = overlayMenuSlots.inset();
/** The hairline rule between menu groups. */
export const menuSeparatorClass = overlayMenuSlots.separator();
/** A menu group label, aligned with the rows' inline padding. */
export const menuGroupLabelClass = overlayMenuSlots.groupLabel();
