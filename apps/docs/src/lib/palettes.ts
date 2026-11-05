/**
 * The palettes handbook page's model: what the generated palette catalog holds, and the rows the
 * variables table shows from it.
 *
 * The table reads like Figma's variables panel. Its columns are the brands, and variant, segment
 * and scheme pick which theme each column shows. A row is a color token, a contrast pair or a
 * primitive. The catalog is written at docs build from the resolved theme catalog
 * (`scripts/lib/palette-catalog.ts`), so the page never parses or converts a color.
 */

import type { BrandCode, ThemeSegment, ThemeVariant } from "@elmeragroup/fuse/theme";
import { RAMP_SCALES, RAMP_STEPS } from "@elmeragroup/fuse/theme-catalog";
import type {
  ResolvedColorScheme,
  RampOrigin,
  RampScale,
  RampStep,
  TokenEntry,
} from "@elmeragroup/fuse/theme-catalog";

import { matchesEveryToken } from "./search";
import { TOKEN_SECTIONS, TOKEN_TABLE } from "./token-sections";
import type { SectionId } from "./token-sections";

/** A contract token whose value is a color: a role, such as `primary`, or a ramp step. */
export type ColorTokenName = Extract<TokenEntry, { readonly kind: "color" }>["name"];

const COLOR_TOKEN_NAMES: ReadonlySet<string> = new Set(
  Object.entries(TOKEN_TABLE).flatMap(([name, row]) => (row.kind === "color" ? [name] : []))
);

/** Whether a name is a color token in the docs' contract taxonomy. */
export function isColorTokenName(name: string): name is ColorTokenName {
  return COLOR_TOKEN_NAMES.has(name);
}

/** The section a color token is filed under, from the docs' shared contract taxonomy. */
function tokenSection(name: ColorTokenName): SectionId {
  return TOKEN_TABLE[name].section;
}

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
] as const satisfies readonly (readonly [ColorTokenName, ColorTokenName])[];

/** A resolved color, as the table shows it. */
export type PaletteTone = {
  /** The color as CSS `oklch()`, the declared literal's canonical spelling. */
  readonly oklch: string;
  /** The color's channels as `#RRGGBB`, clipped into sRGB. Its alpha is {@link alpha}. */
  readonly hex: string;
  /** The color's alpha, from 0 to 1. */
  readonly alpha: number;
  /** A translucent color as `#RRGGBBAA`, which the clipboard takes. An opaque color has none. */
  readonly hexAlpha?: string;
};

/**
 * A pair's kind. `text-grade` pairs are the ones Fuse's contrast gate holds at 4.5:1 in every
 * theme and scheme (`TEXT_GRADE_PAIRS`). `role` pairs are a role with its `-foreground`, or a pair
 * in {@link CONTRACT_PAIRS}, and are outside that list. Fuse's contrast tests hold some of them to
 * a floor of their own and leave the rest unchecked.
 */
export type PalettePairKind = "text-grade" | "role";

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
  /** Each token's resolved color. */
  readonly values: readonly PaletteTone[];
  /** The custom property, without its dashes, a token's declaration names as a single `var()`, or `null`. */
  readonly aliases: readonly (string | null)[];
  /** Each pair's WCAG 2.2 contrast ratio, at full precision, so a grade never rounds up. */
  readonly ratios: readonly number[];
};

/** One legal theme of a brand, in both color schemes. */
export type PaletteBrandTheme = {
  readonly variant: ThemeVariant;
  readonly segment: ThemeSegment;
  readonly schemes: { readonly [S in ResolvedColorScheme]: PaletteScheme };
};

/** A brand, one column of the table, with every legal theme it has. */
export type PaletteBrand = {
  readonly code: BrandCode;
  /** The name a customer sees, such as Telinet. */
  readonly name: string;
  /** The brand primitive's color, the column's marker. */
  readonly accent: PaletteTone;
  readonly rampOrigin: RampOrigin;
  /** The segments the brand allows, so a column shows a pinned cell for the other one. */
  readonly segments: readonly ThemeSegment[];
  readonly themes: readonly PaletteBrandTheme[];
};

/** Which part of the primitives a primitive belongs to. */
export type PrimitiveGroup = "neutral" | "brand";

/** A primitive: one value in every theme and scheme. */
export type PalettePrimitive = {
  readonly name: string;
  readonly group: PrimitiveGroup;
  readonly tone: PaletteTone;
  /** The primitive, without its dashes, its declaration names as a single `var()`, or `null`. */
  readonly alias: string | null;
};

