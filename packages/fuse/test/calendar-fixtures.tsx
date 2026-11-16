import type { ReactElement } from "react";

import { Calendar } from "../src/components/calendar/index";

/**
 * A calendar's visible months with `day` in every cell, so a suite stages its own day button,
 * such as one whose `render` element carries its own `data-slot`.
 *
 * @param props - The months' props.
 * @param props.day - The `Calendar.DayButton` element each cell renders. It reads its day from the
 *   cell.
 * @returns The months, for inside a calendar Root.
 */
export function MonthsWithDay({ day }: { readonly day: ReactElement }): ReactElement {
  return (
    <Calendar.Months>
      {(month) => (
        <Calendar.Month key={month.toString()} value={month}>
          <Calendar.DayGrid>
            <Calendar.DayGridBody>
              {(week) => (
                <Calendar.DayGridRow key={week.toString()} value={week}>
                  {(date) => (
                    <Calendar.DayGridCell key={date.toString()} value={date}>
                      {day}
                    </Calendar.DayGridCell>
                  )}
                </Calendar.DayGridRow>
              )}
            </Calendar.DayGridBody>
          </Calendar.DayGrid>
        </Calendar.Month>
      )}
    </Calendar.Months>
  );
}
