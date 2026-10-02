/**
 * The numbers the `/landing` page states about the library, read from the library so the page
 * cannot drift from it. Theme, brand and segment counts come from `@elmeragroup/fuse/theme` at
 * render time and the component count from the component-page manifest; this module covers
 * the facts that have no runtime export: the supported locales and the density metrics.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

import type { ResolvedThemeCatalog } from "@elmeragroup/fuse/theme-catalog";

import { fuseSrc } from "./paths.ts";

/** The file that declares the `SupportedLocale` union, the one list of shipped locales. */
const LOCALE_SOURCE = path.join(fuseSrc, "intl/locale-context.tsx");

/**
 * Reads the string members of `SupportedLocale`. The union is type-only, so it is read from
 * the source rather than imported.
 *
 * @returns The locale tags, in declaration order.
 */
export function readSupportedLocales(): readonly string[] {
  const parsed = parseSync(LOCALE_SOURCE, readFileSync(LOCALE_SOURCE, "utf8"));
  for (const statement of parsed.program.body) {
    const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (declaration?.type !== "TSTypeAliasDeclaration" || declaration.id.name !== "SupportedLocale") {
      continue;
    }
    const alias = declaration.typeAnnotation;
    const members = alias.type === "TSUnionType" ? alias.types : [alias];
    // A string literal's raw text is its quoted JSON form; any other literal is not a locale tag.
    const locales = members.flatMap((member) =>
      member.type === "TSLiteralType" &&
      member.literal.type === "Literal" &&
      member.literal.raw?.startsWith('"')
        ? [String(JSON.parse(member.literal.raw))]
        : []
    );
    if (locales.length === members.length && locales.length > 0) {
      return locales;
    }
  }
  throw new Error(`landing facts: no string-literal SupportedLocale union in ${LOCALE_SOURCE}`);
}

/**
 * Renders the generated module.
 *
 * @param catalog - The resolved theme catalog, for the density metrics.
 * @returns The module source, without the generated banner.
 */
export function renderLandingFacts(catalog: ResolvedThemeCatalog): string {
  const densities = Object.keys(catalog.density[0]?.px ?? {});
  const metrics = catalog.density.map((metric) => ({ name: metric.name, px: metric.px }));
  const facts = { locales: readSupportedLocales(), densities, metrics };
  return `/** Library facts the landing page states, read from the library by the generate pass. */
export const LANDING_FACTS = ${JSON.stringify(facts, null, 2)} as const;
`;
}
