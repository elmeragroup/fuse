"use client";

import type { FocusEvent, ReactElement } from "react";

import { tv } from "tailwind-variants";

import { BrandMark } from "./brand-mark";
import { BrandWordmark } from "./brand-wordmark";
import { PICKER_BRANDS } from "./landing-facts";
import { useLandingTheme } from "./landing-theme";

const brandPicker = tv({
  slots: {
    section: "sm:py-30 sm:gap-14 flex flex-col items-center gap-10 border-t border-border py-16 lg:px-20",
    head: "sm:px-6 flex max-w-160 flex-col items-center gap-5 px-4 text-center",
    title: "text-4xl sm:text-landing-h2 tracking-landing-h2 font-semibold font-heading text-balance",
    titleAccent: "block text-primary",
    lede: "text-base sm:text-lg leading-relaxed text-pretty text-muted-foreground",
    // Below sm the rail scrolls sideways, which clips its block axis too, so its padding holds the
    // picked tile's focus outline, 8px out, and its negative top margin keeps the layout in place.
    rail: "landing-rail sm:grid sm:grid-cols-3 md:grid-cols-4 sm:overflow-visible sm:px-6 max-w-landing sm:gap-4 2xl:grid-cols-7 sm:mt-0 sm:pt-0 -mt-2 flex w-full scroll-px-6 gap-3 overflow-x-auto px-6 pt-2 pb-2 lg:px-0",
    tile: "landing-press group sm:w-auto flex w-70 shrink-0 cursor-pointer flex-col gap-4 rounded-xl text-left outline-none",
    // The picked brand's tile fills with its primary, so the active theme reads at a glance.
    // Forced colors drop the fill and the rings, so there the picked tile takes a Highlight border
    // inside its mark, apart from the focus outline drawn outside it. The picked ring replaces the
    // focus ring, so the focused picked tile adds an outline 2px past its ring instead.
    shot: "flex aspect-4/3 items-center justify-center overflow-hidden rounded-xl bg-card text-foreground ring-1 ring-border transition group-focus-visible:ring-3 group-focus-visible:ring-ring/50 group-focus-visible:outline-hidden group-aria-pressed:bg-primary group-aria-pressed:text-primary-foreground group-aria-pressed:ring-2 group-aria-pressed:ring-primary group-aria-pressed:ring-offset-2 group-aria-pressed:ring-offset-background group-aria-pressed:group-focus-visible:outline-2 group-aria-pressed:group-focus-visible:outline-offset-6 group-aria-pressed:group-focus-visible:outline-ring group-aria-pressed:group-focus-visible:outline-solid forced-colors:group-aria-pressed:border-4 forced-colors:group-aria-pressed:border-[Highlight]",
    meta: "flex flex-col gap-2 px-0.5",
    logo: "flex h-7.5 items-center text-foreground",
    attribute: "text-xs font-mono text-muted-foreground",
  },
});

const styles = brandPicker();

/**
 * Scrolls a keyboard-focused tile wholly into the phone's rail, inside its scroll padding, so its
 * focus outline shows whole. Chromium does not scroll to a focused element that is already partly
 * in view, and on a phone the next tile along the rail usually is. A press focuses without
 * `:focus-visible`, so the rail does not move under the pointer between press and release.
 */
function revealFocusedTile(event: FocusEvent<HTMLButtonElement>): void {
  if (event.currentTarget.matches(":focus-visible")) {
    event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

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
            onClick={() => changeTheme({ brand })}
            onFocus={revealFocusedTile}>
            <span className={styles.shot()}>
              <BrandMark brand={brand} />
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
