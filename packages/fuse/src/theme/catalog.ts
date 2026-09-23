/**
 * Workspace-only facade for the docs pipeline and the Figma sync. It is not published and
 * not in the root barrel. It stays server-safe `.ts` because Node scripts cannot load
 * `/theme`, which re-exports client TSX.
 */

export type { ResolvedColorScheme } from "./color-scheme-types";
export { composeTheme } from "./compose-theme";
export type { SrgbColor } from "./contrast";
export { cssColorToSrgb, cssFirstFontFamily, cssLengthToPx, cssVarReference } from "./css-values";
export { defaultDensityForVariant, densityAttributes } from "./density";
export { themeAttributes } from "./theme-attributes";
export { TOKEN_KINDS, TOKEN_NAMES } from "./tokens/contract";
export type { TokenContract, TokenKind, TokenName } from "./tokens/contract";
export { PRIMITIVE_NAMES, PRIMITIVES } from "./tokens/primitives";
export type { PrimitiveName } from "./tokens/primitives";
export { LEGAL_THEMES, themeSlug } from "./tokens/themes";
export type { ThemeInput, ThemeSlug } from "./tokens/themes";
