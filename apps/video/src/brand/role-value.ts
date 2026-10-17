import * as Hex from "@elmeragroup/color/hex";
import { themeSlug } from "@elmeragroup/fuse/theme";
import type { BrandCode, ThemeVariant } from "@elmeragroup/fuse/theme";
import type { ResolvedColorScheme, TokenEntry } from "@elmeragroup/fuse/theme-catalog";

import { themeFor } from "../primitives/scene-theme";
import { themeBySlug } from "./fuse-catalog";

/** A colour role: a role token whose value is a colour. */
export type ColorRole = Extract<TokenEntry, { readonly kind: "color" }>["name"];

/** Where a role resolves: the brand, the scheme and the variant `SceneTheme` stamps. */
export type RoleScope = {
  readonly brand: BrandCode;
  readonly scheme: ResolvedColorScheme;
  readonly variant?: ThemeVariant;
};

/** Each role's hex per theme, scheme and role, so a frame-by-frame caller formats it once. */
const hexes = new Map<string, string>();

/**
 * A colour role's value as the hex a brand book prints, such as `#1f6b4a`. It reads Fuse's
 * resolved catalog rather than computed styles, so a frame never waits on the DOM for it. Results
 * are cached per theme, scheme and role.
 *
 * @param scope - The theme the role resolves in; external by default, as `SceneTheme` is.
 * @param role - The colour role.
 * @returns The role's value as opaque hex.
 * @throws When Fuse's catalog lacks the theme, a defect in the theme tables.
 */
export function roleHex({ brand, scheme, variant = "external" }: RoleScope, role: ColorRole): string {
  const slug = themeSlug(themeFor(brand, variant));
  const key = `${slug}/${scheme}/${role}`;
  const cached = hexes.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const hex = Hex.formatOpaque(themeBySlug(slug).schemes[scheme].tokens[role].value);
  hexes.set(key, hex);
  return hex;
}
