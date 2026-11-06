/**
 * The theme axes as a page stamps them, mirrored from Fuse's `THEME_AXES`
 * (`packages/fuse/src/theme/theme-input.ts`). pr-shots runs on plain Node type stripping, which
 * cannot load Fuse's TypeScript sources, so it keeps its own copy, and
 * `test/pr-shots-theme-axes.test.mjs` holds this copy to the registry.
 */

/** Each axis's attribute, in slug order: `<identity>-<brand>-<segment>`. */
export const THEME_AXIS_ATTRIBUTES = [
  "data-theme-identity",
  "data-theme-brand",
  "data-theme-segment",
] as const;

/** The attribute that names a theme's brand. */
export const BRAND_ATTRIBUTE = THEME_AXIS_ATTRIBUTES[1];

/** The identities a theme slug may name, in Fuse's order. */
export const THEME_IDENTITIES = ["neutral", "branded"] as const;

/** The segments a theme slug may name, in Fuse's order. */
export const THEME_SEGMENTS = ["private", "company"] as const;
