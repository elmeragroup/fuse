import { Suspense } from "react";
import type { ReactElement, ReactNode } from "react";

import type { Metadata, Viewport } from "next";

import { ColorSchemeScript, LEGAL_THEMES, themeAttributes, themeSlug } from "@elmeragroup/fuse/theme";

import { DocumentRoot } from "../../components/document-root";
import { ogLandingPath, ogMetadata } from "../../lib/og-metadata";
import { siteOrigin } from "../../lib/site-origin";
import { DOCUMENT_COLOR_SCHEME, OPENING_THEME } from "../../lib/theme";
import "../../styles/globals.css";
import { LANDING_SUMMARY } from "./landing/landing-facts";
import { LandingPage } from "./landing/landing-page";
import { THEME_QUERY } from "./landing/landing-theme-defaults";

/** The card is the same whatever theme the address names, so every landing route shares it. */
export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  title: "Fuse · The Elmera Group design system",
  description: LANDING_SUMMARY,
  ...ogMetadata({ image: ogLandingPath(), alt: "Fuse, the Elmera Group design system" }),
};

/** The landing prerenders whole, once in the opening theme and once per shared theme. */
export const ensureStatic = "navigation";

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

/** Every slug Fuse's slug parser accepts, mapped to the attributes its theme stamps. */
const SLUG_ATTRIBUTES = JSON.stringify(
  Object.fromEntries(LEGAL_THEMES.map((theme) => [themeSlug(theme), themeAttributes(theme)]))
);

/**
 * Restamps `<html>` with a shared address's theme before the browser can paint. The layout
 * stamps `OPENING_THEME` on the server, because a layout receives no search params, and a shared
 * address's landing arrives after an empty shell. So the script reads `?theme=` from the address
 * itself, by `parseThemeSearch`'s rules: exactly one value that names a legal slug stamps, and a
 * missing, repeated or illegal value leaves the opening theme, as `proxy.ts` leaves the request on
 * `/`. The map's keys are `themeSlug` over `LEGAL_THEMES`, the set `parseThemeSlug` accepts, so the
 * script carries no slug grammar of its own and the same text serves every landing route.
 */
const THEME_QUERY_SCRIPT = `(function(m){var v=new URLSearchParams(location.search).getAll(${JSON.stringify(THEME_QUERY)});if(v.length!==1||!Object.prototype.hasOwnProperty.call(m,v[0]))return;var a=m[v[0]],r=document.documentElement;for(var k in a)r.setAttribute(k,a[k])})(${SLUG_ATTRIBUTES})`;

export type LandingLayoutProps = {
  children: ReactNode;
};

export default function LandingLayout({ children }: LandingLayoutProps): ReactElement {
  return (
    <DocumentRoot theme={OPENING_THEME} suppressHydrationWarning>
      <head>
        <ColorSchemeScript
          storageKey={DOCUMENT_COLOR_SCHEME.storageKey}
          defaultColorScheme={DOCUMENT_COLOR_SCHEME.defaultColorScheme}
          enableSystem={DOCUMENT_COLOR_SCHEME.enableSystem}
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_QUERY_SCRIPT }} />
      </head>
      <body className="m-0 min-w-80 bg-background font-sans text-foreground antialiased">
        {/* The landing reads the route's theme param, which the build's shell for the themed
            route does not have yet, so it suspends there; each theme's prerender resumes it. A
            shared address's landing therefore follows an empty shell, which the head script has
            already stamped. `/` has no param to wait for. */}
        <Suspense fallback={null}>
          <LandingPage />
        </Suspense>
        {children}
      </body>
    </DocumentRoot>
  );
}
