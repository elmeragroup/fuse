"use client";

import { LocalizedStringFormatter } from "@internationalized/string";
import type { LocalizedString, LocalizedStringDictionary } from "@internationalized/string";

import { useLocale } from "../intl/locale-context";

const formattersByDictionary = new WeakMap<
  object,
  Map<string, LocalizedStringFormatter<string, LocalizedString>>
>();

function getCachedFormatter<K extends string, T extends LocalizedString>(
  dictionary: LocalizedStringDictionary<K, T>,
  locale: string
): LocalizedStringFormatter<K, T> {
  let byLocale = formattersByDictionary.get(dictionary);
  if (byLocale === undefined) {
    byLocale = new Map();
    formattersByDictionary.set(dictionary, byLocale);
  }
  const cached = byLocale.get(locale);
  if (cached !== undefined) {
    // SAFETY: stored under this dictionary, so the formatter's K/T match the caller.
    return cached as LocalizedStringFormatter<K, T>;
  }
  const formatter = new LocalizedStringFormatter(locale, dictionary);
  byLocale.set(locale, formatter);
  return formatter;
}

/**
 * Package-private string resolution. Locale comes only from LocaleProvider.
 * Explicit component string props override the dictionary at the call site:
 * `override ?? strings.format(key)`. Formatters are cached per dictionary identity
 * and locale so chips, toasts, and pagination edges share one instance.
 */
export function useLocalizedStrings<K extends string, T extends LocalizedString>(
  dictionary: LocalizedStringDictionary<K, T>
): LocalizedStringFormatter<K, T> {
  const { locale } = useLocale();
  return getCachedFormatter(dictionary, locale);
}
