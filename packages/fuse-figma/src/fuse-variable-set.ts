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

import { Result, Schema } from "effect";

import * as CssColor from "@elmeragroup/color/css-color";
import type { InvalidColor } from "@elmeragroup/color/css-color";
import * as ColorEffect from "@elmeragroup/color/effect";
import {
  composeTheme,
  cssFirstFontFamily,
  cssLengthToPx,
  cssVarReference,
  DENSITY_METRIC_FAMILIES,
  DENSITY_METRICS,
  LEGAL_THEMES,
  PRIMITIVE_NAMES,
  PRIMITIVES,
  RADIUS_RUNG_NAMES,
  RADIUS_RUNGS,
  remToPx,
  themeSlug,
  TOKEN_KINDS,
  TOKEN_NAMES,
} from "@elmeragroup/fuse/theme-catalog";
import type {
  Density,
  DensityMetricKind,
  RadiusRungName,
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

/** A token value the projection has no Figma form for. */
export class UnsupportedTokenValue extends Schema.TaggedError<UnsupportedTokenValue>()(
  "UnsupportedTokenValue",
  {
    message: Schema.String,
    token: Schema.String,
    value: Schema.String,
  }
) {}

/** A value the sync's own readers refuse, with what they expected instead. */
type Unreadable = { readonly _tag: "Unreadable"; readonly expected: string };

/** Why the sync cannot read a token value. `unsupportedTokenValue` words each one. */
type ReadFailure = InvalidColor | Unreadable;

/** How one kind of token becomes a Figma variable. */
type KindProjection = {
  readonly type: VariableType;

  /** Read a literal CSS value, or fail with the reason the `UnsupportedTokenValue` reports. */
  readonly literal: (css: string) => Result.Result<LiteralValue, ReadFailure>;
};

const KIND_PROJECTIONS = {
  color: { type: "COLOR", literal: colorLiteral },
  dimension: { type: "FLOAT", literal: dimensionLiteral },
  fontFamily: { type: "STRING", literal: fontFamilyLiteral },
} as const satisfies Record<TokenKind, KindProjection>;

/** The tokens of the dimension kind. */
type DimensionTokenName = {
  [Name in TokenName]: (typeof TOKEN_KINDS)[Name] extends "dimension" ? Name : never;
}[TokenName];

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

function isDimensionToken(token: TokenName): token is DimensionTokenName {
  return TOKEN_KINDS[token] === "dimension";
}

/** The pickers that offer a contract token's `Fuse tokens` variable. */
function tokenScopes(token: TokenName): readonly VariableScope[] {
  return isDimensionToken(token) ? DIMENSION_SCOPES[token] : KIND_SCOPES[TOKEN_KINDS[token]];
}

/** Resolves the name inside a `var(--name)` reference to the variable it aliases. */
type ReferenceResolver = (name: string) => AliasValue | undefined;

/**
 * One variable designers bind in `Fuse tokens`. `Fuse themes` holds its value per theme as
 * `light/<name>` and `dark/<name>`, and the `Fuse tokens` variable aliases those.
 */
type BoundVariable = {
  readonly name: string;
  readonly type: VariableType;

  /** The pickers that offer the `Fuse tokens` variable. */
  readonly scopes: readonly VariableScope[];

  /** The CSS a developer pastes. Every `var()` in it names a property the shipped CSS defines. */
  readonly webSyntax: string;

  /**
   * The Figma value in one composed theme. `reference` turns a `var()` into an alias in the
   * same scheme.
   */
  readonly valueIn: (
    tokens: TokenContract,
    reference: ReferenceResolver
  ) => Result.Result<VariableValue, UnsupportedTokenValue>;
};

function contractVariable(token: TokenName): BoundVariable {
  const projection = KIND_PROJECTIONS[TOKEN_KINDS[token]];
  return {
    name: token,
    type: projection.type,
    scopes: tokenScopes(token),
    webSyntax: `var(--${token})`,
    valueIn: (tokens, reference) => tokenValue(token, tokens[token], projection, reference),
  };
}

/**
 * A radius rung as a pixel value per theme. Figma variables cannot compute, so the sync does
 * the `calc()` from `fuse.css` with the theme's `radius` and `radius-step`. CSS clamps a
 * negative `border-radius` to 0, so a rung below zero becomes 0, the radius a layer shows.
 *
 * The code syntax is the `calc()` itself, the CSS value in `RADIUS_RUNGS` that `fuse.css`
 * declares. `fuse.css` declares the rungs in `@theme inline`, so Tailwind inlines them into
 * its utilities and the built CSS does not define `--radius-sm` and most other rungs as
 * custom properties.
 */
function radiusRungVariable(rung: RadiusRungName): BoundVariable {
  const { steps, css } = RADIUS_RUNGS[rung];
  const projection = KIND_PROJECTIONS.dimension;
  return {
    name: rung,
    type: projection.type,
    scopes: ["CORNER_RADIUS"],
    webSyntax: css,
    valueIn: (tokens) =>
      Result.gen(function* () {
        const radius = yield* lengthInPx("radius", tokens.radius, rung);
        const step = yield* lengthInPx("radius-step", tokens["radius-step"], rung);
        const value: FloatValue = { _tag: "Float", value: Math.max(0, radius + steps * step) };
        return value;
      }),
  };
}

/** A length token in pixels, or the failure that names the rung that needs it. */
function lengthInPx(
  token: TokenName,
  css: string,
  rung: RadiusRungName
): Result.Result<number, UnsupportedTokenValue> {
  const px = cssLengthToPx(css);
  return px === undefined
    ? unsupported(token, css, unreadable(`a rem or px length to derive ${rung} from`))
    : Result.succeed(px);
}

/**
 * Every `Fuse tokens` variable. The sync leaves out `radius-popover` because no component
 * uses it. Fuse popups use `radius-md`, so a designer who binds `radius-popover` to a popover
 * gets a radius the code never renders. `TODO.md` tracks removing the rung from `fuse.css`.
 */
const BOUND_VARIABLES: readonly BoundVariable[] = [
  ...TOKEN_NAMES.map(contractVariable),
  ...RADIUS_RUNG_NAMES.filter((rung) => rung !== "radius-popover").map(radiusRungVariable),
];

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
    return yield* makeVariableSet([primitives, themes, tokensCollection(), densityCollection()]);
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
      for (const bound of BOUND_VARIABLES) {
        const values = new Map<string, VariableValue>();
        for (const [slug, tokens] of composed) {
          values.set(slug, yield* bound.valueIn(tokens, reference));
        }
        // Only designers' pickers read scopes; these variables are reached through aliases.
        variables.push({
          name: themeVariableName(scheme, bound.name),
          type: bound.type,
          scopes: [],
          webSyntax: undefined,
          values,
        });
      }
    }
    return { name: THEMES_COLLECTION, modes: LEGAL_THEMES.map(themeSlug), variables };
  });
}

