/**
 * The palettes handbook page's catalog builder.
 *
 * Reads every legal theme's resolved color roles in both schemes from the workspace-only
 * `@elmeragroup/fuse/theme-catalog` entry and writes, per theme and scheme, the distinct colors
 * the roles resolve to, which role lands on which, and the WCAG contrast of each graded pair.
 * The resolved catalog has already parsed every literal and followed every alias, so this builder
 * only formats each role's declared color and measures pairs through `@elmeragroup/color`.
 */

import * as Hex from "@elmeragroup/color/hex";
import * as Oklch from "@elmeragroup/color/oklch";
import * as Wcag from "@elmeragroup/color/wcag";
import { TEXT_GRADE_PAIRS } from "@elmeragroup/fuse/theme-catalog";
import type {
  ResolvedScheme,
  ResolvedThemeCatalog,
  SourceColor,
  TokenEntry,
} from "@elmeragroup/fuse/theme-catalog";

import { CONTRACT_PAIRS, isColorRoleName } from "../../src/lib/palettes.ts";
import type {
  ColorRoleName,
  PaletteCatalog,
  PalettePair,
  PaletteScheme,
  PaletteTone,
} from "../../src/lib/palettes.ts";

type ColorEntry = Extract<TokenEntry, { readonly kind: "color" }>;

function isColorEntry(entry: TokenEntry): entry is ColorEntry {
  return entry.kind === "color";
}

/** The color roles in the contract's order, refusing one the docs' taxonomy does not file as a color. */
function colorRoles(scheme: ResolvedScheme): readonly ColorRoleName[] {
  return Object.values(scheme.tokens)
    .filter(isColorEntry)
    .map(({ name }) => {
      if (!isColorRoleName(name)) {
        throw new Error(
          `palette catalog: --${String(name)} is a color in Fuse but not in TOKEN_TABLE (src/lib/token-sections.ts)`
        );
      }
      return name;
    });
}

/**
 * The graded pairs: Fuse's text-grade pairs, then every other role with a `-foreground` drawn
 * on it in the contract's order, then the other pairs the contract names.
 */
function gradedPairs(roles: readonly ColorRoleName[]): readonly PalettePair[] {
  const textGrade = TEXT_GRADE_PAIRS.map(([foreground, background]): PalettePair => ({
    foreground,
    background,
    kind: "text-grade",
  }));
  const graded = new Set(textGrade.map((pair) => `${pair.foreground}/${pair.background}`));
  const rolePairs = roles.flatMap((background): PalettePair[] => {
    const foreground = `${background}-foreground`;
    return isColorRoleName(foreground) && !graded.has(`${foreground}/${background}`)
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

/** One theme's palette in one scheme. */
function paletteScheme(
  scheme: ResolvedScheme,
  roles: readonly ColorRoleName[],
  pairs: readonly PalettePair[],
  where: string
): PaletteScheme {
  const entries = roles.map((name) => {
    const entry = scheme.tokens[name];
    if (!isColorEntry(entry)) {
      throw new Error(`palette catalog: --${name} in ${where} is not a color`);
    }
    return entry;
  });
  const colors = entries.map((entry) => sourceOklch(entry.source));
  // Equal colors share one tone: the canonical `oklch()` spelling is the identity, so a hex
  // literal and an `oklch()` literal of the same color land together.
  const distinct = new Map<string, { readonly color: Oklch.Oklch; readonly tone: PaletteTone }>();
  entries.forEach((entry, index) => {
    const color = colors[index];
    if (color === undefined) {
      return;
    }
    const oklch = Oklch.format(color);
    if (!distinct.has(oklch)) {
      distinct.set(oklch, {
        color,
        tone: { oklch, hex: Hex.formatOpaque(entry.value), alpha: entry.value.alpha },
      });
    }
  });
  // Opaque tones run darkest to lightest. A translucent tone paints as whatever it lies on, so
  // its lightness says little: translucent tones follow, most opaque first.
  const sorted = [...distinct.values()].toSorted(
    (left, right) =>
      Number(left.color.alpha < 1) - Number(right.color.alpha < 1) ||
      right.color.alpha - left.color.alpha ||
      left.color.l - right.color.l ||
      left.color.c - right.color.c ||
      left.color.h - right.color.h
  );
  const toneIndex = new Map(sorted.map(({ tone }, index) => [tone.oklch, index]));
  return {
    tones: sorted.map(({ tone }) => tone),
    roleTones: colors.map((color, index) => {
      const tone = toneIndex.get(Oklch.format(color));
      if (tone === undefined) {
        throw new Error(`palette catalog: --${roles[index] ?? "?"} in ${where} has no tone`);
      }
      return tone;
    }),
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

/**
 * Every legal theme's palettes in both schemes, with the graded pairs.
 *
 * @param catalog - The resolved theme catalog.
 * @returns The palettes handbook page's catalog.
 * @throws {Error} On a color role the docs' taxonomy does not file as a color, or a graded pair
 *   on a translucent surface: each a defect in Fuse's tokens or this page's tables.
 */
export function buildPaletteCatalog(catalog: ResolvedThemeCatalog): PaletteCatalog {
  const roles = colorRoles(catalog.themes[0].schemes.light);
  const pairs = gradedPairs(roles);
  return {
    roles,
    pairs,
    themes: catalog.themes.map((theme) => ({
      slug: theme.slug,
      input: theme.input,
      schemes: {
        light: paletteScheme(theme.schemes.light, roles, pairs, `${theme.slug} (light)`),
        dark: paletteScheme(theme.schemes.dark, roles, pairs, `${theme.slug} (dark)`),
      },
    })),
  };
}

/** The generated module the palettes page imports, one line per theme to keep it small. */
export function renderPaletteCatalog(catalog: PaletteCatalog): string {
  const themes = catalog.themes.map((theme) => `    ${JSON.stringify(theme)},`).join("\n");
  return `import type { PaletteCatalog } from "../lib/palettes";

/** Every legal theme's palettes in both color schemes, with the graded contrast pairs. */
export const PALETTE_CATALOG: PaletteCatalog = {
  roles: ${JSON.stringify(catalog.roles)},
  pairs: ${JSON.stringify(catalog.pairs)},
  themes: [
${themes}
  ],
};
`;
}
