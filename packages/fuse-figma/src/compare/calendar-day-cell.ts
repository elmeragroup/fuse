/**
 * The renderer of the `calendar-day` set: each cell as the July 14, 2026 day of the real Fuse
 * `<Calendar>`, the day the docs Basic demo selects, inside `UiProviders` in `en-US`, the locale the
 * docs set. The page measures that day by its `aria-label`.
 *
 * - Every cell sets `defaultFocusedValue` to the day, so the calendar shows July 2026 whatever the
 *   date the run takes place on.
 * - `selected=on` sets `defaultValue` to the day. `disabled` sets the calendar's `isDisabled`, so
 *   React Aria marks the day `aria-disabled` and `data-disabled` and never selects it. `invalid` sets
 *   the day as the value and `isInvalid`, as the docs Error demo does, so React Aria selects the day
 *   and marks it `aria-invalid` and `data-invalid` at either `selected` value.
 * - The calendar drops its card's border, fill and shadow with the `border-none bg-transparent
 *   shadow-none` the date picker gives it inside its popover, so the day sits on the page's
 *   background, as the kit's instance sits on the preview's.
 * - The host class `[&_table]:min-h-0!` gives each week its own 36px, so the day lands on the pixel
 *   grid the page crops on.
 *
 * React Aria sets a day's hover and focus faces from pointer and focus events once a page hydrates,
 * and the compare page renders static markup. So `forcedAttributes` names what React Aria writes on
 * the day in those states, which the page writes when it forces the state: `data-hovered` while
 * hovered, which `hover:` reads on an element marked `data-rac`, and `data-focused`,
 * `data-focus-visible` and the class `Calendar`'s `className` function, `cellVariants`, gives the
 * render prop `isFocusVisible` while a keyboard user focuses the day.
 *
 * Node cannot load Fuse's TSX source, so this module imports the Fuse build. `cell-renderers.ts`
 * imports this module only after the run found the build.
 */

import { createElement } from "react";

import { CalendarDate } from "@internationalized/date";

import { cellVariants } from "@elmeragroup/fuse/recipe-catalog";

import { Calendar } from "../../../fuse/dist/react-aria/calendar.js";
import { UiProviders } from "../../../fuse/dist/react-aria/ui-providers.js";
import type { Cell } from "../components/component-spec.ts";
import type { CellRendering } from "./cell-renderers.ts";

/** The day each cell renders, which React Aria labels `CALENDAR_DAY_LABEL` in `calendar-day-kit.ts`. */
const DAY = new CalendarDate(2026, 7, 14);

/** The classes the date picker gives Calendar inside its popover, which drop the card. */
const WITHOUT_CARD = "border-none bg-transparent shadow-none";

/**
 * A host class that lets the grid's weeks take their own height. The grid's `min-h-[246px]`
 * stretches a five-week month's rows to 45.1875px, which puts the day 31/32px off the pixel grid
 * the page crops on. The day's own box is the same either way. Fuse's standalone `styles.css`
 * writes that rule outside any cascade layer, so only an important declaration in the host's
 * `utilities` layer beats it.
 */
const NATURAL_ROWS = "[&_table]:min-h-0!";

/** A `calendar-day` cell: the day selected or not, disabled or invalid, in a calendar without its card. */
export const calendarDay: CellRendering = {
  element: (cell: Cell) =>
    createElement(UiProviders, {
      locale: "en-US",
      navigate: () => undefined,
      children: createElement(Calendar, {
        className: `${WITHOUT_CARD} ${NATURAL_ROWS}`,
        defaultFocusedValue: DAY,
        defaultValue: cell.selected === "on" || cell.state === "invalid" ? DAY : null,
        isDisabled: cell.state === "disabled",
        isInvalid: cell.state === "invalid",
      }),
    }),
  hostClasses: [NATURAL_ROWS],
  forcedAttributes: (cell: Cell) => {
    if (cell.state === "hover") {
      return { "data-hovered": "true" };
    }
    if (cell.state === "focus") {
      return {
        "data-focused": "true",
        "data-focus-visible": "true",
        class: cellVariants({
          isSelected: cell.selected === "on",
          isFocusVisible: true,
          isDisabled: false,
          isUnavailable: false,
        }),
      };
    }
    return {};
  },
};
