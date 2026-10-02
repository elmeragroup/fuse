import { tv } from "tailwind-variants";

import { controlMd } from "../../styles/control-size-md";
import { nativeStateFaceClass } from "../../styles/state-face";
import { selfFocusRingClass } from "../../styles/utils";
import { overlayPopupSurfaceClass, overlayPositionerClass } from "../overlay/overlay-classes";

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
 * The central reduced-motion rule keeps only opacity and colour transitions, which turns
 * the resize, the slide and the caret rotation off together.
 */
export const navigationMenuVariants = tv({
  slots: {
    root: "group/navigation-menu relative flex max-w-max flex-1 items-center justify-center",
    // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- the gap between triggers is bar layout, not a control rung
    list: "m-0 flex flex-1 list-none items-center justify-center gap-1 p-0",
    item: "relative",
    trigger: [
      selfFocusRingClass,
      nativeStateFaceClass,
      controlMd.height(),
      controlMd.gap(),
      controlMd.inset(),
      controlMd.type(),
      // oxlint-disable-next-line elmera/no-local-focus-ring -- native outline off; the ring comes from the shared adapter
      "group/navigation-menu-trigger font-medium relative inline-flex w-max cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-inherit outline-none select-none data-popup-open:bg-muted enabled-hover:bg-muted",
    ],
    triggerIcon:
      "ease-in-out pointer-events-none size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-popup-open/navigation-menu-trigger:rotate-180",
    positioner: [
      overlayPositionerClass,
      "ease-out h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom] duration-300 data-instant:transition-none",
    ],
    popup: [
      overlayPopupSurfaceClass,
      "ease-out relative h-(--popup-height) max-h-(--available-height) w-(--popup-width) max-w-(--available-width) transition-[opacity,width,height] duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0",
    ],
    viewport: "relative size-full overflow-hidden",
    content: [
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- panel padding is overlay layout, not a control rung
      "ease-out box-border h-full max-h-(--available-height) w-auto max-w-(--available-width) overflow-auto p-2 transition-[opacity,translate] duration-300",
      "data-ending-style:opacity-0 data-starting-style:opacity-0",
      "data-starting-style:data-[activation-direction=left]:-translate-x-1/2 data-starting-style:data-[activation-direction=right]:translate-x-1/2",
      "data-ending-style:data-[activation-direction=left]:translate-x-1/2 data-ending-style:data-[activation-direction=right]:-translate-x-1/2",
    ],
    // The xs control height is the density-owned 24px floor: 24px dense, 32px comfortable.
    // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- row padding and type are menu layout, not a control rung
    link: [
      selfFocusRingClass,
      // oxlint-disable-next-line elmera/no-local-focus-ring -- native outline off; the ring comes from the shared adapter
      "text-sm data-active:font-medium box-border flex min-h-(--control-h-xs) items-center gap-2 rounded-sm px-2 py-1.5 text-inherit no-underline outline-none hover:bg-muted data-active:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      // A link in the bar (the popup portals out of the list) takes the trigger's box, so a
      // bar that mixes links and triggers lines up.
      "in-data-[slot=navigation-menu-list]:font-medium in-data-[slot=navigation-menu-list]:h-(--control-h-md) in-data-[slot=navigation-menu-list]:rounded-md in-data-[slot=navigation-menu-list]:px-(--control-px-md) in-data-[slot=navigation-menu-list]:py-0 in-data-[slot=navigation-menu-list]:[font-size:var(--control-text)] in-data-[slot=navigation-menu-list]:[line-height:var(--control-leading)]",
    ],
    indicator:
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- the arrow is decorative geometry, not a control rung
      "pointer-events-none absolute inset-x-0 top-full flex h-1.5 items-end justify-center overflow-hidden opacity-0 transition-opacity duration-200 data-popup-open:opacity-100",
    // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- the arrow is decorative geometry, not a control rung
    indicatorArrow: "relative top-[60%] size-2 rotate-45 rounded-tl-sm bg-border",
  },
});
