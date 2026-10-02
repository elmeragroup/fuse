import { BRAND_CODES, BRANDS, LEGAL_THEMES, THEME_SEGMENTS, THEME_VARIANTS } from "@elmeragroup/fuse/theme";
import type { BrandCode, Density } from "@elmeragroup/fuse/theme";

import { COMPONENT_PAGES } from "../../../generated/component-pages";
import { LANDING_FACTS } from "../../../generated/landing-facts";

/**
 * Every number the landing page states, derived from the library: theme and brand counts from
 * `@elmeragroup/fuse/theme`, the component count from the component-page manifest, and the
 * locales and density metrics from the generate pass. A library change updates the page.
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
  ...BRAND_CODES.filter((brand) => brand === "elma"),
  ...BRAND_CODES.filter((brand) => brand !== "elma"),
];

const brandSegmentPairs = BRAND_CODES.reduce((total, brand) => total + BRANDS[brand].segments.length, 0);

export const FACTS = {
  components: COMPONENT_PAGES.length,
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

/**
 * Writes one density's control metrics onto `element` as custom properties, so that subtree
 * shows the density while the document keeps its own.
 */
export function applyDensity(element: HTMLElement, density: Density): void {
  for (const metric of LANDING_FACTS.metrics) {
    element.style.setProperty(`--${metric.name}`, `${String(metric.px[density])}px`);
  }
}
