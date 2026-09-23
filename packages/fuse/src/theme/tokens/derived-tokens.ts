import { mixOklch } from "../oklch";
import { DERIVED_ROLES } from "./contract";
import type { DerivedTokenName, LayerTokenName, LayerTokens, TokenContract } from "./contract";

/** A `DERIVED_ROLES` entry whose sources are layer roles, so composition can read them. */
type LayerMix = {
  readonly from: LayerTokenName;
  readonly toward: LayerTokenName;
  readonly percent: number;
};

function mixLiteral(tokens: LayerTokens, role: LayerMix): string {
  return mixOklch(tokens[role.from], tokens[role.toward], role.percent / 100);
}

/**
 * Complete a composed theme with its derived roles. Composition calls it last, so every
 * derived literal follows the roles the theme resolved. Each value reads only the roles its
 * `DERIVED_ROLES` entry names.
 *
 * @param tokens - Every layer-assigned role of one composed theme.
 * @returns The full token contract for that theme.
 */
export function withDerivedTokens(tokens: LayerTokens): TokenContract {
  const derived = {
    "secondary-hover": mixLiteral(tokens, DERIVED_ROLES["secondary-hover"]),
  } satisfies Record<DerivedTokenName, string>;
  return { ...tokens, ...derived };
}

/**
 * The live CSS form of a derived role, the `color-mix()` its `DERIVED_ROLES` entry
 * describes. The browser evaluates it wherever the declaration applies, so it follows a
 * host override of either source there. `withDerivedTokens` computes the same mix as a
 * literal.
 *
 * @param name - A derived role.
 * @returns The `color-mix(in oklch, …)` expression over the role's sources.
 */
export function derivedRoleCss(name: DerivedTokenName): string {
  const role: LayerMix = DERIVED_ROLES[name];
  return `color-mix(in oklch, var(--${role.from}), var(--${role.toward}) ${role.percent}%)`;
}
