import * as Oklch from "@elmeragroup/color/oklch";
import { getOrThrow } from "@elmeragroup/color/result";

import { tokenOklch } from "../token-color";
import { DERIVED_ROLES } from "./contract";
import type { DerivedTokenName, LayerTokens, TokenContract } from "./contract";

/**
 * One `DERIVED_ROLES` entry. Indexing `LayerTokens` with its sources fails to compile if an
 * entry ever names a derived role as a source.
 */
type DerivedRole = (typeof DERIVED_ROLES)[DerivedTokenName];

// `DERIVED_ROLES` is source, so a percent outside 0..100 is a defect and throws, as
// `tokenOklch` does for a source role that is not an `oklch()` literal.
function mixLiteral(tokens: LayerTokens, role: DerivedRole): string {
  const mixed = Oklch.mix(
    tokenOklch(tokens[role.from]),
    tokenOklch(tokens[role.toward]),
    getOrThrow(Oklch.makeMixWeight(role.percent / 100))
  );
  return Oklch.format(mixed);
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
  const role = DERIVED_ROLES[name];
  return `color-mix(in oklch, var(--${role.from}), var(--${role.toward}) ${role.percent}%)`;
}
