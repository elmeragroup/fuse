/**
 * The fonts the Figma file and its comparison draw. Fuse's themes name no fonts, because each app
 * sets `--font-sans` and `--font-heading`, so the kit keeps its own. They are the values the theme
 * catalog held before, so the variable set and the kit stay as they were. Body text is Roboto in
 * every theme. Headings are Neo Sans in Fjordkraft's branded themes, fkas and fkab.
 */

import { themeAxisSelector } from "@elmeragroup/fuse/theme-catalog";
import type { BrandCode, ThemeIdentity } from "@elmeragroup/fuse/theme-catalog";

/** The two font variables the kit binds, in the order the `Fuse tokens` collection lists them. */
export const KIT_FONT_NAMES = ["font-sans", "font-heading"] as const;

/** A font variable the kit binds. */
export type KitFontName = (typeof KIT_FONT_NAMES)[number];

/** The family every theme sets body text in, the one a kit label binds. */
export const KIT_BODY_FAMILY = "Roboto";

/** The family Fjordkraft's branded themes set headings in. */
export const KIT_HEADING_FAMILY = "Neo Sans";

/** What each font variable is for, as a designer reads it in the variable picker. */
export const KIT_FONT_DESCRIPTIONS = {
  "font-sans": "The body font stack, with Roboto first.",
  "font-heading":
    "The heading font. It follows font-sans unless the theme sets its own, such as Neo Sans in branded Fjordkraft themes.",
} as const satisfies Record<KitFontName, string>;

/** The brands whose branded themes set headings in {@link KIT_HEADING_FAMILY}. */
const HEADING_BRANDS: ReadonlySet<BrandCode> = new Set(["fkas", "fkab"]);

/**
 * Whether a theme sets its own heading family rather than following `font-sans`.
 *
 * @param identity - The theme's identity.
 * @param brand - The theme's brand.
 * @returns True for Fjordkraft's branded themes.
 */
export function hasOwnHeadingFamily(identity: ThemeIdentity, brand: BrandCode): boolean {
  return identity === "branded" && HEADING_BRANDS.has(brand);
}

/**
 * The font CSS for a page that renders the components, written as an app writes it. It sets the
 * body stack on the themed element, and the heading stack where a theme has its own heading family.
 *
 * @param themed - The selector of the element that carries the theme attributes.
 * @returns The rules, unlayered, so they win over Fuse's layered defaults.
 */
export function kitFontCss(themed: string): string {
  const own = [...HEADING_BRANDS].map((brand) => themeAxisSelector("brand", brand)).join(",");
  return [
    `${themed}{--font-sans:${KIT_BODY_FAMILY},ui-sans-serif,system-ui,sans-serif;--font-heading:var(--font-sans)}`,
    `${themeAxisSelector("identity", "branded")}:is(${own}){--font-heading:"${KIT_HEADING_FAMILY}",var(--font-sans)}`,
  ].join("\n");
}
