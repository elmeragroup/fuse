"use client";

import type { ReactElement } from "react";

import { Select } from "@elmeragroup/fuse/select";
import { BRAND_CODES, BRANDS, THEME_SEGMENTS, THEME_VARIANTS } from "@elmeragroup/fuse/theme";
import type { ThemeInput, ThemeSegment } from "@elmeragroup/fuse/theme";

import { SingleToggle } from "../../components/single-toggle";
import { SEGMENT_LABELS, VARIANT_LABELS } from "../../lib/theme";
import type { ArtboardSpec } from "../lib/documents";
import { themeWith } from "../lib/theme-axes";
import type { ThemeAxes } from "../lib/theme-axes";
import { useStudio } from "./studio-state";

/** The brands' display names, by brand, for a Select's trigger to show before it opens. */
export const BRAND_NAMES = Object.fromEntries(
  BRAND_CODES.map((code) => [code, BRANDS[code].displayName])
) satisfies Record<string, string>;

/** The theme an artboard renders, and the command that changes its brand, variant or segment. */
export type ArtboardTheme = {
  readonly theme: ThemeInput;
  /** Lays `axes` over the artboard's theme. A brand that serves one segment drags the segment. */
  readonly change: (axes: ThemeAxes) => void;
};

/** An artboard's theme, as the theme toolbar and the inspector change it. */
export function useArtboardTheme(artboard: ArtboardSpec): ArtboardTheme {
  const { settingsOf, changeSettings } = useStudio();
  const { theme } = settingsOf(artboard);
  return {
    theme,
    change: (axes) => {
      changeSettings(artboard.id, { theme: themeWith(theme, axes) });
    },
  };
}

/** The Brand Select's options: every brand, by its display name. */
export function BrandOptions(): ReactElement {
  return (
    <>
      {BRAND_CODES.map((code) => (
        <Select.Item key={code} value={code}>
          {BRANDS[code].displayName}
        </Select.Item>
      ))}
    </>
  );
}

/** An artboard's variant, as a segmented toggle. */
export function VariantToggle({ artboard }: { artboard: ArtboardSpec }): ReactElement {
  const { theme, change } = useArtboardTheme(artboard);
  return (
    <SingleToggle
      label="Variant"
      size="sm"
      options={THEME_VARIANTS}
      labels={VARIANT_LABELS}
      value={theme.variant}
      onValueChange={(variant) => {
        change({ variant });
      }}
    />
  );
}

/**
 * An artboard's segment, as a segmented toggle. A segment its brand does not serve is disabled,
 * as the base theme picker disables it, so the toggle never asks for an illegal theme.
 */
export function SegmentToggle({ artboard }: { artboard: ArtboardSpec }): ReactElement {
  const { theme, change } = useArtboardTheme(artboard);
  const served: readonly ThemeSegment[] = BRANDS[theme.brand].segments;
  return (
    <SingleToggle
      label="Segment"
      size="sm"
      options={THEME_SEGMENTS}
      labels={SEGMENT_LABELS}
      value={theme.segment}
      optionProps={{
        private: { disabled: !served.includes("private") },
        company: { disabled: !served.includes("company") },
      }}
      onValueChange={(segment) => {
        change({ segment });
      }}
    />
  );
}
