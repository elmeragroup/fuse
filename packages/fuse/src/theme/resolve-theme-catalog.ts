/**
 * The theme catalog resolved for design tools: every legal theme in both color schemes, the
 * primitives and the density metrics, with each custom property's CSS, its web code syntax,
 * the one `var()` hop it takes, and the literal at the end of its chain as a design-tool
 * value. Exporters, such as the Figma sync and the docs DTCG export, read this tree instead of
 * parsing CSS values, so every CSS reader stays private to this module.
 *
 * Token values are fuse source, not caller input, so a value the resolver cannot read is a
 * defect in a token module and throws.
 */

import * as CssColor from "@elmeragroup/color/css-color";
import type { Srgb } from "@elmeragroup/color/srgb";

import type { ResolvedColorScheme } from "./color-scheme-types";
import { composeTheme } from "./compose-theme";
import { cssFirstFontFamily, cssLengthToPx, cssVarReference, remToPx } from "./css-values";
import { defaultDensityForVariant, densityAttributes } from "./density";
import type { Density, DensityAttributes } from "./density";
import { themeAttributes } from "./theme-attributes";
import type { ThemeAttributes } from "./theme-attributes";
import { readTokenColor } from "./token-color";
import { TOKEN_KINDS, TOKEN_NAMES } from "./tokens/contract";
import type { TokenContract, TokenKind, TokenName } from "./tokens/contract";
import { DENSITY_METRIC_FAMILIES, DENSITY_METRICS } from "./tokens/density-metrics";
import type { DensityMetricKind, DensityMetricName } from "./tokens/density-metrics";
import { PRIMITIVE_NAMES, PRIMITIVES } from "./tokens/primitives";
import type { PrimitiveName } from "./tokens/primitives";
import { RADIUS_RUNG_NAMES, RADIUS_RUNGS } from "./tokens/radius-scale";
import type { RadiusRungName } from "./tokens/radius-scale";
import { LEGAL_THEMES, themeSlug } from "./tokens/themes";
import type { ThemeInput, ThemeSlug } from "./tokens/themes";

/** The design-tool value each token kind resolves to. Dimensions are px at the 16px root. */
type LiteralByKind = {
  readonly color: Srgb;
  readonly dimension: number;
  readonly fontFamily: string;
};

/** The kind the contract gives a token. */
type KindOf<Name extends TokenName> = (typeof TOKEN_KINDS)[Name];

/** A `var()` that names a primitive, such as `var(--brand-fkas)`. */
export type PrimitiveReference = {
  /** The primitives, which hold one value in every theme and scheme. */
  readonly space: "primitive";

  /** The primitive the `var()` names. */
  readonly name: PrimitiveName;
};

/** A `var()` that names a role token, which resolves in the same theme and scheme. */
export type TokenReference = {
  /** The role tokens of the entry's own theme and scheme. */
  readonly space: "token";

  /** The token the `var()` names. */
  readonly name: TokenName;
};

/** The one custom property a `var()` names. */
export type Reference = PrimitiveReference | TokenReference;

/** One resolved custom property. */
type Entry<Name extends string, Kind extends TokenKind, Ref extends Reference> = {
  /** The custom property without its leading dashes. */
  readonly name: Name;

  /** What the value holds, which decides how exporters translate it. */
  readonly kind: Kind;

  /** The value exactly as `composeTheme`, `PRIMITIVES` or `fuse.css` declares it. */
  readonly css: string;

  /** The CSS a developer pastes: `var(--name)`, or a radius rung's `calc()`. */
  readonly codeSyntax: string;

  /** The property `css` names when it is a single `var()`, one hop only; otherwise `undefined`. */
  readonly reference: Ref | undefined;

  /** The literal at the end of the reference chain, in the same theme and scheme. */
  readonly value: LiteralByKind[Kind];
};

/**
 * A resolved role token. The union is distributive by name, so narrowing `kind` narrows
 * `value`, and narrowing `name` narrows `kind`.
 *
 * @template N - The token names to include, every token by default.
 */
export type TokenEntry<N extends TokenName = TokenName> = {
  [K in N]: Entry<K, KindOf<K>, Reference>;
}[N];

/**
 * A resolved primitive. Every primitive is a color, and it can reference only another
 * primitive.
 *
 * @template N - The primitive names to include, every primitive by default.
 */
export type PrimitiveEntry<N extends PrimitiveName = PrimitiveName> = {
  [K in N]: Entry<K, "color", PrimitiveReference>;
}[N];

/**
 * A resolved radius rung. Its value is the px `fuse.css` computes from the theme's `radius`
 * and `radius-step`, clamped at 0 as CSS clamps a negative `border-radius`. A rung never
 * references anything, even `radius-lg`, whose `css` is `var(--radius)`, because design
 * tools hold its computed length.
 *
 * @template N - The rung names to include, every rung by default.
 */
