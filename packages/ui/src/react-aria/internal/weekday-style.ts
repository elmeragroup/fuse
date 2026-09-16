/**
 * Weekday column-label width decision for the shared calendar grid. Pure and
 * React-free, so the grid can ask it on the render path without extra state.
 */

/** The two weekday label styles a seven-column grid can use. */
export type WeekdayStyle = "narrow" | "short";

/**
 * The widest locale-short weekday name, in code points, a seven-column grid keeps
 * before falling back to narrow glyphs. English short names are 3, the Nordic ones 4,
 * Arabic 8; the grid the pickers open is a few hundred pixels wide, so 5 is the
 * boundary. Width is the driver, never the writing direction.
 */
const SHORT_NAME_LIMIT = 5;

/** One sample week, Sunday first, for measuring a locale's short weekday names. */
const SAMPLE_WEEK = Array.from({ length: 7 }, (_, index) => new Date(Date.UTC(2026, 0, 4 + index)));

/**
 * Weekday column-label style for a locale. Narrow single-glyph labels are a width
 * fallback: a locale whose short names overflow a grid column gets them, a locale with
 * compact short names keeps those.
 */
export function weekdayStyle(locale: string): WeekdayStyle {
  const short = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const widest = SAMPLE_WEEK.reduce((max, day) => Math.max(max, Array.from(short.format(day)).length), 0);
  return widest > SHORT_NAME_LIMIT ? "narrow" : "short";
}
