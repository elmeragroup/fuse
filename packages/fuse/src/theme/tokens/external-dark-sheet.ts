import type { TokenContract, TokenLayer } from "./contract";

/**
 * The Figma sheet roles every external dark palette must name. The remaining roles —
 * status, chart, syntax, muted and the panel derivatives — come from `DARK_DEFAULTS` or
 * are derived from these, so a sheet that omits one of these keys is a type error rather
 * than a silent fallback to the light composition.
 */
export const EXTERNAL_DARK_SHEET_KEYS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "card-soft",
  "card-soft-foreground",
  "primary",
  "primary-foreground",
  "primary-soft",
  "primary-soft-foreground",
  "secondary",
  "secondary-foreground",
  "secondary-soft",
  "secondary-soft-foreground",
  "feature",
  "feature-bright",
  "feature-foreground",
] as const;

/**
 * A dark palette for one external brand or segment: every Figma-named role is required,
 * and a sheet may additionally name any other role it owns.
 */
export type ExternalDarkSheet = Pick<TokenContract, (typeof EXTERNAL_DARK_SHEET_KEYS)[number]> & TokenLayer;
