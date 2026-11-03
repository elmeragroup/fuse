/**
 * The palettes handbook page's model: what the generated palette catalog holds, and the views
 * the token inspector reads from it.
 *
 * Fuse stores finished role values, not tonal ramps. A theme's palette here is the set of
 * distinct colors its color roles resolve to in one scheme, sorted by OKLCH lightness, with the
 * roles that share each one. The catalog is written at docs build from the resolved theme
 * catalog (`scripts/lib/palette-catalog.ts`), so the page never parses or converts a color.
 */

import type { ThemeInput, ThemeSlug } from "@elmeragroup/fuse/theme";
import type { ResolvedColorScheme, TokenEntry } from "@elmeragroup/fuse/theme-catalog";

import { TOKEN_SECTIONS, TOKEN_TABLE } from "./token-sections";
import type { SectionId } from "./token-sections";

/** A role token whose value is a color, such as `primary` or `chart-3`. */
export type ColorRoleName = Extract<TokenEntry, { readonly kind: "color" }>["name"];

/** The contract section a color role is filed under, such as `surfaces` or `charts`. */
export type PaletteGroup = SectionId;

const COLOR_ROLE_NAMES: ReadonlySet<string> = new Set(
  Object.entries(TOKEN_TABLE).flatMap(([name, row]) => (row.kind === "color" ? [name] : []))
);

/** Whether a name is a color role in the docs' contract taxonomy. */
export function isColorRoleName(name: string): name is ColorRoleName {
  return COLOR_ROLE_NAMES.has(name);
}

/** The section a color role is filed under, from the docs' shared contract taxonomy. */
export function roleGroup(name: ColorRoleName): PaletteGroup {
  return TOKEN_TABLE[name].section;
}

/** The sections that hold a color role, in the taxonomy's order, with their labels. */
export const PALETTE_GROUPS: readonly { readonly id: PaletteGroup; readonly label: string }[] =
  TOKEN_SECTIONS.filter((section) =>
    Object.values(TOKEN_TABLE).some((row) => row.section === section.id && row.kind === "color")
  ).map((section) => ({ id: section.id, label: section.title }));

/**
 * The foreground-on-surface pairs the theme contract names beyond the `X-foreground` on `X`
 * convention, each graded as a role pair. The descriptions in
 * `packages/fuse/src/theme/tokens/contract.ts` and the contrast policies in
 * `packages/fuse/src/theme/contrast-matrix.test.ts` name them:
 *
 * - Tooltips fill with `foreground` and set their text in `background`.
 * - Text on an `accent` row takes `foreground` or `muted-foreground`.
 * - Muted copy in a default Accordion item sits on `primary-soft`.
 * - `feature-foreground` draws on both feature fills, `feature` and `feature-bright`.
 * - `sidebar-brand` is brand text on the Sidebar.
 * - A disabled selection row sets its label in `selection-disabled-foreground` on
 *   `selection-disabled-background`.
 */
export const CONTRACT_PAIRS = [
  ["background", "foreground"],
  ["foreground", "accent"],
  ["muted-foreground", "accent"],
  ["muted-foreground", "primary-soft"],
  ["feature-foreground", "feature-bright"],
  ["sidebar-brand", "sidebar"],
  ["selection-disabled-foreground", "selection-disabled-background"],
] as const satisfies readonly (readonly [ColorRoleName, ColorRoleName])[];

/** One distinct color a theme holds in one scheme. */
export type PaletteTone = {
  /** The color as CSS `oklch()`, the declared literal's canonical spelling. */
  readonly oklch: string;
  /** The color's channels as `#RRGGBB`, clipped into sRGB. Its alpha is {@link alpha}. */
  readonly hex: string;
  /** The color's alpha, from 0 to 1. */
  readonly alpha: number;
};

/**
 * Whether a pair is one of Fuse's text-grade pairs, which its contrast gate holds at 4.5:1 in
 * every theme, or another role pair: a role and the `-foreground` drawn on it, or a pair in
 * {@link CONTRACT_PAIRS}, which the gate does not hold at 4.5:1 in every theme and scheme.
 */
export type PalettePairKind = "text-grade" | "role";

/** A foreground role drawn on a background role. */
export type PalettePair = {
  readonly foreground: ColorRoleName;
  readonly background: ColorRoleName;
  readonly kind: PalettePairKind;
};

/**
 * One theme in one scheme. `roleTones`, `aliases` and `ratios` run parallel to the catalog's
 * `roles` and `pairs`.
 */
