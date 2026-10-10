import type { ArtboardScheme } from "./documents";
import type { StudioSeed } from "./seed";
import { isTokenName } from "./tokens";
import type { TokenName } from "./tokens";

const VAR_REFERENCE = /var\(\s*--([\w-]+)/gu;

/** The custom properties a declared value reads, from each `var()` in it. */
export function referencedNames(css: string): string[] {
  return Array.from(css.matchAll(VAR_REFERENCE), (match) => match[1] ?? "");
}

/** The tokens each token's declaration reads in one scheme, for the tokens that read any. */
export type SchemeReferences = Readonly<Partial<Record<TokenName, readonly TokenName[]>>>;

/**
 * A base theme's alias graph: the tokens each declaration reads, per scheme. A `var()` naming a
 * primitive leaves the graph, so it is not listed.
 */
export type BaseReferences = { readonly [Scheme in ArtboardScheme]: SchemeReferences };

function schemeReferences(seed: StudioSeed, scheme: ArtboardScheme): SchemeReferences {
  const entries = Object.entries(seed[scheme]).flatMap(([name, token]) => {
    const tokens = referencedNames(token.css).filter((target) => isTokenName(target));
    return tokens.length === 0 ? [] : [[name, tokens] as const];
  });
  return Object.fromEntries(entries);
}

/**
 * The tokens a seed's declarations read, which is all the cycle check needs of a base theme.
 * The generator writes every theme's references eagerly, so the session can check a theme it
 * has not loaded the seed of.
 */
export function referencesOf(seed: StudioSeed): BaseReferences {
  return { light: schemeReferences(seed, "light"), dark: schemeReferences(seed, "dark") };
}
