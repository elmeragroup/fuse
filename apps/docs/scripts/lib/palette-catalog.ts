/**
 * The palettes handbook page's catalog builder.
 *
 * Reads every legal theme's resolved color tokens in both schemes from the workspace-only
 * `@elmeragroup/fuse/theme-catalog` entry and writes them brand-major: per brand, each of its
 * themes in both schemes, with each token's color and alias, where each brand palette passes
 * through its seed, and the WCAG contrast of each graded pair. The resolved catalog has already
 * parsed every literal and followed every alias, so this builder only formats colors and measures
 * pairs through `@elmeragroup/color`.
 */

import * as Hex from "@elmeragroup/color/hex";
import * as Wcag from "@elmeragroup/color/wcag";
import {
  BRAND_CODES,
  BRANDS,
  brandRampSeedSteps,
  RAMP_SCALES,
  RAMP_STEPS,
  ROLE_TEXT_PAIRS,
  TEXT_GRADE_PAIRS,
} from "@elmeragroup/fuse/theme-catalog";
import type { ResolvedScheme, ResolvedThemeCatalog, TokenEntry } from "@elmeragroup/fuse/theme-catalog";

import type {
  ColorTokenName,
  PaletteBrand,
  PaletteCatalog,
  PalettePair,
  PaletteRamp,
  PaletteScheme,
  SeedSteps,
} from "../../src/lib/palettes.ts";

type ColorEntry = Extract<TokenEntry, { readonly kind: "color" }>;

function isColorEntry(entry: TokenEntry): entry is ColorEntry {
  return entry.kind === "color";
}

/**
 * The docs-only pairs: role text pairs the theme contract describes but no Fuse contrast gate
 * measures, so the page grades them without any floor behind them. The pairs Fuse holds come
 * from its contrast module (`TEXT_GRADE_PAIRS` and `ROLE_TEXT_PAIRS`), never from here. The
 * descriptions in `packages/fuse/src/theme/tokens/contract.ts` name these:
 *
 * - Text on a `brand` fill, and on a `destructive` fill, takes its `-foreground`.
 * - Tooltips fill with `foreground` and set their text in `background`.
 * - Text on an `accent` row takes `foreground` or `muted-foreground`.
 * - A disabled selection row sets its label in `selection-disabled-foreground` on
 *   `selection-disabled-background`.
 */
const UNCHECKED_PAIRS = [
  ["brand-foreground", "brand"],
  ["destructive-foreground", "destructive"],
  ["background", "foreground"],
  ["foreground", "accent"],
  ["muted-foreground", "accent"],
  ["selection-disabled-foreground", "selection-disabled-background"],
] as const satisfies readonly (readonly [ColorTokenName, ColorTokenName])[];

/**
 * The graded pairs: the pairs Fuse's contrast gate holds everywhere, then those it holds in some
 * schemes or identities, then the docs-only pairs it leaves unchecked.
 *
 * @throws {Error} When a docs-only pair is one Fuse already holds, or a pair repeats: the page
 *   would grade it twice under two claims.
 */
function gradedPairs(): readonly PalettePair[] {
  const groups = [
    ["text-grade", TEXT_GRADE_PAIRS],
    ["held", ROLE_TEXT_PAIRS],
    ["unchecked", UNCHECKED_PAIRS],
  ] as const;
  const seen = new Set<string>();
  return groups.flatMap(([kind, pairs]) =>
    pairs.map(([foreground, background]): PalettePair => {
      const id = `${foreground}/${background}`;
      if (seen.has(id)) {
        throw new Error(`palette catalog: --${foreground} on --${background} is graded twice`);
      }
      seen.add(id);
      return { foreground, background, kind };
    })
  );
}

/** One theme's palette in one scheme. */
function paletteScheme(
  scheme: ResolvedScheme,
  tokens: readonly ColorTokenName[],
  pairs: readonly PalettePair[],
  where: string
): PaletteScheme {
  const entries = tokens.map((name) => scheme.tokens[name]);
  return {
    values: entries.map((entry) => Hex.format(entry.value)),
    aliases: entries.map((entry) => entry.reference?.name ?? null),
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
 * Every brand with every legal theme in both schemes, the ramps and the graded pairs.
 *
 * @param catalog - The resolved theme catalog.
 * @returns The palettes handbook page's catalog.
 * @throws {Error} On a graded pair on a translucent surface: a defect in Fuse's tokens or this
 *   page's tables.
 */
export function buildPaletteCatalog(catalog: ResolvedThemeCatalog): PaletteCatalog {
  const tokens = Object.values(catalog.themes[0].schemes.light.tokens)
    .filter(isColorEntry)
    .map(({ name }) => name);
  const ramps = RAMP_SCALES.map((scale): PaletteRamp => ({
    scale,
    steps: RAMP_STEPS.map((step) => ({ step, token: `brand-${scale}-${step}` as const })),
  }));
  const rampTokens = new Set<string>(ramps.flatMap(({ steps }) => steps.map(({ token }) => token)));
  const pairs = gradedPairs();
  const brands = BRAND_CODES.map((code): PaletteBrand => ({
    code,
    name: BRANDS[code].displayName,
    segments: BRANDS[code].segments,
    themes: catalog.themes
      .filter((theme) => theme.input.brand === code)
      .map((theme) => {
        const seeds = brandRampSeedSteps(theme.input);
        return {
          identity: theme.input.identity,
          segment: theme.input.segment,
          seeds: {
            neutral: seeds.neutral ?? null,
            "1": seeds["1"] ?? null,
            "2": seeds["2"] ?? null,
          } satisfies SeedSteps,
          schemes: {
            light: paletteScheme(theme.schemes.light, tokens, pairs, `${theme.slug} (light)`),
            dark: paletteScheme(theme.schemes.dark, tokens, pairs, `${theme.slug} (dark)`),
          },
        };
      }),
  }));
  return { tokens, roles: tokens.filter((name) => !rampTokens.has(name)), ramps, pairs, brands };
}

/**
 * The generated module the palettes page imports.
 *
 * @param catalog - The built palette catalog.
 * @returns The module source.
 */
export function renderPaletteCatalog(catalog: PaletteCatalog): string {
  return `import type { PaletteCatalog } from "../lib/palettes";

/** Every brand's palettes, roles and graded contrast pairs in each of its themes and both color schemes. */
export const PALETTE_CATALOG: PaletteCatalog = ${JSON.stringify(catalog)};
`;
}
