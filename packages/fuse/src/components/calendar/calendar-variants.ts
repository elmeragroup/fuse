/**
 * The calendar parts' slotted recipe, shared by Calendar and RangeCalendar. Module-private: no
 * entry re-exports it. Every slot is invariant; a day's state reaches its button as data
 * attributes, which the `day` and `dayGridCell` slots style, so a day re-renders only when its own
 * state changes and never resolves the recipe per render. Every day attribute, the selection
 * flags (`data-selected`, `data-invalid`, and in a range `data-in-range`, `data-selection-start`,
 * `data-selection-end`, `data-highlighted`) included, is present and empty, which its variant
 * matches: Fuse's presence-not-"false" `data-selected` and `data-disabled`, plain Tailwind
 * presence for the rest.
 */
import { cn } from "../../styles/cn";
import { calendarShellClass } from "../../styles/inner-corner/calendar";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";

export const calendarVariants = tv({
  slots: {
    root: cn(
      "text-sm shadow-md w-fit border border-border bg-card bg-clip-padding text-card-foreground [--surface-muted-foreground:--theme(--color-muted-foreground)] [--surface:--theme(--color-card)]",
      calendarShellClass
    ),
    header: "flex w-full items-center gap-1 px-1 pb-4",
    nav: "shrink-0",
    visibleRangeHeading: "text-lg font-medium mx-2 flex-1 text-center",
    months: "flex flex-wrap justify-center gap-6",
    month: "flex flex-col gap-2",
    monthHeading: "text-sm font-medium text-center",
    dayGrid: "border-collapse",
    dayGridHeader: "",
    dayGridHeaderRow: "",
    dayGridHeaderCell: "text-sm font-medium size-9 p-0 text-muted-foreground",
    dayGridBody: "",
    dayGridRow: "",
    // A range's band: the cells from its start to its end take a translucent fill, rounded at the
    // range's ends and at each row's ends, and the day circles sit on it. Calendar's one selected
    // day is never `data-in-range`, so it shows no band.
    dayGridCell: cn(
      "p-0",
      "data-in-range:bg-primary/20 data-in-range:data-invalid:bg-error/10",
      "forced-colors:data-in-range:bg-[Highlight] forced-colors:data-in-range:data-invalid:bg-[Mark]",
      "data-selection-end:rounded-e-full data-selection-start:rounded-s-full",
      "data-in-range:first:rounded-s-full data-in-range:last:rounded-e-full"
    ),
    day: cn(
      "text-sm flex size-9 cursor-default items-center justify-center rounded-full text-foreground forced-color-adjust-none",
      selfFocusRingClass,
      // Only a day the user can select takes the hover face.
      "enabled-hover:not-aria-disabled:not-data-selected:bg-muted",
      // A neighbouring month's day keeps its grid slot so the weeks stay aligned, and is invisible,
      // which also drops it from the accessibility tree: it is pickable from its own month.
      "data-outside-month:invisible",
      "data-current:font-semibold",
      // Calendar's selected day and a range's ends take the filled circle; a range's middle days
      // show the cell's band through a clear circle.
      "data-selected:not-data-in-range:bg-primary data-selected:not-data-in-range:text-primary-foreground",
      "data-selection-start:bg-primary data-selection-start:text-primary-foreground",
      "data-selection-end:bg-primary data-selection-end:text-primary-foreground",
      "data-in-range:not-data-selection-start:not-data-selection-end:enabled-hover:bg-primary/30",
      "data-selected:data-invalid:not-data-in-range:bg-error data-selected:data-invalid:not-data-in-range:text-error-foreground",
      "data-selection-start:data-invalid:bg-error data-selection-start:data-invalid:text-error-foreground",
      "data-selection-end:data-invalid:bg-error data-selection-end:data-invalid:text-error-foreground",
      // Forced colors paint every selected day in the system's Highlight. Calendar's selected day
      // and a range's ends repeat the selectors of their filled circle above, so each forced-colors
      // rule matches as specifically and, coming later in the stylesheet, wins.
      "forced-colors:data-selected:bg-[Highlight] forced-colors:data-selected:text-[HighlightText]",
      "forced-colors:data-selected:not-data-in-range:bg-[Highlight] forced-colors:data-selected:not-data-in-range:text-[HighlightText]",
      "forced-colors:data-selection-start:bg-[Highlight] forced-colors:data-selection-start:text-[HighlightText]",
      "forced-colors:data-selection-end:bg-[Highlight] forced-colors:data-selection-end:text-[HighlightText]",
      "data-unavailable:text-muted-foreground data-unavailable:line-through",
      "data-disabled:text-muted-foreground forced-colors:data-disabled:text-[GrayText]"
    ),
  },
});
