import type { SiteSection } from "../../copy/catalog";

/** The site's layout width, a desktop breakpoint; the browser scales it to its viewport. */
export const SITE_WIDTH = 960;

/** The sections from the top of the page down, the order Claude writes them in. */
export const SITE_SECTIONS = [
  "header",
  "hero",
  "plans",
  "calculator",
  "faq",
  "footer",
] as const satisfies readonly SiteSection[];

/**
 * Each section's height in site pixels. The page reserves every section's box from the first
 * frame, and the boxes never follow their content, so the camera can scroll to a section by sums
 * whatever the density, the locale or an accordion's motion does inside it.
 */
const SECTION_HEIGHTS = {
  header: 72,
  hero: 416,
  plans: 448,
  calculator: 424,
  faq: 456,
  footer: 240,
} as const satisfies Record<SiteSection, number>;

/**
 * A section's height in site pixels.
 *
 * @param section - The section.
 * @returns Its height.
 */
export function sectionHeight(section: SiteSection): number {
  return SECTION_HEIGHTS[section];
}

/**
 * Where a section starts, in site pixels from the top of the page.
 *
 * @param section - The section.
 * @returns The sum of the heights above it.
 */
export function sectionTop(section: SiteSection): number {
  const index = SITE_SECTIONS.indexOf(section);
  return SITE_SECTIONS.slice(0, index).reduce((total, above) => total + SECTION_HEIGHTS[above], 0);
}

/** The whole page, in site pixels. */
export const SITE_HEIGHT = SITE_SECTIONS.reduce((total, section) => total + SECTION_HEIGHTS[section], 0);
