"use client";

import type { ChangeEvent, ReactElement } from "react";

import { tv } from "tailwind-variants";

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

const themePicker = tv({
  slots: {
    root: "[&_select]:border-docs-line [&_select]:bg-docs-soft [&_select]:font-docs-mono [&_select]:text-docs-ink [&_select:focus-visible]:outline-docs-ink ml-auto flex items-center [&_select]:cursor-pointer [&_select]:appearance-none [&_select]:border [&_select]:px-[9px] [&_select]:py-[5px] [&_select]:text-[11.5px] [&_select]:font-[500] [&_select+select]:border-l-0 [&_select:first-child]:rounded-[6px_0_0_6px] [&_select:focus-visible]:relative [&_select:focus-visible]:z-[1] [&_select:focus-visible]:outline-2 [&_select:focus-visible]:outline-offset-[-1px] [&_select:last-child]:rounded-[0_6px_6px_0]",
  },
});

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

  const { root } = themePicker();

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
