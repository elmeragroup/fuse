/** One medium-date formatter per locale, so a frame-by-frame caller builds each once. */
const formats = new Map<string, Intl.DateTimeFormat>();

/**
 * A calendar day in the video's locale, in the medium date style ("Oct 2, 2026", "2. okt. 2026").
 * The day is read in UTC, so every render machine formats the same date.
 *
 * @param locale - The video's locale.
 * @param utcMs - Midnight UTC of the day, as `Date.UTC` returns it.
 * @returns The formatted day.
 */
export function formatDay(locale: string, utcMs: number): string {
  let format = formats.get(locale);
  if (format === undefined) {
    format = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
    formats.set(locale, format);
  }
  return format.format(utcMs);
}
