/**
 * How each locale joins the two ends of a range. Fuse joins the ends itself rather than calling
 * `Intl.DateTimeFormat#formatRange`, whose shortening differs by engine. Firefox writes fi-FI's
 * October to December 2026 as `loka–joulukuu 2026`, and Chromium and WebKit as
 * `lokakuu 2026–joulukuu 2026`.
 */
import type { SupportedLocale } from "./locale-context";

/**
 * CLDR's interval fallback pattern in each locale Fuse supports: `{0} – {1}` in en-US and
 * `{0}–{1}` in the Nordic locales. A caller maps the joined text through `canonicalSpaces`, so the
 * en-US spaces print as no-break spaces. A locale added to `SupportedLocale` fails to compile here
 * until it has a separator.
 */
const RANGE_SEPARATORS = {
  "en-US": " – ",
  "nb-NO": "–",
  "sv-SE": "–",
  "fi-FI": "–",
} as const satisfies Record<SupportedLocale, string>;

/**
 * The text between the two ends of a range in a locale, such as ` – ` in en-US.
 *
 * @param locale - A locale Fuse supports.
 * @returns The separator.
 */
export function rangeSeparator(locale: SupportedLocale): string {
  return RANGE_SEPARATORS[locale];
}
