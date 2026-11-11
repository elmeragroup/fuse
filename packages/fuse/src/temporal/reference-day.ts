import { temporal } from "./temporal";

/**
 * The day the date components use where any fixed day serves: January 1, 2001, a Monday (ISO
 * weekday 1), on which the zones Fuse's markets use move no clocks. A calendar names its weekdays
 * from the week it starts, a picker hands it as a witness of its kind, and a popup time input
 * forms a time on it while its picker holds no day (`date-field/date-input-scope.ts`).
 *
 * @returns The day, a new object each call.
 */
export function referenceDay(): Temporal.PlainDate {
  return temporal().PlainDate.from({ year: 2001, month: 1, day: 1 });
}
