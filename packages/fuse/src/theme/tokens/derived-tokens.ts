import { mixOklch } from "../oklch-mix";
import type { DerivedTokenName, LayerTokenName, LayerTokens, TokenContract } from "./contract";

/**
 * How far the secondary hover moves from `secondary` toward `foreground`. It reproduces the
 * `color-mix(in oklch, var(--secondary), var(--foreground) 5%)` the Button recipe used,
 * as a literal that design tools can store.
 */
const SECONDARY_HOVER_TOWARD_FOREGROUND = 0.05;

/**
 * The roles each derived role reads. A scope that resets one of these must also reset the
 * derived role, or the scope would inherit a value computed from its parent's roles.
 */
export const DERIVED_TOKEN_SOURCES = {
  "secondary-hover": ["secondary", "foreground"],
} as const satisfies Record<DerivedTokenName, readonly LayerTokenName[]>;

/**
 * Complete a composed theme with its derived roles. Composition calls it last, so every
 * derived value follows the roles the theme resolved.
 *
 * @param tokens - Every layer-assigned role of one composed theme.
 * @returns The full token contract for that theme.
 */
export function withDerivedTokens(tokens: LayerTokens): TokenContract {
  return {
    ...tokens,
    "secondary-hover": mixOklch(tokens.secondary, tokens.foreground, SECONDARY_HOVER_TOWARD_FOREGROUND),
  };
}
