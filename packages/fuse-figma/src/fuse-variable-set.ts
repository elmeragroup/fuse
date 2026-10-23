/**
 * The Fuse token contract projected into Figma variables.
 *
 * Figma resolves an alias that crosses into another collection with the frame's mode for the
 * target collection, inherited from any ancestor. Each theme axis therefore becomes one
 * collection with one mode per value, and designers pick color scheme, variant, segment and
 * brand separately in a frame's Appearance panel, as they do in the docs theme picker.
 *
 * - `Fuse tokens` holds one variable per role token, per radius rung a component uses, per
 *   role tint the component kit binds and per formula a recipe writes over the tokens, with a
 *   Light and a Dark mode. These are the variables designers bind. Each one aliases
 *   `<scheme>/<token>` in `Fuse variant` for its scheme mode.
 * - `Fuse variant` has an Internal and an External mode. `<scheme>/<token>` aliases
 *   `<scheme>/<variant>/<token>` in `Fuse segment`. `density/<metric>` holds the metric in
 *   the variant's default density, which the Auto mode of `Fuse density` reads.
 * - `Fuse segment` has a Private and a Company mode. `<scheme>/<variant>/<token>` aliases
 *   `<scheme>/<variant>/<segment>/<token>` in `Fuse brand`.
 * - `Fuse brand` has one mode per brand and holds each theme's values at
 *   `<scheme>/<variant>/<segment>/<token>`. Figma cannot disable a mode, so a brand pinned to
 *   one segment holds that segment's values under the other segment too.
 * - `Fuse primitives` holds the neutral ramp and brand accents in a single mode. The neutral
 *   ramp is hidden from pickers, because it holds one value in every theme, and stays an alias
 *   target. The brand accents stay in the fill and text pickers for cross-brand artwork.
 * - `Fuse density` holds the density metrics with an Auto, a Dense and a Comfortable mode.
 *   Auto follows the frame's variant, as apps do.
 *
 * Every bound variable takes all four hops, so a hidden variable's name never depends on
 * which axes a token varies on. The variables of `Fuse variant`, `Fuse segment` and
 * `Fuse brand` are hidden from pickers and carry no code syntax and an empty description,
 * because they only feed aliases. A color is offered only in the pickers for where Fuse paints
 * it, and every variable a designer can bind carries the catalog's description. The sync
 * deletes the retired `Fuse themes` collection, which held one mode per theme slug before the
 * axes split.
 */

import type { Result } from "effect";

import {
  BRAND_CODES,
  BRANDS,
  defaultDensityForVariant,
  resolveThemeCatalog,
  THEME_SEGMENTS,
  THEME_VARIANTS,
} from "@elmeragroup/fuse/theme-catalog";
import type {
  AnyEntry,
  BrandCode,
  Density,
  DensityMetricEntry,
  DensityMetricKind,
  PrimitiveEntry,
  PrimitiveName,
  RadiusRungName,
  ResolvedColorScheme,
  ResolvedScheme,
  ResolvedTheme,
  ResolvedThemeCatalog,
  RungEntry,
  ThemeSegment,
  ThemeVariant,
  TokenEntry,
  TokenKind,
  TokenName,
  TokenPaint,
} from "@elmeragroup/fuse/theme-catalog";

import { FILL_SCOPES, makeVariableSet } from "./variable-set.ts";
import type {
  AliasCycle,
  AliasValue,
  CollectionSpec,
  InvalidVariableSet,
  LiteralValue,
  VariableScope,
  VariableSet,
  VariableSpec,
  VariableType,
  VariableValue,
} from "./variable-set.ts";

/** The collection designers bind to, with Light and Dark modes. */
const TOKENS_COLLECTION = "Fuse tokens";

/** The collection with one mode per theme variant. */
const VARIANT_COLLECTION = "Fuse variant";

/** The collection with one mode per theme segment. */
const SEGMENT_COLLECTION = "Fuse segment";

/** The collection with one mode per brand, which holds the theme values. */
const BRAND_COLLECTION = "Fuse brand";

/** The collection holding the scheme-independent palette. */
const PRIMITIVES_COLLECTION = "Fuse primitives";

