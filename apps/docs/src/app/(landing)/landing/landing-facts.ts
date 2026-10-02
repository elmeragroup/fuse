import { BRAND_CODES, BRANDS, LEGAL_THEMES, THEME_SEGMENTS, THEME_VARIANTS } from "@elmeragroup/fuse/theme";
import type { BrandCode, Density } from "@elmeragroup/fuse/theme";

import { LANDING_FACTS } from "../../../generated/landing-facts";
import type { ComponentPageEntry } from "../../../lib/docs-model";
import { componentHref, requireStaticPage } from "../../../lib/pages";

/**
 * Every number the landing page states, derived from the library: theme and brand counts from
 * `@elmeragroup/fuse/theme`, and the locales, density metrics and component index from the
 * generate pass. A library change updates the page. The index carries only slug, title and
 * lede, so the landing's client modules never import the full component-page manifest.
 */

const listFormat = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" });
const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

/** The densities in the library's own order. */
export const DENSITIES: readonly Density[] = LANDING_FACTS.densities;

const mediumControl = LANDING_FACTS.metrics.find((metric) => metric.name === "control-h-md");

/** The medium control height of a density, in px. */
export function mediumControlPx(density: Density): number {
  return mediumControl?.px[density] ?? 0;
}

/** The smallest control height at any density, which is the library's target-size floor. */
const minTargetPx = Math.min(
  ...LANDING_FACTS.metrics
    .filter((metric) => metric.name.startsWith("control-h-"))
    .flatMap((metric) => DENSITIES.map((density) => metric.px[density]))
);

/** Elmera first as the group brand, then the library's order. */
export const PICKER_BRANDS: readonly BrandCode[] = [
  "elma",
  ...BRAND_CODES.filter((brand) => brand !== "elma"),
];

const brandSegmentPairs = BRAND_CODES.reduce((total, brand) => total + BRANDS[brand].segments.length, 0);

export const FACTS = {
  components: LANDING_FACTS.components.length,
  themes: LEGAL_THEMES.length,
  brands: BRAND_CODES.length,
  segments: THEME_SEGMENTS.length,
  variants: THEME_VARIANTS.length,
  brandSegmentPairs,
  locales: LANDING_FACTS.locales.length,
  localeNames: listFormat.format(
    LANDING_FACTS.locales.map((tag) => languageNames.of(new Intl.Locale(tag).language) ?? tag)
  ),
  densities: DENSITIES.length,
  mediumControlPx: listFormat.format(DENSITIES.map((density) => `${String(mediumControlPx(density))} px`)),
  minTargetPx,
} as const;

/** The one sentence the hero and the page metadata both use to describe Fuse. */
export const LANDING_SUMMARY = `${String(FACTS.components)} React components for ${String(FACTS.brands)} brands, ${String(FACTS.segments)} segments and ${String(FACTS.variants)} variants. One attribute sets the theme.`;

/** A component page the landing names or links to. */
export type LandingComponent = Pick<ComponentPageEntry, "slug" | "title" | "lede"> & { href: string };

/** The component page for `slug`; throws when the site serves none, so a stale link fails the build. */
export function landingComponent(slug: string): LandingComponent {
  const component = LANDING_FACTS.components.find((entry) => entry.slug === slug);
  if (component === undefined) {
    throw new Error(`landing: no component page for "${slug}"`);
  }
  return { ...component, href: componentHref(slug) };
}

/** The page every "Get started" action opens. */
export const QUICK_START = requireStaticPage("/quick-start");

/** The page every "Browse components" action opens: the first component, Button. */
export const BROWSE_COMPONENTS = landingComponent("button");

/**
 * Writes one density's control metrics onto `element` as custom properties, so that subtree
 * shows the density while the document keeps its own.
 */
export function applyDensity(element: HTMLElement, density: Density): void {
  for (const metric of LANDING_FACTS.metrics) {
    element.style.setProperty(`--${metric.name}`, `${String(metric.px[density])}px`);
  }
}
