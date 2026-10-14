import type { ResolvedColorScheme } from "../color-scheme-types";
import type { TokenLayer } from "./contract";
import { externalDarkPalette } from "./external-dark-palettes";
import { EXTERNAL_PALETTES, EXTERNAL_VARIANT_LAYER, paletteBrand } from "./external-palettes";
import { INTERNAL_DARK_PALETTE } from "./internal-dark-palette";
import { segmentSheet } from "./segment-sheets";
import type { ThemeInput } from "./themes";

/**
 * The palette layers a theme overlays for one color scheme, in application order.
 * Internal light has none, because `LAYER_DEFAULTS` and the brand pointer already describe
 * it. Internal dark adds the shared internal palette. External light is the variant layer,
 * the brand palette and its segment delta. External dark is the brand-and-segment dark sheet.
 * The fkab alias is resolved here, once, so every palette table below is keyed by
 * `ExternalBrandCode`.
 */
export function paletteLayers(theme: ThemeInput, colorScheme: ResolvedColorScheme): TokenLayer[] {
  const layers: TokenLayer[] = [];
  if (theme.variant === "internal") {
    if (colorScheme === "dark") {
      layers.push(INTERNAL_DARK_PALETTE);
    }
    return layers;
  }
  const brand = paletteBrand(theme.brand);
  if (colorScheme === "light") {
    layers.push(EXTERNAL_VARIANT_LAYER, EXTERNAL_PALETTES[brand]);
    const sheet = segmentSheet(brand, theme.segment);
    if (sheet !== undefined) {
      layers.push(sheet.light);
    }
    return layers;
  }
  layers.push(externalDarkPalette(brand, theme.segment));
  return layers;
}
