"use client";

import { use } from "react";

import type { UseColorSchemeResult } from "./color-scheme";
import { ColorSchemeContext } from "./color-scheme-context";

export function useColorScheme(): UseColorSchemeResult {
  const value = use(ColorSchemeContext);
  if (value === undefined) {
    throw new Error("useColorScheme must be used within ThemeProvider");
  }
  return value;
}
