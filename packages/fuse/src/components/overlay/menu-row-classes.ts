/**
 * Package-private menu-row classes shared by Select, Combobox and DropdownMenu. They read
 * row metrics, so they live apart from the overlay chrome in `overlay-classes.ts`.
 */

import { tv } from "../../styles/tv";

/**
 * Menu-row slots shared by Select, Combobox, Autocomplete, Command, DropdownMenu and the
 * DataTableFilter add menu. The normal highlight fill is not on `item`, because the families style
 * it on different states. Each family adds its own fill beside `item`. Select, Combobox and
 * Autocomplete list it after `item` in their recipe's slot array, DropdownMenu and Command pass it
 * to `cn` with `item`, and the DataTableFilter add menu adds its `row` slot. Select and
 * DropdownMenu style the normal fill on `:focus`. Combobox, Autocomplete, Command and the
 * DataTableFilter add menu style it on `data-highlighted`.
 *
 * The forced-colors fill of a highlighted row is defined here on `item`, for every family. Every
 * family that uses `item` marks its highlighted row with `data-highlighted`, so `item` puts the
 * forced-colors highlight, `forced-highlight`, on that attribute for an enabled row. Forced colors
 * drop the normal fill, so this fill is the highlighted row's cue there, under the pointer and the
 * keyboard alike. The DropdownMenu and DataTableFilter sub-triggers add `forced-highlight` on
 * `data-popup-open` themselves, so an enabled sub-trigger keeps the fill while its submenu is open.
 *
 * The keyboard focus outline follows `:focus-visible` on the row itself. Select and DropdownMenu
 * move focus to the row, so a row the arrow keys reach matches it, in a menu the pointer opened
 * too, and draws the `HighlightText` outline `forced-highlight` gives it inside the fill.
 * Combobox, Autocomplete, Command and the DataTableFilter add menu keep focus in their input, so
 * their rows show the fill only. In forced colors a focused row without the fill draws a 2px
 * `CanvasText` outline, 2px to 4px in from its edge. A Select option that loses
 * `data-highlighted` while the pointer rests on its scroll arrow is one such row.
 *
 * A highlighted disabled row takes no forced-colors fill, since its dim would fade the fill and
 * the outline inside it. In forced colors every disabled row drops the dim and sets its text and
 * its descendants in `GrayText`. A highlighted disabled row also draws the `CanvasText` outline at
 * full contrast, whether it holds focus or only `data-highlighted`. Base UI's Combobox highlights a
 * disabled row the arrow keys reach while focus stays in the input, so without the outline nothing
 * would mark that row.
 *
 * A row reads the row metrics. It is at least `--row-h` tall, pads with `--row-px` and `--row-py`,
 * and grows when its text wraps. A row with a trailing indicator adds `indicatorRoom`, and an
 * inset row or label adds `inset`, both the row inset plus a 16px indicator or icon and its 8px
 * gap. A row is an inner part, so it rounds with `rounded-inner`, from the `--inner-corner` its
 * family's padded popup part publishes.
 */
const overlayMenuVariants = tv({
  slots: {
    item: [
      // oxlint-disable-next-line elmera/no-local-focus-ring -- `outline-none` drops the UA outline and the forced-colors outline `outline-hidden` would draw on every row, since the highlighted row shows a fill there and a later entry outlines a focused row; the normal highlight face and ring stay with the consuming family
      "text-sm relative box-border flex min-h-(--row-h) cursor-default items-center gap-2 rounded-inner px-(--row-px) py-(--row-py) outline-none select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      // The forced-colors fill of an enabled highlighted row, under the pointer and the keyboard alike.
      "data-highlighted:not-data-disabled:forced-highlight",
      // The outline of a focused row in forced colors. On a row with the `forced-highlight` fill, the highlighted row or an open sub-trigger that has lost `data-highlighted`, the utility's `!important` `HighlightText` outline replaces it.
      "forced-colors:focus-visible:outline-2 forced-colors:focus-visible:-outline-offset-4 forced-colors:focus-visible:outline-[CanvasText] forced-colors:focus-visible:outline-solid",
      // The same outline on a highlighted disabled row, which takes no fill. Combobox, Autocomplete and Command keep focus in their input and highlight a disabled row the arrow keys reach, so the outline is the only mark of that row.
      "forced-colors:data-highlighted:data-disabled:outline-2 forced-colors:data-highlighted:data-disabled:-outline-offset-4 forced-colors:data-highlighted:data-disabled:outline-[CanvasText] forced-colors:data-highlighted:data-disabled:outline-solid",
      // The GrayText arms are important, since a focused row's `focus:text-*` and `focus:**:text-*` arms out-rank the `:where()` the data-disabled variant compiles to, and forced colors would turn their colors into CanvasText.
      // oxlint-disable-next-line fuse/state-face -- a menu row is an option part, not a control, so it keeps its own disabled dim and drops pointer events so the pointer never highlights a disabled row; forced colors set it and its descendants in GrayText at full opacity instead
      "data-disabled:pointer-events-none data-disabled:opacity-50 forced-colors:data-disabled:text-[GrayText]! forced-colors:data-disabled:opacity-100 forced-colors:data-disabled:**:text-[GrayText]!",
    ],
    /** The trailing check slot on a selectable option row, positioned once for all three menu families. */
    indicator: "pointer-events-none absolute right-(--row-px) flex items-center justify-center",
    /** The end padding of a row with a trailing indicator. */
    indicatorRoom: "pr-[calc(var(--row-px)+1.5rem)]",
    /** The start padding of an inset row or label, which lines its text up with rows that start with an icon. */
    inset: "data-inset:pl-[calc(var(--row-px)+1.5rem)]",
    /** The hairline rule between option groups, shared by Select, Combobox and DropdownMenu. */
    separator: "-mx-(--surface-pad-sm) my-1 h-px mark-fill-border",
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
/** The start padding of an inset menu row or label, aligned with rows that start with an icon. */
export const menuItemInsetClass = overlayMenuSlots.inset();
/** The hairline rule between menu groups. */
export const menuSeparatorClass = overlayMenuSlots.separator();
/** A menu group label, aligned with the rows' inline padding. */
export const menuGroupLabelClass = overlayMenuSlots.groupLabel();