/** The generated catalog: the color tokens, the graded pairs, the primitives and every brand. */
export type PaletteCatalog = {
  /** Every color token, roles and ramp steps, in the contract's order. */
  readonly tokens: readonly ColorTokenName[];
  /** The pairs graded for contrast: the text-grade pairs first, then the other role pairs. */
  readonly pairs: readonly PalettePair[];
  readonly primitives: readonly PalettePrimitive[];
  /** Every brand, in `BRAND_CODES` order. */
  readonly brands: readonly PaletteBrand[];
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
 * A ratio as WCAG writes it, such as `4.52:1`, truncated to two decimals, so a ratio of 4.4988
 * reads `4.49:1` beside its Below AA grade and never `4.50:1`.
 */
export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
}

/**
 * A color's identity on the page: its 8-bit sRGB hex and its alpha, the precision Figma stores a
 * color at. Two tokens with this key paint the same color, so an `oklch()` role equals a hex ramp
 * step it was picked from, as Fjordkraft's external `--background` equals `shade-100`, #FFEEE6.
 *
 * @param tone - A resolved color.
 * @returns A key two equal colors share.
 */
export function toneKey(tone: PaletteTone): string {
  return `${tone.hex}/${String(tone.alpha)}`;
}

/** A tone's alpha as a percentage, or `undefined` for an opaque tone. */
export function alphaPercent(tone: PaletteTone): string | undefined {
  return tone.alpha < 1 ? `${String(Math.round(tone.alpha * 1000) / 10)}%` : undefined;
}

/** The format a cell writes a color in. */
export type ValueFormat = "hex" | "oklch";

/** A tone written in `format`, with its alpha after a translucent hex. */
export function formatTone(tone: PaletteTone, format: ValueFormat): string {
  if (format === "oklch") {
    return tone.oklch;
  }
  const alpha = alphaPercent(tone);
  return alpha === undefined ? tone.hex : `${tone.hex} · ${alpha}`;
}

/**
 * A tone as a valid CSS color for the clipboard, in `format`: `#RRGGBB`, `#RRGGBBAA` for a
 * translucent tone, or its `oklch()` with any alpha.
 *
 * @param tone - A resolved color.
 * @param format - The format the table writes values in.
 * @returns A color CSS parses, unlike the table's `#000000 · 5%` display.
 */
export function copyValue(tone: PaletteTone, format: ValueFormat): string {
  return format === "oklch" ? tone.oklch : (tone.hexAlpha ?? tone.hex);
}

/** The theme coordinates the switches above the table pick. Each column is one brand. */
export type PaletteAxes = {
  readonly variant: ThemeVariant;
  readonly segment: ThemeSegment;
  readonly scheme: ResolvedColorScheme;
};

/** One column: a brand, and the theme it shows, or the one segment a pinned brand allows. */
export type BrandColumn =
  | { readonly _tag: "theme"; readonly brand: PaletteBrand; readonly palette: PaletteScheme }
  | { readonly _tag: "pinned"; readonly brand: PaletteBrand; readonly only: ThemeSegment };

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

/** Checks that a palette holds an entry for every token and pair. */
function checkPalette(catalog: PaletteCatalog, palette: PaletteScheme, where: string): void {
  const counts = [
    ["token values", palette.values.length, catalog.tokens.length],
    ["aliases", palette.aliases.length, catalog.tokens.length],
    ["ratios", palette.ratios.length, catalog.pairs.length],
  ] as const;
  for (const [what, held, expected] of counts) {
    if (held !== expected) {
      throw new Error(
        `The palette catalog holds ${String(held)} ${what} for ${where}, not ${String(expected)}; regenerate it.`
      );
    }
  }
}

/**
 * The seven brand columns for one variant, segment and scheme. A brand pinned to the other
 * segment, such as Telinet under Company, shows the segment it allows instead of a theme.
 *
 * @param catalog - The generated palette catalog.
 * @param axes - The variant, segment and scheme the switches pick.
 * @returns One column per brand, in `BRAND_CODES` order.
 * @throws {Error} When an allowed theme or one of its entries is missing: a stale catalog.
 */
export function brandColumns(catalog: PaletteCatalog, axes: PaletteAxes): readonly BrandColumn[] {
  return catalog.brands.map((brand): BrandColumn => {
    if (!brand.segments.includes(axes.segment)) {
      return { _tag: "pinned", brand, only: required(brand.segments, 0, `segment for ${brand.code}`) };
    }
    const theme = brand.themes.find(
      (candidate) => candidate.variant === axes.variant && candidate.segment === axes.segment
    );
    if (theme === undefined) {
      throw new Error(
        `The palette catalog has no ${axes.variant}-${brand.code}-${axes.segment}; regenerate it with \`pnpm --filter docs generate\`.`
      );
    }
    const palette = theme.schemes[axes.scheme];
    checkPalette(catalog, palette, `${axes.variant}-${brand.code}-${axes.segment} (${axes.scheme})`);
    return { _tag: "theme", brand, palette };
  });
}

