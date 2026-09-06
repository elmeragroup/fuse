import { tv } from "tailwind-variants";

import { stateFocusRingClass, stateFocusRingVisibleClass } from "./utils";

/**
 * RangeCalendar's slotted recipe. Package-private — no entry
 * re-exports it, and there is no public recipe surface for the interim tier.
 *
 * Two things separate it from Calendar's recipe: RangeCalendar hand-rolls its own
 * two-layer cell instead of borrowing the single-day circle, and its root takes no
 * card-surface slot at all — standalone the calendar renders borderless and the picker
 * dialog supplies the chrome.
 *
 * Every axis lives on the inner pill; `body` and `outerCell` are invariant, so the
 * component resolves them once and re-resolves only `cell` per date.
 */
export const rangeCalendarVariants = tv({
  slots: {
    /**
     * The month table. Zeroing the cell gutter is what lets the range band run
     * unbroken across day columns.
     */
    body: "[&_td]:px-0",
    /**
     * The square band a day sits in: the layer that paints the range fill, the
     * start/end caps and the row-edge rounding, and the `group` the pill styles
     * against. `size-9` is the ref's decorative day square, not a control-box rung,
     * so it stays a literal and reads no
     * `--control-*` variable — the same classification Calendar's day cell has.
     */
    outerCell: [
      "group text-sm size-9 cursor-default outline outline-0",
      "outside-month:text-muted-foreground",
      "selected:bg-primary/20 invalid:selected:bg-error/10",
      "forced-colors:selected:bg-[Highlight] forced-colors:invalid:selected:bg-[Mark]",
      "selection-start:rounded-s-full selection-end:rounded-e-full",
      "[td:first-child_&]:rounded-s-full [td:last-child_&]:rounded-e-full",
    ],
    /**
     * The full-size pill inside the band. Focus is the canonical RAC state adapter:
     * the band owns the tab stop, the pill paints the ring.
     */
    cell: ["flex size-full items-center justify-center rounded-full text-foreground", stateFocusRingClass],
    error: "text-sm text-error",
  },
  variants: {
    /** `getSelectionState`'s three faces: outside the range, inside it, or a cap. */
    selectionState: {
      none: { cell: "group-hover:bg-muted group-pressed:bg-accent" },
      middle: {
        cell: [
          "group-hover:bg-primary/30 group-pressed:bg-primary/40",
          "group-hover:group-invalid:bg-error/20 group-invalid:group-pressed:bg-error/30",
        ],
      },
      cap: { cell: "bg-primary text-primary-foreground group-invalid:bg-error" },
    },
    isDisabled: {
      true: { cell: "text-muted-foreground" },
    },
    isFocusVisible: {
      true: { cell: stateFocusRingVisibleClass },
      false: { cell: "" },
    },
  },
});
