"use client";

import type { ChangeEvent, ReactElement } from "react";

import { tv } from "tailwind-variants";

import { BRANDS, coerceTheme, useColorScheme } from "@elmeragroup/ui/theme";
import type { ThemeInput, ThemeSegment } from "@elmeragroup/ui/theme";

import {
  COLOR_SCHEME_LABELS,
  COLOR_SCHEMES,
  parseColorScheme,
  parseThemeBrand,
  parseThemeSegment,
  parseThemeVariant,
  THEME_BRANDS,
  THEME_SEGMENTS,
  THEME_VARIANTS,
} from "../lib/theme";

const themePicker = tv({
  slots: {
    root: "[&_select]:font-medium sm:order-none sm:w-auto order-last ml-auto flex w-full items-center justify-end [&_select]:h-(--control-h-sm) [&_select]:cursor-pointer [&_select]:appearance-none [&_select]:border [&_select]:border-input [&_select]:bg-card [&_select]:px-(--control-px-sm) [&_select]:font-mono [&_select]:[font-size:var(--control-text)] [&_select]:[line-height:var(--control-leading)] [&_select]:text-card-foreground [&_select+select]:border-l-0 [&_select:first-child]:rounded-l-lg [&_select:focus-visible]:relative [&_select:focus-visible]:z-[1] [&_select:focus-visible]:outline-2 [&_select:focus-visible]:outline-offset-[-1px] [&_select:focus-visible]:outline-ring [&_select:last-child]:rounded-r-lg",
  },
});

const { root } = themePicker();

export type ThemePickerProps = {
  theme: ThemeInput;
  onThemeChange: (theme: ThemeInput) => void;
};

export function ThemePicker({ theme, onThemeChange }: ThemePickerProps): ReactElement {
  const { colorScheme, setColorScheme } = useColorScheme();
  const allowedSegments = BRANDS[theme.brand].segments;

  const handleVariantChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const variant = parseThemeVariant(event.target.value);
    if (variant === null) {
      return;
    }
    commitTheme({ variant, brand: theme.brand, segment: theme.segment }, onThemeChange);
  };

  const handleBrandChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const brand = parseThemeBrand(event.target.value);
    if (brand === null) {
      return;
    }
    commitTheme({ variant: theme.variant, brand, segment: theme.segment }, onThemeChange);
  };

  const handleSegmentChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const segment = parseThemeSegment(event.target.value);
    if (segment === null) {
      return;
    }
    commitTheme({ variant: theme.variant, brand: theme.brand, segment }, onThemeChange);
  };

  const handleColorSchemeChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const scheme = parseColorScheme(event.target.value);
    if (scheme === null) {
      return;
    }
    setColorScheme(scheme);
  };

  return (
    <div className={root()}>
      <select aria-label="Variant" value={theme.variant} onChange={handleVariantChange}>
        {THEME_VARIANTS.map((variant) => (
          <option key={variant} value={variant}>
            {variant}
          </option>
        ))}
      </select>
      <select aria-label="Brand" value={theme.brand} onChange={handleBrandChange}>
        {THEME_BRANDS.map((brand) => (
          <option key={brand} value={brand}>
            {brand}
          </option>
        ))}
      </select>
      <select aria-label="Segment" value={theme.segment} onChange={handleSegmentChange}>
        {THEME_SEGMENTS.map((segment) => (
          <option key={segment} value={segment} disabled={!isSegmentAllowed(allowedSegments, segment)}>
            {segment}
          </option>
        ))}
      </select>
      <select aria-label="Color scheme" value={colorScheme} onChange={handleColorSchemeChange}>
        {COLOR_SCHEMES.map((scheme) => (
          <option key={scheme} value={scheme}>
            {COLOR_SCHEME_LABELS[scheme]}
          </option>
        ))}
      </select>
    </div>
  );
}

function commitTheme(
  next: { variant: ThemeInput["variant"]; brand: ThemeInput["brand"]; segment: ThemeSegment },
  onThemeChange: (theme: ThemeInput) => void
): void {
  const coerced = coerceTheme(next);
  if (coerced === null) {
    return;
  }
  onThemeChange(coerced);
}

function isSegmentAllowed(allowedSegments: readonly ThemeSegment[], segment: ThemeSegment): boolean {
  return allowedSegments.includes(segment);
}
