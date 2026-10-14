"use client";

import { use, useSyncExternalStore } from "react";

import type { UseColorSchemeResult } from "./color-scheme";
import { ColorSchemeContext } from "./color-scheme-root";

export function useColorScheme(): UseColorSchemeResult {
  const runtime = use(ColorSchemeContext);
  if (runtime === undefined) {
    throw new Error("useColorScheme must be used within ThemeProvider");
  }
  return useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getServerSnapshot);
}
