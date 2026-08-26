/**
 * DTCG JSON projected from the theme catalog for native Figma import (docs-site.md §9.2).
 *
 * One file is one Figma mode. Colors are sRGB; dimensions are px; CSS var() becomes
 * `{group.name}` aliases. Conversion stays here — routes serve generated JSON.
 */

import { oklchToLinearSrgb, parseOklch } from "../../../../packages/ui/src/theme/contrast.ts";
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

const VAR_RE = /^var\(--([a-z0-9-]+)\)$/;
const REM_RE = /^(-?[0-9]*\.?[0-9]+)rem$/;
const PX_RE = /^(-?[0-9]*\.?[0-9]+)px$/;
const HEX_RE = /^#([0-9a-f]{6})$/i;
const REM_PX = 16;

type DtcgSlot = { group: "color" | "size" | "font"; key: string };

function dtcgSlot(name: string): DtcgSlot {
  if (name === "font-sans") {
    return { group: "font", key: "sans" };
  }
  if (name === "font-heading") {
    return { group: "font", key: "heading" };
  }
  if (name === "radius" || name === "radius-button") {
    return { group: "size", key: name };
  }
  return { group: "color", key: name };
}

function clipChannel(channel: number): number {
  if (channel < 0) {
    return 0;
  }
  if (channel > 1) {
    return 1;
  }
  return channel;
}

function encodeSrgbChannel(linear: number): number {
  const clipped = clipChannel(linear);
  if (clipped <= 0.0031308) {
    return 12.92 * clipped;
  }
  return 1.055 * clipped ** (1 / 2.4) - 0.055;
}

function roundComponent(channel: number): number {
  return Math.round(channel * 1_000_000) / 1_000_000;
}

function hexFromSrgb(r: number, g: number, b: number): string {
  const byte = (channel: number): string =>
    Math.round(clipChannel(channel) * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function srgbColor(linearR: number, linearG: number, linearB: number, alpha: number): FigmaSrgbColor {
  const r = roundComponent(encodeSrgbChannel(linearR));
  const g = roundComponent(encodeSrgbChannel(linearG));
  const b = roundComponent(encodeSrgbChannel(linearB));
  return {
    colorSpace: "srgb",
    components: [r, g, b],
    alpha,
    hex: hexFromSrgb(r, g, b),
  };
}

function colorFromOklch(css: string): FigmaSrgbColor {
  const parsed = parseOklch(css);
  const linear = oklchToLinearSrgb(css);
  return srgbColor(linear.r, linear.g, linear.b, parsed.alpha);
}

function colorFromHex(css: string): FigmaSrgbColor {
  const match = HEX_RE.exec(css);
  if (match === null) {
    throw new Error(`Expected a six-digit hex color, received: ${css}`);
  }
  const hex = match[1] ?? "";
  const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
  return {
    colorSpace: "srgb",
    components: [roundComponent(r), roundComponent(g), roundComponent(b)],
    alpha: 1,
    hex: `#${hex.toUpperCase()}`,
  };
}

function aliasOf(tokenName: string): `{${string}}` {
  const slot = dtcgSlot(tokenName);
  return `{${slot.group}.${slot.key}}`;
}

function firstFontFamily(css: string): string {
  const first = css.split(",")[0]?.trim() ?? css;
  if ((first.startsWith('"') && first.endsWith('"')) || (first.startsWith("'") && first.endsWith("'"))) {
    return first.slice(1, -1);
  }
  return first;
}

function dimensionFromCss(css: string): FigmaDimensionToken["$value"] {
  const rem = REM_RE.exec(css);
  if (rem !== null) {
    return { value: Number(rem[1]) * REM_PX, unit: "px" };
  }
  const px = PX_RE.exec(css);
  if (px !== null) {
    return { value: Number(px[1]), unit: "px" };
  }
  throw new Error(`Expected a rem or px dimension, received: ${css}`);
}

function colorOrAlias(css: string): FigmaColorToken["$value"] {
  const referenced = VAR_RE.exec(css)?.[1];
  if (referenced !== undefined) {
    return aliasOf(referenced);
  }
  if (css.startsWith("oklch(")) {
    return colorFromOklch(css);
  }
  if (HEX_RE.test(css)) {
    return colorFromHex(css);
  }
  throw new Error(`Expected a color, hex, or var() alias, received: ${css}`);
}

function fontOrAlias(css: string): string {
  const referenced = VAR_RE.exec(css)?.[1];
  if (referenced !== undefined) {
    return aliasOf(referenced);
  }
  return firstFontFamily(css);
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
    groups.font[slot.key] = { $type: "fontFamily", $value: fontOrAlias(css) };
    return;
  }
  if (slot.group === "size") {
    groups.size[slot.key] = { $type: "dimension", $value: dimensionFromCss(css) };
    return;
  }
  groups.color[slot.key] = { $type: "color", $value: colorOrAlias(css) };
}

function emitCssMap(groups: DtcgGroups, map: ThemeCatalogTokenMap): void {
  for (const [cssKey, css] of Object.entries(map)) {
    emitToken(groups, cssTokenName(cssKey), css);
  }
}

/** One DTCG document projected from a catalog row; primitives are inlined (docs-site.md §9.2). */
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

/** `internal-fkas-private` → `internalFkasPrivate`. */
function jsonImportBinding(slug: string): string {
  return slug.replace(/-([a-z])/g, (hyphenLetter) => hyphenLetter.slice(1).toUpperCase());
}

/** The generated barrel the `/api/themes/figma` routes import. */
function renderFigmaThemeCatalog(catalog: ThemeCatalog): string {
  const imports = catalog.themes
    .map((theme) => `import ${jsonImportBinding(theme.slug)} from "./figma/${theme.slug}.json";`)
    .join("\n");
  const files = catalog.themes
    .map((theme) => `  "${theme.slug}": ${jsonImportBinding(theme.slug)},`)
    .join("\n");
  return `import type { FigmaThemeDocument, FigmaThemeIndex } from "../lib/docs-model";
${imports}

export const FIGMA_THEME_INDEX: FigmaThemeIndex = ${JSON.stringify(buildFigmaThemeIndex(catalog), null, 2)};

// SAFETY: each JSON file is written from figmaDocumentFromCatalog; JSON imports widen literals and tuples.
export const FIGMA_THEME_FILES = {
${files}
} as unknown as { readonly [slug: string]: FigmaThemeDocument };
`;
}

/** Barrel module plus per-slug DTCG JSON the generation pass writes (docs-site.md §9.2). */
export function figmaThemeArtifacts(catalog: ThemeCatalog) {
  return {
    indexModule: renderFigmaThemeCatalog(catalog),
    documents: catalog.themes.map((entry) => ({
      slug: entry.slug,
      json: JSON.stringify(figmaDocumentFromCatalog(entry, catalog.primitives)),
    })),
  };
}
