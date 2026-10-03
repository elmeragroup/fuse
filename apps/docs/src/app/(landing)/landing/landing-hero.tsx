import type { ReactElement } from "react";

import Link from "next/link";
import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";

import { BrandWordmark } from "./brand-wordmark";
import { HeroWindow } from "./hero-window";
import { BROWSE_COMPONENTS, LANDING_SUMMARY, PICKER_BRANDS, QUICK_START } from "./landing-facts";

const landingHero = tv({
  slots: {
    section: "sm:pb-30 flex flex-col items-center pb-18",
    copy: "sm:px-6 flex flex-col items-center gap-6 px-4 pt-16 text-center lg:gap-5",
    eyebrow: "text-xs tracking-landing-eyebrow font-mono text-primary uppercase",
    title:
      "text-5xl sm:text-7xl tracking-landing-hero lg:text-landing-hero font-semibold font-heading text-balance text-foreground",
    titleAccent: "block text-primary",
    lede: "text-base leading-relaxed sm:text-xl max-w-180 text-pretty text-muted-foreground",
    actions: "sm:flex-row sm:w-auto sm:gap-6 flex w-full flex-col items-center gap-3",
    primary: "sm:w-auto w-full",
    // The window sits between the actions and the brand strip, as wide as the page allows, and
    // close enough under them that 40% of it shows in a 1440×900 first viewport.
    shot: "flex w-full justify-center pt-12 lg:pt-8",
    strip: "sm:px-6 flex w-full justify-center px-4",
    // Every brand in one ink, quieter than the copy above it.
    brands:
      "sm:gap-x-12 sm:pt-12 max-w-landing m-0 flex list-none flex-wrap items-center justify-center gap-x-7 gap-y-6 p-0 pt-8 text-muted-foreground",
    brand: "flex",
  },
});

const styles = landingHero();

export function LandingHero(): ReactElement {
  return (
    <section className={styles.section()} aria-labelledby="landing-title">
      <div className={styles.copy()}>
        <p className={styles.eyebrow()}>The Elmera Group design system</p>
        <h1 id="landing-title" className={styles.title()}>
          One system.
          <span className={styles.titleAccent()}>Every brand.</span>
        </h1>
        <p className={styles.lede()}>{LANDING_SUMMARY}</p>
        <div className={styles.actions()}>
          <Button
            size="lg"
            className={styles.primary()}
            render={<Link href={QUICK_START.href} />}
            nativeButton={false}>
            Get started
          </Button>
          <Button variant="link" render={<Link href={BROWSE_COMPONENTS.href} />} nativeButton={false}>
            Browse components ›
          </Button>
        </div>
      </div>
      <div className={styles.shot()}>
        <HeroWindow />
      </div>
      <div className={styles.strip()}>
        <ul aria-label="Brands" className={styles.brands()}>
          {PICKER_BRANDS.map((brand) => (
            <li key={brand} className={styles.brand()}>
              <BrandWordmark brand={brand} size="strip" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
