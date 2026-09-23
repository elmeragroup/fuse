/**
 * The Fuse token contract projected into Figma variables.
 *
 * Fuse themes vary on two axes, the theme slug and the color scheme. Figma resolves an
 * alias using the layer's mode for the target collection, so the two axes become two
 * collections that designers set independently on a frame. Density is a third axis,
 * independent of the theme, so it has a collection of its own.
 *
 * - `Fuse tokens` holds one variable per role token and per radius step, with a Light and a
 *   Dark mode. These are the variables designers bind; each one aliases its scheme's
 *   variable in `Fuse themes`.
 * - `Fuse themes` holds `light/<token>` and `dark/<token>` with one mode per theme slug.
 *   Its variables are hidden from the pickers because they only feed `Fuse tokens`.
 * - `Fuse primitives` holds the neutral ramp and brand accents in a single mode. Primitive
 *   tokens are public API, so designers can bind these too.
 * - `Fuse density` holds the control metrics with a Dense and a Comfortable mode.
 *
 * Twenty theme modes stay well inside Figma's 40-mode limit, and a new theme adds a mode
 * rather than a collection.
 */

import { Result, Schema } from "effect";

import {
  composeTheme,
  cssColorToSrgb,
  cssFirstFontFamily,
  cssLengthToPx,
  cssVarReference,
  DENSITY_METRIC_NAMES,
  DENSITY_METRICS,
  LEGAL_THEMES,
  PRIMITIVE_NAMES,
  PRIMITIVES,
  RADIUS_STEP_NAMES,
  RADIUS_STEP_OFFSETS,
  themeSlug,
  TOKEN_KINDS,
  TOKEN_NAMES,
} from "@elmeragroup/fuse/theme-catalog";
import type {
  Density,
  DensityMetricKind,
  RadiusStepName,
  ResolvedColorScheme,
  TokenContract,
  TokenKind,
  TokenName,
} from "@elmeragroup/fuse/theme-catalog";

