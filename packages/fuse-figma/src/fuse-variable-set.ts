/**
 * The Fuse token contract projected into Figma variables.
 *
 * Fuse themes vary on two axes, the theme slug and the color scheme. Figma resolves an
 * alias using the layer's mode for the target collection, so the two axes become two
 * collections that designers set independently on a frame. Density is a third axis,
 * independent of the theme, so it has a collection of its own.
 *
 * - `Fuse tokens` holds one variable per role token and per radius rung a component uses,
 *   with a Light and a Dark mode. These are the variables designers bind; each one aliases
 *   its scheme's variable in `Fuse themes`.
 * - `Fuse themes` holds `light/<token>` and `dark/<token>` with one mode per theme slug.
 *   Its variables are hidden from the pickers because they only feed `Fuse tokens`.
 * - `Fuse primitives` holds the neutral ramp and brand accents in a single mode. Primitive
 *   tokens are public API, so designers can bind these too.
 * - `Fuse density` holds the control metrics with a Dense and a Comfortable mode.
 *
 * Twenty theme modes stay well inside Figma's 40-mode limit, and a new theme adds a mode
 * rather than a collection.
 */

import type { Result } from "effect";

import { resolveThemeCatalog } from "@elmeragroup/fuse/theme-catalog";
import type {
  AnyEntry,
  Density,
  DensityMetricEntry,
  DensityMetricKind,
  PrimitiveEntry,
  PrimitiveName,
  RadiusRungName,
  ResolvedColorScheme,
  ResolvedScheme,
  ResolvedThemeCatalog,
  RungEntry,
  TokenEntry,
  TokenKind,
  TokenName,
} from "@elmeragroup/fuse/theme-catalog";

import { makeVariableSet } from "./variable-set.ts";
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
export const TOKENS_COLLECTION = "Fuse tokens";

/** The collection with one mode per theme slug. */
export const THEMES_COLLECTION = "Fuse themes";

/** The collection holding the scheme-independent palette. */
export const PRIMITIVES_COLLECTION = "Fuse primitives";

/** The collection with the control metrics and one mode per density. */
export const DENSITY_COLLECTION = "Fuse density";

const PRIMITIVES_MODE = "Value";

const SCHEME_MODES = { light: "Light", dark: "Dark" } as const satisfies Record<ResolvedColorScheme, string>;

const SCHEMES = ["light", "dark"] as const satisfies readonly ResolvedColorScheme[];

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
} as const satisfies Record<TokenKind, VariableType>;

/** The pickers that offer each kind of density metric. Figma's `GAP` covers padding too. */
const DENSITY_SCOPES = {
  height: ["WIDTH_HEIGHT"],
  padding: ["GAP"],
  gap: ["GAP"],
  fontSize: ["FONT_SIZE"],
  lineHeight: ["LINE_HEIGHT"],
} as const satisfies Record<DensityMetricKind, readonly VariableScope[]>;

/** The tokens of the dimension kind. */
type DimensionTokenName = Extract<TokenEntry, { readonly kind: "dimension" }>["name"];

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
  "radius-step": [],
} as const satisfies Record<DimensionTokenName, readonly VariableScope[]>;

/**
 * The pickers that offer a color or font token. Font tokens are STRING variables, and the
 * REST API's variable types page says scopes are currently only supported on FLOAT and COLOR
 * variables (https://developers.figma.com/docs/rest-api/variables-types/). They get
 * `ALL_SCOPES` until a real file shows that Figma keeps `FONT_FAMILY` on a STRING variable.
 */
const KIND_SCOPES = {
  color: ["ALL_SCOPES"],
  fontFamily: ["ALL_SCOPES"],
} as const satisfies Record<Exclude<TokenKind, "dimension">, readonly VariableScope[]>;

