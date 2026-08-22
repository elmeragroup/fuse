"use client";

import { useMemo } from "react";

import { LocalizedStringFormatter } from "@internationalized/string";
import type { LocalizedString, LocalizedStringDictionary } from "@internationalized/string";

import { useElmeraGroupUi } from "../theme/elmera-group-ui";

/**
 * Package-private string resolution. Locale comes only from ElmeraGroupUiProvider.
 * Explicit component string props override the dictionary at the call site:
 * `override ?? strings.format(key)`.
 */
export function useLocalizedStrings<K extends string, T extends LocalizedString>(
  dictionary: LocalizedStringDictionary<K, T>
): LocalizedStringFormatter<K, T> {
  const { locale } = useElmeraGroupUi();
  return useMemo(() => new LocalizedStringFormatter(locale, dictionary), [dictionary, locale]);
}
