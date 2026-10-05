"use client";

import type { MouseEvent, ReactElement } from "react";

import { tv } from "tailwind-variants";

import { LocaleProvider } from "@elmeragroup/fuse/theme";
import type { BrandCode } from "@elmeragroup/fuse/theme";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { SiteHero } from "./site-hero";
import type { Site } from "./site-model";
import { SiteSectionView } from "./site-sections";

const brandSite = tv({
  slots: {
    // The window's width, not the viewport's, sets the site's layout: every part sizes from
    // this container. The site scrolls inside the window, which keeps its height.
    scroller:
      "@container h-full overflow-x-clip overflow-y-auto bg-background font-sans text-foreground antialiased",
    // A layout block, not a main landmark: the site sits inside the landing's main.
    content: "flex flex-col",
  },
});

const styles = brandSite();

/**
 * A demo site never leaves the landing. React delivers portalled clicks through this tree, so
 * one capture handler also holds the links in nav panels and the menu Sheet.
 */
function stayOnLanding(event: MouseEvent): void {
  if (event.target instanceof Element && event.target.closest("a[href]") !== null) {
    event.preventDefault();
  }
}

/**
 * One brand's public website, built from Fuse components and the brand's config: the header,
 * the hero and the sections in config order, in the site's own language.
 */
export function BrandSite({
  site,
  onPickBrand,
}: {
  site: Site;
  /** Called when the visitor picks a brand in a site's brand grid. */
  onPickBrand: (brand: BrandCode) => void;
}): ReactElement {
  return (
    <LocaleProvider locale={site.locale}>
      <div data-site-scroller className={styles.scroller()} onClickCapture={stayOnLanding}>
        <SiteHeader site={site} />
        <div className={styles.content()}>
          <SiteHero hero={site.hero} />
          {site.sections.map((section) => (
            <SiteSectionView key={section.id} section={section} site={site} onPickBrand={onPickBrand} />
          ))}
        </div>
        <SiteFooter site={site} />
      </div>
    </LocaleProvider>
  );
}
