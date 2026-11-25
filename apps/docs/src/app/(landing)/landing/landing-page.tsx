import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Toast } from "@elmeragroup/fuse/toast";

import { HOME_PAGE, requireStaticPage } from "../../../lib/pages";
import { BrandPicker } from "./brand-picker";
import { LandingDensity } from "./landing-density";
import { LandingHero } from "./landing-hero";
import { LandingInstall } from "./landing-install";
import { LandingNav } from "./landing-nav";
import { LandingPalette } from "./landing-palette";
import { LandingSpecs } from "./landing-specs";
import { LandingThemeProvider } from "./landing-theme";
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
 * The landing. The landing layout renders it for both landing routes: `/` and `themed/[theme]`,
 * where `proxy.ts` rewrites a shared address. Picking a theme updates the mounted page, then
 * replaces the current history entry's address with `replaceState`, so the page stays mounted.
 */
export function LandingPage(): ReactElement {
  return (
    <LandingThemeProvider>
      <Toast.Provider>
        <LandingPalette>
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
                    <a key={link.href} href={link.href} className={styles.footerLink()}>
                      {link.label}
                    </a>
                  ))}
                </span>
              </div>
            </footer>
          </div>
        </LandingPalette>
        <Toast.Viewport />
      </Toast.Provider>
    </LandingThemeProvider>
  );
}
