import { cn } from "./cn";
import { calendarShellClass } from "./inner-corner/calendar";
import { tv } from "./tv";
import { stateFocusRingClass, stateFocusRingVisibleClass } from "./utils";

/**
 * The day-cell recipe. Flattened rather than a slot on
 * `calendarVariants` because it is the only part with variant axes of its own: RAC hands
 * `CalendarCell` its render props per date, and the component resolves this recipe once
 * per day while the surrounding slots resolve once per render.
 *
 * Package-private — no published entry re-exports it, and the interim tier has no public recipe
 * surface. The workspace-only recipe catalog re-exports it for the Figma kit's day cell. It
 * lives here rather than beside the component because every RAC entry keeps its recipe in
 * `src/styles/`.
 */
export const cellVariants = tv({
  // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- decorative day-cell circle, not a control size
  base: cn(
    "text-sm flex size-9 cursor-default items-center justify-center rounded-full forced-color-adjust-none",
    // RAC disables every day outside the visible month, and a muted day reads as unavailable
    // although it is pickable from its own month. Invisible keeps its grid slot so the weeks stay
    // aligned and drops it from the accessibility tree.
    "outside-month:invisible",
    stateFocusRingClass
  ),
  variants: {
    isFocusVisible: {
      true: stateFocusRingVisibleClass,
      false: "",
    },
    isSelected: {
      // oxlint-disable-next-line fuse/state-face -- a day cell shows its disabled state as muted text, not through the control state face
      false: "text-foreground hover:bg-muted aria-pressed:bg-accent",
      true: "bg-primary text-primary-foreground invalid:bg-error forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:invalid:bg-[Mark]",
    },
    isDisabled: {
      // oxlint-disable-next-line fuse/state-face -- a day cell shows its disabled state as muted text, not through the control state face
      true: "text-muted-foreground hover:bg-transparent forced-colors:text-[GrayText]",
    },
    isUnavailable: {
      // oxlint-disable-next-line fuse/state-face -- a day cell shows its disabled state as muted text, not through the control state face
      true: "text-muted-foreground hover:bg-transparent forced-colors:text-[GrayText]",
    },
  },
});

/**
 * Calendar's slotted recipe. Package-private, same as `cellVariants`
 * above, and — unlike RangeCalendar's — it owns the card surface: standalone Calendar
 * renders as a bordered card, and the picker strips that card chrome from the call site.
 *
 * Every slot here is invariant, so the component resolves them once per render; the
 * per-date axes all live on `cellVariants`.
 */
export const calendarVariants = tv({
  slots: {
    base: cn(
      "max-w-sm text-sm shadow-md min-h-80 min-w-32 border border-border bg-card bg-clip-padding text-card-foreground will-change-transform [--surface-muted-foreground:--theme(--color-muted-foreground)] [--surface:--theme(--color-card)]",
      calendarShellClass
    ),
    header: "flex w-full items-center gap-1 px-1 pb-4",
    heading: "mx-2 flex-1 text-center",
    headerCell: "text-sm font-medium text-muted-foreground",
    body: "mx-auto my-0 min-h-[246px]",
    error: "text-sm text-error",
  },
});
