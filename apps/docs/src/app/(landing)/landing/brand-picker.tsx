"use client";

import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import type { BrandCode } from "@elmeragroup/fuse/theme";

import { BrandHeatmap } from "./brand-heatmap";
import { BrandWordmark } from "./brand-wordmark";
import { useLandingTheme } from "./landing-theme";

/** The brands the picker offers; Fjordkraft Företag shares Fjordkraft's mark, so it is left out. */
const PICKER_BRANDS = ["elma", "fkas", "tkas", "guen", "fkse"] as const satisfies readonly BrandCode[];

const brandPicker = tv({
  slots: {
    section: "sm:py-30 sm:gap-14 flex flex-col items-center gap-10 border-t border-border py-16 lg:px-20",
    head: "sm:px-6 flex max-w-160 flex-col items-center gap-5 px-4 text-center",
    title: "text-4xl sm:text-landing-h2 tracking-landing-h2 font-semibold font-heading text-balance",
    titleAccent: "block text-primary",
    lede: "text-base sm:text-lg leading-relaxed text-pretty text-muted-foreground",
    rail: "landing-rail sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-6 max-w-landing sm:gap-4 flex w-full scroll-px-6 gap-3 overflow-x-auto px-6 pb-2 lg:px-0",
    tile: "landing-press group sm:w-auto flex w-70 shrink-0 cursor-pointer flex-col gap-4 rounded-xl text-left outline-none",
    shot: "aspect-4/3 overflow-hidden rounded-xl bg-card ring-1 ring-border transition-shadow group-focus-visible:ring-3 group-focus-visible:ring-ring/50 group-aria-pressed:ring-2 group-aria-pressed:ring-primary group-aria-pressed:ring-offset-2 group-aria-pressed:ring-offset-background",
    shader: "size-full",
    meta: "flex flex-col gap-2 px-0.5",
    logo: "flex h-7.5 items-center text-foreground",
    attribute: "text-xs font-mono text-muted-foreground",
  },
});

const styles = brandPicker();

export function BrandPicker(): ReactElement {
  const { theme, changeTheme } = useLandingTheme();

  return (
    <section className={styles.section()} aria-labelledby="landing-brands">
      <div className={styles.head()}>
        <h2 id="landing-brands" className={styles.title()}>
          Try it yourself.
          <span className={styles.titleAccent()}>Pick a brand.</span>
        </h2>
        <p className={styles.lede()}>Click a brand to switch this page to its theme.</p>
      </div>
      <div className={styles.rail()}>
        {PICKER_BRANDS.map((brand) => (
          <button
            key={brand}
            type="button"
            aria-pressed={brand === theme.brand}
            className={styles.tile()}
            onClick={() => changeTheme({ brand })}>
            <span className={styles.shot()}>
              <BrandHeatmap brand={brand} surface="card" className={styles.shader()} />
            </span>
            <span className={styles.meta()}>
              <span className={styles.logo()}>
                <BrandWordmark brand={brand} />
              </span>
              <span className={styles.attribute()}>{`data-theme-brand="${brand}"`}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
