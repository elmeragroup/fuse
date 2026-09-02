import type { ReactElement, ReactNode } from "react";

import type { Metadata } from "next";

import {
  ColorSchemeScript,
  defaultDensityForVariant,
  densityAttributes,
  themeAttributes,
} from "@elmeragroup/ui/theme";

import { ThemeHost } from "../components/theme-host";
import { COLOR_SCHEME, DEFAULT_THEME } from "../lib/theme";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "elmera/ui playground",
  robots: { index: false, follow: false },
};

export type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps): ReactElement {
  return (
    <html
      lang="en"
      className="bg-background text-foreground"
      {...themeAttributes(DEFAULT_THEME)}
      {...densityAttributes(defaultDensityForVariant(DEFAULT_THEME.variant))}
      suppressHydrationWarning>
      <head>
        <ColorSchemeScript
          storageKey={COLOR_SCHEME.storageKey}
          defaultColorScheme={COLOR_SCHEME.defaultColorScheme}
          enableSystem={COLOR_SCHEME.enableSystem}
        />
      </head>
      <body className="m-0 min-h-svh bg-background text-foreground antialiased">
        <ThemeHost>{children}</ThemeHost>
      </body>
    </html>
  );
}
