import type { ResolvedColorScheme } from "./color-scheme-types";
import { brandPointer } from "./tokens/brand-pointers";
import {
  assignedTokenNames,
  MUST_OVERRIDE_DARK,
  MUST_OVERRIDE_EXTERNAL,
  MUST_OVERRIDE_INTERNAL,
  overlayTokenLayers,
} from "./tokens/contract";
import type { TokenContract, TokenName } from "./tokens/contract";
import { DEFAULTS } from "./tokens/defaults";
import { paletteLayers } from "./tokens/palette-layers";
import { themeSlug } from "./tokens/themes";
import type { ThemeInput, ThemeVariant } from "./tokens/themes";

/**
 * The coverage gates one composition must pass. The light layers always run — every
 * composition overlays them — and a dark composition adds the dark layers' gate.
 */
export function coverageSchemes(colorScheme: ResolvedColorScheme): readonly ResolvedColorScheme[] {
  return colorScheme === "dark" ? ["light", "dark"] : ["light"];
}

/** Every token name the brand pointer and the scheme's palette layers assign. */
function suppliedTokenNames(theme: ThemeInput, colorScheme: ResolvedColorScheme): Set<TokenName> {
  const supplied = new Set<TokenName>(assignedTokenNames(brandPointer(theme.brand)));
  for (const layer of paletteLayers(theme, colorScheme)) {
    for (const name of assignedTokenNames(layer)) {
      supplied.add(name);
    }
  }
  return supplied;
}

export function mustOverrideKeys(
  variant: ThemeVariant,
  colorScheme: ResolvedColorScheme
): readonly TokenName[] {
  if (colorScheme === "dark") {
    return MUST_OVERRIDE_DARK;
  }
  return variant === "internal" ? MUST_OVERRIDE_INTERNAL : MUST_OVERRIDE_EXTERNAL;
}

export function assertMustOverrideCoverage(
  supplied: ReadonlySet<TokenName>,
  variant: ThemeVariant,
  colorScheme: ResolvedColorScheme,
  slug: string
): void {
  const missing = mustOverrideKeys(variant, colorScheme).filter((key) => !supplied.has(key));
  if (missing.length > 0) {
    throw new Error(`Theme ${slug} is missing must-override tokens: ${missing.join(", ")}`);
  }
}

export function composeTheme(theme: ThemeInput, colorScheme: ResolvedColorScheme = "light"): TokenContract {
  const slug = themeSlug(theme);
  for (const gate of coverageSchemes(colorScheme)) {
    assertMustOverrideCoverage(suppliedTokenNames(theme, gate), theme.variant, gate, slug);
  }
  const light = overlayTokenLayers(DEFAULTS, brandPointer(theme.brand), ...paletteLayers(theme, "light"));
  if (colorScheme === "dark") {
    // Dark layers overlay the light composition, so roles no dark palette names — radius,
    // typography — keep their light values.
    return overlayTokenLayers(light, ...paletteLayers(theme, "dark"));
  }
  return light;
}
