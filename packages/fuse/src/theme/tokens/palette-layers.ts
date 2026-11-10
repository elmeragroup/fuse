import type { ResolvedColorScheme } from "../color-scheme-types";
import type { ThemeInput } from "../theme-input";
import { brandDarkPalette } from "./brand-dark-palettes";
import { BRAND_PALETTES, BRANDED_IDENTITY_LAYER, paletteBrand } from "./brand-palettes";
import type { TokenLayer } from "./contract";
import { NEUTRAL_DARK_PALETTE } from "./neutral-dark-palette";
import { segmentSheet } from "./segment-sheets";

/**
 * The palette layers a theme overlays for one color scheme, in application order.
 * Neutral light has none, because `LAYER_DEFAULTS` and the brand pointer already describe
 * it. Neutral dark adds the shared neutral palette. Branded light is the identity layer,
 * the brand palette and its segment delta. Branded dark is the brand-and-segment dark sheet.
 * The fkab alias is resolved here, as in each accessor of a per-brand table, so every palette
 * table below is keyed by `PaletteBrandCode`. Corners are no palette layer: `theme/corners/corners.ts` owns them, so
 * the dark rules, which reset every key a palette layer can change, never restate them.
 */
export function paletteLayers(theme: ThemeInput, colorScheme: ResolvedColorScheme): TokenLayer[] {
  const layers: TokenLayer[] = [];
  if (theme.identity === "neutral") {
    if (colorScheme === "dark") {
      layers.push(NEUTRAL_DARK_PALETTE);
    }
    return layers;
  }
  const brand = paletteBrand(theme.brand);
  if (colorScheme === "light") {
    layers.push(BRANDED_IDENTITY_LAYER, BRAND_PALETTES[brand]);
    const sheet = segmentSheet(brand, theme.segment);
    if (sheet !== undefined) {
      layers.push(sheet.light);
    }
    return layers;
  }
  layers.push(brandDarkPalette(brand, theme.segment));
  return layers;
}
