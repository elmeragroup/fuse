/**
 * The Fuse token contract projected into Figma variables.
 *
 * Fuse themes vary on two axes, the theme slug and the color scheme. Figma resolves an
 * alias using the layer's mode for the target collection, so the two axes become two
 * collections that designers set independently on a frame.
 *
 * - `Fuse tokens` holds one variable per role token with a Light and a Dark mode. These are
 *   the variables designers bind; each one aliases its scheme's variable in `Fuse themes`.
 * - `Fuse themes` holds `light/<token>` and `dark/<token>` with one mode per theme slug.
 *   Its variables are hidden from the pickers because they only feed `Fuse tokens`.
 * - `Fuse primitives` holds the neutral ramp and brand accents in a single mode.
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
  LEGAL_THEMES,
  PRIMITIVE_NAMES,
  PRIMITIVES,
  themeSlug,
  TOKEN_KINDS,
  TOKEN_NAMES,
} from "@elmeragroup/fuse/theme-catalog";
import type { ResolvedColorScheme, TokenKind, TokenName } from "@elmeragroup/fuse/theme-catalog";

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

const PRIMITIVES_MODE = "Value";

const SCHEME_MODES = { light: "Light", dark: "Dark" } as const satisfies Record<ResolvedColorScheme, string>;

const SCHEMES = ["light", "dark"] as const satisfies readonly ResolvedColorScheme[];

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

  /** The pickers that offer a `Fuse tokens` variable of this kind. */
  readonly scopes: readonly VariableScope[];

  /** Read a literal CSS value, or return `undefined` when it is not in this kind's form. */
  readonly literal: (css: string) => LiteralValue | undefined;

  /** What the sync expects, for the message when `literal` refuses a value. */
  readonly expected: string;
};

const KIND_PROJECTIONS = {
  color: {
    type: "COLOR",
    scopes: ["ALL_SCOPES"],
    literal: colorLiteral,
    expected: "an oklch() or #rrggbb color",
  },
  dimension: {
    type: "FLOAT",
    scopes: ["CORNER_RADIUS"],
    literal: dimensionLiteral,
    expected: "a rem or px length",
  },
  fontFamily: {
    type: "STRING",
    scopes: ["FONT_FAMILY"],
    literal: fontFamilyLiteral,
    expected: "a font stack that starts with a named family",
  },
} as const satisfies Record<TokenKind, KindProjection>;

const primitiveNames: ReadonlySet<string> = new Set(PRIMITIVE_NAMES);
const tokenNames: ReadonlySet<string> = new Set(TOKEN_NAMES);

/**
 * Build the variable set for every legal theme in both color schemes.
 *
 * @returns The three Fuse collections. It fails on the first token value that has no Figma
 *   form, or on the variable set rule the projection breaks.
 */
export function fuseVariableSet(): Result.Result<
  VariableSet,
  UnsupportedTokenValue | InvalidVariableSet | AliasCycle
> {
  return Result.gen(function* () {
    const primitives = yield* primitivesCollection();
    const themes = yield* themesCollection();
    return yield* makeVariableSet([primitives, themes, tokensCollection()]);
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
        scopes: projection.scopes,
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
    }
    return { name: THEMES_COLLECTION, modes: LEGAL_THEMES.map(themeSlug), variables };
  });
}

function tokensCollection(): CollectionSpec {
  const variables = TOKEN_NAMES.map((token): VariableSpec => {
    const projection = KIND_PROJECTIONS[TOKEN_KINDS[token]];
    return {
      name: token,
      type: projection.type,
      scopes: projection.scopes,
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
function themeVariableName(scheme: ResolvedColorScheme, token: TokenName): string {
  return `${scheme}/${token}`;
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
