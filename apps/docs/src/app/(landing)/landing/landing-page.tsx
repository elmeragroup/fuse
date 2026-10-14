import type { ReactElement } from "react";

import Link from "next/link";
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
 * The landing, rendered once by the landing layout for every landing route, so a client navigation
 * between `/` and a shared address keeps one instance and the address alone moves its theme.
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
                    <Link key={link.href} href={link.href} className={styles.footerLink()}>
                      {link.label}
                    </Link>
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
