"use client";

import type { ReactElement } from "react";

import Link from "next/link";
import { tv } from "tailwind-variants";

import { Toast } from "@elmeragroup/fuse/toast";

import { BrandPicker } from "./brand-picker";
import { LandingDensity } from "./landing-density";
import { LandingHero } from "./landing-hero";
import { LandingInstall } from "./landing-install";
import { LandingNav, SchemeSwitch } from "./landing-nav";
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
    // The nav has no room for the scheme switch on phones, so it lives here instead.
    footerScheme: "sm:hidden",
    footerLink: "underline-offset-4 hover:text-foreground hover:underline",
  },
});

const styles = landingPage();

export function LandingPage(): ReactElement {
  return (
    <LandingThemeProvider>
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
                Fuse is built by Elmera Group for Fjordkraft, TrøndelagKraft, Gudbrandsdal Energi and Telinet.
              </span>
              <span className={styles.footerScheme()}>
                <SchemeSwitch />
              </span>
              <span className={styles.footerLinks()}>
                <Link href="/" className={styles.footerLink()}>
                  Docs
                </Link>
                <Link href="/releases" className={styles.footerLink()}>
                  Releases
                </Link>
                <Link href="/accessibility" className={styles.footerLink()}>
                  Accessibility
                </Link>
              </span>
            </div>
          </footer>
        </div>
        <Toast.Viewport />
      </Toast.Provider>
    </LandingThemeProvider>
  );
}