/** What a column shows for a row of a pinned brand. */
export type PinnedCell = { readonly _tag: "pinned"; readonly only: ThemeSegment };

/** A token's value in one column. */
export type TokenCell =
  | PinnedCell
  | {
      readonly _tag: "value";
      readonly tone: PaletteTone;
      /** The custom property the token's declaration names, without its dashes. */
      readonly alias: string | undefined;
      /** The ramp step the value equals, such as `shade-100`, for a role. */
      readonly step: string | undefined;
    };

/** A pair's contrast in one column. */
export type PairCell =
  | PinnedCell
  | {
      readonly _tag: "value";
      readonly ratio: number;
      readonly grade: ContrastGrade;
      readonly foreground: PaletteTone;
      readonly background: PaletteTone;
    };

/** A ramp token's place in Fuse's ramps. */
export type RampPosition = { readonly scale: RampScale; readonly step: RampStep };

/** One color token's row: a role or a ramp step. */
export type TokenRow = {
  readonly _tag: "token";
  readonly id: string;
  readonly name: ColorTokenName;
  /** A ramp step's scale and step, or `undefined` for a role. */
  readonly ramp: RampPosition | undefined;
  /** The row's group: a contract section for a role, the scale for a ramp step. */
  readonly group: string;
  readonly cells: readonly TokenCell[];
};

/** One contrast pair's row. */
export type PairRow = {
  readonly _tag: "pair";
  readonly id: string;
  readonly pair: PalettePair;
  readonly group: PalettePairKind;
  readonly cells: readonly PairCell[];
  /** Every grade the pair reaches across the brand columns, for the contrast filter. */
  readonly grades: readonly ContrastGrade[];
};

/** One primitive's row: one value, the same in every theme. */
export type PrimitiveRow = {
  readonly _tag: "primitive";
  readonly id: string;
  readonly primitive: PalettePrimitive;
  readonly group: PrimitiveGroup;
};

/** The collections the rail lists, as Figma's variables panel lists its collections. */
export type PaletteCollection = "roles" | "contrast" | "ramps" | "primitives";

/** A group of rows, the header the table puts above them. */
type RowGroup = { readonly id: string; readonly label: string };

/** The groups of each collection, in the order the table and the rail list them. */
// oxlint-disable-next-line elmera/no-raw-class-map -- the values are group ids and labels, not classes; "text-grade" reads as a text- utility
export const COLLECTION_GROUPS = {
  roles: TOKEN_SECTIONS.filter(
    (section) =>
      section.id !== "ramps" &&
      Object.values(TOKEN_TABLE).some((row) => row.section === section.id && row.kind === "color")
  ).map((section) => ({ id: section.id, label: section.title })),
  contrast: [
    { id: "text-grade", label: "Text-grade pairs" },
    { id: "role", label: "Other role pairs" },
  ],
  ramps: RAMP_SCALES.map((scale) => ({ id: scale, label: `brand-${scale}` })),
  primitives: [
    { id: "neutral", label: "neutral" },
    { id: "brand", label: "brand" },
  ],
} as const satisfies Record<PaletteCollection, readonly RowGroup[]>;

/** Each ramp token's scale and step, from Fuse's ramp structure rather than the token names. */
const RAMP_POSITIONS: ReadonlyMap<string, RampPosition> = new Map(
  RAMP_SCALES.flatMap((scale) =>
    RAMP_STEPS.map((step) => [`brand-${scale}-${step}`, { scale, step }] as const)
  )
);

/** A ramp step's pill label, such as `shade-100`. */
function stepLabel({ scale, step }: RampPosition): string {
  return `${scale}-${step}`;
}

/**
 * Each color a column's ramps paint, with the step that paints it. Neutral goes in first so that
 * shade wins: where a brand's neutral and shade share a step, as Fjordkraft's 100 does, the pill
 * names the shade.
 */
function rampSteps(catalog: PaletteCatalog, palette: PaletteScheme): ReadonlyMap<string, string> {
  const ramps = catalog.tokens.flatMap((name, index) => {
    const position = RAMP_POSITIONS.get(name);
    const tone = palette.values[index];
    return position === undefined || tone === undefined ? [] : [{ position, tone }];
  });
  return new Map(
    RAMP_SCALES.flatMap((scale) =>
      ramps
        .filter(({ position }) => position.scale === scale)
        .map(({ position, tone }) => [toneKey(tone), stepLabel(position)] as const)
    )
  );
}

/**
 * The rows of the Roles or Brand ramps collection: one per token, with its value in each column.
 * A role's cell names the token it aliases, or the ramp step its value equals.
 *
 * @param catalog - The generated palette catalog.
 * @param columns - The brand columns the switches pick.
 * @param collection - `roles` or `ramps`.
 * @returns The rows in the contract's order.
 */