function tokensCollection(): CollectionSpec {
  const variables = BOUND_VARIABLES.map((bound): VariableSpec => ({
    name: bound.name,
    type: bound.type,
    scopes: bound.scopes,
    webSyntax: bound.webSyntax,
    values: new Map(
      SCHEMES.map((scheme) => [SCHEME_MODES[scheme], themeAlias(themeVariableName(scheme, bound.name))])
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
function densityCollection(): CollectionSpec {
  const projection = KIND_PROJECTIONS.dimension;
  const variables = DENSITY_METRIC_FAMILIES.flatMap(({ kind, metrics }) =>
    metrics.map((name): VariableSpec => ({
      name,
      type: projection.type,
      scopes: DENSITY_SCOPES[kind],
      webSyntax: `var(--${name})`,
      values: new Map<string, VariableValue>(
        DENSITIES.map((density) => [
          DENSITY_MODES[density],
          { _tag: "Float", value: remToPx(DENSITY_METRICS[name][density]) },
        ])
      ),
    }))
  );
  return { name: DENSITY_COLLECTION, modes: DENSITIES.map((density) => DENSITY_MODES[density]), variables };
}

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
    if (tokenNames.has(name)) {
      return themeAlias(themeVariableName(scheme, name));
    }
    return undefined;
  };
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
      ? unsupported(token, css, unreadable("a reference to a Fuse token or primitive"))
      : Result.succeed(alias);
  }
  return Result.mapError(projection.literal(css), (failure) => unsupportedTokenValue(token, css, failure));
}

function colorLiteral(css: string): Result.Result<ColorValue, InvalidColor> {
  return Result.map(ColorEffect.toResult(CssColor.parse(css)), (color): ColorValue => {
    const srgb = CssColor.toSrgb(color);
    return { _tag: "Color", color: { r: srgb.r, g: srgb.g, b: srgb.b, a: srgb.alpha } };
  });
}

/** Figma dimensions are unitless pixels. */
function dimensionLiteral(css: string): Result.Result<FloatValue, Unreadable> {
  const px = cssLengthToPx(css);
  return px === undefined
    ? Result.fail(unreadable("a rem or px length"))
    : Result.succeed({ _tag: "Float", value: px });
}

/** Figma binds one family, so the first family of a CSS font stack is the designed one. */
function fontFamilyLiteral(css: string): Result.Result<StringValue, Unreadable> {
  const family = cssFirstFontFamily(css);
  return family === undefined
    ? Result.fail(unreadable("a font stack that starts with a named family"))
    : Result.succeed({ _tag: "String", value: family });
}

function unreadable(expected: string): Unreadable {
  return { _tag: "Unreadable", expected };
}

/**
 * The one place that words a failure. The color parser's message already says what it reads
 * and quotes the value, so it passes through as-is. The sync's own readers word theirs the
 * same way.
 */
function unsupportedTokenValue(token: string, value: string, failure: ReadFailure): UnsupportedTokenValue {
  const reason =
    failure._tag === "InvalidColor"
      ? failure.message
      : `Expected ${failure.expected}, received ${JSON.stringify(value)}`;
  return new UnsupportedTokenValue({
    message: `The Figma sync cannot read token "${token}": ${reason}.`,
    token,
    value,
  });
}

function unsupported(
  token: string,
  value: string,
  failure: ReadFailure
): Result.Result<never, UnsupportedTokenValue> {
  return Result.fail(unsupportedTokenValue(token, value, failure));
}
