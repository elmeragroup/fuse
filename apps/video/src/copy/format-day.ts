import { dateTimeFormat } from "./intl";

/**
 * A calendar day in the video's locale, in the medium date style ("Oct 2, 2026", "2. okt. 2026").
 * The day is read in UTC, so every render machine formats the same date.
 *
 * @param locale - The video's locale.
 * @param utcMs - Midnight UTC of the day, as `Date.UTC` returns it.
 * @returns The formatted day.
 */
export function formatDay(locale: string, utcMs: number): string {
  return dateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(utcMs);
}