import { makeVariableSet } from "./variable-set.ts";
import type {
  AliasCycle,
  AliasValue,
  CollectionSpec,
  ColorValue,
  FloatValue,
  InvalidVariableSet,
  LiteralValue,
  StringValue,
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

/** The pickers that offer each kind of density metric. Figma's `GAP` covers padding too. */
const DENSITY_SCOPES = {
  height: ["WIDTH_HEIGHT"],
  padding: ["GAP"],
  gap: ["GAP"],
  fontSize: ["FONT_SIZE"],
  lineHeight: ["LINE_HEIGHT"],
} as const satisfies Record<DensityMetricKind, readonly VariableScope[]>;

/** A `Fuse tokens` variable: a contract token, or a radius step `fuse.css` derives from `--radius`. */
type BoundName = TokenName | RadiusStepName;

/** Every `Fuse tokens` variable with the kind that decides its Figma type. */
const BOUND_TOKENS: readonly (readonly [BoundName, TokenKind])[] = [
  ...TOKEN_NAMES.map((token) => [token, TOKEN_KINDS[token]] as const),
  ...RADIUS_STEP_NAMES.map((step) => [step, "dimension"] as const),
];

/** A token value the projection has no Figma form for. */
export class UnsupportedTokenValue extends Schema.TaggedError<UnsupportedTokenValue>()(
  "UnsupportedTokenValue",
  {
    message: Schema.String,
    token: Schema.String,
    value: Schema.String,
  }
) {}

/** How one kind of token becomes a Figma variable. */
type KindProjection = {
  readonly type: VariableType;

  /** Read a literal CSS value, or return `undefined` when it is not in this kind's form. */
  readonly literal: (css: string) => LiteralValue | undefined;

  /** What the sync expects, for the message when `literal` refuses a value. */
  readonly expected: string;
};

const KIND_PROJECTIONS = {
  color: {
    type: "COLOR",
    literal: colorLiteral,
    expected: "an oklch() or #rrggbb color",
  },
  dimension: {
    type: "FLOAT",
    literal: dimensionLiteral,
    expected: "a rem or px length",
  },
  fontFamily: {
    type: "STRING",
    literal: fontFamilyLiteral,
    expected: "a font stack that starts with a named family",
  },
} as const satisfies Record<TokenKind, KindProjection>;

/** The tokens of the dimension kind. */
type DimensionTokenName = {
  [Name in TokenName]: (typeof TOKEN_KINDS)[Name] extends "dimension" ? Name : never;
}[TokenName];

/**
 * The pickers that offer each dimension token. A length can round corners, space a gap or
 * size a stroke, so the kind alone does not pick a scope. A new dimension token fails to
 * compile until it has an entry here. `radius-step` spaces the radius scale and switches
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

function isDimensionToken(token: TokenName): token is DimensionTokenName {
  return TOKEN_KINDS[token] === "dimension";
}

/** The pickers that offer a `Fuse tokens` variable. Every radius step rounds corners. */
function tokenScopes(name: BoundName): readonly VariableScope[] {
  if (!isTokenName(name)) return ["CORNER_RADIUS"];
  return isDimensionToken(name) ? DIMENSION_SCOPES[name] : KIND_SCOPES[TOKEN_KINDS[name]];
}

const primitiveNames: ReadonlySet<string> = new Set(PRIMITIVE_NAMES);
const tokenNames: ReadonlySet<string> = new Set(TOKEN_NAMES);

/**
 * Build the variable set for every legal theme in both color schemes and both densities.
 *
 * @returns The four Fuse collections. It fails on the first token value that has no Figma
 *   form, or on the variable set rule the projection breaks.
 */
export function fuseVariableSet(): Result.Result<
  VariableSet,
  UnsupportedTokenValue | InvalidVariableSet | AliasCycle
> {
  return Result.gen(function* () {
    const primitives = yield* primitivesCollection();
    const themes = yield* themesCollection();
    const density = yield* densityCollection();
    return yield* makeVariableSet([primitives, themes, tokensCollection(), density]);
  });
}

function primitivesCollection(): Result.Result<CollectionSpec, UnsupportedTokenValue> {
  return Result.gen(function* () {
    const projection = KIND_PROJECTIONS.color;
    const variables: VariableSpec[] = [];
    for (const name of PRIMITIVE_NAMES) {
      const value = yield* tokenValue(name, PRIMITIVES[name], projection, primitiveReference);
      variables.push({
        name,
        type: projection.type,
        scopes: KIND_SCOPES.color,
        webSyntax: `var(--${name})`,
        values: new Map([[PRIMITIVES_MODE, value]]),
      });
    }
    return { name: PRIMITIVES_COLLECTION, modes: [PRIMITIVES_MODE], variables };
  });
}

function themesCollection(): Result.Result<CollectionSpec, UnsupportedTokenValue> {
  return Result.gen(function* () {
    const variables: VariableSpec[] = [];
    for (const scheme of SCHEMES) {
      const composed = LEGAL_THEMES.map((theme) => [themeSlug(theme), composeTheme(theme, scheme)] as const);
      const reference = schemeReference(scheme);
      for (const token of TOKEN_NAMES) {
        const projection = KIND_PROJECTIONS[TOKEN_KINDS[token]];
        const values = new Map<string, VariableValue>();
        for (const [slug, tokens] of composed) {
          values.set(slug, yield* tokenValue(token, tokens[token], projection, reference));
        }
        // Only designers' pickers read scopes; these variables are reached through aliases.
        variables.push({
          name: themeVariableName(scheme, token),
          type: projection.type,
          scopes: [],
          webSyntax: undefined,
          values,
        });
      }
      for (const step of RADIUS_STEP_NAMES) {
        const values = new Map<string, VariableValue>();
        for (const [slug, tokens] of composed) {
          values.set(slug, yield* radiusStepValue(step, tokens));
        }
        variables.push({
          name: themeVariableName(scheme, step),
          type: KIND_PROJECTIONS.dimension.type,
          scopes: [],
          webSyntax: undefined,
          values,
        });
      }
    }
    return { name: THEMES_COLLECTION, modes: LEGAL_THEMES.map(themeSlug), variables };
  });
}

/**
 * A radius step in pixels for one composed theme. Figma variables cannot compute, so the
 * sync does the `calc()` from `fuse.css`. CSS clamps a negative `border-radius` to 0, so a
 * step below zero becomes 0, the radius a layer shows.
 */
function radiusStepValue(
  step: RadiusStepName,
  tokens: TokenContract
): Result.Result<FloatValue, UnsupportedTokenValue> {
  const radius = cssLengthToPx(tokens.radius);
  return radius === undefined
    ? unsupported("radius", tokens.radius, `a rem or px length to derive ${step} from`)
    : Result.succeed({ _tag: "Float", value: Math.max(0, radius + RADIUS_STEP_OFFSETS[step]) });
}

function tokensCollection(): CollectionSpec {
  const variables = BOUND_TOKENS.map(([token, kind]): VariableSpec => {
    const projection = KIND_PROJECTIONS[kind];
    return {
      name: token,
      type: projection.type,
      scopes: tokenScopes(token),
      webSyntax: `var(--${token})`,
      values: new Map([
        [SCHEME_MODES.light, themeAlias(themeVariableName("light", token))],
        [SCHEME_MODES.dark, themeAlias(themeVariableName("dark", token))],
      ]),
    };
  });
  return { name: TOKENS_COLLECTION, modes: [SCHEME_MODES.light, SCHEME_MODES.dark], variables };
}

/** The `Fuse themes` variable holding one token's value in one scheme. */
function themeVariableName(scheme: ResolvedColorScheme, token: BoundName): string {
  return `${scheme}/${token}`;
}

/**
 * One FLOAT variable per control metric, named after its custom property. Density is
 * independent of theme and scheme, so these variables hold literals and alias nothing.
 */
function densityCollection(): Result.Result<CollectionSpec, UnsupportedTokenValue> {
  return Result.gen(function* () {
    const variables: VariableSpec[] = [];
    for (const name of DENSITY_METRIC_NAMES) {
      const metric = DENSITY_METRICS[name];
      const values = new Map<string, VariableValue>();
      for (const density of DENSITIES) {
        const literal = dimensionLiteral(metric[density]);
        if (literal === undefined) {
          return yield* unsupported(name, metric[density], KIND_PROJECTIONS.dimension.expected);
        }
        values.set(DENSITY_MODES[density], literal);
      }
      variables.push({
        name,
        type: KIND_PROJECTIONS.dimension.type,
        scopes: DENSITY_SCOPES[metric.kind],
        webSyntax: `var(--${name})`,
        values,
      });
    }
    return { name: DENSITY_COLLECTION, modes: DENSITIES.map((density) => DENSITY_MODES[density]), variables };
  });
}

/** Resolves the name inside a `var(--name)` reference to the variable it aliases. */
type ReferenceResolver = (name: string) => AliasValue | undefined;

function primitiveReference(name: string): AliasValue | undefined {
  return primitiveNames.has(name)
    ? { _tag: "Alias", target: { collection: PRIMITIVES_COLLECTION, variable: name } }
    : undefined;
}

/**
 * CSS resolves `var(--role)` against the element's own scope, so a role reference in a
 * theme value means the same scheme's role, and a primitive reference means the primitive.
 */
function schemeReference(scheme: ResolvedColorScheme): ReferenceResolver {
  return (name) => {
    if (primitiveNames.has(name)) {
      return primitiveReference(name);
    }
    if (isTokenName(name)) {
      return themeAlias(themeVariableName(scheme, name));
    }
    return undefined;
  };
}

function isTokenName(name: string): name is TokenName {
  return tokenNames.has(name);
}

function themeAlias(variable: string): AliasValue {
  return { _tag: "Alias", target: { collection: THEMES_COLLECTION, variable } };
}

/**
 * The Figma value for one token's CSS. A `var(--name)` reference becomes an alias, and
 * `makeVariableSet` later checks that the target has the same type. Anything else must be a
 * literal of the token's kind.
 */
function tokenValue(
  token: string,
  css: string,
  projection: KindProjection,
  reference: ReferenceResolver
): Result.Result<VariableValue, UnsupportedTokenValue> {
  const referenced = cssVarReference(css);
  if (referenced !== undefined) {
    const alias = reference(referenced);
    return alias === undefined
      ? unsupported(token, css, "a reference to a Fuse token or primitive")
      : Result.succeed(alias);
  }
  const literal = projection.literal(css);
  return literal === undefined ? unsupported(token, css, projection.expected) : Result.succeed(literal);
}

function colorLiteral(css: string): ColorValue | undefined {
  const srgb = cssColorToSrgb(css);
  return srgb === undefined
    ? undefined
    : { _tag: "Color", color: { r: srgb.r, g: srgb.g, b: srgb.b, a: srgb.alpha } };
}

/** Figma dimensions are unitless pixels. */
function dimensionLiteral(css: string): FloatValue | undefined {
  const px = cssLengthToPx(css);
  return px === undefined ? undefined : { _tag: "Float", value: px };
}

/** Figma binds one family, so the first family of a CSS font stack is the designed one. */
function fontFamilyLiteral(css: string): StringValue | undefined {
  const family = cssFirstFontFamily(css);
  return family === undefined ? undefined : { _tag: "String", value: family };
}

function unsupported(
  token: string,
  value: string,
  expected: string
): Result.Result<never, UnsupportedTokenValue> {
  return Result.fail(
    new UnsupportedTokenValue({
      message: `Token "${token}" has the value "${value}", but the Figma sync expects ${expected}.`,
      token,
      value,
    })
  );
}
