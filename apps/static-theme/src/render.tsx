import type { ReactNode } from "react";

import { createRoot } from "react-dom/client";

import { ThemeProvider } from "@elmeragroup/ui/theme";
import type { ColorScheme, ThemeInput } from "@elmeragroup/ui/theme";

import { App } from "./app";

export function renderFixture(
  theme: ThemeInput,
  storageKey: string,
  defaultColorScheme: ColorScheme,
  enableSystem: boolean,
  forcedColorScheme: ColorScheme | undefined,
  preview?: ReactNode
): void {
  const host = document.getElementById("root");
  if (host === null) {
    throw new Error("Static theme fixture is missing #root");
  }

  createRoot(host).render(
    <ThemeProvider
      theme={theme}
      storageKey={storageKey}
      defaultColorScheme={defaultColorScheme}
      enableSystem={enableSystem}
      forcedColorScheme={forcedColorScheme}
      injectColorSchemeScript={false}>
      {preview ?? <App />}
    </ThemeProvider>
  );
}
