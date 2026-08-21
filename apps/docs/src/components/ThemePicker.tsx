"use client";

import type { ChangeEvent, ReactElement } from "react";

import { BRANDS, coerceTheme } from "@elmeragroup/ui/theme";
import type { ThemeInput, ThemeSegment } from "@elmeragroup/ui/theme";

import {
  parseThemeBrand,
  parseThemeSegment,
  parseThemeVariant,
  THEME_BRANDS,
  THEME_SEGMENTS,
  THEME_VARIANTS,
} from "../lib/theme";

export type ThemePickerProps = {
  theme: ThemeInput;
  onThemeChange: (theme: ThemeInput) => void;
};

export function ThemePicker({ theme, onThemeChange }: ThemePickerProps): ReactElement {
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

  return (
    <div className="ThemePicker">
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