export function tokenRows(
  catalog: PaletteCatalog,
  columns: readonly BrandColumn[],
  collection: "roles" | "ramps"
): readonly TokenRow[] {
  const steps = columns.map((column) =>
    collection === "roles" && column._tag === "theme" ? rampSteps(catalog, column.palette) : undefined
  );
  return catalog.tokens.flatMap((name, index): TokenRow[] => {
    const section = tokenSection(name);
    if ((section === "ramps") !== (collection === "ramps")) {
      return [];
    }
    const cells = columns.map((column, at): TokenCell => {
      if (column._tag === "pinned") {
        return { _tag: "pinned", only: column.only };
      }
      const tone = required(column.palette.values, index, `value for --${name}`);
      const alias = required(column.palette.aliases, index, `alias entry for --${name}`);
      return { _tag: "value", tone, alias: alias ?? undefined, step: steps[at]?.get(toneKey(tone)) };
    });
    const ramp = RAMP_POSITIONS.get(name);
    return [{ _tag: "token", id: name, name, ramp, group: ramp?.scale ?? section, cells }];
  });
}

/**
 * The Contrast collection's rows: one per graded pair, with its ratio and grade in each column.
 *
 * @param catalog - The generated palette catalog.
 * @param columns - The brand columns the switches pick.
 * @returns The pairs in the catalog's order, text-grade first.
 * @throws {Error} When a pair names a token the catalog lacks: a stale catalog.
 */
export function pairRows(catalog: PaletteCatalog, columns: readonly BrandColumn[]): readonly PairRow[] {
  const tokenIndex = new Map(catalog.tokens.map((name, index) => [name, index]));
  const toneOf = (palette: PaletteScheme, name: ColorTokenName, pair: PalettePair): PaletteTone => {
    const index = tokenIndex.get(name);
    if (index === undefined) {
      throw new Error(
        `The palette catalog pairs --${pair.foreground} on --${pair.background}, but has no token --${name}; regenerate it.`
      );
    }
    return required(palette.values, index, `value for --${name}`);
  };
  return catalog.pairs.map((pair, index): PairRow => {
    const cells = columns.map((column): PairCell => {
      if (column._tag === "pinned") {
        return { _tag: "pinned", only: column.only };
      }
      const ratio = required(
        column.palette.ratios,
        index,
        `ratio for --${pair.foreground} on --${pair.background}`
      );
      return {
        _tag: "value",
        ratio,
        grade: contrastGrade(ratio),
        foreground: toneOf(column.palette, pair.foreground, pair),
        background: toneOf(column.palette, pair.background, pair),
      };
    });
    const grades = [...new Set(cells.flatMap((cell) => (cell._tag === "value" ? [cell.grade] : [])))];
    return {
      _tag: "pair",
      id: `${pair.foreground}/${pair.background}`,
      pair,
      group: pair.kind,
      cells,
      grades,
    };
  });
}

/**
 * The Primitives collection's rows, which hold one value in every theme.
 *
 * @param catalog - The generated palette catalog.
 * @returns The primitives in source order.
 */
export function primitiveRows(catalog: PaletteCatalog): readonly PrimitiveRow[] {
  return catalog.primitives.map((primitive) => ({
    _tag: "primitive",
    id: primitive.name,
    primitive,
    group: primitive.group,
  }));
}

/** Every value a cell shows, as text a search can match. */
function cellText(cell: TokenCell | PairCell): string {
  if (cell._tag === "pinned") {
    return "";
  }
  if ("ratio" in cell) {
    return `${formatRatio(cell.ratio)} ${GRADE_LABELS[cell.grade]}`;
  }
  return [cell.tone.hex, cell.tone.oklch, cell.alias ?? "", cell.step ?? ""].join(" ");
}

/** A row's searchable text: its name and every value it shows. */
function rowSearchText(row: TokenRow | PairRow | PrimitiveRow): string {
  switch (row._tag) {
    case "token":
      return [`--${row.name}`, ...row.cells.map(cellText)].join(" ");
    case "pair":
      return [row.pair.foreground, row.pair.background, ...row.cells.map(cellText)].join(" ");
    case "primitive":
      return [`--${row.primitive.name}`, row.primitive.tone.hex, row.primitive.tone.oklch].join(" ");
  }
}

/**
 * Whether a row matches every word of a search, in its name or any value it shows.
 *
 * @param row - A row of any collection.
 * @param search - What the search field holds.
 * @returns `true` for an empty search.
 */
export function matchesSearch(row: TokenRow | PairRow | PrimitiveRow, search: string): boolean {
  return matchesEveryToken(rowSearchText(row), search);
}
