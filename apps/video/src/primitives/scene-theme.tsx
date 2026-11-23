import type { ReactElement, ReactNode } from "react";

import { coerceTheme, densityAttributes, ThemeScope } from "@elmeragroup/fuse/theme";
import type { BrandCode, Density, ThemeIdentity, ThemeInput } from "@elmeragroup/fuse/theme";
import type { ResolvedColorScheme } from "@elmeragroup/fuse/theme-catalog";

/**
 * The density each identity ships at in the films: a neutral app dense, a branded site
 * comfortable. Fuse implies no density from an identity, so the films name the pairing here.
 */
export const IDENTITY_DENSITY = {
  neutral: "dense",
  branded: "comfortable",
} as const satisfies Record<ThemeIdentity, Density>;

/**
 * A brand's theme in an identity, in the private segment, which Fuse pins to company for Fjordkraft
 * Företag, the one company-only brand.
 *
 * @param brand - The brand.
 * @param identity - The identity.
 * @returns The theme a scene stamps for them.
 */
export function themeFor(brand: BrandCode, identity: ThemeIdentity): ThemeInput {
  const theme = coerceTheme({ identity, brand, segment: "private" });
  if (theme === null) {
    throw new Error(`Fuse rejected the ${brand} ${identity} theme, a defect in themeFor.`);
  }
  return theme;
}

/** Props for {@link SceneTheme}. */
export type SceneThemeProps = {
  readonly brand: BrandCode;
  readonly scheme: ResolvedColorScheme;
  /** The identity; branded by default, as the landing opens. */
  readonly identity?: ThemeIdentity;
  /** The density; the identity's density in {@link IDENTITY_DENSITY} by default. */
  readonly density?: Density;
  readonly className?: string;
  readonly children: ReactNode;
};

/**
 * A subtree in one brand, scheme and identity. It stamps the theme through `ThemeScope`, the dark
 * scheme through `data-theme`, and the density, the identity's one unless the caller
 * names another, through the demo-stage attributes Fuse's `demo-stage-density.css` re-scopes, so
 * a dense app and a comfortable site can share one frame. Overlays inside it portal into its
 * element and keep its theme.
 *
 * @returns The themed element.
 */
export function SceneTheme({
  brand,
  scheme,
  identity = "branded",
  density = IDENTITY_DENSITY[identity],
  className,
  children,
}: SceneThemeProps): ReactElement {
  return (
    <ThemeScope
      theme={themeFor(brand, identity)}
      data-theme={scheme === "dark" ? "dark" : undefined}
      data-demo-stage=""
      {...densityAttributes(density)}
      className={className}>
      {children}
    </ThemeScope>
  );
}
