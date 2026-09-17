import type { TokenContract } from "./contract";
import type { BrandCode, ThemeInput, ThemeSegment } from "./themes";

/** Both schemes' sheets for one brand/segment pair that departs from its brand base. */
export type SegmentSheets = {
  /** The light overrides applied on top of the brand's base palette. */
  readonly light: Partial<TokenContract>;

  /** The dark sheet that replaces the brand's dark palette. */
  readonly dark: Partial<TokenContract>;
};

// fkas-company's light overrides on top of the fkas base palette. The generator emits only
// the keys that differ from the base theme.
const FKAS_COMPANY_DELTA = {
  background: "oklch(0.9823 0.01428 213.1)",
  foreground: "oklch(0.30579 0.03693 215.45)",
  "card-foreground": "oklch(0.25285 0.03792 212.52)",
  "card-soft": "oklch(0.99011 0.0069 219.56)",
  "card-soft-foreground": "oklch(0.30579 0.03693 215.45)",
  "muted-foreground": "oklch(0.30579 0.03693 215.45 / 0.7)",
  primary: "oklch(0.47471 0.07313 217.18)",
  "primary-soft": "oklch(0.95328 0.03401 215.01)",
  "primary-soft-foreground": "oklch(0.25285 0.03792 212.52)",
  secondary: "oklch(0.30579 0.03693 215.45)",
  "secondary-soft": "oklch(0.95328 0.03401 215.01)",
  "secondary-soft-foreground": "oklch(0.30579 0.03693 215.45)",
  feature: "oklch(0.55738 0.06979 216.27)",
  "feature-bright": "oklch(0.7871 0.0657 225.82)",
  "feature-foreground": "oklch(0.90856 0.05958 225.03)",
} as const satisfies Partial<TokenContract>;

// Bedrift UF9t0CyeKAwPEypCW3S41m. Only fkas-company uses this sheet, and it replaces
// the fkas dark sheet key for key rather than layering on top of it.
const FKAS_COMPANY_DARK_SHEET = {
  background: "oklch(0.1749487 0.003804 164.5613)", // #0F1110
  foreground: "oklch(0.9822955 0.0142785 213.0969)", // #EFFCFF
  card: "oklch(0.2661671 0.0034366 164.8011)", // #242625
  "card-foreground": "oklch(0.9822955 0.0142785 213.0969)", // #EFFCFF
  "card-soft": "oklch(0.1749487 0.003804 164.5613)", // #0F1110
  "card-soft-foreground": "oklch(0.9822955 0.0142785 213.0969)", // #EFFCFF
  primary: "oklch(0.9085589 0.0595841 225.0316)", // #B7EAFF
  "primary-foreground": "oklch(0 0 0)", // #000000
  "primary-soft": "oklch(0.2661671 0.0034366 164.8011)", // #242625
  "primary-soft-foreground": "oklch(0.9822955 0.0142785 213.0969)", // #EFFCFF
  secondary: "oklch(0.9822955 0.0142785 213.0969)", // #EFFCFF
  "secondary-foreground": "oklch(0 0 0)", // #000000
  "secondary-soft": "oklch(0.2661671 0.0034366 164.8011)", // #242625
  "secondary-soft-foreground": "oklch(0.9822955 0.0142785 213.0969)", // #EFFCFF
  feature: "oklch(0.5573786 0.0697862 216.2687)", // #3E7E8E
  "feature-bright": "oklch(0.2661671 0.0034366 164.8011)", // #242625
  "feature-foreground": "oklch(0.3921674 0.071463 220.1224)", // #004E60
} as const satisfies Partial<TokenContract>;

// `as const satisfies` keeps the literal key; the accessor narrows the composite key to
// it with `Object.hasOwn`, so the lookup needs no open-dictionary annotation (which
// `anti-slop/no-known-value-widening` rejects).
const SEGMENT_SHEETS = {
  "fkas-company": { light: FKAS_COMPANY_DELTA, dark: FKAS_COMPANY_DARK_SHEET },
} as const satisfies Partial<Record<`${BrandCode}-${ThemeSegment}`, SegmentSheets>>;

/** True when a composite brand/segment key names an entry in `SEGMENT_SHEETS`. */
function isSegmentSheetKey(key: string): key is keyof typeof SEGMENT_SHEETS {
  return Object.hasOwn(SEGMENT_SHEETS, key);
}

/**
 * Both schemes' sheets for one theme that departs from its brand base, or `undefined`
 * when it has none. Internal themes never consult a segment sheet, so an internal
 * `fkas-company` is a no-sheet theme by construction.
 */
export function segmentSheet(theme: ThemeInput): SegmentSheets | undefined {
  if (theme.variant !== "external") return undefined;
  const key = `${theme.brand}-${theme.segment}`;
  return isSegmentSheetKey(key) ? SEGMENT_SHEETS[key] : undefined;
}
