/**
 * The palettes handbook page's model: what the generated palette catalog holds, and the rows its
 * three tables show from it.
 *
 * Each table has one column per brand, and the identity, segment and scheme switches pick which
 * theme every column shows. The Brand palettes table lists each ramp's steps, the Roles table each
 * color role and where it points, and the Contrast table each graded pair's WCAG ratio. The
 * catalog is written at docs build from the resolved theme catalog (`scripts/lib/palette-catalog.ts`),
 * so the page never parses, converts or measures a color.
 */

import type { BrandCode, ThemeIdentity, ThemeSegment } from "@elmeragroup/fuse/theme";
import type { RampScale, RampStep, ResolvedColorScheme, TokenEntry } from "@elmeragroup/fuse/theme-catalog";

/** A contract token whose value is a color: a role, such as `primary`, or a ramp step. */
export type ColorTokenName = Extract<TokenEntry, { readonly kind: "color" }>["name"];

/**
 * What Fuse's contrast gate holds of a pair. `text-grade` pairs it holds at 4.5:1 in every theme
 * and scheme (`TEXT_GRADE_PAIRS`). `held` pairs it holds at 4.5:1 in at least one scheme or
 * identity (`ROLE_TEXT_PAIRS`), so they can fall below AA elsewhere. `unchecked` pairs are the
 * docs-only pairs the generator adds (`UNCHECKED_PAIRS` in `scripts/lib/palette-catalog.ts`), which
 * no gate measures.
 */
export type PalettePairKind = "text-grade" | "held" | "unchecked";

/** A foreground token drawn on a background token. */
export type PalettePair = {
  readonly foreground: ColorTokenName;
  readonly background: ColorTokenName;
  readonly kind: PalettePairKind;
};

/**
 * One theme in one scheme. `values` and `aliases` run parallel to the catalog's `tokens`, and
 * `ratios` to its `pairs`.
 */
export type PaletteScheme = {
  /** Each token's resolved color as CSS hex: `#RRGGBB`, or `#RRGGBBAA` when translucent. */
  readonly values: readonly string[];
  /** The custom property, without its dashes, a token's declaration names as a single `var()`, or `null`. */
  readonly aliases: readonly (string | null)[];
  /** Each pair's WCAG 2.2 contrast ratio, at full precision, so a grade never rounds up. */
  readonly ratios: readonly number[];
};

/** The step of each ramp scale that holds the brand's curated seed color, or `null` for none. */
export type SeedSteps = { readonly [S in RampScale]: RampStep | null };

/** One legal theme of a brand, in both color schemes. */
export type PaletteBrandTheme = {
  readonly identity: ThemeIdentity;
  readonly segment: ThemeSegment;
  /** Where each palette passes through its seed. Ramps follow the brand and segment alone. */
  readonly seeds: SeedSteps;
  readonly schemes: { readonly [S in ResolvedColorScheme]: PaletteScheme };
};

/** A brand, one column of each table, with every legal theme it has. */
export type PaletteBrand = {
  readonly code: BrandCode;
  /** The name a customer sees, such as Telinet. */
  readonly name: string;
  /** The segments the brand allows, so a column shows a pinned cell for the other one. */
  readonly segments: readonly ThemeSegment[];
  readonly themes: readonly PaletteBrandTheme[];
};

/** A ramp scale's steps, lightest first, each with its token. */
export type PaletteRamp = {
  readonly scale: RampScale;
  readonly steps: readonly { readonly step: RampStep; readonly token: ColorTokenName }[];
};

/** The generated catalog: the color tokens, the ramps, the graded pairs and every brand. */
export type PaletteCatalog = {
  /** Every color token, roles and ramp steps, in the contract's order. */
  readonly tokens: readonly ColorTokenName[];
  /** The color roles: every color token but the ramp steps, in the contract's order. */
  readonly roles: readonly ColorTokenName[];
  /** The ramp scales in `RAMP_SCALES` order. */
  readonly ramps: readonly PaletteRamp[];
  /** The pairs graded for contrast: the text-grade pairs first, then the other role pairs. */
  readonly pairs: readonly PalettePair[];
  /** Every brand, in `BRAND_CODES` order. */
  readonly brands: readonly PaletteBrand[];
};

/** WCAG 2.2 AA for normal text. */
const AA_RATIO = 4.5;

/** WCAG 2.2 AAA for normal text. */
const AAA_RATIO = 7;

/** A contrast ratio's WCAG 2.2 level for normal text. */
export type ContrastGrade = "AAA" | "AA" | "below-aa";

/**
 * The WCAG 2.2 level a contrast ratio reaches for normal text.
 *
 * @param ratio - A contrast ratio from 1 to 21, at full precision.
 * @returns `AAA` from 7:1, `AA` from 4.5:1, otherwise `below-aa`.
 */