export type PaletteScheme = {
  /** Every distinct color the roles resolve to: opaque ones darkest first, then translucent ones. */
  readonly tones: readonly PaletteTone[];
  /** Each role's index into {@link tones}. */
  readonly roleTones: readonly number[];
  /** The custom property each role's declaration names when it is a single `var()`, or `null`. */
  readonly aliases: readonly (string | null)[];
  /** Each pair's WCAG 2.2 contrast ratio, at full precision, so a grade never rounds up. */
  readonly ratios: readonly number[];
};

/** One legal theme with its palette in both color schemes. */
export type PaletteTheme = {
  readonly slug: ThemeSlug;
  readonly input: ThemeInput;
  readonly schemes: { readonly [S in ResolvedColorScheme]: PaletteScheme };
};

/** The generated catalog: the color roles, the graded pairs and every legal theme's palettes. */
export type PaletteCatalog = {
  /** Every color role, in the contract's order. */
  readonly roles: readonly ColorRoleName[];
  /** The pairs graded for contrast: the text-grade pairs first, then the other role pairs. */
  readonly pairs: readonly PalettePair[];
  /** Every legal theme, in `LEGAL_THEMES` order. */
  readonly themes: readonly PaletteTheme[];
};

/** WCAG 2.2 AA for normal text. */
export const AA_RATIO = 4.5;

/** WCAG 2.2 AAA for normal text. */
export const AAA_RATIO = 7;

/** A contrast ratio's WCAG 2.2 level for normal text. */
export type ContrastGrade = "AAA" | "AA" | "below-aa";

/**
 * The WCAG 2.2 level a contrast ratio reaches for normal text.
 *
 * @param ratio - A contrast ratio from 1 to 21.
 * @returns `AAA` from 7:1, `AA` from 4.5:1, otherwise `below-aa`.
 */
export function contrastGrade(ratio: number): ContrastGrade {
  if (ratio >= AAA_RATIO) {
    return "AAA";
  }
  return ratio >= AA_RATIO ? "AA" : "below-aa";
}

/** How a grade reads in a badge and a filter. */
export const GRADE_LABELS = {
  AAA: "AAA",
  AA: "AA",
  "below-aa": "Below AA",
} as const satisfies Record<ContrastGrade, string>;

/**
 * A ratio as WCAG writes it, such as `4.52:1`, cut to two decimals rather than rounded, so a
 * ratio of 4.4988 reads `4.49:1` beside its Below AA grade and never `4.50:1`.
 */
export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
}

/** A tone with the roles that resolve to it. */
export type ToneView = PaletteTone & {
  /** The tone's place in the theme's palette, from 1. */
  readonly step: number;
  /** The roles that resolve to the tone, in the contract's order. */
  readonly roles: readonly ColorRoleName[];
};

/** A graded pair. */
export type PairView = PalettePair & {
  readonly ratio: number;
  readonly grade: ContrastGrade;
  /** The tone the foreground role resolves to. */
  readonly foregroundTone: ToneView;
  /** The tone the background role resolves to. */
  readonly backgroundTone: ToneView;
};

/** A role with everything the inspector shows about it in one theme and scheme. */
export type RoleView = {
  readonly name: ColorRoleName;
  readonly group: PaletteGroup;
  readonly tone: ToneView;
  /** The custom property the role's declaration names when it is a single `var()`. */
  readonly alias: string | undefined;
  /** The other roles that resolve to the same tone. */
  readonly sharesWith: readonly ColorRoleName[];
  /** The role's lowest-contrast pair, as foreground or background, if it is in one. */
  readonly weakestPair: PairView | undefined;
};

/** One theme's palette in one scheme, as the inspector shows it. */
export type PaletteView = {
  readonly slug: ThemeSlug;
  readonly scheme: ResolvedColorScheme;
  readonly tones: readonly ToneView[];
  readonly roles: readonly RoleView[];
  readonly pairs: readonly PairView[];
};

/** The entry at `index`, or a thrown defect naming what the generated catalog lacks. */
function required<T>(entries: readonly T[], index: number, what: string): T {
  const entry = entries[index];
  if (entry === undefined) {
    throw new Error(
      `The palette catalog has no ${what}; regenerate it with \`pnpm --filter docs generate\`.`
    );
  }
  return entry;
}

/**
 * Checks that one theme's palette in one scheme holds an entry for every role and pair of the
 * catalog and that every role points at a tone it holds. The catalog is generated, so a gap is a
 * generator defect, and the inspector throws rather than show a role without its tone or a pair
 * without its ratio.
 */