/** The collection with the density metrics and one mode per density, plus Auto. */
const DENSITY_COLLECTION = "Fuse density";

/**
 * Collections earlier syncs wrote and this one deletes. `Fuse themes` held one mode per theme
 * slug before the four axis collections replaced it.
 */
const RETIRED_COLLECTIONS = ["Fuse themes"] as const;

const PRIMITIVES_MODE = "Value";

const SCHEME_MODES = { light: "Light", dark: "Dark" } as const satisfies Record<ResolvedColorScheme, string>;

const SCHEMES = ["light", "dark"] as const satisfies readonly ResolvedColorScheme[];

/** The variant labels the docs theme picker shows. */
const VARIANT_MODES = { internal: "Internal", external: "External" } as const satisfies Record<
  ThemeVariant,
  string
>;

/** The segment labels the docs theme picker shows. */
const SEGMENT_MODES = { private: "Private", company: "Company" } as const satisfies Record<
  ThemeSegment,
  string
>;

/** The mode that follows the frame's variant, first so that a new collection defaults to it. */
const AUTO_DENSITY_MODE = "Auto";

const DENSITY_MODES = { dense: "Dense", comfortable: "Comfortable" } as const satisfies Record<
  Density,
  string
>;

const DENSITIES = ["dense", "comfortable"] as const satisfies readonly Density[];

/** The Figma variable type each token kind syncs as. */
const VARIABLE_TYPES = {
  color: "COLOR",
  dimension: "FLOAT",
  fontFamily: "STRING",
  fontWeight: "FLOAT",
} as const satisfies Record<TokenKind, VariableType>;

/** The pickers that offer each kind of density metric. Figma's `GAP` covers padding too. */
const DENSITY_SCOPES = {
  height: ["WIDTH_HEIGHT"],
  padding: ["GAP"],
  gap: ["GAP"],
  fontSize: ["FONT_SIZE"],
  lineHeight: ["LINE_HEIGHT"],
} as const satisfies Record<DensityMetricKind, readonly VariableScope[]>;

/** The tokens of the color kind. */
type ColorTokenName = Extract<TokenEntry, { readonly kind: "color" }>["name"];

/**
 * The role tints the component kit binds, each a role and the percent a recipe mixes it at
 * toward transparent, as `bg-error/10` does. A Figma paint takes its opacity from the alpha of
 * the color variable it binds, so a paint cannot bind `error` at 10%. Each tint therefore syncs
 * as its own variable, such as `error/10`, holding the role's color at that alpha. Its code
 * syntax is the `color-mix()` Tailwind compiles the utility to, which the kit's builder binds,
 * and it is offered in its role's pickers.
 * The kit's coverage test fails when a recipe mixes a role at a percent this table lacks.
 */
const ROLE_TINTS = [
  ["primary", 80],
  ["error", 10],
  ["error", 20],
  ["success", 10],
  ["success", 20],
  ["warning", 20],
  ["info", 20],
] as const satisfies readonly (readonly [ColorTokenName, number])[];

/** The tokens of the dimension kind. */
type DimensionTokenName = Extract<TokenEntry, { readonly kind: "dimension" }>["name"];

/**
 * The lengths a recipe writes as a formula over theme tokens. Figma variables cannot compute, so
 * each formula syncs as its own FLOAT variable holding what the formula gives for each theme.
 * The code syntax is the formula as Tailwind compiles the recipe's class, which the kit's builder
 * binds once it compares the two with the fallbacks of synced variables dropped.
 *
 * - The outline Button's shadow lengths read `--button-outline-width`. At a 1px outline they
 *   give Tailwind's `shadow-xs`. From 2px the shadow stays inside the border box, where it
 *   paints nothing.
 * - The compact corner is `compactCornerClass` in `corner-radius.ts`, which the xs Toggle
 *   rounds with. Internal themes step 0px, which gives `--radius`, and external themes step
 *   2px, which gives `radius-md` capped at 10px.
 * - The checkbox corner is `checkboxCornerClass` in `corner-radius.ts`, which the Checkbox box
 *   rounds with: `radius-md` capped at 4px.
 */