export function contrastGrade(ratio: number): ContrastGrade {
  if (ratio >= AAA_RATIO) {
    return "AAA";
  }
  return ratio >= AA_RATIO ? "AA" : "below-aa";
}

/**
 * A ratio as WCAG writes it, such as `4.52:1`, truncated to two decimals, so a ratio of 4.4988
 * reads `4.49:1` beside its Below AA grade and never `4.50:1`.
 *
 * @param ratio - A contrast ratio at full precision.
 * @returns The ratio for display.
 */
export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
}

/** The theme coordinates the switches pick. Each column is one brand. */
export type PaletteAxes = {
  readonly identity: ThemeIdentity;
  readonly segment: ThemeSegment;
  readonly scheme: ResolvedColorScheme;
};

/** One column: a brand and the theme it shows, or the one segment a pinned brand allows. */
export type BrandColumn =
  | {
      readonly _tag: "theme";
      readonly brand: PaletteBrand;
      readonly theme: PaletteBrandTheme;
      readonly palette: PaletteScheme;
    }
  | { readonly _tag: "pinned"; readonly brand: PaletteBrand; readonly only: ThemeSegment };

/** What a column shows in any row for a brand pinned to the other segment. */
export type PinnedCell = { readonly _tag: "pinned"; readonly only: ThemeSegment };

/** The message a stale generated catalog fails with. */
function stale(what: string): Error {
  return new Error(`The palette catalog has no ${what}; regenerate it with \`pnpm --filter docs generate\`.`);
}

/**
 * The seven brand columns for one identity, segment and scheme. A brand pinned to the other
 * segment, such as Telinet under Company, shows the segment it allows instead of a theme.
 *
 * @param catalog - The generated palette catalog.
 * @param axes - The identity, segment and scheme the switches pick.
 * @returns One column per brand, in `BRAND_CODES` order.
 * @throws {Error} When an allowed theme is missing: a stale catalog.
 */
export function brandColumns(catalog: PaletteCatalog, axes: PaletteAxes): readonly BrandColumn[] {
  return catalog.brands.map((brand): BrandColumn => {
    if (!brand.segments.includes(axes.segment)) {
      const only = brand.segments[0];
      if (only === undefined) {
        throw stale(`segment for ${brand.code}`);
      }
      return { _tag: "pinned", brand, only };
    }
    const theme = brand.themes.find(
      (candidate) => candidate.identity === axes.identity && candidate.segment === axes.segment
    );
    if (theme === undefined) {
      throw stale(`${axes.identity}-${brand.code}-${axes.segment}`);
    }
    return { _tag: "theme", brand, theme, palette: theme.schemes[axes.scheme] };
  });
}

/** A token's color and alias in one palette. */
type Resolved = { readonly hex: string; readonly alias: string | null };

/** Reads a token from a palette, refusing one the catalog lacks. */
type Reader = (palette: PaletteScheme, name: ColorTokenName) => Resolved;

/** A reader over the catalog's parallel arrays, indexing its tokens once. */
function reader(catalog: PaletteCatalog): Reader {
  const indexes = new Map(catalog.tokens.map((name, index) => [name, index]));
  return (palette, name) => {
    const index = indexes.get(name);
    const hex = index === undefined ? undefined : palette.values[index];
    const alias = index === undefined ? undefined : palette.aliases[index];
    if (hex === undefined || alias === undefined) {
      throw stale(`value for --${name}`);
    }
    return { hex, alias };
  };
}

/** A column that shows a theme rather than a pinned brand. */
type ThemeColumn = Extract<BrandColumn, { readonly _tag: "theme" }>;

/**
 * One row's cells, one per column: a pinned brand shows the segment it allows, and every other
 * brand the value read from its theme.
 */
function brandCells<Value>(
  columns: readonly BrandColumn[],
  value: (column: ThemeColumn, at: number) => Value
): readonly (PinnedCell | Value)[] {
  return columns.map((column, at): PinnedCell | Value =>
    column._tag === "pinned" ? { _tag: "pinned", only: column.only } : value(column, at)
  );
}

/** A ramp step's value in a theme's column. */
export type RampValue = {
  readonly _tag: "value";
  /** The step's color as CSS hex. */
  readonly hex: string;
  /** The ramp token the step points at, such as `brand-1-500` for an aliased palette 2, or `null`. */
  readonly alias: string | null;
  /** Whether this step holds the brand's curated seed color unchanged. */
  readonly seed: boolean;
};

/** A ramp step's value in one column. */
export type RampCell = PinnedCell | RampValue;

/** One ramp step's row. */
export type RampRow = {
  readonly scale: RampScale;
  readonly step: RampStep;
  readonly token: ColorTokenName;
  readonly cells: readonly RampCell[];
};

