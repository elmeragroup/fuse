/**
 * The palettes handbook page's catalog builder.
 *
 * Reads every legal theme's resolved color tokens in both schemes from the workspace-only
 * `@elmeragroup/fuse/theme-catalog` entry and writes them brand-major: per brand, each of its
 * themes in both schemes, with each token's resolved color and alias and the WCAG contrast of
 * each graded pair. The resolved catalog has already parsed every literal and followed every
 * alias, so this builder only formats each declared color and measures pairs through
 * `@elmeragroup/color`.
 */

import * as Hex from "@elmeragroup/color/hex";
import * as Oklch from "@elmeragroup/color/oklch";
import * as Wcag from "@elmeragroup/color/wcag";
import { BRAND_CODES, BRAND_RAMP_ORIGINS, BRANDS, TEXT_GRADE_PAIRS } from "@elmeragroup/fuse/theme-catalog";
import type {
  PrimitiveEntry,
  ResolvedScheme,
  ResolvedThemeCatalog,
  SourceColor,
  TokenEntry,
} from "@elmeragroup/fuse/theme-catalog";

import { CONTRACT_PAIRS, isColorTokenName } from "../../src/lib/palettes.ts";
import type {
  ColorTokenName,
  PaletteBrand,
  PaletteCatalog,
  PalettePair,
  PalettePrimitive,
  PaletteScheme,
  PaletteTone,
} from "../../src/lib/palettes.ts";

type ColorEntry = Extract<TokenEntry, { readonly kind: "color" }>;

function isColorEntry(entry: TokenEntry): entry is ColorEntry {
  return entry.kind === "color";
}

/** The color tokens in the contract's order, refusing one the docs' taxonomy does not file as a color. */
function colorTokens(scheme: ResolvedScheme): readonly ColorTokenName[] {
  return Object.values(scheme.tokens)
    .filter(isColorEntry)
    .map(({ name }) => {
      if (!isColorTokenName(name)) {
        throw new Error(
          `palette catalog: --${String(name)} is a color in Fuse but not in TOKEN_TABLE (src/lib/token-sections.ts)`
        );
      }
      return name;
    });
}

/**
 * The graded pairs: Fuse's text-grade pairs, then every other role with a `-foreground` drawn on
 * it in the contract's order, then the other pairs the contract names.
 */
function gradedPairs(tokens: readonly ColorTokenName[]): readonly PalettePair[] {
  const textGrade = TEXT_GRADE_PAIRS.map(([foreground, background]): PalettePair => ({
    foreground,
    background,
    kind: "text-grade",
  }));
  const graded = new Set(textGrade.map((pair) => `${pair.foreground}/${pair.background}`));
  const rolePairs = tokens.flatMap((background): PalettePair[] => {
    const foreground = `${background}-foreground`;
    return isColorTokenName(foreground) && !graded.has(`${foreground}/${background}`)
      ? [{ foreground, background, kind: "role" }]
      : [];
  });
  const contractPairs = CONTRACT_PAIRS.map(([foreground, background]): PalettePair => ({
    foreground,
    background,
    kind: "role",
  }));
  return [...textGrade, ...rolePairs, ...contractPairs];
}

/** A declared color as OKLCH: an `oklch()` literal as it is, a hex literal converted. */
function sourceOklch(source: SourceColor): Oklch.Oklch {
  return source._tag === "Oklch" ? source : Oklch.fromSrgb(source);
}

/** A resolved color as the page shows it: canonical `oklch()`, hex and alpha. */
function toneOf(entry: ColorEntry | PrimitiveEntry): PaletteTone {
  return {
    oklch: Oklch.format(sourceOklch(entry.source)),
    hex: Hex.formatOpaque(entry.value),
    alpha: entry.value.alpha,
  };
}

/** One theme's palette in one scheme. */
function paletteScheme(
  scheme: ResolvedScheme,
  tokens: readonly ColorTokenName[],
  pairs: readonly PalettePair[],
  where: string
): PaletteScheme {
  const entries = tokens.map((name) => {
    const entry = scheme.tokens[name];
    if (!isColorEntry(entry)) {
      throw new Error(`palette catalog: --${name} in ${where} is not a color`);
    }
    return entry;
  });
  return {
    values: entries.map(toneOf),
    aliases: entries.map((entry) => (entry.reference === undefined ? null : `--${entry.reference.name}`)),
    ratios: pairs.map(({ foreground, background }) => {
      const ratio = Wcag.contrastRatio(scheme.tokens[foreground].value, scheme.tokens[background].value);
      if (ratio._tag === "err") {
        throw new Error(
          `palette catalog: --${background} in ${where} is translucent, so --${foreground} has no contrast on it alone`
        );
      }
      // Full precision: a grade reads the true ratio, and only the display cuts it to two decimals.
      return ratio.value;
    }),
  };
}

/** The primitives: the neutral ramp, then the brand accents and their foregrounds. */
function primitives(catalog: ResolvedThemeCatalog): readonly PalettePrimitive[] {
  return Object.values(catalog.primitives).map((entry) => ({
    name: entry.name,
    group: entry.name.startsWith("neutral-") ? "neutral" : "brand",
    tone: toneOf(entry),
    alias: entry.reference === undefined ? null : `--${entry.reference.name}`,
  }));
}

/**
 * Every brand with every legal theme in both schemes, the graded pairs and the primitives.
 *
 * @param catalog - The resolved theme catalog.
 * @returns The palettes handbook page's catalog.
 * @throws {Error} On a color token the docs' taxonomy does not file as a color, or a graded pair
 *   on a translucent surface: each a defect in Fuse's tokens or this page's tables.
 */
export function buildPaletteCatalog(catalog: ResolvedThemeCatalog): PaletteCatalog {
  const tokens = colorTokens(catalog.themes[0].schemes.light);
  const pairs = gradedPairs(tokens);
  const brands = BRAND_CODES.map((code): PaletteBrand => ({
    code,
    name: BRANDS[code].displayName,
    accent: toneOf(catalog.primitives[`brand-${code}`]),
    rampOrigin: BRAND_RAMP_ORIGINS[code],
    segments: BRANDS[code].segments,
    themes: catalog.themes
      .filter((theme) => theme.input.brand === code)
      .map((theme) => ({
        variant: theme.input.variant,
        segment: theme.input.segment,
        schemes: {
          light: paletteScheme(theme.schemes.light, tokens, pairs, `${theme.slug} (light)`),
          dark: paletteScheme(theme.schemes.dark, tokens, pairs, `${theme.slug} (dark)`),
        },
      })),
  }));
  return { tokens, pairs, primitives: primitives(catalog), brands };
}

/** The generated module the palettes page imports, one line per brand theme to keep it readable. */
export function renderPaletteCatalog(catalog: PaletteCatalog): string {
  const brands = catalog.brands
    .map(({ themes, ...brand }) => {
      const head = JSON.stringify(brand).slice(1, -1);
      const lines = themes.map((theme) => `      ${JSON.stringify(theme)},`).join("\n");
      return `    {${head},"themes":[\n${lines}\n    ]},`;
    })
    .join("\n");
  return `import type { PaletteCatalog } from "../lib/palettes";

/** Every brand's palettes in each of its themes and both color schemes, with the graded pairs. */
export const PALETTE_CATALOG: PaletteCatalog = {
  tokens: ${JSON.stringify(catalog.tokens)},
  pairs: ${JSON.stringify(catalog.pairs)},
  primitives: ${JSON.stringify(catalog.primitives)},
  brands: [
${brands}
  ],
};
`;
}
