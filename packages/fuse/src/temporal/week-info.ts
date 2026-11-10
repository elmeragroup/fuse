// The week facts of the four locales Fuse supports. Pure and free of Temporal, so the data table
// filter's date presets read it on a server without the polyfill. A table rather than
// `Intl.Locale#getWeekInfo`, so the answer never depends on an engine's Intl data.

import type { SupportedLocale } from "../intl/locale-context";

/** A day of the week as Temporal numbers it: Monday is 1 and Sunday is 7. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * The first day of the week in each locale Fuse supports, as CLDR gives it for the locale's
 * region. A locale added to `SupportedLocale` fails to compile here until it has a row.
 */
const FIRST_DAY_OF_WEEK = {
  "en-US": 7,
  "nb-NO": 1,
  "sv-SE": 1,
  "fi-FI": 1,
} as const satisfies Record<SupportedLocale, IsoWeekday>;

/**
 * The day a locale's weeks start on.
 *
 * @param locale - A locale Fuse supports.
 * @returns Sunday (7) in en-US, Monday (1) in nb-NO, sv-SE and fi-FI.
 */
export function firstDayOfWeek(locale: SupportedLocale): IsoWeekday {
  return FIRST_DAY_OF_WEEK[locale];
}
