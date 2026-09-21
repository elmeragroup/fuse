import type { ReactNode } from "react";

import { createRoot } from "react-dom/client";

import { ThemeProvider } from "@elmeragroup/fuse/theme";
import type { ColorSchemeOptions, ThemeInput } from "@elmeragroup/fuse/theme";

import { App } from "./app";

export function renderFixture(theme: ThemeInput, colorScheme: ColorSchemeOptions, preview?: ReactNode): void {
  const host = document.getElementById("root");
  if (host === null) {
    throw new Error("Static theme fixture is missing #root");
  }

  createRoot(host).render(
    <ThemeProvider theme={theme} {...colorScheme} injectColorSchemeScript={false}>
      {preview ?? <App />}
    </ThemeProvider>
  );
}
