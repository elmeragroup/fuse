"use client";

import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";

import { LEGAL_THEMES, themeSlug } from "@elmeragroup/fuse/theme";
import type { ThemeInput } from "@elmeragroup/fuse/theme";
import { Toast } from "@elmeragroup/fuse/toast";

import { SitePaletteDialog, SitePaletteProvider } from "../../../components/site-palette/site-palette";
import { colorSchemeOptions } from "../../../components/site-palette/site-palette-model";
import type { SiteSettings } from "../../../components/site-palette/site-palette-model";
import { PICKER_BRANDS } from "./landing-facts";
import { useLandingTheme } from "./landing-theme";
import { sameTheme } from "./landing-theme-defaults";
import { themeSummary } from "./theme-picker/theme-options";

/** Every legal theme, which the landing can wear, in the theme picker's brand order. */
const LANDING_THEMES: readonly ThemeInput[] = PICKER_BRANDS.flatMap((brand) =>
  LEGAL_THEMES.filter((theme) => theme.brand === brand)
);

/**
 * The landing's settings: the colour scheme and the theme the page wears, which the nav's theme
 * chip also moves. Both go through the landing's provider, so a pick reveals and announces as the
 * chip's does.
 */
function useLandingSettings(): SiteSettings {
  const { theme, colorScheme, changeTheme, changeColorScheme } = useLandingTheme();
  return useMemo(
    (): SiteSettings => ({
      pages: [
        {
          id: "appearance",
          label: "Appearance",
          keywords: ["color scheme"],
          options: colorSchemeOptions(colorScheme, changeColorScheme),
        },
        {
          id: "landing-theme",
          label: "Landing theme",
          keywords: ["brand", "segment", "variant"],
          options: LANDING_THEMES.map((option) => ({
            id: themeSlug(option),
            label: themeSummary(option),
            state: sameTheme(option, theme) ? "current" : "available",
            apply: () => {
              changeTheme(option);
            },
          })),
        },
      ],
      commands: [],
    }),
    [theme, colorScheme, changeTheme, changeColorScheme]
  );
}

/**
 * The landing's site palette around the page. It sits inside the landing's toast provider, which
 * shows the copy actions' toasts.
 */
export function LandingPalette({ children }: { children: ReactNode }): ReactElement {
  const toasts = Toast.useToastManager();
  return (
    <SitePaletteProvider settings={useLandingSettings()} toasts={toasts}>
      {children}
      <SitePaletteDialog />
    </SitePaletteProvider>
  );
}
