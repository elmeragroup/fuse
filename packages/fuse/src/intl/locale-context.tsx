"use client";

import { createContext, use, useMemo } from "react";
import type { ReactNode } from "react";

/** A locale with built-in translations in Fuse. */
export type SupportedLocale = "nb-NO" | "sv-SE" | "en-US" | "fi-FI";

/** The locale shared by every string-bearing component. */
export type LocaleContextValue = {
  locale: SupportedLocale;
};

/** The locale and child tree supplied to `LocaleProvider`. */
export type LocaleProviderProps = {
  locale: SupportedLocale;
  children: ReactNode;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

/** Supply a supported locale to the child component tree. */
export function LocaleProvider({ locale, children }: LocaleProviderProps) {
  const value = useMemo((): LocaleContextValue => ({ locale }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Read the active locale. Throws when the required `LocaleProvider` is missing.
 *
 * Not react-aria's `useLocale`, which is a different hook (it also returns `direction`) and is
 * confined to `src/react-aria/**`. A quarantine file needing both must alias one of them.
 */
export function useLocale(): LocaleContextValue {
  const value = use(LocaleContext);
  if (value === undefined) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return value;
}
