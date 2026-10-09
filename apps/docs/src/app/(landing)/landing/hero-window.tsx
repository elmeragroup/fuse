"use client";

import { Suspense, useEffect, useId, useRef, useState } from "react";
import type { ReactElement } from "react";

import dynamic from "next/dynamic";
import { tv } from "tailwind-variants";

import { Lock } from "@elmeragroup/fuse/icons";
import { THEME_VARIANTS, ThemeScope } from "@elmeragroup/fuse/theme";
import type { BrandCode, ThemeVariant } from "@elmeragroup/fuse/theme";

import { SingleToggle } from "../../../components/single-toggle";
import { VARIANT_LABELS } from "../../../lib/theme";
import { BrandSite } from "./brand-site/brand-site";
import { SITES } from "./brand-site/sites";
import { useLandingTheme } from "./landing-theme";
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

// The landing opens on External, so the Dashboard's code loads apart from the page's. It keeps
// SSR: a shared internal theme still paints the Dashboard on the server, and Next preloads its
// code in that page's HTML. With SSR on, `dynamic` adds no Suspense boundary; `DashboardSide`
// decides where the Dashboard waits for its code.
const DashboardApp = dynamic(async () => (await import("./app-shell/dashboard-app")).DashboardApp);

/** Starts fetching the Dashboard's code ahead of a flip to Internal. */
function prefetchDashboard(): void {
  // A failed fetch is not an error yet: the flip imports the module again.
  import("./app-shell/dashboard-app").catch(() => undefined);
}

/** Pointing at or focusing Internal starts fetching the Dashboard's code before the press. */
const INTERNAL_PREFETCH = {
  internal: { onPointerEnter: prefetchDashboard, onFocus: prefetchDashboard },
} as const;

/**
 * How the Dashboard first mounted: in the server's HTML, because the page opened on Internal, or
 * on the first flip to Internal.
 */
type DashboardArrival = "server" | "flip";

/**
 * The Dashboard, waiting for its code where its arrival allows.
 *
 * A flip mounts it behind its own Suspense boundary, so a flip that waits for the code holds only
 * this side. A server-rendered Dashboard hydrates without one. A boundary still dehydrated when a
 * context above it changes drops the server's HTML and shows its fallback until the code arrives,
 * and the page's color-scheme context changes as the page hydrates: the scheme resolves once its
 * runtime connects, in an effect. Without a boundary of its own, the Dashboard's hydration holds
 * the page's, which then commits in one piece, so the server's Dashboard stays on screen. Next
 * preloads the code in the HTML, so the wait is short.
 */
function DashboardSide({ arrival }: { arrival: DashboardArrival }): ReactElement {
  if (arrival === "server") {
    return <DashboardApp />;
  }
  return (
    <Suspense fallback={null}>
      <DashboardApp />
    </Suspense>
  );
}

/** The window's sides are the theme's variants: the switch and the nav's picker move one value. */
type Side = ThemeVariant;

/**
 * The hero's live demo: one window, two sides. Internal runs Dashboard, the back-office app,
 * in the internal variant; External shows the picked brand's public website in the external
 * variant, behind a browser's address field. The side is the landing theme's variant, so the
 * window's switch and the nav's theme picker move the same value and re-theme the page together.
 * Each side mounts the first time it shows and stays mounted, so the Dashboard keeps its state
 * through a round trip, and the site's photos and the Dashboard's code load only once a visitor
 * asks. Pointing at or focusing Internal starts fetching the Dashboard's code before the flip.
 */
export function HeroWindow(): ReactElement {
  const { theme, changeTheme } = useLandingTheme();
  const side = theme.variant;
  const [dashboardArrival] = useState<DashboardArrival>(side === "internal" ? "server" : "flip");
  const [dashboardMounted, setDashboardMounted] = useState(side === "internal");
  if (side === "internal" && !dashboardMounted) {
    setDashboardMounted(true);
  }
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
                optionProps={INTERNAL_PREFETCH}
              />
            </span>
          </div>
          <div className={styles.stage()}>
            {dashboardMounted ? (
              <div
                role="region"
                aria-label="Dashboard"
                data-shown={!external}
                inert={external}
                className={styles.side({ side: "internal" })}>
                <WindowSide shown={!external}>
                  <DashboardSide arrival={dashboardArrival} />
                </WindowSide>
              </div>
            ) : (
              // Until the first flip the side is an empty cell, so the Dashboard's code waits for a visitor who asks for it.
              <div data-shown={false} inert className={styles.side({ side: "internal" })} />
            )}
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
