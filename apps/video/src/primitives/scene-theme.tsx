import type { ReactElement, ReactNode } from "react";

import { BRANDS, defaultDensityForVariant, densityAttributes, ThemeScope } from "@elmeragroup/fuse/theme";
import type { BrandCode, Density, ThemeInput, ThemeVariant } from "@elmeragroup/fuse/theme";
import type { ResolvedColorScheme } from "@elmeragroup/fuse/theme-catalog";

/**
 * A brand's theme in a variant, in its first allowed segment: Fjordkraft Företag is company-only,
 * the rest private.
 *
 * @param brand - The brand.
 * @param variant - The variant.
 * @returns The theme a scene stamps for them.
 */
export function themeFor(brand: BrandCode, variant: ThemeVariant): ThemeInput {
  // SAFETY: the segment is the brand's own first allowed segment from Fuse's pin table, so the
  // combination is legal; TypeScript cannot correlate the table's entry with the union member.
  return { variant, brand, segment: BRANDS[brand].segments[0] } as ThemeInput;
}

/** Props for {@link SceneTheme}. */
export type SceneThemeProps = {
  readonly brand: BrandCode;
  readonly scheme: ResolvedColorScheme;
  /** The variant; external by default, as the landing opens. */
  readonly variant?: ThemeVariant;
  /** The density; the variant's deployed density by default. */
  readonly density?: Density;
  readonly className?: string;
  readonly children: ReactNode;
};

/**
 * A subtree in one brand, scheme and variant. It stamps the theme through `ThemeScope`, the dark
 * scheme through `data-theme`, and the density, the variant's deployed one unless the caller
 * names another, through the demo-stage attributes Fuse's `demo-stage-density.css` re-scopes, so
 * a dense app and a comfortable site can share one frame. Overlays inside it portal into its
 * element and keep its theme.
 *
 * @returns The themed element.
 */
export function SceneTheme({
  brand,
  scheme,
  variant = "external",
  density = defaultDensityForVariant(variant),
  className,
  children,
}: SceneThemeProps): ReactElement {
  return (
    <ThemeScope
      theme={themeFor(brand, variant)}
      data-theme={scheme === "dark" ? "dark" : undefined}
      data-demo-stage=""
      {...densityAttributes(density)}
      className={className}>
      {children}
    </ThemeScope>
  );
}
