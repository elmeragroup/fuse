/**
 * The React Aria Calendar's day cell, as one component set on the Calendar page, so a designer can
 * lay out a month by hand until the kit draws the month itself.
 *
 * `Calendar` renders each date as React Aria's `CalendarCell`, a `<div role="button" data-rac>`
 * with no `data-slot`, and passes `cellVariants` as its `className` function, which React Aria calls
 * with the cell's render props. So a cell's classes are `cellVariants` of the render props React
 * Aria hands it in that state: `isFocusVisible` while a keyboard user focuses the date, `isSelected`
 * while it is the value, and `isDisabled` while it cannot be picked. A date that is unavailable or
 * outside the month draws the same classes, so `disabled` stands for all three. React Aria never
 * selects a date it disables, so a disabled cell draws unselected at `selected=on`, and it selects
 * an invalid date, so an invalid cell draws selected at `selected=off`. Fuse draws no face for
 * today, so the set has none.
 *
 * Every face depends on the cell's own state alone. The range calendar's band, whose corners
 * follow the cell's place in its week, waits for the segment sets.
 */
import { cellVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition } from "./component-spec";

/**
 * The day the docs Basic demo selects, July 14, 2026, as its cell shows it: the default of the
 * `Day` text property. The compare renderer renders the same date.
 */
export const CALENDAR_DAY_NUMBER = "14";

/**
 * How React Aria labels that day in `en-US`, the locale the docs set. It adds ` selected` while the
 * day is the value, so the compare finds the cell by this prefix.
 */
export const CALENDAR_DAY_LABEL = "Tuesday, July 14, 2026";

/** The render props React Aria hands `Calendar`'s `className` function in a cell, as `cellVariants` reads them. */
function renderPropsFor(cell: Cell) {
  const disabled = cell.state === "disabled";
  return {
    isFocusVisible: cell.state === "focus",
    isSelected: !disabled && (cell.selected === "on" || cell.state === "invalid"),
    isDisabled: disabled,
  };
}

/**
 * A day of the month, as `Calendar` renders a date: React Aria's `CalendarCell` with the classes
 * `cellVariants` gives its render props. `aria-pressed:` never holds, since React Aria marks a day
 * cell `data-pressed` while pressed and never `aria-pressed`, so `aria-pressed:bg-accent` paints in
 * no cell.
 */
export const CALENDAR_DAY: ComponentDefinition = {
  key: "calendar-day",
  name: "Calendar day",
  slot: "calendar-cell",
  element: {
    tag: "div",
    attributes: { "data-rac": true, role: "button" },
    prefixes: { "aria-label": CALENDAR_DAY_LABEL },
  },
  rootKind: "react-aria-element",
  axes: [
    { name: "selected", values: ["off", "on"] },
    { name: "state", values: ["rest", "hover", "focus", "disabled", "invalid"] },
  ],
  columnAxis: "state",
  classesFor: (cell) => cellVariants(renderPropsFor(cell)),
  states: {},
  facts: new Map(),
  omittedStates: new Set(["aria-pressed"]),
  omittedMedia: new Map([
    ["forced-colors", "the kit draws the normal colors, not the system colors a forced-colors mode paints"],
  ]),
  label: {
    key: "label",
    name: "label",
    characters: CALENDAR_DAY_NUMBER,
    textProperty: "Day",
    shownIn: () => true,
  },
  iconsFor: () => [],
  swapProperties: [],
};
