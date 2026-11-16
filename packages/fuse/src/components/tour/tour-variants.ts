import { cn } from "../../styles/cn";
import { popoverShellClass } from "../../styles/inner-corner/popover";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";
import { overlayTimedPopupClass } from "../overlay/overlay-classes";

/** The primary-color ring around a step's element, which every highlight of the element shares. */
const tourOutlineClass = cn("ring-2 ring-primary");

/**
 * The module-private recipe for the tour popup and its parts.
 *
 * - `popup` is the shared timed popup on the Popover shell, as `Popover.Content` is, 320px wide or
 *   the viewport less 32px, with its parts 12px apart.
 * - `header` sets the progress at the start and the close button at the end.
 * - `progress` is the muted count with its dots; `dot` marks the shown step in the primary color.
 * - `title` and `description` match Popover's.
 * - `footer` sets Skip at the start and Prev and Next at the end.
 * - `announcement` hides the live region that announces the step.
 * - `outline` rings a step's lit element in the primary color, so the spotlight's hole reads on any
 *   page, dark ones included, where the scrim's tint barely shows.
 */
export const tourVariants = tv({
  slots: {
    popup: [
      selfFocusRingClass,
      overlayTimedPopupClass,
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
  },
});
