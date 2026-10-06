import * as Oklch from "@elmeragroup/color/oklch";
import { getOrThrow } from "@elmeragroup/color/result";

import { tokenOklch } from "../token-color";
import { DERIVED_ROLES } from "./contract";
import type { DerivedTokenName, LayerTokens, TokenContract } from "./contract";
import { readableSidebarBrand } from "./sidebar-brand";

/**
 * One `DERIVED_ROLES` mix entry. Indexing `LayerTokens` with its sources fails to compile if
 * an entry ever names a derived role as a source.
 */
type MixRole = Extract<(typeof DERIVED_ROLES)[DerivedTokenName], { readonly _tag: "OklchMix" }>;

/**
 * Mix two `oklch()` token literals in OKLCH, as CSS `color-mix(in oklch, from, toward percent%)`
 * does. Percents are source, so one outside 0..100 is a defect and throws, as `tokenOklch` does
 * for a literal that is not `oklch()` notation.
 *
 * @param from - The literal the mix starts from.
 * @param toward - The literal the mix moves toward.
 * @param percent - The share of `toward`, in percent.
 * @returns The mixed color as an `oklch()` literal.
 */
export function mixOklchLiteral(from: string, toward: string, percent: number): string {
  const mixed = Oklch.mix(
    tokenOklch(from),
    tokenOklch(toward),
    getOrThrow(Oklch.makeMixWeight(percent / 100))
  );
  return Oklch.format(mixed);
}

function mixLiteral(tokens: LayerTokens, role: MixRole): string {
  return mixOklchLiteral(tokens[role.from], tokens[role.toward], role.percent);
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
    ...readableSidebarBrand(tokens),
  } satisfies Record<DerivedTokenName, string>;
  return { ...tokens, ...derived };
}

/**
 * The value a theme rule declares for a derived role. A mix declares its live `color-mix()`,
 * which the browser evaluates wherever the declaration applies, so it follows a host
 * override of either source there; `withDerivedTokens` computes the same mix as a literal.
 * A composed role declares the value composition computed.
 *
 * @param name - A derived role.
 * @param composed - The value `withDerivedTokens` computed for the role.
 * @returns The `color-mix(in oklch, …)` expression over a mix's sources, or `composed`.
 */
export function derivedRoleCss(name: DerivedTokenName, composed: string): string {
  const role = DERIVED_ROLES[name];
  if (role._tag === "Composed") {
    return composed;
  }
  return `color-mix(in oklch, var(--${role.from}), var(--${role.toward}) ${role.percent}%)`;
}
