"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Lock } from "@elmeragroup/fuse/icons";
import { THEME_VARIANTS, ThemeScope } from "@elmeragroup/fuse/theme";
import type { BrandCode, ThemeVariant } from "@elmeragroup/fuse/theme";

import { VARIANT_LABELS } from "../../../lib/theme";
import { DashboardApp } from "./app-shell/dashboard-app";
import { BrandSite } from "./brand-site/brand-site";
import { SITES } from "./brand-site/sites";
import { useLandingTheme } from "./landing-theme";
import { SingleToggle } from "./product-parts";
import { WindowSide } from "./window-side";

const heroWindow = tv({
  slots: {
    frame: "sm:px-6 w-full max-w-312 px-4 lg:px-8",
    // The fade is a mask, so it is applied on a wrapper padded out to the shadow's reach.
    fade: "landing-fade",
    window: "rounded-2xl shadow-2xl relative overflow-hidden border border-border bg-background text-left",
    chrome: "text-sm sm:px-4 flex h-11 items-center gap-3 border-b border-border bg-muted/40 px-3",
    caption: "landing-swap flex min-w-0 flex-1 items-center gap-3",
    chromeName: "font-semibold shrink-0 text-foreground",
    chromeNote: "sm:inline hidden truncate text-muted-foreground",
    // A browser's address field, so the External side reads as a website.
    address:
      "text-xs font-medium flex h-7 min-w-0 shrink-0 items-center gap-1.5 rounded-md bg-background px-2.5 text-foreground ring-1 ring-border",
    addressIcon: "size-3.5 shrink-0 text-muted-foreground",
    chromeEnd: "ml-auto shrink-0",
    // Both sides share one cell of a fixed-height grid, so a flip never changes the window's height.
    stage: "sm:h-180 relative grid h-160 overflow-clip lg:h-190",
    side: "landing-flip col-start-1 row-start-1 min-h-0 data-[shown=false]:pointer-events-none data-[shown=false]:scale-99 data-[shown=false]:opacity-0",
    // The scope is the site's containing block, as the Dashboard's is: its nav panels and Sheet
    // position against the window and stay out of the site's own scroller.
    siteScope: "h-full transform-gpu overflow-clip",
  },
  variants: {
    // Each side leaves toward its end of the switch: Internal to the left, External to the right.
    side: {
      internal: { side: "data-[shown=false]:-translate-x-6" },
      external: { side: "data-[shown=false]:translate-x-6" },
    },
  },
});

const styles = heroWindow();

/** The window's sides are the theme's variants: the switch and the nav's picker move one value. */
type Side = ThemeVariant;

/**
 * The hero's live demo: one window, two sides. Internal runs Dashboard, the back-office app,
 * in the internal variant; External shows the picked brand's public website in the external
 * variant, behind a browser's address field. The side is the landing theme's variant, so the
 * window's switch and the nav's theme picker move the same value and re-theme the page together.
 * Both sides stay mounted once shown, so the Dashboard keeps its state through a round trip.
 * The site mounts the first time External shows, so its photos load only once a visitor asks.
 */
export function HeroWindow(): ReactElement {
  const { theme, changeTheme } = useLandingTheme();
  const side = theme.variant;
  const [siteMounted, setSiteMounted] = useState(side === "external");
  if (side === "external" && !siteMounted) {
    setSiteMounted(true);
  }
  const captionId = useId();
  const siteSide = useRef<HTMLDivElement>(null);
  const sideSwitch = useRef<HTMLSpanElement>(null);
  const site = SITES[theme.brand];
  const external = side === "external";

  // A brand card on a site unmounts with that site, so the card's pick moves focus to the new
  // site's heading once it mounts. A pick in the landing's brand picker leaves focus there.
  const cardPick = useRef(false);
  const pickFromCard = (brand: BrandCode) => {
    // The current brand's card keeps its site, and so its focus.
    cardPick.current = brand !== theme.brand;
    changeTheme({ brand });
  };
  useEffect(() => {
    if (cardPick.current) {
      cardPick.current = false;
      siteSide.current?.querySelector<HTMLElement>("h1")?.focus();
    }
  }, [site.brand]);

  const flip = (next: Side) => {
    changeTheme({ variant: next });
    // A pointer press leaves focus where it was in Safari, which focuses no button on a click:
    // in a closed dialog, whose focus return targets its trigger on the side going inert, or
    // on that side itself. Focus moves to the pressed button before the return runs, so the
    // return finds focus outside the dialog and leaves it there. The switch renders one button
    // per side, in order.
    sideSwitch.current?.querySelectorAll("button")[THEME_VARIANTS.indexOf(next)]?.focus();
  };

  return (
    <div className={styles.frame()}>
      <div className={styles.fade()}>
        <section aria-label="Live demo" aria-describedby={captionId} className={styles.window()}>
          <div className={styles.chrome()}>
            {external ? (
              <p key={site.domain} id={captionId} className={styles.caption()}>
                <span className={styles.address()}>
                  <Lock aria-hidden className={styles.addressIcon()} />
                  {site.domain}
                </span>
                <span className={styles.chromeNote()}>{site.caption}</span>
              </p>
            ) : (
              <p key="internal" id={captionId} className={styles.caption()}>
                <span className={styles.chromeName()}>Live demo</span>
                <span className={styles.chromeNote()}>
                  Dashboard: an internal sales and back-office app built with Fuse
                </span>
              </p>
            )}
            <span ref={sideSwitch} className={styles.chromeEnd()}>
              <SingleToggle
                label="Window content"
                size="sm"
                options={THEME_VARIANTS}
                labels={VARIANT_LABELS}
                value={side}
                onValueChange={flip}
              />
            </span>
          </div>
          <div className={styles.stage()}>
            <div
              role="region"
              aria-label="Dashboard"
              data-shown={!external}
              inert={external}
              className={styles.side({ side: "internal" })}>
              <WindowSide shown={!external}>
                <DashboardApp />
              </WindowSide>
            </div>
            {siteMounted ? (
              <div
                ref={siteSide}
                role="region"
                aria-label={`${site.name} website`}
                lang={site.locale}
                data-shown={external}
                inert={!external}
                className={styles.side({ side: "external" })}>
                <WindowSide shown={external}>
                  <ThemeScope theme={{ ...theme, variant: "external" }} className={styles.siteScope()}>
                    <BrandSite key={site.brand} site={site} onPickBrand={pickFromCard} />
                  </ThemeScope>
                </WindowSide>
              </div>
            ) : (
              // Until the first flip the side is an empty cell, so the site's photos wait for a visitor who asks for it.
              <div data-shown={false} inert className={styles.side({ side: "external" })} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
