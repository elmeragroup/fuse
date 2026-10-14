"use client";

import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";

import {
  BRAND_CODES,
  BRANDS,
  COLOR_SCHEMES,
  THEME_SEGMENTS,
  THEME_VARIANTS,
  useColorScheme,
} from "@elmeragroup/fuse/theme";
import type { ThemeSegment } from "@elmeragroup/fuse/theme";
import { Toast } from "@elmeragroup/fuse/toast";

import { COLOR_SCHEME_LABELS, DEFAULT_THEME, SEGMENT_LABELS, VARIANT_LABELS } from "../lib/theme";
import { usePreviewTheme } from "./preview-theme";
import { SitePaletteDialog, SitePaletteProvider } from "./site-palette/site-palette";
import type { SiteSettings } from "./site-palette/site-palette-model";
import { commitTheme } from "./theme-picker";

/** The words every preview-theme entry matches, as the header's theme settings group them. */
const PREVIEW_KEYWORDS = ["preview theme"];

/**
 * The docs' settings: the document's appearance and the component previews' theme, the same
 * choices as the header's theme settings menu.
 */
function useDocsSettings(): SiteSettings {
  const { colorScheme, setColorScheme } = useColorScheme();
  const { theme, setTheme } = usePreviewTheme();
  return useMemo((): SiteSettings => {
    const allowedSegments: readonly ThemeSegment[] = BRANDS[theme.brand].segments;
    return {
      pages: [
        {
          id: "appearance",
          label: "Appearance",
          keywords: ["color scheme"],
          options: COLOR_SCHEMES.map((scheme) => ({
            id: scheme,
            label: COLOR_SCHEME_LABELS[scheme],
            state: scheme === colorScheme ? "current" : "available",
            apply: () => {
              setColorScheme(scheme);
            },
          })),
        },
        {
          id: "variant",
          label: "Variant",
          keywords: PREVIEW_KEYWORDS,
          options: THEME_VARIANTS.map((variant) => ({
            id: variant,
            label: VARIANT_LABELS[variant],
            state: variant === theme.variant ? "current" : "available",
            apply: () => {
              commitTheme({ ...theme, variant }, setTheme);
            },
          })),
        },
        {
          id: "brand",
          label: "Brand",
          keywords: PREVIEW_KEYWORDS,
          options: BRAND_CODES.map((brand) => ({
            id: brand,
            label: BRANDS[brand].displayName,
            state: brand === theme.brand ? "current" : "available",
            apply: () => {
              commitTheme({ ...theme, brand }, setTheme);
            },
          })),
        },
        {
          id: "segment",
          label: "Segment",
          keywords: PREVIEW_KEYWORDS,
          options: THEME_SEGMENTS.map((segment) => ({
            id: segment,
            label: SEGMENT_LABELS[segment],
            state: segmentState(segment, theme.segment, allowedSegments),
            apply: () => {
              commitTheme({ ...theme, segment }, setTheme);
            },
          })),
        },
      ],
      commands: [
        {
          id: "reset-preview-theme",
          title: "Reset preview theme",
          keywords: PREVIEW_KEYWORDS,
          action: {
            _tag: "Run",
            run: () => {
              setTheme(DEFAULT_THEME);
            },
          },
        },
      ],
    };
  }, [colorScheme, setColorScheme, theme, setTheme]);
}

function segmentState(
  segment: ThemeSegment,
  current: ThemeSegment,
  allowed: readonly ThemeSegment[]
): "current" | "available" | "unavailable" {
  if (segment === current) {
    return "current";
  }
  return allowed.includes(segment) ? "available" : "unavailable";
}

function DocsPaletteState({ children }: { children: ReactNode }): ReactElement {
  const toasts = Toast.useToastManager();
  return (
    <SitePaletteProvider settings={useDocsSettings()} toasts={toasts}>
      {children}
      <SitePaletteDialog />
    </SitePaletteProvider>
  );
}

/**
 * The docs' site palette around the docs shell, with the toasts its copy actions report in. The
 * docs had no toasts of their own, so the viewport mounts here.
 */
export function DocsPalette({ children }: { children: ReactNode }): ReactElement {
  return (
    <Toast.Provider>
      <DocsPaletteState>{children}</DocsPaletteState>
      <Toast.Viewport />
    </Toast.Provider>
  );
}
