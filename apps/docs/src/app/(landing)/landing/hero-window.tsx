"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactElement } from "react";

import { flushSync } from "react-dom";
import { tv } from "tailwind-variants";

import { Lock } from "@elmeragroup/fuse/icons";
import { ThemeScope } from "@elmeragroup/fuse/theme";
import type { BrandCode } from "@elmeragroup/fuse/theme";

import { DashboardApp } from "./app-shell/dashboard-app";
import { BrandSite } from "./brand-site/brand-site";
import { SITES } from "./brand-site/sites";
import { useLandingTheme } from "./landing-theme";
import { SingleToggle } from "./product-parts";

const heroWindow = tv({
  slots: {
    frame: "sm:px-6 w-full max-w-312 px-4 lg:px-8",
    // The fade is a mask, so it is applied on a padded wrapper the shadow fits inside.
    fade: "landing-fade sm:-mx-6 sm:px-6 -mx-4 px-4 pb-2",
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

const SIDES = ["internal", "external"] as const;
type Side = (typeof SIDES)[number];
const SIDE_LABELS = { internal: "Internal", external: "External" } as const satisfies Record<Side, string>;

/**
 * Closes the dialogs open on `side`, topmost first, before the side goes inert. A modal's
 * backdrop stops at the window's edge, so the switch stays pressable while one is open, and a
 * modal left open on the hidden side keeps its scroll lock and hides the shown side from
 * assistive technology. Escape is the one close every dialog in the window answers, and each
 * press commits before the next, so a nested dialog's parent sees itself as the topmost one.
 * The sides keep their state: only the dialogs close.
 */
function closeDialogs(side: HTMLElement | null): void {
  // Each side's dialogs portal into its theme scope, so the side holds them. An alert dialog
  // ignores presses outside it but answers Escape as its Cancel does, so the order it confirms
  // stays as it was.
  const open = [
    ...(side?.querySelectorAll("[role='dialog'][data-open], [role='alertdialog'][data-open]") ?? []),
  ].reverse();
  for (const dialog of open) {
    flushSync(() => {
      dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
  }
}

/**
 * The hero's live demo: one window, two sides. Internal runs Dashboard, the back-office app,
 * in the internal variant; External shows the picked brand's public website in the external
 * variant, behind a browser's address field. The switch flips the content and the variant
 * together; both sides stay mounted, so the Dashboard keeps its state through a round trip.
 * The site mounts on the first flip, so its photos load only once a visitor asks for it.
 */
export function HeroWindow(): ReactElement {
  const { theme, changeBrand } = useLandingTheme();
  const [side, setSide] = useState<Side>("internal");
  const [siteMounted, setSiteMounted] = useState(false);
  const captionId = useId();
  const sides = useRef<Record<Side, HTMLDivElement | null>>({ internal: null, external: null });
  const sideSwitch = useRef<HTMLSpanElement>(null);
  const site = SITES[theme.brand];
  const external = side === "external";

  // A brand card on a site unmounts with that site, so the card's pick moves focus to the new
  // site's heading once it mounts. A pick in the landing's brand picker leaves focus there.
  const cardPick = useRef(false);
  const pickFromCard = (brand: BrandCode) => {
    // The current brand's card keeps its site, and so its focus.
    cardPick.current = brand !== theme.brand;
    changeBrand(brand);
  };
  useEffect(() => {
    if (cardPick.current) {
      cardPick.current = false;
      sides.current.external?.querySelector<HTMLElement>("h1")?.focus();
    }
  }, [site.brand]);

  const flip = (next: Side) => {
    closeDialogs(sides.current[side]);
    // A pointer press leaves focus where it was in Safari, which focuses no button on a click:
    // in a closing dialog, whose focus return targets its trigger on the side going inert, or
    // on that side itself. Focus moves to the pressed button first, so the return finds focus
    // outside the dialog and leaves it there. The switch renders one button per side, in order.
    sideSwitch.current?.querySelectorAll("button")[SIDES.indexOf(next)]?.focus();
    setSide(next);
    if (next === "external") {
      setSiteMounted(true);
    }
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
                options={SIDES}
                labels={SIDE_LABELS}
                value={side}
                onValueChange={flip}
              />
            </span>
          </div>
          <div className={styles.stage()}>
            <div
              role="region"
              ref={(element) => {
                sides.current.internal = element;
              }}
              aria-label="Dashboard"
              data-shown={!external}
              inert={external}
              className={styles.side({ side: "internal" })}>
              <DashboardApp />
            </div>
            {siteMounted ? (
              <div
                ref={(element) => {
                  sides.current.external = element;
                }}
                role="region"
                aria-label={`${site.name} website`}
                lang={site.lang}
                data-shown={external}
                inert={!external}
                className={styles.side({ side: "external" })}>
                <ThemeScope theme={{ ...theme, variant: "external" }} className={styles.siteScope()}>
                  <BrandSite key={site.brand} site={site} onPickBrand={pickFromCard} />
                </ThemeScope>
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