/** The pickers that offer a contract token's `Fuse tokens` variable. */
function tokenScopes(entry: TokenEntry): readonly VariableScope[] {
  return entry.kind === "dimension" ? DIMENSION_SCOPES[entry.name] : KIND_SCOPES[entry.kind];
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
 * One variable designers bind in `Fuse tokens`. `Fuse themes` holds its value per theme as
 * `light/<name>` and `dark/<name>`, and the `Fuse tokens` variable aliases those.
 */
type BoundVariable = {
  readonly name: TokenName | SyncedRungName;
  readonly type: VariableType;

  /** The pickers that offer the `Fuse tokens` variable. */
  readonly scopes: readonly VariableScope[];

  /** The CSS a developer pastes. Every `var()` in it names a property the shipped CSS defines. */
  readonly webSyntax: string;

  /** The same token or rung in another theme's scheme. */
  readonly entryIn: (scheme: ResolvedScheme) => TokenEntry | RungEntry;
};

/**
 * Every `Fuse tokens` variable: each role token, then each synced radius rung. A rung's
 * code syntax is the `calc()` `fuse.css` declares. `fuse.css` declares the rungs in
 * `@theme inline`, so Tailwind inlines them into its utilities and the built CSS does not
 * define `--radius-sm` and most other rungs as custom properties. Figma variables cannot
 * compute, so each rung holds the px the catalog computes per theme.
 */
function boundVariables(template: ResolvedScheme): readonly BoundVariable[] {
  const tokens = Object.values(template.tokens).map((entry): BoundVariable => ({
    name: entry.name,
    type: VARIABLE_TYPES[entry.kind],
    scopes: tokenScopes(entry),
    webSyntax: entry.codeSyntax,
    entryIn: (scheme) => scheme.tokens[entry.name],
  }));
  const rungs = Object.values(template.rungs)
    .filter(isSyncedRung)
    .map((entry): BoundVariable => ({
      name: entry.name,
      type: VARIABLE_TYPES[entry.kind],
      scopes: ["CORNER_RADIUS"],
      webSyntax: entry.codeSyntax,
      entryIn: (scheme) => scheme.rungs[entry.name],
    }));
  return [...tokens, ...rungs];
}

/**
 * Build the variable set for every legal theme in both color schemes and both densities.
 *
 * @returns The four Fuse collections, or the variable set rule the projection breaks.
 * @throws Error when the theme catalog meets a token value it cannot resolve or resolves no
 *   theme, which is a defect in a Fuse token module.
 */
export function fuseVariableSet(): Result.Result<VariableSet, InvalidVariableSet | AliasCycle> {
  const catalog = resolveThemeCatalog();
  const [first] = catalog.themes;
  if (first === undefined) {
    // LEGAL_THEMES is a flatMap over the brand pin table, so its type cannot say non-empty.
    throw new Error(
      "The theme catalog resolved no legal theme, a defect in Fuse's theme table: the variable set takes its token list from the first theme."
    );
  }
  const bound = boundVariables(first.schemes.light);
  return makeVariableSet([
    primitivesCollection(catalog.primitives),
    themesCollection(catalog, bound),
    tokensCollection(bound),
    densityCollection(catalog.density),
  ]);
}

function primitivesCollection(primitives: ResolvedThemeCatalog["primitives"]): CollectionSpec {
  const variables = Object.values(primitives).map((entry: PrimitiveEntry): VariableSpec => ({
    name: entry.name,
    type: VARIABLE_TYPES[entry.kind],
    scopes: KIND_SCOPES[entry.kind],
    webSyntax: entry.codeSyntax,
    values: new Map([
      [
        PRIMITIVES_MODE,
        entry.reference === undefined ? literalValue(entry) : primitiveAlias(entry.reference.name),
      ],
    ]),
  }));
  return { name: PRIMITIVES_COLLECTION, modes: [PRIMITIVES_MODE], variables };
}

function themesCollection(catalog: ResolvedThemeCatalog, bound: readonly BoundVariable[]): CollectionSpec {
  const variables = SCHEMES.flatMap((scheme) =>
    bound.map((variable): VariableSpec => ({
      name: themeVariableName(scheme, variable.name),
      type: variable.type,
      // Only designers' pickers read scopes; these variables are reached through aliases.
      scopes: [],
      webSyntax: undefined,
      values: new Map(
        catalog.themes.map((theme) => [
          theme.slug,
          schemeValue(variable.entryIn(theme.schemes[scheme]), scheme),
        ])
      ),
    }))
  );
  return { name: THEMES_COLLECTION, modes: catalog.themes.map((theme) => theme.slug), variables };
}

function tokensCollection(bound: readonly BoundVariable[]): CollectionSpec {
  const variables = bound.map((variable): VariableSpec => ({
    name: variable.name,
    type: variable.type,
    scopes: variable.scopes,
    webSyntax: variable.webSyntax,
    values: new Map(
      SCHEMES.map((scheme) => [SCHEME_MODES[scheme], themeAlias(themeVariableName(scheme, variable.name))])
    ),
  }));
  return { name: TOKENS_COLLECTION, modes: SCHEMES.map((scheme) => SCHEME_MODES[scheme]), variables };
}

/** The `Fuse themes` variable holding one bound variable's value in one scheme. */
function themeVariableName(scheme: ResolvedColorScheme, name: string): string {
  return `${scheme}/${name}`;
}

/**
 * One FLOAT variable per control metric, named after its custom property. Density is
 * independent of theme and scheme, so these variables hold literals and alias nothing. A
 * metric's family decides its scopes.
 */
function densityCollection(density: readonly DensityMetricEntry[]): CollectionSpec {
  const variables = density.map((metric): VariableSpec => ({
    name: metric.name,
    type: VARIABLE_TYPES.dimension,
    scopes: DENSITY_SCOPES[metric.metricKind],
    webSyntax: metric.codeSyntax,
    values: new Map<string, VariableValue>(
      DENSITIES.map((mode) => [DENSITY_MODES[mode], { _tag: "Float", value: metric.px[mode] }])
    ),
  }));
  return { name: DENSITY_COLLECTION, modes: DENSITIES.map((mode) => DENSITY_MODES[mode]), variables };
}

/**
 * The Figma value of one entry in a theme's scheme. A reference becomes an alias, which
 * `makeVariableSet` later checks has the same type, and anything else is the entry's literal.
 * CSS resolves `var(--role)` against the element's own scope, so a role reference means the
 * same scheme's role, and a primitive reference means the primitive.
 */
function schemeValue(entry: TokenEntry | RungEntry, scheme: ResolvedColorScheme): VariableValue {
  if (entry.reference === undefined) {
    return literalValue(entry);
  }
  return entry.reference.space === "primitive"
    ? primitiveAlias(entry.reference.name)
    : themeAlias(themeVariableName(scheme, entry.reference.name));
}

/** A resolved literal in Figma's form for its kind. Figma dimensions are unitless pixels. */
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
  }
}

function primitiveAlias(name: PrimitiveName): AliasValue {
  return { _tag: "Alias", target: { collection: PRIMITIVES_COLLECTION, variable: name } };
}

function themeAlias(variable: string): AliasValue {
  return { _tag: "Alias", target: { collection: THEMES_COLLECTION, variable } };
}
