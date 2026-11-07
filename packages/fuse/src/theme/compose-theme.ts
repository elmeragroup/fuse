import type { ResolvedColorScheme } from "./color-scheme-types";
import { cornersOf } from "./corners/corners";
import type { ThemeIdentity, ThemeInput } from "./theme-input";
import { themeSlug } from "./theme-input";
import { brandPointer } from "./tokens/brand-pointers";
import {
  assignedTokenNames,
  MUST_OVERRIDE_BY_IDENTITY,
  MUST_OVERRIDE_DARK,
  overlayTokenLayers,
} from "./tokens/contract";
import type { TokenContract, TokenName } from "./tokens/contract";
import { LAYER_DEFAULTS } from "./tokens/defaults";
import { withDerivedTokens } from "./tokens/derived-tokens";
import { paletteLayers } from "./tokens/palette-layers";

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

function mustOverrideKeys(identity: ThemeIdentity, colorScheme: ResolvedColorScheme): readonly TokenName[] {
  return colorScheme === "dark" ? MUST_OVERRIDE_DARK : MUST_OVERRIDE_BY_IDENTITY[identity];
}

/**
 * Throws when the layers of a theme leave one of its must-override tokens to the defaults.
 *
 * @param supplied - The token names the theme's non-default layers assign.
 * @param identity - The theme's identity, which picks the light obligations.
 * @param colorScheme - The scheme whose obligations apply.
 * @param slug - The theme's slug, for the message.
 * @throws When a must-override token is missing, a defect in the theme tables.
 */
export function assertMustOverrideCoverage(
  supplied: ReadonlySet<TokenName>,
  identity: ThemeIdentity,
  colorScheme: ResolvedColorScheme,
  slug: string
): void {
  const missing = mustOverrideKeys(identity, colorScheme).filter((key) => !supplied.has(key));
  if (missing.length > 0) {
    throw new Error(`Theme ${slug} is missing must-override tokens: ${missing.join(", ")}`);
  }
}

/**
 * Composes a theme's full token contract in one scheme: the defaults, the brand pointer, the
 * identity's palette layers and its corner set.
 *
 * @param theme - A legal theme.
 * @param colorScheme - The scheme, light by default.
 * @returns Every token's composed value.
 * @throws When the theme misses a must-override token, a defect in the theme tables.
 */
export function composeTheme(theme: ThemeInput, colorScheme: ResolvedColorScheme = "light"): TokenContract {
  const slug = themeSlug(theme);
  // The light layers always run — every composition overlays them — and a dark composition
  // adds the dark layers' gate.
  const gates: readonly ResolvedColorScheme[] = colorScheme === "dark" ? ["light", "dark"] : ["light"];
  for (const gate of gates) {
    assertMustOverrideCoverage(suppliedTokenNames(theme, gate), theme.identity, gate, slug);
  }
  // Corners overlay last and only in light: no palette assigns them, and the dark composition
  // keeps them from the light one.
  const light = withDerivedTokens(
    overlayTokenLayers(
      LAYER_DEFAULTS,
      brandPointer(theme.brand),
      ...paletteLayers(theme, "light"),
      cornersOf(theme)
    )
  );
  if (colorScheme === "dark") {
    // Dark layers overlay the light composition, so roles no dark palette names, such as
    // corners and typography, keep their light values. Composition computes the derived
    // roles again from the dark roles.
    return withDerivedTokens(overlayTokenLayers(light, ...paletteLayers(theme, "dark")));
  }
  return light;
}
