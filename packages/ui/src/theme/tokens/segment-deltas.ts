import type { TokenContract } from "./contract";
import type { ThemeInput } from "./themes";

export const FKAS_COMPANY_DELTA = {
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

export function segmentDelta(theme: ThemeInput): Partial<TokenContract> | undefined {
  if (theme.variant === "external" && theme.brand === "fkas" && theme.segment === "company") {
    return FKAS_COMPANY_DELTA;
  }
  return undefined;
}
