/**
 * Workspace-only facade for the docs pipeline and the Figma sync. It is not published and
 * not in the root barrel. It stays server-safe `.ts` because Node scripts cannot load
 * `/theme`, which re-exports client TSX. Its values are the resolved catalog, so readers
 * translate resolved values into their own format and never parse CSS themselves, and the
 * part density table it carries, which the docs coverage test reads without resolving every
 * theme. It also carries the theme axes and the brand table, so a design tool can lay out
 * identity, brand and segment as separate choices. It carries the legal radius steps and the
 * radius rungs too, so the docs studio reads them instead of restating them. The text-grade pairs
 * name the role pairs the contrast gate holds at 4.5:1 everywhere, and the role text pairs those
 * it holds in some schemes or identities, so the docs palettes page grades the same pairs. The
 * ramp scales, steps and seed steps let it lay out the brand ramps without parsing token names
 * or restating the ramp recipe.
 */

export { ROLE_TEXT_PAIRS, TEXT_GRADE_PAIRS } from "./contrast";
export { RAMP_SCALES, RAMP_STEPS } from "./tokens/brand-ramps";
export type { RampScale, RampStep } from "./tokens/brand-ramps";
export { brandRampSeedSteps } from "./tokens/brand-ramp-layer";

export { CORNER_STEPS } from "./corners/corners";
export { RADIUS_RUNG_NAMES, RADIUS_RUNGS } from "./corners/radius-scale";
export { resolveThemeCatalog } from "./resolve-theme-catalog";
export { DENSITY_ROLES, PART_DENSITY } from "./tokens/density-roles";
export type {
  AnyEntry,
  DensityMetricEntry,
  PartDensityCatalog,
  PrimitiveEntry,
  PrimitiveReference,
  Reference,
  ResolvedScheme,
  ResolvedTheme,
  ResolvedThemeCatalog,
  RungEntry,
  TokenEntry,
  TokenReference,
} from "./resolve-theme-catalog";
export type { ResolvedColorScheme } from "./color-scheme-types";
export type { Density } from "./density";
export type { TokenKind, TokenName, TokenPaint } from "./tokens/contract";
export type { DensityMetricKind, DensityMetricName } from "./tokens/density-metrics";
export type { DensityPart, DensityRole } from "./tokens/density-roles";
export type { PrimitiveName } from "./tokens/primitives";
export type { RadiusRungName } from "./corners/radius-scale";
export {
  BRAND_CODES,
  BRANDS,
  THEME_AXES,
  THEME_IDENTITIES,
  THEME_SEGMENTS,
  themeAxisAttributes,
  themeAxisSelector,
} from "./theme-input";
export type { BrandCode, ThemeAxes, ThemeAxis, ThemeIdentity, ThemeSegment, ThemeSlug } from "./theme-input";
