/**
 * The colour token list of the tokens handbook page: every token a library colour utility reads,
 * each with the description the resolved catalog gives it, the same text the Figma sync sends.
 */

import type { ResolvedThemeCatalog } from "@elmeragroup/fuse/theme-catalog";

import type { TokenRef } from "../../src/lib/docs-model.ts";
import type { ColorTokenMap } from "./tokens.ts";

/**
 * Every colour token a utility in the library's `@theme` block reads, in name order, with its
 * catalog description.
 *
 * @param colors - The utility-to-token map read from the library's `@theme` block.
 * @param catalog - The resolved theme catalog.
 * @returns One colour reference per token, named with its leading dashes.
 * @throws Error when the block names a token that is neither a role nor a primitive, which the
 *   page could not describe.
 */
export function buildTokenReference(
  colors: ColorTokenMap,
  catalog: ResolvedThemeCatalog
): readonly TokenRef[] {
  // Every theme describes its tokens the same way, so the first one speaks for all.
  const [theme] = catalog.themes;
  const entries = [...Object.values(theme.schemes.light.tokens), ...Object.values(catalog.primitives)];
  const descriptions = new Map(entries.map((entry) => [`--${entry.name}`, entry.description]));
  return [...new Set(colors.values())]
    .sort((left, right) => left.localeCompare(right))
    .map((name) => {
      const description = descriptions.get(name);
      if (description === undefined) {
        throw new Error(
          `The @theme block maps a colour utility to ${name}, which the theme catalog does not describe.`
        );
      }
      return { name, isColor: true, description };
    });
}

/** The generated module the tokens handbook page imports. */
export function renderTokenReference(tokens: readonly TokenRef[]): string {
  return `import type { TokenRef } from "../lib/docs-model";

/** Every colour token a Tailwind utility in the library resolves to, with its description. */
export const COLOR_TOKENS: readonly TokenRef[] = ${JSON.stringify(tokens, null, 2)};
`;
}
