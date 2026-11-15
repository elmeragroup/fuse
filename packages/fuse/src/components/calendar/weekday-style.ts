/**
 * Picks the weekday column-label width for the shared calendar grid. The module is pure and
 * React-free, so the grid can call it on the render path without extra state.
 */

/** The two weekday label styles a seven-column grid can use. */
export type WeekdayStyle = "narrow" | "short";

/**
 * The widest locale-short weekday name, in code points, a seven-column grid keeps
 * before falling back to narrow glyphs. English short names are 3, the Nordic ones 4,
 * Arabic 8; the grid the pickers open is a few hundred pixels wide, so 5 is the
 * boundary. The choice follows width, never the writing direction.
 */
const SHORT_NAME_LIMIT = 5;

/** One sample week, Sunday first, for measuring a locale's short weekday names. */
const SAMPLE_WEEK = Array.from({ length: 7 }, (_, index) => new Date(Date.UTC(2026, 0, 4 + index)));

/** The measured style per locale, so the render path formats the sample week once. */
const STYLE_BY_LOCALE = new Map<string, WeekdayStyle>();

/**
 * The weekday column-label style for a locale. Narrow single-glyph labels are a width
 * fallback. A locale whose short names overflow a grid column gets them, and a locale with
 * compact short names keeps its short names.
 */
export function weekdayStyle(locale: string): WeekdayStyle {
  const cached = STYLE_BY_LOCALE.get(locale);
  if (cached !== undefined) {
    return cached;
  }
  const short = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const widest = SAMPLE_WEEK.reduce((max, day) => Math.max(max, Array.from(short.format(day)).length), 0);
  const style: WeekdayStyle = widest > SHORT_NAME_LIMIT ? "narrow" : "short";
  STYLE_BY_LOCALE.set(locale, style);
  return style;
}
