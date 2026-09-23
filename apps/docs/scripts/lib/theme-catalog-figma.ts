/**
 * DTCG JSON projected from the theme catalog for native Figma import.
 *
 * One file is one Figma mode. Colors are sRGB; dimensions are px; CSS var() becomes
 * `{group.name}` aliases. Conversion stays here; the generation pass writes one module
 * that inlines every document (`FIGMA_THEME_FILES`), and the routes serve from it — there
 * is no second, per-slug JSON serialisation.
 */

import {
  cssColorToSrgb,
  cssFirstFontFamily,
  cssLengthToPx,
  cssVarReference,
  PRIMITIVE_NAMES,
  TOKEN_KINDS,
} from "@elmeragroup/fuse/theme-catalog";
import type { TokenKind } from "@elmeragroup/fuse/theme-catalog";

import type {
  FigmaColorToken,
  FigmaDimensionToken,
  FigmaFontToken,
  FigmaSrgbColor,
  FigmaThemeDocument,
  FigmaThemeIndex,
  ThemeCatalog,
  ThemeCatalogEntry,
  ThemeCatalogTokenMap,
} from "../../src/lib/docs-model.ts";

type DtcgGroup = "color" | "size" | "font";

type DtcgSlot = { group: DtcgGroup; key: string };

const DTCG_GROUPS = {
  color: "color",
  dimension: "size",
  fontFamily: "font",
} as const satisfies Record<TokenKind, DtcgGroup>;

// Every primitive is a color.
const KINDS: ReadonlyMap<string, TokenKind> = new Map<string, TokenKind>([
  ...PRIMITIVE_NAMES.map((name) => [name, "color"] as const),
  ...Object.entries(TOKEN_KINDS),
]);

function dtcgSlot(name: string): DtcgSlot {
  const kind = KINDS.get(name);
  if (kind === undefined) {
    throw new Error(`Expected a Fuse token or primitive name, received: ${name}`);
  }
  // Font tokens sit in the font group without their prefix, as `font.sans`.
  const key = kind === "fontFamily" ? name.replace(/^font-/, "") : name;
  return { group: DTCG_GROUPS[kind], key };
}

function roundComponent(channel: number): number {
  return Math.round(channel * 1_000_000) / 1_000_000;
}

function hexFromSrgb(r: number, g: number, b: number): string {
  const byte = (channel: number): string =>
    Math.round(channel * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function aliasOf(tokenName: string): `{${string}}` {
  const slot = dtcgSlot(tokenName);
  return `{${slot.group}.${slot.key}}`;
}

function dimensionFromCss(css: string): FigmaDimensionToken["$value"] {
  const px = cssLengthToPx(css);
  if (px === undefined) {
    throw new Error(`Expected a rem or px dimension, received: ${css}`);
  }
  return { value: px, unit: "px" };
}

function colorFromCss(css: string): FigmaColorToken["$value"] {
  const srgb = cssColorToSrgb(css);
  if (srgb === undefined) {
    throw new Error(`Expected an oklch() or hex color, received: ${css}`);
  }
  const components = [roundComponent(srgb.r), roundComponent(srgb.g), roundComponent(srgb.b)] as const;
  const color: FigmaSrgbColor = {
    colorSpace: "srgb",
    components,
    alpha: srgb.alpha,
    hex: hexFromSrgb(...components),
  };
  return color;
}

function fontFamilyFromCss(css: string): string {
  const family = cssFirstFontFamily(css);
  if (family === undefined) {
    throw new Error(`Expected a font stack that starts with a named family, received: ${css}`);
  }
  return family;
}

/**
 * The DTCG value for one role. A `var(--role)` value becomes an alias of that role's slot,
 * and any other value goes through the parser for its token type.
 */
function valueOrAlias<Value>(css: string, parse: (css: string) => Value): Value | `{${string}}` {
  const referenced = cssVarReference(css);
  return referenced === undefined ? parse(css) : aliasOf(referenced);
}

function cssTokenName(cssKey: string): string {
  if (!cssKey.startsWith("--")) {
    throw new Error(`Expected a --custom-property key, received: ${cssKey}`);
  }
  return cssKey.slice(2);
}

type DtcgGroups = {
  color: Record<string, FigmaColorToken>;
  size: Record<string, FigmaDimensionToken>;
  font: Record<string, FigmaFontToken>;
};

function emitToken(groups: DtcgGroups, name: string, css: string): void {
  const slot = dtcgSlot(name);
  if (slot.group === "font") {
    groups.font[slot.key] = { $type: "fontFamily", $value: valueOrAlias(css, fontFamilyFromCss) };
    return;
  }
  if (slot.group === "size") {
    groups.size[slot.key] = { $type: "dimension", $value: valueOrAlias(css, dimensionFromCss) };
    return;
  }
  groups.color[slot.key] = { $type: "color", $value: valueOrAlias(css, colorFromCss) };
}

function emitCssMap(groups: DtcgGroups, map: ThemeCatalogTokenMap): void {
  for (const [cssKey, css] of Object.entries(map)) {
    emitToken(groups, cssTokenName(cssKey), css);
  }
}

/** One DTCG document projected from a catalog row; primitives are inlined. */
export function figmaDocumentFromCatalog(
  entry: ThemeCatalogEntry,
  primitives: ThemeCatalogTokenMap
): FigmaThemeDocument {
  const groups: DtcgGroups = { color: {}, size: {}, font: {} };
  emitCssMap(groups, primitives);
  emitCssMap(groups, entry.tokens);
  return {
    color: { $type: "color", ...groups.color },
    size: { $type: "dimension", ...groups.size },
    font: { $type: "fontFamily", ...groups.font },
  };
}

export function buildFigmaThemeIndex(catalog: ThemeCatalog): FigmaThemeIndex {
  return {
    format: "figma",
    files: catalog.themes.map((theme) => ({
      slug: theme.slug,
      href: `/api/themes/figma/${theme.slug}`,
    })),
  };
}

/** The generated module the `/api/themes/figma` routes import. */
export function renderFigmaThemeCatalog(catalog: ThemeCatalog): string {
  const files = catalog.themes
    .map((theme) => {
      const document = figmaDocumentFromCatalog(theme, catalog.primitives);
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
