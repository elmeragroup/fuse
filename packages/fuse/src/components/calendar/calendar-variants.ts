/**
 * The calendar parts' slotted recipe, shared by Calendar and RangeCalendar. Module-private: no
 * entry re-exports it. Every slot is invariant; a day's state reaches its button as data
 * attributes, which the `day` slot styles, so a day re-renders only when its own state changes and
 * never resolves the recipe per render. Every day attribute, the selection flags such as
 * `data-selected` and `data-invalid` included, is present and empty, which its variant matches:
 * Fuse's presence-not-"false" `data-selected` and `data-disabled`, plain Tailwind presence for
 * the rest.
 */
import { cn } from "../../styles/cn";
import { calendarShellClass } from "../../styles/inner-corner/calendar";
import { tv } from "../../styles/tv";
import { selfFocusRingClass } from "../../styles/utils";

export const calendarVariants = tv({
  slots: {
    root: cn(
      "text-sm shadow-md w-fit border border-border bg-card bg-clip-padding text-card-foreground",
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
    dayGridCell: "p-0",
    day: cn(
      "text-sm flex size-9 cursor-default items-center justify-center rounded-full text-foreground forced-color-adjust-none",
      selfFocusRingClass,
      // Only a day the user can select takes the hover face.
      "enabled-hover:not-aria-disabled:not-data-selected:bg-muted",
      // A neighbouring month's day keeps its grid slot so the weeks stay aligned, and is invisible,
      // which also drops it from the accessibility tree: it is pickable from its own month.
      "data-outside-month:invisible",
      "data-current:font-semibold",
      "data-selected:bg-primary data-selected:text-primary-foreground",
      "data-selected:data-invalid:bg-error data-selected:data-invalid:text-error-foreground",
      "forced-colors:data-selected:bg-[Highlight] forced-colors:data-selected:text-[HighlightText]",
      "data-unavailable:text-muted-foreground data-unavailable:line-through",
      "data-disabled:text-muted-foreground forced-colors:data-disabled:text-[GrayText]"
    ),
  },
});
