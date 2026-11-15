"use client";

import { createContext, use, useMemo } from "react";
import type { ReactNode } from "react";

/**
 * A locale with built-in translations in Fuse.
 *
 * @public
 */
export type SupportedLocale = "nb-NO" | "sv-SE" | "en-US" | "fi-FI";

/** The locale and time zone shared by every string-bearing component. */
export type LocaleContextValue = {
  locale: SupportedLocale;
  /** The IANA time zone dates format in, when the host supplied one. */
  timeZone?: string;
};

/** Props for `LocaleProvider`, the locale, time zone and child tree it supplies. */
export type LocaleProviderProps = {
  locale: SupportedLocale;
  /**
   * The IANA time zone that dates and times format in, such as `"Europe/Oslo"`. Pass the zone of
   * the market the data describes, not the viewer's. It removes the differences that runtime zones
   * cause, so a server and a browser in different zones write the same dates. Without it,
   * `DataTable` date cells format in the runtime's zone. An invalid name throws a `RangeError`
   * when the provider renders.
   */
  timeZone?: string;
  children: ReactNode;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

/** A provider that gives the child component tree a supported locale and an optional time zone. */
export function LocaleProvider({ locale, timeZone, children }: LocaleProviderProps) {
  const value = useMemo((): LocaleContextValue => {
    // Intl throws a RangeError for a name that isn't an IANA zone, and accepts a missing one.
    Intl.DateTimeFormat("en-US", { timeZone });
    return { locale, timeZone };
  }, [locale, timeZone]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * The active locale and time zone. It throws when the required `LocaleProvider` is missing.
 */
export function useLocale(): LocaleContextValue {
  const value = use(LocaleContext);
  if (value === undefined) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return value;
}
