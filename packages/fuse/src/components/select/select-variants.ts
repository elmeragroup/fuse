import { cn } from "../../styles/cn";
import { controlLabel } from "../../styles/control-size";
import { dataReadOnlyFillClass, fieldBoxChromeClass } from "../../styles/field-box";
import { selectGroupShellClass, selectPopupShellClass } from "../../styles/inner-corner/select";
import { dataStateFaceClass, nativeStateFaceClass } from "../../styles/state-face";
import { triggerCaretClass } from "../../styles/trigger-caret";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";
import {
  menuGroupLabelClass,
  menuItemClass,
  menuItemIndicatorClass,
  menuItemIndicatorRoomClass,
  menuSeparatorClass,
} from "../overlay/menu-row-classes";
import { overlayTimedPopupClass } from "../overlay/overlay-classes";

const selectScrollArrowClass = cn(
  "z-10 flex h-6 w-full cursor-default items-center justify-center bg-popover [--surface-muted-foreground:inherit] [--surface:inherit] [&_svg:not([class*='size-'])]:size-4"
);

/**
 * The module-private recipe for `Select.Trigger` and the value and caret it holds. It is not
 * exported from `@elmeragroup/fuse/select`, and the workspace-only recipe catalog re-exports it
 * for the Figma component sync.
 *
 * - `trigger` paints the field box chrome with the shared focus ring. The trigger is a native
 *   `<button>` that Base UI also marks `data-disabled` and `data-invalid`, so it takes the native
 *   and the data state faces. While the Select is read-only, Base UI marks the trigger
 *   `data-readonly`, and it takes the muted read-only fill the other field boxes take, unless it
 *   is also disabled. Its `size` axis takes the md control size's label at `"default"` and
 *   the sm one at `"sm"`. The trigger has never mapped icon children onto the icon edge, so its
 *   label omits that part. Its row hugs the value and the caret and spaces them to its ends on one
 *   line, mutes the text while `data-placeholder` marks the placeholder, lays out the value, and
 *   sizes an `<svg>` without a size class to 16px.
 * - `value` grows to fill the row and sets its text at the left.
 * - `caret` draws CaretDown as the shared trigger caret (`triggerCaretClass`), and turns it half a
 *   turn while the trigger carries `data-popup-open`.
 */
export const selectTriggerVariants = tv({
  slots: {
    trigger: cn(
      selfFocusRingClass,
      fieldBoxChromeClass,
      dataReadOnlyFillClass,
      nativeStateFaceClass,
      dataStateFaceClass
    ),
    value: "flex flex-1 text-left",
    caret: [triggerCaretClass, "group-data-[popup-open]/select-trigger:rotate-180"],
  },
  variants: {
    size: {
      sm: { trigger: controlLabel("sm", { iconEdge: "omit" }) },
      default: { trigger: controlLabel("md", { iconEdge: "omit" }) },
    },
  },
  // The trigger's row classes apply at every size and come after the size's label classes.
  compoundSlots: [
    {
      slots: ["trigger"],
      class:
        // oxlint-disable-next-line elmera/no-local-focus-ring -- the shared adapter draws the ring instead
        "group/select-trigger flex w-fit items-center justify-between whitespace-nowrap outline-none select-none data-placeholder:text-muted-foreground *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    },
  ],
  defaultVariants: {
    size: "default",
  },
});

/**
 * The module-private recipe for the parts of the open Select. It is not exported from
 * `@elmeragroup/fuse/select`, and the workspace-only recipe catalog re-exports it for the Figma
 * component sync.
 *
 * - `content` is the shared timed popup on the Select shell, which pads nothing. It is as wide as
 *   the trigger and at least 144px, stops at the available height and clips, and skips its
 *   entrance animation while it aligns the selected item with the trigger. Its column lets the list
 *   shrink to that height.
 * - `list` is Base UI's `Select.List`, which scrolls at the popup's height. Base UI reads its
 *   overflow to show the scroll arrows. Its 24px scroll padding is the arrow's height, so a row that
 *   comes into view by keyboard stays clear of the arrow over that end.
 * - `scrollUpArrow` and `scrollDownArrow` are the public scroll arrows, 24px tall, which center
 *   their 16px glyph. Base UI writes `position: absolute` inline on them, so they lie over the top
 *   and bottom edges of the popup they are composed in.
 * - `listScrollUpArrow` and `listScrollDownArrow` place the arrows `Select.Content` renders inside
 *   its list, so a wheel gesture over one still scrolls the list. `sticky!` overrides the inline
 *   position, so they stick over the top and bottom edges of the visible list. A negative margin
 *   as tall as the arrow keeps each one out of the list's scroll height.
 * - `item` is the shared menu row with room for the trailing check, highlighted on `focus:`, which
 *   recolors its descendants. Its last span child, the indicator, lays out its glyph.
 * - `itemText` fills the row on one line.
 * - `itemIndicator` is the shared trailing check slot at 16px.
 * - `group` is the Select group shell, which pads its rows, and keeps a 4px scroll margin.
 * - `label` is the shared group label.
 * - `separator` is the shared hairline, which ignores the pointer.
 */
export const selectContentVariants = tv({
  slots: {
    content: [
      overlayTimedPopupClass,
      selectPopupShellClass,
      "relative flex max-h-(--available-height) w-(--anchor-width) min-w-36 flex-col overflow-hidden data-[align-trigger=true]:transition-none",
    ],
    list: "min-h-0 scroll-py-6 overflow-x-hidden overflow-y-auto",
    scrollUpArrow: [selectScrollArrowClass, "top-0"],
    scrollDownArrow: [selectScrollArrowClass, "bottom-0"],
    listScrollUpArrow: "sticky! -mb-6",
    listScrollDownArrow: "sticky! -mt-6",
    item: [
      menuItemClass,
      menuItemIndicatorRoomClass,
      // oxlint-disable-next-line fuse/forced-state-arm -- Base UI sets `data-highlighted` on the focused row, where `menuItemClass` gives an enabled row its `forced-highlight`; a focused row that loses it to the scroll arrow, and a highlighted disabled row, draw its CanvasText outline.
      "w-full focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
    ],
    itemText: "flex flex-1 shrink-0 gap-2 whitespace-nowrap",
    itemIndicator: [menuItemIndicatorClass, "size-4"],
    group: [selectGroupShellClass, "scroll-my-1"],
    label: menuGroupLabelClass,
    separator: [menuSeparatorClass, "pointer-events-none"],
  },
});
