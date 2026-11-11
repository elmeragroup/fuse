/**
 * The singular and plural forms of a counted word, the one picker that chooses between them
 * through `Intl.PluralRules`, and the count written with its word.
 */
import { numberFormat, pluralRules } from "../internal/intl-cache";
import { canonicalSpaces } from "./canonical-spaces";
import type { SupportedLocale } from "./locale-context";

/** A word in the singular and plural forms `Intl.PluralRules` selects between. */
export type Inflected = { readonly one: string; readonly other: string };

/**
 * The form of a word a count takes in a locale.
 *
 * @param locale - The active supported locale.
 * @param count - The count the word follows.
 * @param word - The word's forms.
 * @param options - The digits the count prints with, which decide its plural category.
 * @returns The singular for the locale's "one" category, else the plural.
 */
export function inflect(
  locale: SupportedLocale,
  count: number,
  word: Inflected,
  options: Intl.PluralRulesOptions = {}
): string {
  return pluralRules(locale, options).select(count) === "one" ? word.one : word.other;
}

/**
 * A count in words, such as `25 timer`, `1 day` or `52 punkter`, joined by a no-break space so the
 * number never wraps away from its word.
 *
 * @param locale - The active supported locale.
 * @param count - The number of things.
 * @param word - The word's forms, such as a slot interval's or the points' word.
 * @returns The count and its word in the locale's plural form.
 */
export function countOf(locale: SupportedLocale, count: number, word: Inflected): string {
  const number = canonicalSpaces(numberFormat(locale, {}).format(count));
  return `${number}\u00a0${inflect(locale, count, word)}`;
}
