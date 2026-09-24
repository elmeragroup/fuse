/**
 * DTCG JSON projected from the resolved theme catalog for native Figma import.
 *
 * One file is one Figma mode. Colors are sRGB rounded to 1e-6; dimensions are px; a
 * reference becomes a `{group.name}` alias. The DTCG vocabulary stays here, and the catalog
 * owns every CSS reading. The generation pass writes one module that inlines every document
 * (`FIGMA_THEME_FILES`), and the routes serve from it — there is no second, per-slug JSON
 * serialisation.
 */

import * as Hex from "@elmeragroup/color/hex";
import { getOrThrow } from "@elmeragroup/color/result";
import * as Srgb from "@elmeragroup/color/srgb";
import type {
  PrimitiveEntry,
  Reference,
  ResolvedScheme,
  ResolvedThemeCatalog,
  TokenEntry,
  TokenKind,
} from "@elmeragroup/fuse/theme-catalog";

import type {
  FigmaColorToken,
  FigmaDimensionToken,
  FigmaFontToken,
  FigmaSrgbColor,
  FigmaThemeDocument,
  FigmaThemeIndex,
} from "../../src/lib/docs-model.ts";

type DtcgGroup = "color" | "size" | "font";

const DTCG_GROUPS = {
  color: "color",
  dimension: "size",
  fontFamily: "font",
} as const satisfies Record<TokenKind, DtcgGroup>;

type DtcgAlias = `{${string}}`;

/** A name's key in its kind's group. Font tokens drop their prefix, as `font.sans`. */
function dtcgKey(kind: TokenKind, name: string): string {
  return kind === "fontFamily" ? name.replace(/^font-/, "") : name;
}

/** The DTCG alias of a reference. A reference target has the same kind as the entry holding it. */
function aliasOf(kind: TokenKind, reference: Reference): DtcgAlias {
  return `{${DTCG_GROUPS[kind]}.${dtcgKey(kind, reference.name)}}`;
}

/**
 * Round each channel to 1e-6. Rounding keeps a channel inside `0..1`, so `make` accepts it.
 * `hex` is built from the rounded `components`, so the two fields always agree.
 */
function dtcgColor(color: Srgb.Srgb): FigmaSrgbColor {
  const round = (channel: number) => Math.round(channel * 1_000_000) / 1_000_000;
  const srgb = getOrThrow(
    Srgb.make({ r: round(color.r), g: round(color.g), b: round(color.b), alpha: color.alpha })
  );
  return {
    colorSpace: "srgb",
    components: [srgb.r, srgb.g, srgb.b],
    alpha: srgb.alpha,
    hex: Hex.formatOpaque(srgb),
  };
}

type DtcgGroups = {
  color: Record<string, FigmaColorToken>;
  size: Record<string, FigmaDimensionToken>;
  font: Record<string, FigmaFontToken>;
};

/** Write one entry into its kind's group: an alias for a reference, else its literal. */
function emitEntry(groups: DtcgGroups, entry: PrimitiveEntry | TokenEntry): void {
  const key = dtcgKey(entry.kind, entry.name);
  const alias = entry.reference === undefined ? undefined : aliasOf(entry.kind, entry.reference);
  switch (entry.kind) {
    case "color":
      groups.color[key] = { $type: "color", $value: alias ?? dtcgColor(entry.value) };
      return;
    case "dimension":
      groups.size[key] = { $type: "dimension", $value: alias ?? { value: entry.value, unit: "px" } };
      return;
    case "fontFamily":
      groups.font[key] = { $type: "fontFamily", $value: alias ?? entry.value };
      return;
  }
}

/**
 * One DTCG document for one theme's scheme; primitives are inlined first.
 *
 * @param scheme - The theme's resolved tokens in one color scheme.
 * @param primitives - The catalog's primitives.
 * @returns The document Figma's native importer reads as one mode.
 */
export function figmaDocumentFromScheme(
  scheme: ResolvedScheme,
  primitives: ResolvedThemeCatalog["primitives"]
): FigmaThemeDocument {
  const groups: DtcgGroups = { color: {}, size: {}, font: {} };
  for (const entry of Object.values(primitives)) {
    emitEntry(groups, entry);
  }
  for (const entry of Object.values(scheme.tokens)) {
    emitEntry(groups, entry);
  }
  return {
    color: { $type: "color", ...groups.color },
    size: { $type: "dimension", ...groups.size },
    font: { $type: "fontFamily", ...groups.font },
  };
}

/**
 * The index of per-mode files, one per legal theme.
 *
 * @param catalog - The resolved theme catalog.
 * @returns The `/api/themes/figma` payload.
 */
export function buildFigmaThemeIndex(catalog: ResolvedThemeCatalog): FigmaThemeIndex {
  return {
    format: "figma",
    files: catalog.themes.map((theme) => ({
      slug: theme.slug,
      href: `/api/themes/figma/${theme.slug}`,
    })),
  };
}

/**
 * The generated module the `/api/themes/figma` routes import. The export writes light modes only.
 *
 * @param catalog - The resolved theme catalog.
 * @returns The module source.
 */
export function renderFigmaThemeCatalog(catalog: ResolvedThemeCatalog): string {
  const files = catalog.themes
    .map((theme) => {
      const document = figmaDocumentFromScheme(theme.schemes.light, catalog.primitives);
      return `  "${theme.slug}": ${JSON.stringify(document)}`;
    })
    .join(",\n");
  return `import type { FigmaThemeDocument, FigmaThemeIndex } from "../lib/docs-model";

export const FIGMA_THEME_INDEX: FigmaThemeIndex = ${JSON.stringify(buildFigmaThemeIndex(catalog), null, 2)};

export const FIGMA_THEME_FILES: { readonly [slug: string]: FigmaThemeDocument } = {
${files}
};
`;
}
