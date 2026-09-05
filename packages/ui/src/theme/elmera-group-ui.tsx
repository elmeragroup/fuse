"use client";

import { createContext, use, useMemo } from "react";
import type { ReactNode } from "react";

export type SupportedLocale = "nb-NO" | "sv-SE" | "en-US" | "fi-FI";

export type ElmeraGroupUiContextValue = {
  locale: SupportedLocale;
};

export type ElmeraGroupUiProviderProps = {
  locale: SupportedLocale;
  children: ReactNode;
};

const ElmeraGroupUiContext = createContext<ElmeraGroupUiContextValue | undefined>(undefined);

export function ElmeraGroupUiProvider({ locale, children }: ElmeraGroupUiProviderProps) {
  const value = useMemo((): ElmeraGroupUiContextValue => ({ locale }), [locale]);
  return <ElmeraGroupUiContext.Provider value={value}>{children}</ElmeraGroupUiContext.Provider>;
}

export function useElmeraGroupUi(): ElmeraGroupUiContextValue {
  const value = use(ElmeraGroupUiContext);
  if (value === undefined) {
    throw new Error("useElmeraGroupUi must be used within ElmeraGroupUiProvider");
  }
  return value;
}
