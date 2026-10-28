import { fieldReads, fieldSize } from "../../styles/field-size";
import { fieldBoxShellClass } from "../../styles/inner-corner/field";
import {
  chipShellClass,
  chipsShellClass,
  listboxListShellClass,
  listboxPopupShellClass,
} from "../../styles/inner-corner/listbox";
import { withinStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import { withinFocusRingClass } from "../../styles/utils";
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
 * for the Figma component sync. The chips field takes {@link comboboxChipsVariants}.
 *
 * - `trigger` sizes an icon the consumer puts in `Combobox.Trigger` beside the caret to 16px.
 * - `inputTrigger` is the caret button `Combobox.Input` renders in its trailing addon. It hides
 *   while the group holds a clear button, and keeps no pressed fill while the popup is open.
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
    trigger: "[&_svg:not([class*='size-'])]:size-4",
    inputTrigger: "group-has-data-[slot=combobox-clear]/input-group:hidden data-pressed:bg-transparent",
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

/**
 * The module-private recipe for the chips field, `Combobox.Chips`, and the chips in it.
 *
 * - `chips` is the field box. It reads its min height, inset, type and gap from the field size it
 *   writes (`field-size.ts`), and counts its border in its height (`box-border`, as every field box
 *   chrome has) in a preflight-free host too. Its row gap keeps the remove buttons' 24px targets
 *   on wrapped rows apart. It writes `--chip-h`, the one chip height, which
 *   `chip` reads and the sm padding subtracts.
 * - `chip` is one chip, `--chip-h` tall.
 *
 * `size` is `"default"`, the md control size, or `"sm"`, the sm control size. The default box
 * keeps the row padding of its shell. An sm box is too short for that padding around a chip, so
 * it centres one row of chips in its height instead: the height less the chip and the 1px borders,
 * halved. The size's padding is an unprefixed utility after the shell's, so a consumer's `py-*`
 * replaces it through tailwind-merge.
 */
export const comboboxChipsVariants = tv({
  slots: {
    chips: [
      fieldReads.minHeight(),
      fieldReads.inset(),
      fieldReads.type(),
      fieldReads.gap(),
      // Between wrapped rows the gap is at least 24px less a chip, so the 24px targets of the
      // remove buttons on two rows never overlap, as the sm gap alone lets them under a 14px root.
      // A single row's height is unchanged.
      "gap-y-[max(var(--field-gap,var(--control-gap-md)),calc(24px-var(--chip-h)))]",
      "[--chip-h:calc(var(--spacing)*5.5)]",
      "shadow-xs box-border flex flex-wrap items-center border border-input bg-transparent bg-clip-padding transition-[color,box-shadow]",
      fieldBoxShellClass,
      chipsShellClass,
      withinFocusRingClass,
      withinStateFaceClass,
    ],
    // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- moved as-is from combobox.tsx, where the rule did not reach it; the chip's density role is `fixed`
    chip: [
      "text-xs font-medium flex h-(--chip-h) w-fit items-center justify-center gap-1 bg-muted px-1.5 whitespace-nowrap text-foreground",
      chipShellClass,
    ],
  },
  variants: {
    size: {
      default: { chips: fieldSize({ size: "default" }).box() },
      sm: { chips: [fieldSize({ size: "sm" }).box(), "py-[calc((var(--field-h)-var(--chip-h)-2px)/2)]"] },
    },
  },
  defaultVariants: {
    size: "default",
  },
});
