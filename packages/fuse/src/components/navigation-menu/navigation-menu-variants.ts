import { cn } from "../../styles/cn";
import { controlMd } from "../../styles/control-size-md";
import {
  navigationContentShellClass,
  navigationInlineViewportShellClass,
  navigationPopupShellClass,
} from "../../styles/inner-corner/navigation";
import { nativeStateFaceClass } from "../../styles/state-face";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";
import { overlayPopupSurfaceClass, overlayPositionerClass } from "../overlay/overlay-classes";

/**
 * The box and type of a row in a content panel's list: a link outside a bar, or a trigger in
 * a vertical Root. Both slots take it, so a nested trigger cannot drift from the links beside it.
 * It reads the row metrics, as menu rows do: at least `--row-h` tall, padded with `--row-px` and
 * `--row-py`. A multi-line row grows. A row in the popup is an inner part and rounds with
 * `rounded-inner`. A row outside it, in a vertical Root or an inline Root on the page, keeps the
 * outer `rounded-sm`. Both corners weigh nothing, so a consumer's `rounded-*` class wins.
 */
// oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- the 8px icon gap is row layout, not a control rung
const contentRowClass = cn(
  "text-sm box-border min-h-(--row-h) gap-2 px-(--row-px) py-(--row-py) [:where(&)]:rounded-sm in-data-[slot=navigation-menu-popup]:[:where(&)]:rounded-inner"
);

/**
 * The box and type of a bar trigger and of a link directly in a horizontal List. It is the md
 * control rung, so a bar that mixes links and triggers lines up with other controls.
 */
const barBoxClass = cn(
  controlMd.height(),
  controlMd.minHeight(),
  controlMd.gap(),
  controlMd.inset(),
  controlMd.type(),
  "font-medium rounded-md"
);

/**
 * NavigationMenu's part classes, one slot per rendered part.
 *
 * The popup animates its size and position through transitions on the `--popup-*` and
 * `--positioner-*` variables Base UI writes, not through the `data-open` keyframes the
 * timed anchored popups use, so it takes the shared surface without the shared motion.
 *
 * Base UI measures the popup inside the positioner, which caps it at the available width.
 * The popup and the content also cap at the available height and width, so a panel larger
 * than the space under the trigger scrolls inside the content instead of being clipped by
 * the viewport.
 *
 * Only Root and List write `data-orientation`; the trigger's `orientation` axis and the link's
 * `box` axis come from their parts.
 *
 * The central reduced-motion rule keeps only opacity and colour transitions, which turns
 * the resize, the slide and the caret rotation off together.
 */
export const navigationMenuVariants = tv({
  slots: {
    root: "relative flex max-w-max flex-1 items-center justify-center data-[orientation=vertical]:max-w-none data-[orientation=vertical]:items-stretch",
    // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- the gap between triggers is bar layout, not a control rung
    list: "m-0 flex flex-1 list-none items-center justify-center gap-1 p-0 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
    item: "relative",
    trigger: [
      selfFocusRingClass,
      nativeStateFaceClass,
      // oxlint-disable-next-line elmera/no-local-focus-ring -- native outline off; the ring comes from the shared adapter
      "group/navigation-menu-trigger relative inline-flex cursor-pointer items-center border-0 bg-transparent text-inherit outline-none select-none",
    ],
    // The caret writes its Root's popup `data-side` and points there: physical sides stay put
    // in RTL and logical sides flip. Only a `bottom` caret turns while open.
    triggerIcon: [
      "ease-in-out pointer-events-none size-4 shrink-0 text-muted-foreground transition-transform duration-200",
      "data-[side=bottom]:group-data-popup-open/navigation-menu-trigger:rotate-180 data-[side=left]:rotate-90 data-[side=right]:-rotate-90 data-[side=top]:rotate-180",
      "data-[side=inline-end]:ltr:-rotate-90 data-[side=inline-start]:ltr:rotate-90 data-[side=inline-end]:rtl:rotate-90 data-[side=inline-start]:rtl:-rotate-90",
    ],
    positioner: [
      overlayPositionerClass,
      "ease-out h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom] duration-300 data-instant:transition-none",
    ],
    popup: [
      overlayPopupSurfaceClass,
      navigationPopupShellClass,
      "ease-out relative h-(--popup-height) max-h-(--available-height) w-(--popup-width) max-w-(--available-width) transition-[opacity,width,height] duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0",
    ],
    viewport: "relative size-full overflow-hidden",
    inlineViewport: [navigationInlineViewportShellClass, "relative min-w-0 overflow-hidden"],
    content: [
      navigationContentShellClass,
      "ease-out box-border h-full max-h-(--available-height) w-auto max-w-(--available-width) overflow-auto transition-[opacity,translate] duration-300",
      "data-ending-style:opacity-0 data-starting-style:opacity-0",
      "data-starting-style:data-[activation-direction=left]:-translate-x-1/2 data-starting-style:data-[activation-direction=right]:translate-x-1/2",
      "data-ending-style:data-[activation-direction=left]:translate-x-1/2 data-ending-style:data-[activation-direction=right]:-translate-x-1/2",
    ],
    link: [
      selfFocusRingClass,
      // oxlint-disable-next-line elmera/no-local-focus-ring -- native outline off; the ring comes from the shared adapter
      "data-active:font-medium flex items-center text-inherit no-underline outline-none data-active:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    ],
    indicator:
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- the arrow is decorative geometry, not a control rung
      "pointer-events-none absolute inset-x-0 top-full flex h-1.5 items-end justify-center overflow-hidden opacity-0 transition-opacity duration-200 data-popup-open:opacity-100",
    // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- the arrow is decorative geometry, not a control rung
    indicatorArrow: "relative top-[60%] size-2 rotate-45 rounded-tl-sm bg-border",
  },
  // A bar sits on the page and highlights with `muted`. A row sits on the popover and
  // highlights with `accent`, as menu items in Select, Combobox and DropdownMenu do: accent
  // is the role defined as a lift from the popover, so a row tint stays off the popup.
  variants: {
    orientation: {
      horizontal: {
        trigger: [barBoxClass, "w-max justify-center data-popup-open:bg-muted enabled-hover:bg-muted"],
      },
      // A vertical trigger is full width and start-aligned, so it can hold a title and a description.
      vertical: {
        trigger: [
          contentRowClass,
          "h-auto w-full justify-between text-start font-[number:inherit]",
          "data-popup-open:bg-accent data-popup-open:text-accent-foreground enabled-hover:bg-accent enabled-hover:text-accent-foreground",
        ],
      },
    },
    box: {
      bar: { link: [barBoxClass, "hover:bg-muted"] },
      row: { link: [contentRowClass, "hover:bg-accent hover:text-accent-foreground"] },
    },
  },
  // Trigger and Link always pass their axis, so neither has a default.
  defaultVariants: {},
});
