import type { ResolvedColorScheme } from "./color-scheme-types";
import { brandPointer } from "./tokens/brand-pointers";
import {
  assignedTokenNames,
  EXTERNAL_RESET_KEYS,
  MUST_OVERRIDE_EXTERNAL,
  MUST_OVERRIDE_INTERNAL,
  overlayTokenLayers,
  pickTokenKeys,
} from "./tokens/contract";
import type { TokenContract, TokenName } from "./tokens/contract";
import { DEFAULTS } from "./tokens/defaults";
import { externalDarkPalette } from "./tokens/external-dark-palettes";
import { externalPalette } from "./tokens/external-palettes";
import { INTERNAL_DARK_PALETTE } from "./tokens/internal-dark-palette";
import { segmentSheet } from "./tokens/segment-sheets";
import { themeSlug } from "./tokens/themes";
import type { ThemeInput, ThemeVariant } from "./tokens/themes";

export function internalReset(): Pick<TokenContract, (typeof EXTERNAL_RESET_KEYS)[number]> {
  return pickTokenKeys(DEFAULTS, EXTERNAL_RESET_KEYS);
}

export function externalResetLayer(theme: ThemeInput): Partial<TokenContract> {
  return {
    ...internalReset(),
    ...externalPalette(theme.brand),
  };
}

export function nonDefaultLayers(theme: ThemeInput): Partial<TokenContract>[] {
  const layers: Partial<TokenContract>[] = [brandPointer(theme.brand)];
  if (theme.variant === "internal") {
    layers.push(internalReset());
    return layers;
  }
  layers.push(externalResetLayer(theme));
  const light = segmentSheet(theme)?.light;
  if (light) {
    layers.push(light);
  }
  return layers;
}

export function suppliedNonDefaultKeys(theme: ThemeInput): Set<TokenName> {
  const supplied = new Set<TokenName>();
  for (const name of assignedTokenNames(brandPointer(theme.brand))) {
    supplied.add(name);
  }
  if (theme.variant === "external") {
    for (const name of assignedTokenNames(externalPalette(theme.brand))) {
      supplied.add(name);
    }
    const light = segmentSheet(theme)?.light;
    if (light) {
      for (const name of assignedTokenNames(light)) {
        supplied.add(name);
      }
    }
  }
  return supplied;
}

export function mustOverrideKeys(variant: ThemeVariant): readonly TokenName[] {
  return variant === "internal" ? MUST_OVERRIDE_INTERNAL : MUST_OVERRIDE_EXTERNAL;
}

export function assertMustOverrideCoverage(
  supplied: ReadonlySet<TokenName>,
  variant: ThemeVariant,
  slug: string
): void {
  const missing = mustOverrideKeys(variant).filter((key) => !supplied.has(key));
  if (missing.length > 0) {
    throw new Error(`Theme ${slug} is missing must-override tokens: ${missing.join(", ")}`);
  }
}

export function composeTheme(theme: ThemeInput, colorScheme: ResolvedColorScheme = "light"): TokenContract {
  const slug = themeSlug(theme);
  assertMustOverrideCoverage(suppliedNonDefaultKeys(theme), theme.variant, slug);
  const light = overlayTokenLayers(DEFAULTS, ...nonDefaultLayers(theme));
  if (colorScheme === "dark") {
    const dark = theme.variant === "internal" ? INTERNAL_DARK_PALETTE : externalDarkPalette(theme);
    return overlayTokenLayers(light, dark);
  }
  return light;
}