const FORMULA_VARIABLES = [
  {
    name: "button-outline-shadow-blur",
    formula: "max(0px, 4px - 2 * var(--button-outline-width, 1px))",
    length: (scheme: ResolvedScheme) => Math.max(0, 4 - 2 * scheme.tokens["button-outline-width"].value),
    scopes: ["EFFECT_FLOAT"],
    description:
      "The blur of the outline Button shadow, max(0px, 4px - 2 * button-outline-width). Figma variables cannot compute, so the sync writes the result for each theme.",
  },
  {
    name: "button-outline-shadow-spread",
    formula: "min(0px, 2px - 2 * var(--button-outline-width, 1px))",
    length: (scheme: ResolvedScheme) => Math.min(0, 2 - 2 * scheme.tokens["button-outline-width"].value),
    scopes: ["EFFECT_FLOAT"],
    description:
      "The spread of the outline Button shadow, min(0px, 2px - 2 * button-outline-width). Figma variables cannot compute, so the sync writes the result for each theme.",
  },
  {
    name: "radius-compact",
    formula:
      "min(calc(var(--radius) - var(--radius-step, 0px)), max(10px, var(--radius) - 1000 * var(--radius-step, 0px)))",
    // The catalog's `radius-md` is the formula's first term, already clamped at 0 as CSS clamps
    // a negative `border-radius`.
    length: (scheme: ResolvedScheme) =>
      Math.min(
        scheme.rungs["radius-md"].value,
        Math.max(10, scheme.tokens.radius.value - 1000 * scheme.tokens["radius-step"].value)
      ),
    scopes: ["CORNER_RADIUS"],
    description:
      "The corner of a compact button in a toolbar, such as the xs Toggle: radius in internal themes, and radius-md capped at 10px in external ones. Figma variables cannot compute, so the sync writes the result for each theme.",
  },
  {
    name: "radius-checkbox",
    formula: "min(calc(var(--radius) - var(--radius-step, 0px)), 4px)",
    length: (scheme: ResolvedScheme) => Math.min(scheme.rungs["radius-md"].value, 4),
    scopes: ["CORNER_RADIUS"],
    description:
      "The corner of the Checkbox box: radius-md capped at 4px. Figma variables cannot compute, so the sync writes the result for each theme.",
  },
] as const satisfies readonly {
  readonly name: string;
  readonly formula: string;
  readonly length: (scheme: ResolvedScheme) => number;
  readonly scopes: readonly VariableScope[];
  readonly description: string;
}[];

/**
 * The pickers that offer each dimension token. A length can round corners, space a gap or
 * size a stroke, so the kind alone does not pick a scope. A new dimension token fails to
 * compile until it has an entry here. `radius-step` spaces the radius rungs and switches
 * between the internal and external variants, so no layer rounds with it. It syncs hidden
 * from every picker and keeps its code syntax for developers.
 */
const DIMENSION_SCOPES = {
  radius: ["CORNER_RADIUS"],
  "radius-button": ["CORNER_RADIUS"],
  "radius-field": ["CORNER_RADIUS"],
  "radius-step": [],
  "button-outline-width": ["STROKE_FLOAT"],
  "paragraph-leading-sm": ["LINE_HEIGHT"],
  "paragraph-leading-base": ["LINE_HEIGHT"],
  "paragraph-leading-lg": ["LINE_HEIGHT"],
} as const satisfies Record<DimensionTokenName, readonly VariableScope[]>;

/**
 * The pickers that offer a font token. A real Enterprise file kept `FONT_FAMILY` on the STRING
 * font family variables. Font weights are FLOAT variables and take `FONT_STYLE`, the REST API's
 * name for a FLOAT variable's font weight picker. The Plugin API names the same stored scope
 * `FONT_WEIGHT`.
 */
const FONT_SCOPES = {
  fontFamily: ["FONT_FAMILY"],
  fontWeight: ["FONT_STYLE"],
} as const satisfies Record<Exclude<TokenKind, "color" | "dimension">, readonly VariableScope[]>;

/**
 * The pickers that offer a color for each place Fuse paints it. A surface fills frames and
 * shapes. An ink colors text, and Fuse colors icons with the text color through `currentColor`,
 * so an ink also fills shapes and strokes vectors. A line strokes.
 */
