import { cn } from "../../styles/cn";
import { controlLabel } from "../../styles/control-size";
import { fieldBoxChromeClass } from "../../styles/field-box";
import { selectGroupShellClass, selectPopupShellClass } from "../../styles/inner-corner/select";
import { dataStateFaceClass, nativeStateFaceClass } from "../../styles/state-face";
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

/**
 * The module-private recipe for `Select.Trigger` and the value and caret it holds. It is not
 * exported from `@elmeragroup/fuse/select`, and the workspace-only recipe catalog re-exports it
 * for the Figma component sync.
 *
 * - `trigger` paints the field box chrome with the shared focus ring. The trigger is a native
 *   `<button>` that Base UI also marks `data-disabled` and `data-invalid`, so it takes the native
 *   and the data state faces. Its `size` axis takes the md control size's label at `"default"` and
 *   the sm one at `"sm"`. The trigger has never mapped icon children onto the icon edge, so its
 *   label omits that part. Its row hugs the value and the caret and spaces them to its ends on one
 *   line, mutes the text while `data-placeholder` marks the placeholder, lays out the value, and
 *   sizes an `<svg>` without a size class to 16px.
 * - `value` grows to fill the row and sets its text at the left.
 * - `caret` draws CaretDown at 16px in the muted color, and turns it half a turn while the trigger
 *   carries `data-popup-open`.
 */
export const selectTriggerVariants = tv({
  slots: {
    trigger: cn(selfFocusRingClass, fieldBoxChromeClass, nativeStateFaceClass, dataStateFaceClass),
    value: "flex flex-1 text-left",
    caret:
      "ease-in-out pointer-events-none size-4 text-muted-foreground transition-transform duration-200 group-data-[popup-open]/select-trigger:rotate-180",
  },
  variants: {
    size: {
      sm: { trigger: controlLabel("sm", { iconEdge: "omit" }) },
      default: { trigger: controlLabel("md", { iconEdge: "omit" }) },
    },
  },
  // The row, at every size, after the size's label, the order the trigger's classes have always
  // rendered in.
  compoundSlots: [
    {
      slots: ["trigger"],
      class:
        // oxlint-disable-next-line elmera/no-local-focus-ring -- native outline off; ring comes from the shared adapter
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
 * component sync. The scroll arrows keep their classes in `select.tsx`.
 *
 * - `content` is the shared timed popup on the Select shell, which pads nothing. It is as wide as
 *   the trigger and at least 144px, scrolls within the available height, and skips its entrance
 *   animation while it aligns the selected item with the trigger.
 * - `item` is the shared menu row with room for the trailing check, highlighted on `focus:`, which
 *   recolours its descendants. Its last span child, the indicator, lays out its glyph.
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
      "relative max-h-(--available-height) w-(--anchor-width) min-w-36 overflow-x-hidden overflow-y-auto data-[align-trigger=true]:animate-none",
    ],
    item: [
      menuItemClass,
      menuItemIndicatorRoomClass,
      "w-full focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
    ],
    itemText: "flex flex-1 shrink-0 gap-2 whitespace-nowrap",
    itemIndicator: [menuItemIndicatorClass, "size-4"],
    group: [selectGroupShellClass, "scroll-my-1"],
    label: menuGroupLabelClass,
    separator: [menuSeparatorClass, "pointer-events-none"],
  },
});
