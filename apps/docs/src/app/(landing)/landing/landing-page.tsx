import type { ReactElement } from "react";

import Link from "next/link";
import { tv } from "tailwind-variants";

import { themeAttributes } from "@elmeragroup/fuse/theme";
import type { ThemeInput } from "@elmeragroup/fuse/theme";
import { Toast } from "@elmeragroup/fuse/toast";

import { HOME_PAGE, requireStaticPage } from "../../../lib/pages";
import { OPENING_THEME } from "../../../lib/theme";
import { BrandPicker } from "./brand-picker";
import { LandingDensity } from "./landing-density";
import { LandingHero } from "./landing-hero";
import { LandingInstall } from "./landing-install";
import { LandingNav } from "./landing-nav";
import { LandingSpecs } from "./landing-specs";
import { LandingThemeProvider } from "./landing-theme";
import { sameTheme } from "./landing-theme-defaults";
import { ProductShot } from "./product-shot";

const landingPage = tv({
  slots: {
    root: "min-h-svh bg-background text-foreground",
    footer: "border-t border-border",
    footerInner:
      "text-sm sm:flex-row sm:items-center sm:px-6 max-w-landing pb-footer-end mx-auto flex w-full flex-col gap-4 px-4 py-8 text-muted-foreground lg:px-12",
    footerLinks: "sm:ml-auto flex gap-5",
    footerLink: "underline-offset-4 hover:text-foreground hover:underline",
  },
});

const styles = landingPage();

const FOOTER_LINKS = [
  { href: HOME_PAGE.href, label: "Docs" },
  requireStaticPage("/releases"),
  requireStaticPage("/accessibility"),
];

/**
 * Restamps `<html>` with a shared address's theme before the browser paints the page. The layout
 * stamps `OPENING_THEME` on the server, because a layout receives no search params; this script is
 * the body's first child, so it runs before any paintable element is parsed. Its values are the
 * attributes of a theme Fuse's slug parser accepted, so the inlined JSON holds only enum members.
 */
function SharedThemeScript({ theme }: { theme: ThemeInput }): ReactElement {
  const attributes = JSON.stringify(themeAttributes(theme));
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(a){var r=document.documentElement;for(var k in a)r.setAttribute(k,a[k])})(${attributes})`,
      }}
    />
  );
}

export type LandingPageProps = {
  /** The theme a shared address names, or `OPENING_THEME`. */
  theme: ThemeInput;
};

export function LandingPage({ theme }: LandingPageProps): ReactElement {
  return (
    <>
      {sameTheme(theme, OPENING_THEME) ? null : <SharedThemeScript theme={theme} />}
      <LandingThemeProvider routeTheme={theme}>
        <Toast.Provider>
          <div className={styles.root()} data-landing>
            <LandingNav />
            <main>
              <LandingHero />
              <BrandPicker />
              <ProductShot />
              <LandingSpecs />
              <LandingDensity />
              <LandingInstall />
            </main>
            <footer className={styles.footer()}>
              <div className={styles.footerInner()}>
                <span>
                  Fuse is built by Elmera Group for Fjordkraft, TrøndelagKraft, Gudbrandsdal Energi, Telinet
                  and Nordic Green Energy.
                </span>
                <span className={styles.footerLinks()}>
                  {FOOTER_LINKS.map((link) => (
                    <Link key={link.href} href={link.href} className={styles.footerLink()}>
                      {link.label}
                    </Link>
                  ))}
                </span>
              </div>
            </footer>
          </div>
          <Toast.Viewport />
        </Toast.Provider>
      </LandingThemeProvider>
    </>
  );
}