const PAINT_SCOPES = {
  surface: ["FRAME_FILL", "SHAPE_FILL"],
  ink: ["TEXT_FILL", "SHAPE_FILL", "STROKE_COLOR"],
  line: ["STROKE_COLOR"],
} as const satisfies Record<TokenPaint, readonly VariableScope[]>;

/**
 * The pickers that offer a color painted in `paints`: each scope once, with the three fill
 * scopes folded into `ALL_FILLS`, which Figma keeps for any fill picker it adds later. The plan
 * compares a file's scopes as a set against this list's length, so a duplicate would read as
 * drift on every run. No paints means no picker, which hides the variable and keeps it an
 * alias target.
 */
function paintScopes(paints: readonly TokenPaint[]): readonly VariableScope[] {
  const scopes = new Set<VariableScope>(paints.flatMap((paint) => PAINT_SCOPES[paint]));
  if (FILL_SCOPES.every((scope) => scopes.has(scope))) {
    const strokes = [...scopes].filter((scope) => !FILL_SCOPES.includes(scope));
    return ["ALL_FILLS", ...strokes];
  }
  return [...scopes];
}

/** The pickers that offer a contract token's `Fuse tokens` variable. */
function tokenScopes(entry: TokenEntry): readonly VariableScope[] {
  switch (entry.kind) {
    case "color":
      return paintScopes(entry.paints);
    case "dimension":
      return DIMENSION_SCOPES[entry.name];
    case "fontFamily":
    case "fontWeight":
      return FONT_SCOPES[entry.kind];
  }
}

/**
 * The rungs the sync writes. It leaves out `radius-popover` because no component uses it.
 * Fuse popups use `radius-md`, so a designer who binds `radius-popover` to a popover gets a
 * radius the code never renders. `TODO.md` tracks removing the rung from `fuse.css`.
 */
type SyncedRungName = Exclude<RadiusRungName, "radius-popover">;

function isSyncedRung(entry: RungEntry): entry is RungEntry<SyncedRungName> {
  return entry.name !== "radius-popover";
}

/**
 * One variable designers bind in `Fuse tokens`. `Fuse brand` holds its value per theme, and
 * the variant and segment collections pass the frame's choice of each axis along.
 */
type BoundVariable = {
  readonly name:
    | TokenName
    | SyncedRungName
    | `${ColorTokenName}/${number}`
    | (typeof FORMULA_VARIABLES)[number]["name"];
  readonly type: VariableType;

  /** The pickers that offer the `Fuse tokens` variable. */
  readonly scopes: readonly VariableScope[];

  /** The CSS a developer pastes. Every `var()` in it names a property the shipped CSS defines. */
  readonly webSyntax: string;

  /** What the token or rung is for, from the catalog. */
  readonly description: string;

  /** The value `Fuse brand` holds for a theme's scheme at a theme path. */
  readonly leafIn: (scheme: ResolvedScheme, path: ThemePath) => VariableValue;
};

/** Where a theme's value sits along the scheme, variant and segment axes. */
type ThemePath = {
  readonly scheme: ResolvedColorScheme;
  readonly variant: ThemeVariant;
  readonly segment: ThemeSegment;
};

/**
 * Every `Fuse tokens` variable: each role token, then each synced radius rung, then each role
 * tint, then the formula variables. A rung's code syntax is the `calc()` `fuse.css` declares.
 * `fuse.css` declares the rungs in `@theme inline`, so Tailwind inlines them into its utilities
 * and the built CSS does not define `--radius-sm` and most other rungs as custom properties.
 * Figma variables cannot compute, so each rung holds the px the catalog computes per theme, each
 * tint holds its role's color at the tint's alpha, and each formula variable holds what its
 * formula gives.
 */
