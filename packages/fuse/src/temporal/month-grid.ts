import type { IsoWeekday } from "./week-info";

/**
 * The weeks a month's day grid shows: every week that holds one of the month's days, each seven
 * days long from `firstDay`. The first and last week include the neighbouring months' days that
 * share them, so a month spans four to six weeks.
 *
 * @param month - The month.
 * @param firstDay - The weekday each week starts on.
 * @returns The weeks in order, each its seven days in order.
 */
export function monthWeeks(
  month: Temporal.PlainYearMonth,
  firstDay: IsoWeekday
): ReadonlyArray<ReadonlyArray<Temporal.PlainDate>> {
  const first = month.toPlainDate({ day: 1 });
  const last = month.toPlainDate({ day: month.daysInMonth });
  const weeks: Temporal.PlainDate[][] = [];
  let day = first.subtract({ days: (first.dayOfWeek - firstDay + 7) % 7 });
  while (day.until(last).days >= 0) {
    const week: Temporal.PlainDate[] = [];
    for (let index = 0; index < 7; index += 1) {
      week.push(day);
      day = day.add({ days: 1 });
    }
    weeks.push(week);
  }
  return weeks;
}
