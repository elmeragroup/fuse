/**
 * CONTRACT section 8.12's month-switch fixture, written by hand: one value per Oslo day of October
 * 2025, equal to the day of the month, so the window's highest value is its last day. The first load
 * holds 1 to 30 October, and the reload adds the 31st.
 */

/** One October day. */
export type DayRow = { readonly day: Date; readonly kwh: number };

/** Oslo's local midnight on an October 2025 day, which is 22:00 UTC the day before under CEST. */
export function october(day: number): Date {
  // Summer time ends on 26 October, so later midnights are 23:00 UTC the day before.
  return new Date(Date.UTC(2025, 9, day - 1, day <= 26 ? 22 : 23));
}

/** A September 2025 Oslo midnight, under CEST. */
export function september(day: number): Date {
  return new Date(Date.UTC(2025, 8, day - 1, 22));
}

const rows = (days: number): DayRow[] =>
  Array.from({ length: days }, (_, index) => ({ day: october(index + 1), kwh: index + 1 }));

/** The first load, 1 to 30 October. */
export const OCTOBER_FIRST_LOAD = rows(30);

/** The reload, 1 to 31 October. */
export const OCTOBER_RELOAD = rows(31);