function boundVariables(template: ResolvedScheme): readonly BoundVariable[] {
  const tokens = Object.values(template.tokens).map((entry): BoundVariable => ({
    name: entry.name,
    type: VARIABLE_TYPES[entry.kind],
    scopes: tokenScopes(entry),
    webSyntax: entry.codeSyntax,
    description: entry.description,
    leafIn: (scheme, path) => leafValue(scheme.tokens[entry.name], path),
  }));
  const rungs = Object.values(template.rungs)
    .filter(isSyncedRung)
    .map((entry): BoundVariable => ({
      name: entry.name,
      type: VARIABLE_TYPES[entry.kind],
      scopes: ["CORNER_RADIUS"],
      webSyntax: entry.codeSyntax,
      description: entry.description,
      leafIn: (scheme, path) => leafValue(scheme.rungs[entry.name], path),
    }));
  const tints = ROLE_TINTS.map(([role, percent]): BoundVariable => ({
    name: `${role}/${percent}`,
    type: VARIABLE_TYPES.color,
    scopes: paintScopes(template.tokens[role].paints),
    webSyntax: `color-mix(in oklab, ${template.tokens[role].codeSyntax} ${percent}%, transparent)`,
    description: `${role} at ${percent}% opacity, which Fuse writes as ${role}/${percent}. Bind it instead of ${role}, because Figma takes the opacity of a bound color from its variable.`,
    // Mixing toward transparent keeps the color and scales its alpha, in any color space.
    leafIn: (scheme) => {
      const { r, g, b, alpha } = scheme.tokens[role].value;
      return { _tag: "Color", color: { r, g, b, a: (alpha * percent) / 100 } };
    },
  }));
  const formulas = FORMULA_VARIABLES.map(({ name, formula, length, scopes, description }): BoundVariable => ({
    name,
    type: VARIABLE_TYPES.dimension,
    scopes,
    webSyntax: formula,
    description,
    leafIn: (scheme) => ({ _tag: "Float", value: length(scheme) }),
  }));
  return [...tokens, ...rungs, ...tints, ...formulas];
}

/**
 * Build the variable set for every legal theme in both color schemes and every density.
 *
 * @returns The six Fuse collections with `Fuse themes` retired, or the variable set rule the
 *   projection breaks.
 * @throws Error when the theme catalog meets a token value it cannot resolve, which is a
 *   defect in a Fuse token module.
 */
export function fuseVariableSet(): Result.Result<VariableSet, InvalidVariableSet | AliasCycle> {
  const catalog = resolveThemeCatalog();
  // The token list comes from the first theme; every theme holds the same tokens and rungs.
  const [first] = catalog.themes;
  const bound = boundVariables(first.schemes.light);
  return makeVariableSet(
    [
      primitivesCollection(catalog.primitives),
      brandCollection(catalog, bound),
      segmentCollection(bound),
      variantCollection(bound, catalog.density),
      tokensCollection(bound),
      densityCollection(catalog.density),
    ],
    RETIRED_COLLECTIONS
  );
}

function primitivesCollection(primitives: ResolvedThemeCatalog["primitives"]): CollectionSpec {
  const variables = Object.values(primitives).map((entry: PrimitiveEntry): VariableSpec => ({
    name: entry.name,
    type: VARIABLE_TYPES[entry.kind],
    scopes: paintScopes(entry.paints),
    webSyntax: entry.codeSyntax,
    description: entry.description,
    values: new Map([
      [
        PRIMITIVES_MODE,
        entry.reference === undefined ? literalValue(entry) : primitiveAlias(entry.reference.name),
      ],
    ]),
  }));
  return { name: PRIMITIVES_COLLECTION, modes: [PRIMITIVES_MODE], variables };
}

/**
 * The picker metadata of a hidden collection's variable. Only designers' pickers read scopes and
 * descriptions, and the brand, segment and variant variables are reached through aliases.
 */
const HIDDEN_METADATA = {
  scopes: [],
  webSyntax: undefined,
  description: "",
} as const satisfies Pick<VariableSpec, "scopes" | "webSyntax" | "description">;

/** Every scheme, variant and segment, in the order the hidden collections list them. */
const THEME_PATHS: readonly ThemePath[] = SCHEMES.flatMap((scheme) =>
  THEME_VARIANTS.flatMap((variant) => THEME_SEGMENTS.map((segment) => ({ scheme, variant, segment })))
);

/**
 * One variable per bound variable at every theme path, with one mode per brand holding the
 * value of the theme that brand shows at that path.
 */
