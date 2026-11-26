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
    // A day is a 36px circle at both densities, above the 24px target-size floor.
    day: cn(
      "text-sm flex size-9 cursor-default items-center justify-center rounded-full text-foreground",
      selfFocusRingClass,
      // Only a day the user can select takes the hover face.
      "enabled-hover:not-aria-disabled:not-data-selected:bg-muted",
      // A neighboring month's day keeps its grid slot so the weeks stay aligned, and is invisible,
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
      // Forced colors paint a selected day in the system's Highlight. A selected day that fails
      // validation, and each selected end of an invalid range, take Mark instead, the color of the
      // invalid band, so the invalid cue survives. An invalid range's selected middle days are
      // Highlight circles on the Mark band, hovered or not. The single-day, range-end and hover
      // rules repeat the selectors of the normal-mode rules they replace, so they match as
      // specifically and win by coming later in the stylesheet. The broad `data-selected` rule
      // gives the middle days their Highlight, and its `data-unavailable` twin keeps an unavailable
      // middle day's HighlightText ahead of the muted text below.
      //
      // Only a selected day opts out of forced colors. Without the opt-out, Chromium paints a
      // Canvas backplate behind the text, which hides HighlightText on the Highlight fill. Every
      // other day is forced, so the browser paints it in its system colors whatever the theme, and
      // a disabled day in GrayText. An opted-out day keeps its author ring and outline, so a focused
      // selected day drops the theme ring and draws an outline in its own text color inside its
      // fill, which contrasts with Highlight and with Mark.
      "data-selected:forced-color-adjust-none",
      "forced-colors:data-selected:bg-[Highlight] forced-colors:data-selected:text-[HighlightText]",
      "forced-colors:data-selected:not-data-in-range:bg-[Highlight] forced-colors:data-selected:not-data-in-range:text-[HighlightText]",
      "forced-colors:data-selection-start:bg-[Highlight] forced-colors:data-selection-start:text-[HighlightText]",
      "forced-colors:data-selection-end:bg-[Highlight] forced-colors:data-selection-end:text-[HighlightText]",
      "forced-colors:data-selected:data-invalid:not-data-in-range:bg-[Mark] forced-colors:data-selected:data-invalid:not-data-in-range:text-[MarkText]",
      "forced-colors:data-selection-start:data-invalid:bg-[Mark] forced-colors:data-selection-start:data-invalid:text-[MarkText]",
      "forced-colors:data-selection-end:data-invalid:bg-[Mark] forced-colors:data-selection-end:data-invalid:text-[MarkText]",
      "forced-colors:data-selected:data-unavailable:text-[HighlightText]",
      "forced-colors:data-in-range:not-data-selection-start:not-data-selection-end:enabled-hover:bg-[Highlight]",
      "forced-colors:data-selected:focus-visible:[box-shadow:none] forced-colors:data-selected:focus-visible:-outline-offset-4 forced-colors:data-selected:focus-visible:outline-current",
      "data-unavailable:text-muted-foreground data-unavailable:line-through",
      "data-disabled:text-muted-foreground forced-colors:data-disabled:text-[GrayText]"
    ),
  },
});
