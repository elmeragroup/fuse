/**
 * Workspace-only facade for the docs pipeline and the Figma sync. It is not published and
 * not in the root barrel. It stays server-safe `.ts` because Node scripts cannot load
 * `/theme`, which re-exports client TSX. Its values are the resolved catalog, so readers
 * translate resolved values into their own format and never parse CSS themselves, and the
 * part density table it carries, which the docs coverage test reads without resolving every
 * theme.
 */

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
export type { TokenKind, TokenName } from "./tokens/contract";
export type { DensityMetricKind, DensityMetricName } from "./tokens/density-metrics";
export type { DensityPart, DensityRole } from "./tokens/density-roles";
export type { PrimitiveName } from "./tokens/primitives";
export type { RadiusRungName } from "./tokens/radius-scale";
export type { ThemeSlug } from "./tokens/themes";
