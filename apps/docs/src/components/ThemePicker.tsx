"use client";

import type { ChangeEvent, ReactElement } from "react";

import { BRANDS } from "@elmeragroup/ui/theme";
import type { ThemeInput, ThemeSegment } from "@elmeragroup/ui/theme";

import {
  parseThemeBrand,
  parseThemeSegment,
  parseThemeVariant,
  THEME_BRANDS,
  THEME_SEGMENTS,
  THEME_VARIANTS,
  themeFromAxes,
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
    onThemeChange(themeFromAxes(variant, theme.brand, theme.segment));
  };

  const handleBrandChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const brand = parseThemeBrand(event.target.value);
    if (brand === null) {
      return;
    }
    onThemeChange(themeFromAxes(theme.variant, brand, theme.segment));
  };

  const handleSegmentChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const segment = parseThemeSegment(event.target.value);
    if (segment === null) {
      return;
    }
    onThemeChange(themeFromAxes(theme.variant, theme.brand, segment));
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

function isSegmentAllowed(allowedSegments: readonly ThemeSegment[], segment: ThemeSegment): boolean {
  return allowedSegments.includes(segment);
}
