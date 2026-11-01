/**
 * The singular and plural forms of a chart word, and the one picker that chooses between them
 * through `Intl.PluralRules`.
 */
import { pluralRules } from "../../../internal/intl-cache";
import type { SupportedLocale } from "../../../intl/locale-context";

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
