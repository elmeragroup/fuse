/**
 * The numbers the `/landing` page states about the library, read from the library so the page
 * cannot drift from it. Theme, brand and segment counts come from `@elmeragroup/fuse/theme` at
 * render time; this module covers the facts that have no runtime export: the supported locales,
 * the density metrics, and a slug/title/lede index of the component pages, so the landing's
 * client code never imports the full component-page manifest.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

import type { ResolvedThemeCatalog } from "@elmeragroup/fuse/theme-catalog";

import type { ComponentPageEntry } from "../../src/lib/docs-model.ts";
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
    const locales = members.flatMap((member) =>
      member.type === "TSLiteralType" &&
      member.literal.type === "Literal" &&
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- parsed-source I/O: an ESTree Literal's value kind is known only at runtime
      typeof member.literal.value === "string"
        ? [member.literal.value]
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
 * @param components - Every component page the site serves, in route order; the landing names
 *   them by slug, title and lede for its count, its nav showcase and its part labels.
 * @returns The module source, without the generated banner.
 */
export function renderLandingFacts(
  catalog: ResolvedThemeCatalog,
  components: readonly Pick<ComponentPageEntry, "slug" | "title" | "lede">[]
): string {
  const metrics = catalog.density.map((metric) => ({ name: metric.name, px: metric.px }));
  const index = components.map(({ slug, title, lede }) => ({ slug, title, lede }));
  const facts = { locales: readSupportedLocales(), metrics, components: index };
  return `/** Library facts the landing page states, read from the library by the generate pass. */
export const LANDING_FACTS = ${JSON.stringify(facts, null, 2)} as const;
`;
}
