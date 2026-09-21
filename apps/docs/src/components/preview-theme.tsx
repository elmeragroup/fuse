"use client";

import { createContext, use, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import type { ThemeInput } from "@elmeragroup/fuse/theme";

import { DEFAULT_THEME } from "../lib/theme";

export type PreviewThemeContextValue = {
  theme: ThemeInput;
  setTheme: (theme: ThemeInput) => void;
};

const PreviewThemeContext = createContext<PreviewThemeContextValue | undefined>(undefined);

export type PreviewThemeProviderProps = {
  children: ReactNode;
};

export function PreviewThemeProvider({ children }: PreviewThemeProviderProps): ReactElement {
  const [theme, setTheme] = useState<ThemeInput>(DEFAULT_THEME);
  const value = useMemo(
    (): PreviewThemeContextValue => ({
      theme,
      setTheme,
    }),
    [theme]
  );

  return <PreviewThemeContext.Provider value={value}>{children}</PreviewThemeContext.Provider>;
}

export function usePreviewTheme(): PreviewThemeContextValue {
  const value = use(PreviewThemeContext);
  if (value === undefined) {
    throw new Error("usePreviewTheme must be used within PreviewThemeProvider");
  }
  return value;
}