export type RungEntry<N extends RadiusRungName = RadiusRungName> = {
  [K in N]: Entry<K, "dimension", never>;
}[N];

/** Any resolved entry, distributive by kind, so `switch (entry.kind)` narrows `entry.value`. */
export type AnyEntry = TokenEntry | PrimitiveEntry | RungEntry;

/** One theme's role tokens and radius rungs in one color scheme. */
export type ResolvedScheme = {
  /** Every role token, in `TOKEN_NAMES` order. */
  readonly tokens: { readonly [N in TokenName]: TokenEntry<N> };

  /** Every radius rung, in `fuse.css` order, including the unused `radius-popover`. */
  readonly rungs: { readonly [N in RadiusRungName]: RungEntry<N> };
};

/** One legal theme, with what describes it and its values in both color schemes. */
export type ResolvedTheme = {
  /** The theme's slug, such as `external-fkas-private`. */
  readonly slug: ThemeSlug;

  /** The theme's variant, brand and segment. */
  readonly input: ThemeInput;

  /** The density the theme's variant deploys with. */
  readonly defaultDensity: Density;

  /** The document attributes that select the theme: `data-theme-*`, then `data-density`. */
  readonly attributes: ThemeAttributes & DensityAttributes;

  /** The theme's tokens and rungs per color scheme, light first. */
  readonly schemes: { readonly [S in ResolvedColorScheme]: ResolvedScheme };
};

/** One density control metric, which is independent of the theme and the scheme. */
export type DensityMetricEntry = {
  /** The custom property without its leading dashes, such as `control-h-md`. */
  readonly name: DensityMetricName;

  /** The box or type property the metric sets. */
  readonly metricKind: DensityMetricKind;

  /** The CSS a developer pastes, such as `var(--control-h-md)`. */
  readonly codeSyntax: string;

  /** The metric in px per density, at the 16px root. */
  readonly px: { readonly [D in Density]: number };
};

/** Every legal theme in both color schemes, the primitives and the density metrics. */
export type ResolvedThemeCatalog = {
  /** Every primitive, in `PRIMITIVE_NAMES` order. */
  readonly primitives: { readonly [N in PrimitiveName]: PrimitiveEntry<N> };

  /** Every legal theme, in `LEGAL_THEMES` order. The pin table always admits one. */
  readonly themes: readonly [ResolvedTheme, ...ResolvedTheme[]];

  /** Every control metric, in `fuse.css` order. */
  readonly density: readonly DensityMetricEntry[];
};

/**
 * Every legal theme in both colour schemes, the primitives and the density metrics, with each
 * value resolved for design tools. Pure: every call resolves afresh (no memo, no freeze).
 *
 * @returns The resolved catalog, with every record and list in source order.
 * @throws Error on a fuse defect, never caller input:
 *   - an unreadable literal
 *   - a `var()` naming an unknown property
 *   - a primitive that references a token
 *   - a reference whose target has another kind
 *   - a reference cycle
 *   - a theme table with no legal theme
 *   The message names the slug, scheme, token and value. A `composeTheme` failure passes
 *   through unchanged.
 */
export function resolveThemeCatalog(): ResolvedThemeCatalog {
  const [first, ...rest] = LEGAL_THEMES;
  if (first === undefined) {
    // LEGAL_THEMES is a flatMap over the brand pin table, so its type cannot say non-empty.
    throw new Error("The theme catalog found no legal theme, a defect in Fuse's theme table.");
  }
  const primitives = resolvePrimitives();
  const resolve = (theme: ThemeInput): ResolvedTheme => resolveTheme(theme, primitives);
  return {
    primitives,
    themes: [resolve(first), ...rest.map(resolve)],
    density: DENSITY_METRIC_FAMILIES.flatMap(({ kind, metrics }) =>
      metrics.map((name) => densityEntry(name, kind))
    ),
  };
}

/** Where a value is declared, for the message a defect throws with. */
type Site = {
  /** The declaring scope, such as `primitive` or `token in external-fkas-private (dark)`. */
  readonly scope: string;

  /** The custom property without its leading dashes. */
  readonly name: string;

  /** The value as declared. */
  readonly css: string;
};

/** The error a fuse defect throws, naming where the value is declared and why it fails. */
function defect(site: Site, reason: string): Error {
  return new Error(
    `The theme catalog cannot resolve ${site.scope} "${site.name}", declared as ${JSON.stringify(site.css)}: ${reason}.`
  );
}

/** The reason a reader refuses a value, worded the way the color parser words its own. */
function expected(form: string, css: string): string {
  return `Expected ${form}, received ${JSON.stringify(css)}`;
}

