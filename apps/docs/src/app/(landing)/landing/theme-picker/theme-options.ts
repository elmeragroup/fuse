import { BRANDS } from "@elmeragroup/fuse/theme";
import type { BrandCode, ColorScheme, ThemeInput, ThemeSegment } from "@elmeragroup/fuse/theme";

import { COLOR_SCHEME_LABELS, SEGMENT_LABELS, VARIANT_LABELS } from "../../../../lib/theme";

/**
 * The option data the theme picker renders: which combinations are legal, and how a theme reads
 * aloud and in a summary. Legality comes from the segments Fuse's `BRANDS` serves, so a brand
 * Fuse pins to one segment shows here without a list of its own.
 */

/** The audience a segment serves, for the reason a pinned brand gives. */
const SEGMENT_AUDIENCE = {
  private: "households",
  company: "businesses",
} as const satisfies Record<ThemeSegment, string>;

/**
 * Why `brand` cannot take `segment`, or `undefined` when it can: "Fjordkraft Företag serves
 * businesses only".
 *
 * @param brand - The brand in the theme.
 * @param segment - The segment a visitor might pick.
 * @returns The reason the segment is blocked, or `undefined` when the pair is legal.
 */
export function segmentBlock(brand: BrandCode, segment: ThemeSegment): string | undefined {
  const served: readonly ThemeSegment[] = BRANDS[brand].segments;
  if (served.includes(segment)) {
    return undefined;
  }
  const audience = served.map((candidate) => SEGMENT_AUDIENCE[candidate]).join(" and ");
  return `${BRANDS[brand].displayName} serves ${audience} only`;
}

/**
 * The theme in one line, as the chip reads it: "Fjordkraft · Private · External".
 *
 * @param theme - The theme to name.
 * @returns The brand, segment and variant joined by middle dots.
 */
export function themeSummary(theme: ThemeInput): string {
  return `${BRANDS[theme.brand].displayName} · ${SEGMENT_LABELS[theme.segment]} · ${VARIANT_LABELS[theme.variant]}`;
}

/**
 * What the status region says after a change: "Theme: Fjordkraft, private, external, dark".
 *
 * @param theme - The theme just committed.
 * @param scheme - The colour scheme the visitor picked; `system` reads as "system".
 * @returns The sentence the polite region announces.
 */
export function themeAnnouncement(theme: ThemeInput, scheme: ColorScheme): string {
  const parts = [SEGMENT_LABELS[theme.segment], VARIANT_LABELS[theme.variant], COLOR_SCHEME_LABELS[scheme]];
  return `Theme: ${[BRANDS[theme.brand].displayName, ...parts.map((part) => part.toLowerCase())].join(", ")}`;
}
