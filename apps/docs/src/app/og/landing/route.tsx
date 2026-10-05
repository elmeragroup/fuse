import { themeSlug } from "@elmeragroup/fuse/theme";

import { LANDING_SUMMARY } from "../../(landing)/landing/landing-facts";
import { parseThemeQuery, THEME_QUERY } from "../../(landing)/landing/landing-theme-defaults";
import { LandingImage } from "../../../og/landing-image";
import { loadBrandArtwork } from "../../../og/og-assets";
import { ogResponse } from "../../../og/og-response";
import { css, ogTheme } from "../../../og/og-theme";

/**
 * The landing's Open Graph image in the theme `?theme=` names. The landing's own parser reads
 * it, so a missing, repeated or illegal value draws `LANDING_THEME`, the theme the page opens in.
 */
export async function GET(request: Request): Promise<Response> {
  const values = new URL(request.url).searchParams.getAll(THEME_QUERY);
  const theme = ogTheme(
    themeSlug(parseThemeQuery(values.length === 0 ? undefined : values.length === 1 ? values[0] : values))
  );
  const { colors } = theme;
  const [mark, brandMark, brandLogo] = await Promise.all([
    loadBrandArtwork("elma", "marks", css(colors.foreground)),
    loadBrandArtwork(theme.brand, "marks", css(theme.variant === "internal" ? colors.brand : colors.feature)),
    loadBrandArtwork(theme.brand, "logos", css(colors.foreground)),
  ]);
  return await ogResponse(
    <LandingImage
      theme={theme}
      mark={mark}
      brandMark={brandMark}
      brandLogo={brandLogo}
      summary={LANDING_SUMMARY}
    />
  );
}
