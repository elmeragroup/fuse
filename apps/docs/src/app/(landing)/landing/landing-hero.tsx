"use client";

import type { ReactElement } from "react";

import Link from "next/link";
import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { useColorScheme } from "@elmeragroup/fuse/theme";

import { BrandHeatmap } from "./brand-heatmap";
import { useLandingTheme } from "./landing-theme";

const landingHero = tv({
  slots: {
    section: "relative isolate flex flex-col items-center overflow-hidden",
    copy: "sm:px-6 relative z-10 flex flex-col items-center gap-6 px-4 pt-16 text-center lg:pt-28",
    eyebrow: "text-xs tracking-landing-eyebrow font-mono text-primary uppercase",
    title:
      "text-5xl sm:text-7xl tracking-landing-hero lg:text-landing-hero font-semibold font-heading text-balance text-foreground",
    titleAccent: "block text-primary",
    lede: "text-base leading-relaxed sm:text-xl max-w-180 text-pretty text-muted-foreground",
    actions: "sm:flex-row sm:w-auto sm:gap-6 flex w-full flex-col items-center gap-3",
    primary: "sm:w-auto w-full",
    stage: "sm:-mt-12 sm:h-180 relative -mt-4 h-90 w-full",
    shader: "size-full",
    // The shader's grain fades into the page so the copy above reads on a flat ground.
    fade: "sm:h-65 pointer-events-none absolute inset-x-0 top-0 h-30 bg-linear-to-b from-background to-transparent",
    caption:
      "text-2xs tracking-landing-caption absolute inset-x-0 bottom-6 px-4 text-center font-mono text-muted-foreground uppercase",
  },
});

const styles = landingHero();

export function LandingHero(): ReactElement {
  const { theme } = useLandingTheme();
  const { resolvedColorScheme } = useColorScheme();

  return (
    <section className={styles.section()} aria-labelledby="landing-title">
      <div className={styles.copy()}>
        <p className={styles.eyebrow()}>The Elmera Group design system</p>
        <h1 id="landing-title" className={styles.title()}>
          One system.
          <span className={styles.titleAccent()}>Every brand.</span>
        </h1>
        <p className={styles.lede()}>
          67 React components for six brands, two segments and two variants. One attribute sets the theme.
        </p>
        <div className={styles.actions()}>
          <Button
            size="lg"
            className={styles.primary()}
            render={<Link href="/quick-start" />}
            nativeButton={false}>
            Get started
          </Button>
          <Button variant="link" render={<Link href="/components/button" />} nativeButton={false}>
            Browse components ›
          </Button>
        </div>
      </div>
      <div className={styles.stage()}>
        <BrandHeatmap brand={theme.brand} surface="background" className={styles.shader()} />
        <div aria-hidden className={styles.fade()} />
        <p aria-hidden className={styles.caption()}>
          {`${theme.variant}-${theme.brand}-${theme.segment} · ${resolvedColorScheme ?? "light"}`}
        </p>
      </div>
    </section>
  );
}
