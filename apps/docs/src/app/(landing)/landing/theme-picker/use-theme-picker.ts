import { BRANDS, COLOR_SCHEMES, THEME_SEGMENTS, THEME_VARIANTS } from "@elmeragroup/fuse/theme";
import type { BrandCode, ColorScheme, ThemeInput, ThemeSegment, ThemeVariant } from "@elmeragroup/fuse/theme";

import { COLOR_SCHEME_LABELS, SEGMENT_LABELS, VARIANT_LABELS } from "../../../../lib/theme";
import { useMediaQuery } from "../../../../lib/use-media-query";
import { PICKER_BRANDS } from "../landing-facts";
import { useLandingTheme } from "../landing-theme";
import type { ThemeChange } from "../landing-theme";
import { segmentBlock, themeSummary } from "./theme-options";

/** One option on one axis, with the reason it is blocked when the current brand cannot take it. */
export type AxisOption<Value extends string> = {
  readonly value: Value;
  readonly label: string;
  readonly blocked?: string;
};

/** What the theme picker reads and calls. */
export type ThemePicker = {
  readonly theme: ThemeInput;
  readonly colorScheme: ColorScheme;
  /** "Fjordkraft · Private · External". */
  readonly summary: string;
  readonly brands: readonly AxisOption<BrandCode>[];
  readonly segments: readonly AxisOption<ThemeSegment>[];
  readonly variants: readonly AxisOption<ThemeVariant>[];
  readonly schemes: readonly AxisOption<ColorScheme>[];
  readonly changeTheme: (change: ThemeChange) => void;
  readonly changeColorScheme: (scheme: ColorScheme) => void;
};

const BRAND_OPTIONS = PICKER_BRANDS.map((brand) => ({ value: brand, label: BRANDS[brand].displayName }));
const VARIANT_OPTIONS = THEME_VARIANTS.map((variant) => ({ value: variant, label: VARIANT_LABELS[variant] }));
const SCHEME_OPTIONS = COLOR_SCHEMES.map((scheme) => ({ value: scheme, label: COLOR_SCHEME_LABELS[scheme] }));

/**
 * The landing theme as the picker sees it: the current value of each axis, each axis's
 * options in display order, and the segments the current brand blocks with their reasons. Every
 * change goes through the landing's provider, so it coerces, reveals and announces there.
 */
export function useThemePicker(): ThemePicker {
  const { theme, colorScheme, changeTheme, changeColorScheme } = useLandingTheme();
  const segments = THEME_SEGMENTS.map((segment): AxisOption<ThemeSegment> => {
    const label = SEGMENT_LABELS[segment];
    const blocked = segmentBlock(theme.brand, segment);
    return blocked === undefined ? { value: segment, label } : { value: segment, label, blocked };
  });
  return {
    theme,
    colorScheme,
    summary: themeSummary(theme),
    brands: BRAND_OPTIONS,
    segments,
    variants: VARIANT_OPTIONS,
    schemes: SCHEME_OPTIONS,
    changeTheme,
    changeColorScheme,
  };
}

/** Below Tailwind's `sm`, where the picker opens in a bottom Sheet instead of a popover. */
const PHONE_QUERY = "(width < 40rem)";

/**
 * True on a phone-width viewport. The server and the first client render say false, so the
 * markup hydrates as rendered; the trigger looks the same either way, and only what it opens
 * changes.
 */
export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY, false);
}
