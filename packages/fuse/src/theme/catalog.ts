/**
 * Workspace-only facade for the docs pipeline and the Figma sync. It is not published and
 * not in the root barrel. It stays server-safe `.ts` because Node scripts cannot load
 * `/theme`, which re-exports client TSX.
 */

export type { ResolvedColorScheme } from "./color-scheme-types";
export { composeTheme } from "./compose-theme";
export { cssFirstFontFamily, cssLengthToPx, cssVarReference, remToPx } from "./css-values";
export { defaultDensityForVariant, densityAttributes } from "./density";
export { themeAttributes } from "./theme-attributes";
export type { Density } from "./density";
export { TOKEN_KINDS, TOKEN_NAMES } from "./tokens/contract";
export type { TokenContract, TokenKind, TokenName } from "./tokens/contract";
export { DENSITY_METRIC_FAMILIES, DENSITY_METRICS } from "./tokens/density-metrics";
export type { DensityMetricKind } from "./tokens/density-metrics";
export { PRIMITIVE_NAMES, PRIMITIVES } from "./tokens/primitives";
export { RADIUS_RUNG_NAMES, RADIUS_RUNGS } from "./tokens/radius-scale";
export type { RadiusRungName } from "./tokens/radius-scale";
export { LEGAL_THEMES, themeSlug } from "./tokens/themes";