function brandCollection(catalog: ResolvedThemeCatalog, bound: readonly BoundVariable[]): CollectionSpec {
  const variables = THEME_PATHS.flatMap((path) => {
    const shown = BRAND_CODES.map(
      (brand) => [brandModeName(brand), shownTheme(catalog, path, brand)] as const
    );
    return bound.map((variable): VariableSpec => ({
      name: brandVariableName(path, variable.name),
      type: variable.type,
      ...HIDDEN_METADATA,
      values: new Map(
        shown.map(([mode, theme]) => [mode, variable.leafIn(theme.schemes[path.scheme], path)])
      ),
    }));
  });
  return { name: BRAND_COLLECTION, modes: BRAND_CODES.map(brandModeName), variables };
}

/**
 * The theme a brand mode shows at a theme path. A brand that allows the path's segment shows
 * its theme for that segment. A brand pinned to one segment shows its only theme under both
 * segments, because Figma cannot disable a mode; the docs picker moves the segment instead.
 */
function shownTheme(catalog: ResolvedThemeCatalog, path: ThemePath, brand: BrandCode): ResolvedTheme {
  const ofBrand = catalog.themes.filter(
    (theme) => theme.input.variant === path.variant && theme.input.brand === brand
  );
  const shown =
    ofBrand.find((theme) => theme.input.segment === path.segment) ??
    (ofBrand.length === 1 ? ofBrand[0] : undefined);
  if (shown === undefined) {
    throw new Error(
      `The theme catalog has no ${path.variant} theme for brand ${brand} to show under ${path.segment}, a defect in Fuse's theme table.`
    );
  }
  return shown;
}

/**
 * A brand's mode name, its display name. A brand pinned to one segment names that segment, so
 * a designer can tell that the other segment mode repeats it.
 */
function brandModeName(code: BrandCode): string {
  const { displayName, segments } = BRANDS[code];
  const [only, ...others] = segments;
  return others.length === 0 ? `${displayName} (${only} only)` : displayName;
}

/** One variable per bound variable for each scheme and variant, aliasing the brand leaf of each segment. */
function segmentCollection(bound: readonly BoundVariable[]): CollectionSpec {
  const variables = SCHEMES.flatMap((scheme) =>
    THEME_VARIANTS.flatMap((variant) =>
      bound.map((variable): VariableSpec => ({
        name: segmentVariableName(scheme, variant, variable.name),
        type: variable.type,
        ...HIDDEN_METADATA,
        values: new Map(
          THEME_SEGMENTS.map((segment) => [
            SEGMENT_MODES[segment],
            alias(BRAND_COLLECTION, brandVariableName({ scheme, variant, segment }, variable.name)),
          ])
        ),
      }))
    )
  );
  return {
    name: SEGMENT_COLLECTION,
    modes: THEME_SEGMENTS.map((segment) => SEGMENT_MODES[segment]),
    variables,
  };
}

/**
 * One variable per bound variable for each scheme, aliasing the segment variable of each
 * variant, and one variable per density metric holding the metric in the variant's default
 * density.
 */
function variantCollection(
  bound: readonly BoundVariable[],
  density: readonly DensityMetricEntry[]
): CollectionSpec {
  const tokens = SCHEMES.flatMap((scheme) =>
    bound.map((variable): VariableSpec => ({
      name: variantVariableName(scheme, variable.name),
      type: variable.type,
      ...HIDDEN_METADATA,
      values: new Map(
        THEME_VARIANTS.map((variant) => [
          VARIANT_MODES[variant],
          alias(SEGMENT_COLLECTION, segmentVariableName(scheme, variant, variable.name)),
        ])
      ),
    }))
  );
  const metrics = density.map((metric): VariableSpec => ({
    name: variantDensityName(metric),
    type: VARIABLE_TYPES.dimension,
    ...HIDDEN_METADATA,
    values: new Map(
      THEME_VARIANTS.map((variant) => [
        VARIANT_MODES[variant],
        { _tag: "Float", value: metric.px[defaultDensityForVariant(variant)] },
      ])
    ),
  }));
  return {
    name: VARIANT_COLLECTION,
    modes: THEME_VARIANTS.map((variant) => VARIANT_MODES[variant]),
    variables: [...tokens, ...metrics],
  };
}

