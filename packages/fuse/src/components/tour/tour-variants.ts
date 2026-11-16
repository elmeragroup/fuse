import { cn } from "../../styles/cn";
import { popoverShellClass } from "../../styles/inner-corner/popover";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";
import { overlayGlidingPopupClass, overlayLayer } from "../overlay/overlay-classes";

/** The primary-color ring around a step's element, which every highlight of the element shares. */
const tourOutlineClass = cn("ring-2 ring-primary");

/**
 * The module-private recipe for the tour popup and its parts.
 *
 * - `popup` is the shared gliding popup on the Popover shell, `Popover.Content`'s timed popup with
 *   the glide between steps, 320px wide or the viewport less 32px, with its parts 12px apart.
 * - `header` sets the progress at the start and the close button at the end.
 * - `progress` is the muted count with its dots; `dot` marks the shown step in the primary color.
 * - `title` and `description` match Popover's.
 * - `footer` sets Skip at the start and Prev and Next at the end.
 * - `announcement` hides the live region that announces the step.
 * - `outline` rings a step's lit element in the primary color, so the spotlight's hole reads on any
 *   page, dark ones included, where the scrim's tint barely shows.
 * - `highlight` places a box over the step's element from the `--tour-highlight-*` properties
 *   `TourHighlight` writes, and takes no pointer.
 * - `ring` is the same outline on the overlay layer, for `Tour.Ring`.
 * - `beacon` centers `beaconDot`, a 10px primary dot, over `beaconPulse`, a copy that grows and fades
 *   three times when motion is allowed, so the beacon never moves for longer than WCAG's five
 *   seconds.
 */
export const tourVariants = tv({
  slots: {
    popup: [
      selfFocusRingClass,
      overlayGlidingPopupClass,
      popoverShellClass,
      "text-sm flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3",
    ],
    header: "flex items-center justify-between gap-2",
    progress: "text-xs flex items-center gap-2 text-muted-foreground tabular-nums",
    dots: "flex items-center gap-1",
    dot: "size-1.5 rounded-full bg-muted-foreground/30 data-current:bg-primary",
    title: "font-medium text-balance",
    description: "text-pretty text-muted-foreground",
    footer: "flex items-center justify-end gap-2",
    skip: "me-auto",
    announcement: "sr-only",
    outline: tourOutlineClass,
    highlight:
      "pointer-events-none fixed top-0 left-0 h-(--tour-highlight-h) w-(--tour-highlight-w) translate-x-(--tour-highlight-x) translate-y-(--tour-highlight-y) rounded-(--tour-highlight-r)",
    ring: [tourOutlineClass, overlayLayer],
    beacon: "relative",
    beaconDot: "size-2.5 rounded-full bg-primary",
    beaconPulse:
      "absolute inset-0 m-auto size-2.5 rounded-full bg-primary motion-safe:animate-[ping_1s_cubic-bezier(0,0,0.2,1)_3]",
  },
});