function checkPalette(catalog: PaletteCatalog, palette: PaletteScheme, where: string): void {
  const counts = [
    ["role tones", palette.roleTones.length, catalog.roles.length],
    ["aliases", palette.aliases.length, catalog.roles.length],
    ["ratios", palette.ratios.length, catalog.pairs.length],
  ] as const;
  for (const [what, held, expected] of counts) {
    if (held !== expected) {
      throw new Error(
        `The palette catalog holds ${String(held)} ${what} for ${where}, not ${String(expected)}; regenerate it.`
      );
    }
  }
  palette.roleTones.forEach((tone, role) => {
    required(
      palette.tones,
      tone,
      `tone ${String(tone)} for --${required(catalog.roles, role, "role")} in ${where}`
    );
  });
}

/**
 * One theme's palette in one scheme: its tones with the roles that share each one, its roles
 * with their tone and weakest pair, and every graded pair. Grades read the full-precision ratio.
 *
 * @param catalog - The generated palette catalog.
 * @param theme - A theme from the catalog.
 * @param scheme - The color scheme to read.
 * @returns The view the inspector renders.
 * @throws {Error} When the theme's palette lacks a role, a pair or a tone it points at, or a pair
 *   names a role the catalog does not hold: a defect in the generated catalog. The message names
 *   the theme, the scheme and the missing role.
 */
export function paletteView(
  catalog: PaletteCatalog,
  theme: PaletteTheme,
  scheme: ResolvedColorScheme
): PaletteView {
  const palette = theme.schemes[scheme];
  const where = `${theme.slug} (${scheme})`;
  checkPalette(catalog, palette, where);
  const tones = palette.tones.map((tone, index): ToneView => ({
    ...tone,
    step: index + 1,
    roles: catalog.roles.filter((_, role) => palette.roleTones[role] === index),
  }));
  // Each role's tone, in the catalog's role order, and the same tones by role name.
  const toneByRole = catalog.roles.map((name, index) =>
    required(
      tones,
      required(palette.roleTones, index, `tone index for --${name} in ${where}`),
      `tone for --${name} in ${where}`
    )
  );
  const roleTones = new Map(
    catalog.roles.map((name, index) => [name, required(toneByRole, index, `tone for --${name}`)])
  );
  // Each pair's two roles resolve here once, so a pair whose role the catalog lacks throws
  // instead of counting in the totals and rendering nowhere.
  const endpointTone = (name: ColorRoleName, pair: PalettePair): ToneView => {
    const tone = roleTones.get(name);
    if (tone === undefined) {
      throw new Error(
        `The palette catalog pairs --${pair.foreground} on --${pair.background} in ${where}, but has no role --${name}; regenerate it with \`pnpm --filter docs generate\`.`
      );
    }
    return tone;
  };
  const pairs = catalog.pairs.map((pair, index): PairView => {
    const ratio = required(
      palette.ratios,
      index,
      `ratio for --${pair.foreground} on --${pair.background} in ${where}`
    );
    return {
      ...pair,
      ratio,
      grade: contrastGrade(ratio),
      foregroundTone: endpointTone(pair.foreground, pair),
      backgroundTone: endpointTone(pair.background, pair),
    };
  });
  const roles = catalog.roles.map((name, index): RoleView => {
    const tone = required(toneByRole, index, `tone for --${name} in ${where}`);
    const alias = required(palette.aliases, index, `alias entry for --${name} in ${where}`);
    const weakestPair = pairs
      .filter((pair) => pair.foreground === name || pair.background === name)
      .reduce<PairView | undefined>(
        (weakest, pair) => (weakest === undefined || pair.ratio < weakest.ratio ? pair : weakest),
        undefined
      );
    return {
      name,
      group: roleGroup(name),
      tone,
      alias: alias ?? undefined,
      sharesWith: tone.roles.filter((role) => role !== name),
      weakestPair,
    };
  });
  return { slug: theme.slug, scheme, tones, roles, pairs };
}

/**
 * The catalog's theme for a slug.
 *
 * @param catalog - The generated palette catalog.
 * @param slug - A legal theme's slug.
 * @returns The theme.
 * @throws {Error} When the catalog lacks the theme: the generated catalog is stale.
 */
export function paletteTheme(catalog: PaletteCatalog, slug: ThemeSlug): PaletteTheme {
  const theme = catalog.themes.find((candidate) => candidate.slug === slug);
  if (theme === undefined) {
    throw new Error(
      `The palette catalog has no ${slug}; regenerate it with \`pnpm --filter docs generate\`.`
    );
  }
  return theme;
}

/** A tone's alpha as a percentage, or `undefined` for an opaque tone. */
export function alphaPercent(tone: PaletteTone): string | undefined {
  return tone.alpha < 1 ? `${String(Math.round(tone.alpha * 1000) / 10)}%` : undefined;
}
