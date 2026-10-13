import { BRANDS, coerceTheme } from "@elmeragroup/fuse/theme";
import type { BrandCode, ThemeInput, ThemeSegment, ThemeVariant } from "@elmeragroup/fuse/theme";

import { SEGMENT_LABELS, VARIANT_LABELS } from "../../lib/theme";

/** A change to one or more of a theme's axes. */
export type ThemeAxes = {
  readonly brand?: BrandCode;
  readonly variant?: ThemeVariant;
  readonly segment?: ThemeSegment;
};

/**
 * `theme` with `axes` laid over it, through Fuse's `coerceTheme`, so the result is always a legal
 * theme: a brand that serves one segment drags the segment along.
 */
export function themeWith(theme: ThemeInput, axes: ThemeAxes): ThemeInput {
  // `coerceTheme` returns null only for an axis value it does not know, which the types rule out.
  return coerceTheme({ ...theme, ...axes }) ?? theme;
}

/** A theme as the studio names it: brand, variant and segment, such as "Elmera · External · Private". */
export function themeLabel(theme: ThemeInput): string {
  return `${BRANDS[theme.brand].displayName} · ${VARIANT_LABELS[theme.variant]} · ${SEGMENT_LABELS[theme.segment]}`;
}