function tokensCollection(bound: readonly BoundVariable[]): CollectionSpec {
  const variables = bound.map((variable): VariableSpec => ({
    name: variable.name,
    type: variable.type,
    scopes: variable.scopes,
    webSyntax: variable.webSyntax,
    description: variable.description,
    values: new Map(
      SCHEMES.map((scheme) => [
        SCHEME_MODES[scheme],
        alias(VARIANT_COLLECTION, variantVariableName(scheme, variable.name)),
      ])
    ),
  }));
  return { name: TOKENS_COLLECTION, modes: SCHEMES.map((scheme) => SCHEME_MODES[scheme]), variables };
}

/** The `Fuse variant` variable for one bound variable in one scheme. */
function variantVariableName(scheme: ResolvedColorScheme, name: string): string {
  return `${scheme}/${name}`;
}

/** The `Fuse variant` variable holding one density metric in the variant's default density. */
function variantDensityName(metric: DensityMetricEntry): string {
  return `density/${metric.name}`;
}

/** The `Fuse segment` variable for one bound variable in one scheme and variant. */
function segmentVariableName(scheme: ResolvedColorScheme, variant: ThemeVariant, name: string): string {
  return `${scheme}/${variant}/${name}`;
}

/** The `Fuse brand` variable holding one bound variable's value at a theme path. */
function brandVariableName(path: ThemePath, name: string): string {
  return `${path.scheme}/${path.variant}/${path.segment}/${name}`;
}

/**
 * One FLOAT variable per density metric, named after its custom property. Dense and
 * Comfortable hold the metric's literals, and Auto aliases the metric in `Fuse variant`, so it
 * follows the frame's variant the way apps pick a variant's default density. A metric's kind
 * decides its scopes.
 */
function densityCollection(density: readonly DensityMetricEntry[]): CollectionSpec {
  const variables = density.map((metric): VariableSpec => ({
    name: metric.name,
    type: VARIABLE_TYPES.dimension,
    scopes: DENSITY_SCOPES[metric.metricKind],
    webSyntax: metric.codeSyntax,
    description: metric.description,
    values: new Map<string, VariableValue>([
      [AUTO_DENSITY_MODE, alias(VARIANT_COLLECTION, variantDensityName(metric))],
      ...DENSITIES.map((mode): [string, VariableValue] => [
        DENSITY_MODES[mode],
        { _tag: "Float", value: metric.px[mode] },
      ]),
    ]),
  }));
  return {
    name: DENSITY_COLLECTION,
    modes: [AUTO_DENSITY_MODE, ...DENSITIES.map((mode) => DENSITY_MODES[mode])],
    variables,
  };
}

/**
 * The `Fuse brand` value of one entry at a theme path. A reference becomes an alias, which
 * `makeVariableSet` later checks has the same type, and anything else is the entry's literal.
 * CSS resolves `var(--role)` against the element's own scope, so a role reference means the
 * role at the same path, and a primitive reference means the primitive.
 */
function leafValue(entry: TokenEntry | RungEntry, path: ThemePath): VariableValue {
  if (entry.reference === undefined) {
    return literalValue(entry);
  }
  return entry.reference.space === "primitive"
    ? primitiveAlias(entry.reference.name)
    : alias(BRAND_COLLECTION, brandVariableName(path, entry.reference.name));
}

/**
 * A resolved literal in Figma's form for its kind. Figma dimensions are unitless pixels, and
 * font weights are the CSS number.
 */
function literalValue(entry: AnyEntry): LiteralValue {
  switch (entry.kind) {
    case "color": {
      const { r, g, b, alpha } = entry.value;
      return { _tag: "Color", color: { r, g, b, a: alpha } };
    }
    case "dimension":
      return { _tag: "Float", value: entry.value };
    case "fontFamily":
      return { _tag: "String", value: entry.value };
    case "fontWeight":
      return { _tag: "Float", value: entry.value };
  }
}

function primitiveAlias(name: PrimitiveName): AliasValue {
  return alias(PRIMITIVES_COLLECTION, name);
}

function alias(collection: string, variable: string): AliasValue {
  return { _tag: "Alias", target: { collection, variable } };
}
