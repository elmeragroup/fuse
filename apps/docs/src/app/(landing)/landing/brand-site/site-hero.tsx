import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { ArrowRight } from "@elmeragroup/fuse/icons";

import { SiteChecklist } from "./site-checklist";
import type { SiteHero as SiteHeroConfig } from "./site-model";
import { SiteActionRow, SitePhoto } from "./site-parts";

/**
 * The hero in one of six closed layouts, one per reference. The theme paints it; the layout
 * decides the shape: a centred statement on a soft glow, a tinted card that frames the photo,
 * a panel cut on a diagonal, a soft rounded panel, tiles over a full-bleed photo, or a strong
 * brand-coloured promo block. Sizes follow the window's container, not the viewport.
 */
const siteHero = tv({
  slots: {
    section: "relative isolate",
    inner: "max-w-6xl @3xl:px-10 mx-auto w-full px-5",
    frame: "grid *:min-w-0",
    copy: "flex flex-col items-start gap-6",
    kicker: "text-sm font-medium",
    // Long compound words (strømleverandør, vintersäkra) set a column's minimum width, so the
    // title hyphenates in the site's language and steps down a size on phones.
    // The title takes focus when a brand card swaps the site, so it names the place focus moved
    // to; it is no control, so it draws no ring.
    title:
      "text-3xl font-medium @md:text-4xl @3xl:text-5xl font-heading text-balance hyphens-auto outline-none",
    lede: "text-base max-w-xl @3xl:text-lg text-pretty",
    media: "relative overflow-hidden",
    photo: "size-full object-cover",
    glow: "max-w-4xl pointer-events-none absolute inset-x-0 -top-32 -z-10 mx-auto aspect-square rounded-full bg-radial from-primary-soft to-transparent to-70%",
    chip: "text-xs shadow-xs flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-1 pl-3 text-card-foreground",
    chipDot: "size-1.5 rounded-full bg-success",
    chipArrow: "size-3",
    actions: "",
    chipLink:
      "font-medium inline-flex min-h-6 items-center gap-1 rounded-full bg-primary-soft px-2.5 text-primary-soft-foreground no-underline outline-none hover:bg-primary-soft/70 focus-visible:ring-2 focus-visible:ring-ring",
    tiles: "@3xl:grid-cols-3 relative m-0 grid list-none gap-3 p-0",
    tile: "backdrop-blur-sm flex h-full flex-col gap-2 rounded-lg p-5 no-underline transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    tileTitle: "text-xl font-semibold font-heading text-balance",
    tileText: "text-sm text-pretty opacity-90",
    tileArrow: "mt-auto size-5 self-end",
  },
  variants: {
    layout: {
      centered: {
        section: "@3xl:py-28 overflow-hidden py-20",
        copy: "max-w-3xl mx-auto items-center text-center",
        title: "text-5xl font-semibold tracking-tight @3xl:text-7xl hyphens-none",
        lede: "mx-auto text-muted-foreground",
        actions: "justify-center",
        media: "hidden",
      },
      card: {
        section: "@3xl:py-12 py-6",
        title: "@3xl:text-4xl",
        frame: "@3xl:grid-cols-2 gap-2 rounded-xl bg-primary-soft p-2",
        copy: "@3xl:p-12 justify-center rounded-lg bg-card-soft p-7 text-card-soft-foreground",
        media: "aspect-square rounded-lg",
      },
      angled: {
        section: "bg-primary-soft text-primary-soft-foreground",
        inner: "@3xl:px-0 max-w-none px-0",
        frame: "@3xl:grid-cols-2",
        copy: "max-w-xl @3xl:py-16 @3xl:pr-0 @3xl:pl-10 mx-auto w-full justify-center px-5 py-10",
        title: "font-semibold",
        media: "aspect-video @3xl:landing-angle @3xl:aspect-auto",
      },
      panel: {
        section: "@3xl:py-10 py-6",
        frame:
          "@3xl:grid-cols-2 @3xl:p-12 items-center gap-8 rounded-xl bg-primary-soft p-6 text-primary-soft-foreground",
        title: "font-semibold",
        media: "aspect-6/5 rounded-xl",
      },
      overlay: {
        section: "@3xl:min-h-140 @3xl:py-12 flex min-h-120 items-end overflow-hidden py-8 text-foreground",
        inner: "relative flex flex-col gap-6",
        copy: "order-last items-center",
        title:
          "text-sm font-medium tracking-wide backdrop-blur-sm @3xl:text-sm rounded-full bg-background/85 px-3 py-1 font-sans",
        media: "absolute inset-0 -z-10",
      },
      promo: {
        section: "@3xl:py-12 py-6",
        title: "@3xl:text-4xl",
        // In dark mode the block follows the bands' rule and takes the brand's soft surface.
        frame:
          "@3xl:grid-cols-2 landing-dark:bg-primary-soft landing-dark:text-primary-soft-foreground gap-2 rounded-xl bg-primary p-2 text-primary-foreground",
        copy: "@3xl:p-10 justify-center gap-5 p-6",
        media: "aspect-square rounded-lg",
      },
    },
    /** An overlay tile's colours, each a contract pair of the theme. */
    tone: {
      secondary: {
        tile: "landing-dark:bg-primary-soft/90 landing-dark:text-primary-soft-foreground landing-dark:hover:bg-primary-soft bg-secondary/90 text-secondary-foreground hover:bg-secondary",
      },
      primary: { tile: "bg-primary/90 text-primary-foreground hover:bg-primary" },
      soft: { tile: "bg-primary-soft/90 text-primary-soft-foreground hover:bg-primary-soft" },
    },
  },
});

