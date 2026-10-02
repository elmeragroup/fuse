import type { ReactElement, ReactNode } from "react";

import type { Metadata, Viewport } from "next";

import { ColorSchemeScript, densityAttributes, themeAttributes } from "@elmeragroup/fuse/theme";

import { DOCUMENT_COLOR_SCHEME } from "../../lib/theme";
import "../../styles/globals.css";
import { LANDING_DENSITY, LANDING_THEME } from "./landing/landing-theme-defaults";

export const metadata: Metadata = {
  title: "Fuse · The Elmera Group design system",
  description:
    "67 React components for six brands, two segments and two variants. One attribute sets the theme.",
};

// `viewport-fit=cover` lets the sticky nav and the footer paint under the notch and the home
// indicator and pad themselves back out with `env(safe-area-inset-*)`. The theme-color pair is the
// first-paint value; the landing rewrites both tags to the live `--background` whenever
// the page re-themes, so the status bar follows the brand.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export type LandingLayoutProps = {
  children: ReactNode;
};

export default function LandingLayout({ children }: LandingLayoutProps): ReactElement {
  return (
    <html
      lang="en"
      className="bg-background text-foreground"
      {...themeAttributes(LANDING_THEME)}
      {...densityAttributes(LANDING_DENSITY)}
      suppressHydrationWarning>
      <head>
        <ColorSchemeScript
          storageKey={DOCUMENT_COLOR_SCHEME.storageKey}
          defaultColorScheme={DOCUMENT_COLOR_SCHEME.defaultColorScheme}
          enableSystem={DOCUMENT_COLOR_SCHEME.enableSystem}
        />
      </head>
      <body className="m-0 min-w-80 bg-background font-sans text-foreground antialiased">{children}</body>
    </html>
  );
}
