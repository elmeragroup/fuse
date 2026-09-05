/**
 * Workspace-only docs-pipeline facade. Not published; not in the root barrel
 * (architecture.md §8). Server-safe `.ts` only — Node generate scripts cannot
 * load `/theme` because that entry re-exports client TSX.
 */

export { composeTheme } from "./compose-theme";
export { oklchToLinearSrgb, parseOklch } from "./contrast";
export { defaultDensityForVariant, densityAttributes } from "./density";
export { themeAttributes } from "./theme-attributes";
export { TOKEN_NAMES } from "./tokens/contract";
export { PRIMITIVE_NAMES, PRIMITIVES } from "./tokens/primitives";
export { LEGAL_THEMES, themeSlug } from "./tokens/themes";