/** A reader for each kind's literals, which throws a defect for a value not in its form. */
type LiteralReaders = { readonly [K in TokenKind]: (css: string, site: Site) => LiteralByKind[K] };

const LITERAL_READERS: LiteralReaders = {
  color: (css, site) => {
    // Token modules write oklch() or #rrggbb, and composition refuses any other notation.
    const color = readTokenColor(css);
    if (color._tag === "err") {
      throw defect(site, color.error.message);
    }
    return CssColor.toSrgb(color.value);
  },
  dimension: (css, site) => {
    const length = cssLengthToPx(css);
    if (length === undefined) {
      throw defect(site, expected("a rem or px length", css));
    }
    return length;
  },
  fontFamily: (css, site) => {
    // Design tools bind one family, so the first family of a stack is the designed one.
    const family = cssFirstFontFamily(css);
    if (family === undefined) {
      throw defect(site, expected("a font stack that starts with a named family", css));
    }
    return family;
  },
};

const PRIMITIVE_NAME_SET: ReadonlySet<string> = new Set(PRIMITIVE_NAMES);

function isPrimitiveName(name: string): name is PrimitiveName {
  return PRIMITIVE_NAME_SET.has(name);
}

function isTokenName(name: string): name is TokenName {
  return Object.hasOwn(TOKEN_KINDS, name);
}

/** The property a single `var()` names, or `undefined` for a literal. */
function referenceIn(site: Site): Reference | undefined {
  const target = cssVarReference(site.css);
  if (target === undefined) {
    return undefined;
  }
  if (isPrimitiveName(target)) {
    return { space: "primitive", name: target };
  }
  if (isTokenName(target)) {
    return { space: "token", name: target };
  }
  throw defect(site, `--${target} is neither a token nor a primitive`);
}

/** An entry before its type correlates the name with its kind and value. */
type UncorrelatedEntry = {
  readonly name: string;
  readonly kind: TokenKind;
  readonly css: string;
  readonly codeSyntax: string;
  readonly reference: Reference | undefined;
  readonly value: LiteralByKind[TokenKind];
};

/** The names a reference into `space` can take. */
type NameIn<S extends Reference["space"]> = Extract<Reference, { readonly space: S }>["name"];

/** A reference out of `space` into the other one. */
type ReferenceOutside<S extends Reference["space"]> = Exclude<Reference, { readonly space: S }>;

/**
 * The entries of one scope in `names` order, such as one theme's tokens in one scheme. A
 * reference into the scope's own `space` resolves within the scope: an entry resolves the
 * entries its reference chain reaches first, each once, and a name met again while its own
 * chain resolves is a cycle. `foreignTarget` answers a reference into the other space.
 *
 * @template S - The space the scope's names belong to.
 * @template E - The correlated entry union the scope holds.
 */
function resolveScope<S extends Reference["space"], E extends AnyEntry>(
  space: S,
  names: readonly NameIn<S>[],
  siteOf: (name: NameIn<S>) => Site,
  kindOf: (name: NameIn<S>) => TokenKind,
  foreignTarget: (reference: ReferenceOutside<S>, site: Site) => UncorrelatedEntry
): ReadonlyMap<NameIn<S>, E> {
  const resolved = new Map<NameIn<S>, E>();
  const resolving = new Set<NameIn<S>>();
  const targetOf = (reference: Reference, site: Site): UncorrelatedEntry =>
    reference.space === space
      ? // SAFETY: a reference whose space is `space` is the `Reference` member tagged S, so its
        // name is a NameIn<S>. TypeScript does not narrow a union by a generic tag.
        entryOf(reference.name as NameIn<S>)
      : // SAFETY: every other reference is a member not tagged S, which ReferenceOutside<S>
        // names. TypeScript does not narrow a union by a generic tag.
        foreignTarget(reference as ReferenceOutside<S>, site);
  const entryOf = (name: NameIn<S>): E => {
    const known = resolved.get(name);
    if (known !== undefined) {
      return known;
    }
    const site = siteOf(name);
    if (resolving.has(name)) {
      throw defect(site, "its reference chain is a cycle");
    }
    resolving.add(name);
    const entry = resolveEntry<E>(site, kindOf(name), (reference) => targetOf(reference, site));
    resolving.delete(name);
    resolved.set(name, entry);
    return entry;
  };
  return new Map(names.map((name) => [name, entryOf(name)]));
}

/** A record of every name's entry, with its keys in `names` order. */
function recordOf<N extends string, E extends { readonly name: N }>(
  names: readonly N[],
  entries: ReadonlyMap<N, E>
): { readonly [K in N]: Extract<E, { readonly name: K }> } {
  // SAFETY: each key is written with the entry resolved for that same name, and every entry
  // carries its own name, so Extract selects exactly the value stored under the key.
  // Object.fromEntries cannot express that correlation.
  return Object.fromEntries(names.map((name) => [name, entries.get(name)])) as {
    readonly [K in N]: Extract<E, { readonly name: K }>;
  };
}

