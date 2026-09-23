/**
 * Workspace-only facade for the docs pipeline. It is not published and not in the root
 * barrel. It stays server-safe `.ts` because Node generate scripts cannot load `/theme`,
 * which re-exports client TSX.
 */

export { composeTheme } from "./compose-theme";
export { oklchToLinearSrgb, parseOklch } from "./oklch";
export { defaultDensityForVariant, densityAttributes } from "./density";
export { themeAttributes } from "./theme-attributes";
export { TOKEN_NAMES } from "./tokens/contract";
export { PRIMITIVE_NAMES, PRIMITIVES } from "./tokens/primitives";
export { LEGAL_THEMES, themeSlug } from "./tokens/themes";