/**
 * The Brand palettes table's rows: every scale's steps, lightest first, with each brand's value,
 * the step that holds its seed and the step an aliased scale points at.
 *
 * @param catalog - The generated palette catalog.
 * @param columns - The brand columns the switches pick.
 * @returns One row per ramp token, scale by scale.
 */
export function rampRows(catalog: PaletteCatalog, columns: readonly BrandColumn[]): readonly RampRow[] {
  const read = reader(catalog);
  return catalog.ramps.flatMap(({ scale, steps }) =>
    steps.map(({ step, token }): RampRow => ({
      scale,
      step,
      token,
      cells: brandCells(columns, (column): RampValue => ({
        _tag: "value",
        ...read(column.palette, token),
        seed: column.theme.seeds[scale] === step,
      })),
    }))
  );
}

/**
 * How a role relates to the brand's tokens: it points at another token through `var()`, its
 * color equals a ramp step it does not point at, or neither.
 */
export type RoleLink =
  | { readonly _tag: "alias"; readonly token: string }
  | { readonly _tag: "equals"; readonly token: ColorTokenName }
  | { readonly _tag: "none" };

/** A role's value in a theme's column. */
export type RoleValue = { readonly _tag: "value"; readonly hex: string; readonly link: RoleLink };

/** A role's value in one column. */
export type RoleCell = PinnedCell | RoleValue;

/** One color role's row. */
export type RoleRow = { readonly name: ColorTokenName; readonly cells: readonly RoleCell[] };

/**
 * Each color a column's own ramps paint, with the first step that paints it. A scale that aliases
 * another, as a single-colour brand's palette 2 does, holds no colors of its own, so a role equal
 * to palette 1 names palette 1.
 */
function rampColors(
  ramps: readonly PaletteRamp[],
  read: Reader,
  palette: PaletteScheme
): ReadonlyMap<string, ColorTokenName> {
  const colors = new Map<string, ColorTokenName>();
  for (const { steps } of ramps) {
    const resolved = steps.map(({ token }) => ({ token, ...read(palette, token) }));
    if (resolved.some(({ alias }) => alias !== null)) {
      continue;
    }
    for (const { token, hex } of resolved) {
      if (!colors.has(hex)) {
        colors.set(hex, token);
      }
    }
  }
  return colors;
}

/**
 * The Roles table's rows: every color role with each brand's value and where it points. A role
 * that aliases a token names it; a literal role whose color equals one of the brand's ramp steps
 * names that step.
 *
 * @param catalog - The generated palette catalog.
 * @param columns - The brand columns the switches pick.
 * @returns One row per color role, in the contract's order.
 */
export function roleRows(catalog: PaletteCatalog, columns: readonly BrandColumn[]): readonly RoleRow[] {
  const read = reader(catalog);
  const colors = columns.map((column) =>
    column._tag === "theme" ? rampColors(catalog.ramps, read, column.palette) : undefined
  );
  return catalog.roles.map((name) => ({
    name,
    cells: brandCells(columns, (column, at): RoleValue => {
      const { hex, alias } = read(column.palette, name);
      if (alias !== null) {
        return { _tag: "value", hex, link: { _tag: "alias", token: alias } };
      }
      const step = colors[at]?.get(hex);
      return {
        _tag: "value",
        hex,
        link: step === undefined ? { _tag: "none" } : { _tag: "equals", token: step },
      };
    }),
  }));
}

/** A pair's contrast in a theme's column. */
export type PairValue = {
  readonly _tag: "value";
  readonly ratio: number;
  readonly grade: ContrastGrade;
  /** The foreground's color as CSS hex, for the sample. */
  readonly foreground: string;
  /** The background's color as CSS hex, for the sample. */
  readonly background: string;
};

/** A pair's contrast in one column. */
export type PairCell = PinnedCell | PairValue;

/** One contrast pair's row. */
export type PairRow = { readonly pair: PalettePair; readonly cells: readonly PairCell[] };

/**
 * The Contrast table's rows: one per graded pair, with its ratio and grade in each column.
 *
 * @param catalog - The generated palette catalog.
 * @param columns - The brand columns the switches pick.
 * @returns The pairs in the catalog's order, text-grade first.
 */
export function pairRows(catalog: PaletteCatalog, columns: readonly BrandColumn[]): readonly PairRow[] {
  const read = reader(catalog);
  return catalog.pairs.map((pair, index) => ({
    pair,
    cells: brandCells(columns, (column): PairValue => {
      const ratio = column.palette.ratios[index];
      if (ratio === undefined) {
        throw stale(`ratio for --${pair.foreground} on --${pair.background}`);
      }
      return {
        _tag: "value",
        ratio,
        grade: contrastGrade(ratio),
        foreground: read(column.palette, pair.foreground).hex,
        background: read(column.palette, pair.background).hex,
      };
    }),
  }));
}