/**
 * Correlate an entry's name with its kind and value once the resolver has checked them.
 *
 * @template E - The correlated entry union the entry belongs to.
 */
function correlated<E extends AnyEntry>(entry: UncorrelatedEntry): E {
  // SAFETY: the resolver takes `kind` from the contract for `name`, and `value` either comes
  // from the reader for that kind or is copied from a reference target whose kind it checked
  // is the same. TypeScript cannot correlate those three fields across a lookup.
  return entry as E;
}

/** The value of a single `var()`'s target, after checking that the target has `kind`. */
function referencedValue(
  site: Site,
  kind: TokenKind,
  reference: Reference,
  target: UncorrelatedEntry
): LiteralByKind[TokenKind] {
  if (target.kind !== kind) {
    throw defect(
      site,
      `it is a ${kind} that references the ${target.kind} ${reference.space} ${reference.name}`
    );
  }
  return target.value;
}

/**
 * One entry of a scope: a literal read by its kind's reader, or a single `var()` whose value is
 * copied from the target `targetOf` finds, after checking the target has the same kind.
 *
 * @template E - The correlated entry union the entry belongs to.
 */
function resolveEntry<E extends AnyEntry>(
  site: Site,
  kind: TokenKind,
  targetOf: (reference: Reference) => UncorrelatedEntry
): E {
  const reference = referenceIn(site);
  const value =
    reference === undefined
      ? LITERAL_READERS[kind](site.css, site)
      : referencedValue(site, kind, reference, targetOf(reference));
  return correlated({
    name: site.name,
    kind,
    css: site.css,
    codeSyntax: `var(--${site.name})`,
    reference,
    value,
  });
}

function resolvePrimitives(): ResolvedThemeCatalog["primitives"] {
  const entries = resolveScope<"primitive", PrimitiveEntry>(
    "primitive",
    PRIMITIVE_NAMES,
    (name) => ({ scope: "primitive", name, css: PRIMITIVES[name] }),
    () => "color",
    (reference, site) => {
      throw defect(site, `a primitive cannot reference the token ${reference.name}`);
    }
  );
  return recordOf(PRIMITIVE_NAMES, entries);
}

function resolveTheme(input: ThemeInput, primitives: ResolvedThemeCatalog["primitives"]): ResolvedTheme {
  const slug = themeSlug(input);
  const defaultDensity = defaultDensityForVariant(input.variant);
  const scheme = (colorScheme: ResolvedColorScheme): ResolvedScheme =>
    resolveScheme(composeTheme(input, colorScheme), `${slug} (${colorScheme})`, primitives);
  return {
    slug,
    input,
    defaultDensity,
    attributes: { ...themeAttributes(input), ...densityAttributes(defaultDensity) },
    schemes: { light: scheme("light"), dark: scheme("dark") },
  };
}

/**
 * One composed theme in one scheme. A token reference resolves in the same composition, as
 * CSS resolves `var(--role)` against the element's own scope.
 */
function resolveScheme(
  composed: TokenContract,
  where: string,
  primitives: ResolvedThemeCatalog["primitives"]
): ResolvedScheme {
  const entries = resolveScope<"token", TokenEntry>(
    "token",
    TOKEN_NAMES,
    (name) => ({ scope: `token in ${where}`, name, css: composed[name] }),
    (name) => TOKEN_KINDS[name],
    (reference) => primitives[reference.name]
  );
  const tokens = recordOf(TOKEN_NAMES, entries);
  return { tokens, rungs: resolveRungs(tokens.radius.value, tokens["radius-step"].value) };
}

/** Every radius rung in px, from a theme's `radius` and `radius-step` in px. */
function resolveRungs(radius: number, step: number): ResolvedScheme["rungs"] {
  const rungs = new Map(
    RADIUS_RUNG_NAMES.map((name): [RadiusRungName, RungEntry] => {
      const { steps, css } = RADIUS_RUNGS[name];
      const value = Math.max(0, radius + steps * step);
      return [name, { name, kind: "dimension", css, codeSyntax: css, reference: undefined, value }];
    })
  );
  return recordOf(RADIUS_RUNG_NAMES, rungs);
}

function densityEntry(name: DensityMetricName, metricKind: DensityMetricKind): DensityMetricEntry {
  const rem = DENSITY_METRICS[name];
  return {
    name,
    metricKind,
    codeSyntax: `var(--${name})`,
    px: { dense: remToPx(rem.dense), comfortable: remToPx(rem.comfortable) },
  };
}