/** The site's hero: an `h1`, its supporting copy and actions, and the layout's photo or tiles. */
export function SiteHero({ hero }: { hero: SiteHeroConfig }): ReactElement {
  const styles = siteHero({ layout: hero.layout });
  const title = (
    <h1 tabIndex={-1} className={styles.title()}>
      {hero.title}
    </h1>
  );

  switch (hero.layout) {
    case "centered":
      return (
        <section className={styles.section()}>
          <div aria-hidden className={styles.glow()} />
          <div className={styles.inner()}>
            <div className={styles.copy()}>
              <p className={styles.chip()}>
                <span aria-hidden className={styles.chipDot()} />
                {hero.announcement.text}
                <a href={hero.announcement.link.href} className={styles.chipLink()}>
                  {hero.announcement.link.label}
                  <ArrowRight className={styles.chipArrow()} />
                </a>
              </p>
              {title}
              <p className={styles.lede()}>{hero.lede}</p>
              <SiteActionRow actions={hero.actions} className={styles.actions()} />
            </div>
          </div>
        </section>
      );
    case "card":
    case "angled":
      return (
        <section className={styles.section()}>
          <div className={styles.inner()}>
            <div className={styles.frame()}>
              <div className={styles.copy()}>
                {title}
                <SiteChecklist checklist={hero.checklist} />
                <SiteActionRow actions={hero.actions} />
              </div>
              <div className={styles.media()}>
                <SitePhoto image={hero.image} priority="eager" className={styles.photo()} />
              </div>
            </div>
          </div>
        </section>
      );
    case "panel":
      return (
        <section className={styles.section()}>
          <div className={styles.inner()}>
            <div className={styles.frame()}>
              <div className={styles.copy()}>
                {title}
                <p className={styles.lede()}>{hero.lede}</p>
                <SiteActionRow actions={hero.actions} />
              </div>
              <div className={styles.media()}>
                <SitePhoto image={hero.image} priority="eager" className={styles.photo()} />
              </div>
            </div>
          </div>
        </section>
      );
    case "overlay":
      return (
        <section className={styles.section()}>
          <div className={styles.media()}>
            <SitePhoto image={hero.image} priority="eager" className={styles.photo()} />
          </div>
          <div className={styles.inner()}>
            <ul className={styles.tiles()}>
              {hero.tiles.map((tile) => (
                <li key={tile.href}>
                  <a href={tile.href} className={styles.tile({ tone: tile.tone })}>
                    <span className={styles.tileTitle()}>{tile.title}</span>
                    <span className={styles.tileText()}>{tile.text}</span>
                    <ArrowRight aria-hidden className={styles.tileArrow()} />
                  </a>
                </li>
              ))}
            </ul>
            <div className={styles.copy()}>{title}</div>
          </div>
        </section>
      );
    case "promo":
      return (
        <section className={styles.section()}>
          <div className={styles.inner()}>
            <div className={styles.frame()}>
              <div className={styles.copy()}>
                <p className={styles.kicker()}>{hero.kicker}</p>
                {title}
                <p className={styles.lede()}>{hero.lede}</p>
                <SiteChecklist checklist={hero.checklist} tone="inverse" />
                <SiteActionRow actions={hero.actions} primary="secondary" quiet="ghost" />
              </div>
              <div className={styles.media()}>
                <SitePhoto image={hero.image} priority="eager" className={styles.photo()} />
              </div>
            </div>
          </div>
        </section>
      );
  }
}
