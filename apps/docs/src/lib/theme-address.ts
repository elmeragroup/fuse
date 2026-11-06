import { LEGAL_THEMES, themeSlug } from "@elmeragroup/fuse/theme";
import type { ThemeInput } from "@elmeragroup/fuse/theme";

/**
 * The search parameter that carries a shared theme, as Fuse's slug: `neutral-fkas-company`. The
 * landing's shared addresses and a block preview opened in its own tab both read it.
 */
export const THEME_QUERY = "theme";

/**
 * Every slug Fuse's slug parser accepts, mapped to the attributes a head script stamps on `<html>`
 * for it, as the JSON text the script embeds. The keys are `themeSlug` over `LEGAL_THEMES`, the
 * set `parseThemeSlug` accepts, so a script that looks a slug up in the map carries no slug
 * grammar of its own.
 *
 * @param attributes - The attributes a theme stamps.
 * @returns The map as JSON.
 */
export function slugAttributesJson(
  attributes: (theme: ThemeInput) => Readonly<Record<string, string>>
): string {
  return JSON.stringify(
    Object.fromEntries(LEGAL_THEMES.map((theme) => [themeSlug(theme), attributes(theme)]))
  );
}
