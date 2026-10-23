/**
 * The HTML the built Fuse Calendar renders for a Calendar day cell, and the attributes the page
 * writes on the day when it forces the cell's state. The unit under test is the Calendar day
 * renderer. The oracle is React Aria's `CalendarCell` contract: it renders each date as a
 * `<div role="button" data-rac>` labelled with the date, marks the value `data-selected` and labels
 * it ` selected`, never selects a date it disables, selects an invalid value, and while a keyboard
 * user focuses a day it marks it `data-focused` and `data-focus-visible` and calls `Calendar`'s
 * `className` function with `isFocusVisible`. Fuse's state focus ring answers that render prop with
 * `ring-2 ring-ring outline-hidden` in place of the resting `outline-none` (`styles/utils.ts`). The
 * markup check in `kit-markup.test.ts` reads the attributes the kit's variants select, so it cannot
 * tell a selected day from an unselected one, whose faces come from render props, or check the
 * class the page writes on a focused day.
 */
import { describe, expect, it } from "vitest";

import { elementsOf } from "../../test/static-markup";
import { CALENDAR_DAY_LABEL } from "../components/calendar-day-kit";
import { calendarDay } from "./calendar-day-cell";
import { forcedAttributesFor, renderCellHtml } from "./cell-renderers";

/** The cell's day and the calendar's heading, as the static markup holds them. */
function render(cell: Readonly<Record<string, string>>) {
  const elements = elementsOf(renderCellHtml(calendarDay, cell));
  const days = elements.filter(
    (element) =>
      element.attributes.has("data-rac") &&
      (element.attributes.get("aria-label") ?? "").startsWith(CALENDAR_DAY_LABEL)
  );
  return { days, heading: elements.find((element) => element.name === "h2")?.text };
}

const SELECTED = ["off", "on"];
const STATES = ["rest", "hover", "focus", "disabled", "invalid"];

describe("the Calendar day renderer", () => {
  it("renders July 14, 2026 in July 2026, selected exactly where React Aria selects it", () => {
    for (const selected of SELECTED) {
      for (const state of STATES) {
        const { days, heading } = render({ selected, state });
        const [day] = days;
        // React Aria disables every date of a disabled calendar and selects the value of an invalid one.
        const isSelected = state !== "disabled" && (selected === "on" || state === "invalid");
        expect(heading, `${selected} ${state}`).toBe("July 2026");
        expect(days, `${selected} ${state}`).toHaveLength(1);
        expect([day?.text, day?.attributes.get("data-selected"), day?.attributes.get("aria-label")]).toEqual([
          "14",
          isSelected ? "true" : undefined,
          isSelected ? `${CALENDAR_DAY_LABEL} selected` : CALENDAR_DAY_LABEL,
        ]);
      }
    }
  });

  it("writes React Aria's focus marks on a focused day, and its resting classes with the ring for the outline", () => {
    for (const selected of SELECTED) {
      const cell = { selected, state: "focus" };
      const resting = (render(cell).days[0]?.attributes.get("class") ?? "").split(" ");
      const { class: focused = "", ...marks } = forcedAttributesFor(calendarDay, cell);
      expect(marks, selected).toEqual({ "data-focused": "true", "data-focus-visible": "true" });
      expect(new Set(focused.split(" ")), selected).toEqual(
        new Set([
          ...resting.filter((name) => name !== "outline-none"),
          "ring-2",
          "ring-ring",
          "outline-hidden",
        ])
      );
    }
  });
});
