import { tv } from "tailwind-variants";

import { cn } from "./cn";
import { stateFocusRingClass, stateFocusRingVisibleClass } from "./utils";

/**
 * The day-cell recipe. Flattened rather than a slot on
 * `calendarVariants` because it is the only part with variant axes of its own: RAC hands
 * `CalendarCell` its render props per date, and the component resolves this recipe once
 * per day while the surrounding slots resolve once per render.
 *
 * Package-private — no entry re-exports it, and the interim tier has no public recipe
 * surface. It lives here rather than beside the component because every RAC entry keeps
 * its recipe in `src/styles/`.
 */
export const cellVariants = tv({
  // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- decorative day-cell circle, not a control-box rung
  base: cn(
    "text-sm flex size-9 cursor-default items-center justify-center rounded-full forced-color-adjust-none",
    stateFocusRingClass
  ),
  variants: {
    isFocusVisible: {
      true: stateFocusRingVisibleClass,
      false: "",
    },
    isSelected: {
      false: "text-foreground hover:bg-muted aria-pressed:bg-accent",
      true: "bg-primary text-primary-foreground invalid:bg-error forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:invalid:bg-[Mark]",
    },
    isDisabled: {
      true: "text-muted-foreground hover:bg-transparent forced-colors:text-[GrayText]",
    },
    isUnavailable: {
      true: "text-muted-foreground hover:bg-transparent forced-colors:text-[GrayText]",
    },
  },
});

/**
 * Calendar's slotted recipe. Package-private, same as `cellVariants`
 * above, and — unlike RangeCalendar's — it owns the card surface: standalone Calendar
 * renders as a bordered card, and the picker strips that border from the call site
 *
 * Every slot here is invariant, so the component resolves them once per render; the
 * per-date axes all live on `cellVariants`.
 */
export const calendarVariants = tv({
  slots: {
    base: "max-w-sm text-sm shadow-md min-h-80 min-w-32 rounded-lg border border-border bg-card bg-clip-padding p-2 text-card-foreground will-change-transform",
    header: "flex w-full items-center gap-1 px-1 pb-4",
    heading: "mx-2 flex-1 text-center",
    headerCell: "text-sm font-medium text-muted-foreground",
    body: "mx-auto my-0 min-h-[246px]",
    error: "text-sm text-error",
  },
});
