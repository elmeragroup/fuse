"use client";

import { use } from "react";
import type { ReactNode } from "react";

import { ThemeContext, useResolvedTheme } from "./theme-context";
import type { Theme } from "./theme-context";
import type { ThemeInput } from "./tokens/themes";

export type ThemeProviderProps = {
  theme: ThemeInput;
  children: ReactNode;
};

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const value = useResolvedTheme(theme);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = use(ThemeContext);
  if (theme === undefined) {
    throw new Error("useTheme must be used within ThemeProvider or ThemeScope");
  }
  return theme;
}
