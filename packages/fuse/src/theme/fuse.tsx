"use client";

import { createContext, use, useMemo } from "react";
import type { ReactNode } from "react";

/** A locale with built-in translations in Fuse. */
export type SupportedLocale = "nb-NO" | "sv-SE" | "en-US" | "fi-FI";

/** The locale shared by Fuse components. */
export type FuseContextValue = {
  locale: SupportedLocale;
};

/** The locale and child tree supplied to Fuse. */
export type FuseProviderProps = {
  locale: SupportedLocale;
  children: ReactNode;
};

const FuseContext = createContext<FuseContextValue | undefined>(undefined);

/** Supply a supported locale to the child component tree. */
export function FuseProvider({ locale, children }: FuseProviderProps) {
  const value = useMemo((): FuseContextValue => ({ locale }), [locale]);
  return <FuseContext.Provider value={value}>{children}</FuseContext.Provider>;
}

/** Read the Fuse locale. Throws when the required FuseProvider is missing. */
export function useFuse(): FuseContextValue {
  const value = use(FuseContext);
  if (value === undefined) {
    throw new Error("useFuse must be used within FuseProvider");
  }
  return value;
}
