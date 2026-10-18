"use client";

import { createContext, use, useMemo } from "react";
import type { ReactNode } from "react";

/** A locale with built-in translations in Fuse. */
export type SupportedLocale = "nb-NO" | "sv-SE" | "en-US" | "fi-FI";

/** The locale and time zone shared by every string-bearing component. */
export type LocaleContextValue = {
  locale: SupportedLocale;
  /** The IANA time zone dates format in, when the host supplied one. */
  timeZone?: string;
};

/** The locale, time zone and child tree supplied to `LocaleProvider`. */
export type LocaleProviderProps = {
  locale: SupportedLocale;
  /**
   * The IANA time zone that dates and times format in, such as `"Europe/Oslo"`. Pass the zone of
   * the market the data describes, not the viewer's. It removes the differences that runtime zones
   * cause, so a server and a browser in different zones write the same dates. WebKit's date-time
   * join still differs for some styles, as `data-table-format.ts` and `TODO.md` record. Without
   * it, `DataTable` date cells format in the runtime's zone. An invalid name throws a `RangeError`
   * when the provider renders.
   */
  timeZone?: string;
  children: ReactNode;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

/** Supply a supported locale, and optionally a time zone, to the child component tree. */
export function LocaleProvider({ locale, timeZone, children }: LocaleProviderProps) {
  const value = useMemo((): LocaleContextValue => {
    // Intl throws a RangeError for a name that isn't an IANA zone, and accepts a missing one.
    Intl.DateTimeFormat("en-US", { timeZone });
    return { locale, timeZone };
  }, [locale, timeZone]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Read the active locale and time zone. Throws when the required `LocaleProvider` is missing.
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
