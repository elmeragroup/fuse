import * as CssColor from "@elmeragroup/color/css-color";
import { themeSlug } from "@elmeragroup/fuse/theme";
import type { ThemeInput, ThemeVariant } from "@elmeragroup/fuse/theme";

import { STUDIO_BASE_REFERENCES, STUDIO_PRIMITIVES } from "../../generated/studio-seeds";
import type { ArtboardScheme } from "./documents";
import { overrideOf, overridesFor, resetNames } from "./edits";
import type { StudioDocument, StudioOverrides, TokenOverrides } from "./edits";
import { referencedNames, referencesOf } from "./references";
import type { BaseReferences } from "./references";
import type { StudioSeed } from "./seed";
import { MAX_VALUE_LENGTH } from "./size-policy";
import { STUDIO_TOKEN_NAMES, TOKEN_TABLE, isLightOnly, isTokenName } from "./tokens";
import type { TokenKind, TokenName } from "./tokens";

export { referencedNames } from "./references";

const SINGLE_VAR = /^var\(\s*--([\w-]+)\s*\)$/u;

/** The custom property a value names when it is exactly one `var()`, such as `border`. */
export function aliasTarget(css: string): string | undefined {
  return SINGLE_VAR.exec(css.trim())?.[1];
}

/** A seed's declared CSS in each scheme, keyed by token name, as the closure and the export read it. */
export function declarationsOf(seed: StudioSeed) {
  const declared = (scheme: ArtboardScheme) =>
    Object.fromEntries(Object.entries(seed[scheme]).map(([name, token]) => [name, token.css]));
  return { light: declared("light"), dark: declared("dark") };
}

/**
 * A color routed through `color-mix(in lab)`: the same color, which Chromium serializes as
 * `lab()` once computed, whatever notation it was written in. `@elmeragroup/color` reads `lab()`,
 * so the studio reads every color the browser resolves through this one path.
 */
export function canonicalColorCss(css: string): string {
  return `color-mix(in lab, ${css}, ${css})`;
}

/** The CSS a token holds in `scheme`: the visitor's edit, else the base theme's declaration. */
export function currentCss(
  overrides: StudioOverrides,
  seed: StudioSeed | undefined,
  scheme: ArtboardScheme,
  name: TokenName
): string | undefined {
  return overrideOf(overrides, scheme, name) ?? seed?.[scheme][name].css;
}

/** Longer alias chains than this are treated as cycles. */
const MAX_HOPS = 16;

/**
 * The CSS at the end of a token's alias chain in `scheme`, following each `var()` that names
 * another token, so an alias such as `radius-button: var(--radius)` reads the radius in effect.
 * A chain that leaves the tokens, such as a `var()` naming a primitive, ends at that `var()`.
 *
 * @returns The literal, mix or foreign `var()` the chain ends at, or `undefined` while the seed
 *   loads or for a cycle.
 */
export function resolvedCss(
  overrides: StudioOverrides,
  seed: StudioSeed | undefined,
  scheme: ArtboardScheme,
  name: TokenName
): string | undefined {
  let css = currentCss(overrides, seed, scheme, name);
  for (let hop = 0; hop < MAX_HOPS && css !== undefined; hop += 1) {
    const target = aliasTarget(css);
    if (target === undefined || !isTokenName(target)) {
      return css;
    }
    css = currentCss(overrides, seed, scheme, target);
  }
  return undefined;
}

/** A CSS `<number>`: a sign, digits with a fraction or a fraction alone, and an exponent. */
const CSS_NUMBER = String.raw`[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?`;

const LENGTH = new RegExp(`^(${CSS_NUMBER})(px|rem)$`, "u");

/** A `px` or `rem` length in px at the 16px root, or `undefined` for anything else. */
export function lengthPx(css: string): number | undefined {
  const match = LENGTH.exec(css.trim());
  if (match === null) {
    return undefined;
  }
  const amount = Number(match[1]);
  return match[2] === "rem" ? amount * 16 : amount;
}

/** A px amount as the CSS a knob writes: whole px, or rem at the 16px root. */
export function formatLength(px: number, unit: "px" | "rem"): string {
  return unit === "px" ? `${String(px)}px` : `${String(px / 16)}rem`;
}

/** Why a value was refused. */
type Refusal = { readonly ok: false; readonly reason: string };

/** A value a token accepts, as the CSS to declare, or why it does not. */
export type ParsedValue = { readonly ok: true; readonly css: string } | Refusal;

const accept = (css: string): ParsedValue => ({ ok: true, css });
const refuse = (reason: string): Refusal => ({ ok: false, reason });

/**
 * No character that could end the declaration, open or close a block, or start markup, since a
 * value lands in an inline style and in the exported CSS.
 */
const SAFE_VALUE = /^[^;{}<>\\\n\r]+$/u;

const KIND_NAMES = {
  color: "color",
  dimension: "dimension",
  fontFamily: "font family",
  fontWeight: "font weight",
} as const satisfies Record<TokenKind, string>;

const PRIMITIVE_NAMES: ReadonlySet<string> = new Set(STUDIO_PRIMITIVES.map((primitive) => primitive.name));

/** `--radius-step` takes only the two values the corner formulas support (CONTEXT.md). */
export const RADIUS_STEPS = ["0px", "2px"] as const;

/** A CSS identifier without escapes, such as `Segoe` or `-apple-system`; never `123`. */
const IDENTIFIER = String.raw`(?:--|-?[\p{L}_])[\p{L}\p{N}_-]*`;

/**
 * One family: a quoted name of free text without quotes or backslashes, or identifiers between
 * spaces, such as `Segoe UI` or `ui-sans-serif`.
 */
const FAMILY = String.raw`(?:"[^"'\\]+"|'[^"'\\]+'|${IDENTIFIER}(?:\s+${IDENTIFIER})*)`;

const FONT_STACK = new RegExp(`^${FAMILY}(?:\\s*,\\s*${FAMILY})*$`, "u");

/** The names CSS reserves from an unquoted family, in any case: the CSS-wide keywords and `default`. */
const RESERVED_FAMILY_WORDS: ReadonlySet<string> = new Set([
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
  "default",
]);

const QUOTED_FAMILY = /"[^"'\\]+"|'[^"'\\]+'/gu;

/** Whether a stack {@link FONT_STACK} matches has an unquoted word CSS reserves. */
function hasReservedFamilyWord(css: string): boolean {
  return css
    .replace(QUOTED_FAMILY, ",")
    .split(/[\s,]+/u)
    .some((word) => RESERVED_FAMILY_WORDS.has(word.toLowerCase()));
}

const NUMBER = /^(?:\d+(?:\.\d+)?|\.\d+)$/u;

/** Whether `name` may read `target`: a token of its own kind, or a primitive for a color. */
function readsKnown(name: TokenName, target: string): boolean {
  const { kind } = TOKEN_TABLE[name];
  return isTokenName(target)
    ? TOKEN_TABLE[target].kind === kind
    : kind === "color" && PRIMITIVE_NAMES.has(target);
}

function refuseUnknown(name: TokenName, target: string): Refusal {
  return refuse(`--${target} is not a ${KIND_NAMES[TOKEN_TABLE[name].kind]} token`);
}

function parseAlias(name: TokenName, target: string): ParsedValue {
  if (target === name) {
    return refuse("A token cannot alias itself");
  }
  return readsKnown(name, target) ? accept(`var(--${target})`) : refuseUnknown(name, target);
}

const NOT_A_COLOR = "Not a color the studio can read";

const HAS_VAR = /var\(/iu;

const COLOR_MIX = /^color-mix\(/iu;

/** The rectangular spaces Chromium mixes in. */
const RECTANGULAR_SPACES: ReadonlySet<string> = new Set([
  "srgb",
  "srgb-linear",
  "display-p3",
  "a98-rgb",
  "prophoto-rgb",
  "rec2020",
  "lab",
  "oklab",
  "xyz",
  "xyz-d50",
  "xyz-d65",
]);

/** The polar spaces Chromium mixes in, which alone take a hue method. */
const POLAR_SPACES: ReadonlySet<string> = new Set(["hsl", "hwb", "lch", "oklch"]);

const INTERPOLATION = /^in\s+([\w-]+)(?:\s+(?:shorter|longer|increasing|decreasing)\s+(hue))?$/iu;

/** An operand and its optional trailing percentage, such as `var(--foreground) 5%`. */
const OPERAND = new RegExp(`^(.*?)(?:\\s+(${CSS_NUMBER})%)?$`, "su");

/** Whether the parenthesis `css` opens with closes at its last character, and none before. */
function closesAtEnd(css: string): boolean {
  let depth = 0;
  for (let index = 0; index < css.length; index += 1) {
    if (css[index] === "(") {
      depth += 1;
    } else if (css[index] === ")") {
      depth -= 1;
      if (depth === 0 && index !== css.length - 1) {
        return false;
      }
    }
  }
  return depth === 0;
}

/** `css` split at the commas outside any parentheses, each part trimmed. */
function topLevelParts(css: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < css.length; index += 1) {
    if (css[index] === "(") {
      depth += 1;
    } else if (css[index] === ")") {
      depth -= 1;
    } else if (css[index] === "," && depth === 0) {
      parts.push(css.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(css.slice(start).trim());
  return parts;
}

/** Why a mix's `in <space> [<hue-method> hue]` part is refused, or `undefined` when it reads. */
function interpolationRefusal(text: string): string | undefined {
  const match = INTERPOLATION.exec(text);
  const space = match?.[1]?.toLowerCase();
  if (match === null || space === undefined || !(RECTANGULAR_SPACES.has(space) || POLAR_SPACES.has(space))) {
    return "color-mix() starts with in and a color space, such as in oklch";
  }
  return match[2] !== undefined && !POLAR_SPACES.has(space)
    ? "Only hsl, hwb, lch and oklch take a hue method"
    : undefined;
}

/** One color of a mix, read: its percentage, if it has one, or why the mix refuses it. */
type MixOperand = { readonly ok: true; readonly percentage: number | undefined } | Refusal;

/**
 * One color of a mix: a `var()` without fallback naming a color token or a primitive other than
 * `name`, or a literal `@elmeragroup/color` reads, so no `currentcolor`, keyword or nested
 * function, whose color would depend on where it resolves.
 */
function parseOperand(name: TokenName, text: string): MixOperand {
  const match = OPERAND.exec(text);
  const color = match?.[1] ?? "";
  const percentage = match?.[2] === undefined ? undefined : Number(match[2]);
  const target = aliasTarget(color);
  if (target === name) {
    return refuse("A token cannot read itself");
  }
  if (target !== undefined && !readsKnown(name, target)) {
    return refuseUnknown(name, target);
  }
  if (target === undefined && CssColor.parse(color)._tag !== "ok") {
    return refuse("Each color in a mix is a var() without fallback or a color the studio reads");
  }
  return percentage === undefined || (percentage >= 0 && percentage <= 100)
    ? { ok: true, percentage }
    : refuse("A mix percentage is from 0% to 100%");
}

/**
 * A live color formula, kept as typed: a `color-mix()`, the one formula Fuse ships, such as the
 * theme's own `color-mix(in oklch, var(--secondary), var(--foreground) 5%)`. It is read here
 * rather than left to the browser, so restore and export never keep a mix the browser drops:
 *
 * `color-mix(in <space> [<hue-method> hue]?, <operand> [<percentage>]?, <operand> [<percentage>]?)`
 *
 * The panel measures its computed color through {@link canonicalColorCss}.
 */
function parseFormula(name: TokenName, css: string): ParsedValue {
  if (!COLOR_MIX.test(css)) {
    return refuse(HAS_VAR.test(css) ? "Only color-mix() may read another token" : NOT_A_COLOR);
  }
  if (!closesAtEnd(css)) {
    return refuse(NOT_A_COLOR);
  }
  const [interpolation = "", ...colors] = topLevelParts(css.slice(css.indexOf("(") + 1, -1));
  const space = interpolationRefusal(interpolation);
  if (space !== undefined) {
    return refuse(space);
  }
  if (colors.length !== 2) {
    return refuse("color-mix() mixes two colors");
  }
  let bothZero = true;
  for (const color of colors) {
    const operand = parseOperand(name, color);
    if (!operand.ok) {
      return operand;
    }
    bothZero &&= operand.percentage === 0;
  }
  return bothZero ? refuse("A mix needs a percentage above 0%") : accept(css);
}

function parseLiteral(name: TokenName, css: string): ParsedValue {
  switch (TOKEN_TABLE[name].kind) {
    case "color":
      if (HAS_VAR.test(css) || COLOR_MIX.test(css)) {
        return parseFormula(name, css);
      }
      return CssColor.parse(css)._tag === "ok" ? accept(css) : refuse(NOT_A_COLOR);
    case "dimension": {
      const px = lengthPx(css);
      return px !== undefined && px >= 0 ? accept(css) : refuse("Not a px or rem length");
    }
    case "fontFamily":
      if (!FONT_STACK.test(css)) {
        return refuse("Not a font stack: names, quoted or plain, between commas");
      }
      return hasReservedFamilyWord(css) ? refuse("Quote a family named like a CSS keyword") : accept(css);
    case "fontWeight": {
      const weight = Number(css);
      return NUMBER.test(css) && weight >= 1 && weight <= 1000
        ? accept(css)
        : refuse("Not a font weight from 1 to 1000");
    }
  }
}

/**
 * The one reading of a token value by the token's kind, shared by the knobs' commits and the
 * share codec's restore, so the studio never holds a value it could not have accepted:
 *
 * - a color is one `@elmeragroup/color` reads, a `var()` naming a color token or a primitive, or
 *   a `color-mix()` of two such colors (see {@link parseFormula}); no other function may hold a
 *   `var()`;
 * - a dimension is a non-negative px or rem length, and `--radius-step` only `0px` or `2px`;
 * - a font family is a stack of plain or quoted names, where a plain name holds no CSS-wide
 *   keyword and no `default`;
 * - a font weight is a number from 1 to 1000.
 *
 * An alias names a known token of the same kind, never the token itself. Whether it closes a
 * cycle depends on the other declarations; see {@link createsCycle}.
 *
 * @param name - The token the value is for.
 * @param text - The value as typed or stored.
 * @returns The trimmed CSS to declare, or why the token does not accept it.
 */
export function parseTokenValue(name: TokenName, text: string): ParsedValue {
  const css = text.trim();
  if (css === "") {
    return refuse("Enter a value");
  }
  if (css.length > MAX_VALUE_LENGTH) {
    return refuse(`Longer than ${String(MAX_VALUE_LENGTH)} characters`);
  }
  if (!SAFE_VALUE.test(css)) {
    return refuse("Holds a character a declaration cannot");
  }
  if (name === "radius-step") {
    return RADIUS_STEPS.some((step) => step === css) ? accept(css) : refuse("The radius step is 0px or 2px");
  }
  const target = aliasTarget(css);
  return target === undefined ? parseLiteral(name, css) : parseAlias(name, target);
}

const SCHEMES = ["light", "dark"] as const satisfies readonly ArtboardScheme[];

/** The tokens `name` reads in `scheme`: its edit's `var()`s, else its base declaration's. */
function readsOf(
  overrides: StudioOverrides,
  base: BaseReferences,
  scheme: ArtboardScheme,
  name: TokenName
): readonly string[] {
  const edit = overrideOf(overrides, scheme, name);
  return edit === undefined ? (base[scheme][name] ?? []) : referencedNames(edit);
}

/** Whether a walk from the properties in `start` reaches `name` through the declarations. */
function reaches(
  overrides: StudioOverrides,
  base: BaseReferences,
  scheme: ArtboardScheme,
  name: TokenName,
  start: readonly string[]
): boolean {
  const seen = new Set<string>();
  const pending = [...start];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (next === name) {
      return true;
    }
    if (!seen.has(next) && isTokenName(next)) {
      seen.add(next);
      pending.push(...readsOf(overrides, base, scheme, next));
    }
  }
  return false;
}

/**
 * The tokens on an alias cycle in either scheme's effective declarations: the base theme's, with
 * the edits over them. The browser drops every declaration on a cycle, so the session holds none.
 *
 * @param overrides - The edits in effect.
 * @param base - The base theme's alias graph.
 * @returns The names on a cycle, sorted, or none.
 */
export function cycleNames(overrides: StudioOverrides, base: BaseReferences): TokenName[] {
  return STUDIO_TOKEN_NAMES.filter((name) =>
    SCHEMES.some((scheme) => reaches(overrides, base, scheme, name, readsOf(overrides, base, scheme, name)))
  ).sort();
}

/** The generated alias graph of `variant` of `theme`. */
function variantReferences(theme: ThemeInput, variant: ThemeVariant): BaseReferences {
  return STUDIO_BASE_REFERENCES[themeSlug({ ...theme, variant })];
}

/**
 * The tokens on an alias cycle in a document, against its own theme's generated alias graph, so
 * it answers before the theme's seed loads. The edit session refuses every transition to a
 * document where this is not empty, and the share codec drops such a document. A page whose
 * artboards pin variants of the theme passes them as `pins`, and their graphs count too.
 *
 * @param document - The base theme and the edits over it.
 * @param pins - The variants of the theme the page's artboards pin.
 */
export function documentCycles(document: StudioDocument, pins: readonly ThemeVariant[] = []): TokenName[] {
  const variants = new Set([document.theme.variant, ...pins]);
  const names = new Set(
    [...variants].flatMap((variant) =>
      cycleNames(document.overrides, variantReferences(document.theme, variant))
    )
  );
  return [...names].sort();
}

/** The edits a pinned artboard applies in one scheme, and the ones it skips. */
export type PinnedEdits = {
  readonly applied: TokenOverrides;
  /** Sorted. */
  readonly skipped: readonly TokenName[];
};

/**
 * The edits an artboard pinned to `variant` of the document's theme applies in `scheme`: every
 * edit but those on an alias cycle against that variant's own declarations. The session guards
 * the pins of the page it is on, so such an edit arrives from another page or a restore. A
 * skipped token falls back to the variant's own declaration, which can loop another edit, so
 * the check repeats until nothing loops.
 *
 * @param document - The base theme and the edits over it.
 * @param variant - The variant the artboard pins.
 * @param scheme - The artboard's scheme.
 */
export function pinnedEdits(
  document: StudioDocument,
  variant: ThemeVariant,
  scheme: ArtboardScheme
): PinnedEdits {
  const base = variantReferences(document.theme, variant);
  const looping = (overrides: StudioOverrides) =>
    STUDIO_TOKEN_NAMES.filter(
      (name) =>
        overrideOf(overrides, scheme, name) !== undefined &&
        reaches(overrides, base, scheme, name, readsOf(overrides, base, scheme, name))
    );
  let overrides = document.overrides;
  const skipped: TokenName[] = [];
  for (let next = looping(overrides); next.length > 0; next = looping(overrides)) {
    skipped.push(...next);
    overrides = resetNames(overrides, scheme, next);
  }
  return { applied: overridesFor(overrides, scheme), skipped: skipped.sort() };
}

const NO_REFERENCES: BaseReferences = { light: {}, dark: {} };

const seedReferences = new WeakMap<StudioSeed, BaseReferences>();

function baseOf(seed: StudioSeed | undefined): BaseReferences {
  if (seed === undefined) {
    return NO_REFERENCES;
  }
  const known = seedReferences.get(seed);
  if (known !== undefined) {
    return known;
  }
  const references = referencesOf(seed);
  seedReferences.set(seed, references);
  return references;
}

/**
 * Whether declaring `css` for `name` would close a cycle in the effective declarations, the
 * base theme's with the edits over them, so the browser would drop every token on it. A
 * light-only token's edit applies in both schemes, so both are checked.
 *
 * @param overrides - The edits in effect.
 * @param seed - The base theme's declarations, `undefined` while they load.
 * @param scheme - The scheme the edit is made in.
 * @param name - The token the edit is for.
 * @param css - The value it would declare.
 */
export function createsCycle(
  overrides: StudioOverrides,
  seed: StudioSeed | undefined,
  scheme: ArtboardScheme,
  name: TokenName,
  css: string
): boolean {
  const schemes: readonly ArtboardScheme[] = isLightOnly(name) ? SCHEMES : [scheme];
  const base = baseOf(seed);
  return schemes.some((each) => reaches(overrides, base, each, name, referencedNames(css)));
}

/**
 * Whether declaring `css` for `name` would close a cycle in a variant of `theme` that the page's
 * artboards pin, against that variant's generated alias graph, as {@link createsCycle} checks
 * the base theme.
 *
 * @param overrides - The edits in effect.
 * @param theme - The base theme.
 * @param pins - The variants of it the page pins.
 * @param scheme - The scheme the edit is made in.
 * @param name - The token the edit is for.
 * @param css - The value it would declare.
 */
export function createsPinnedCycle(
  overrides: StudioOverrides,
  theme: ThemeInput,
  pins: readonly ThemeVariant[],
  scheme: ArtboardScheme,
  name: TokenName,
  css: string
): boolean {
  const schemes: readonly ArtboardScheme[] = isLightOnly(name) ? SCHEMES : [scheme];
  return pins.some((variant) => {
    const base = variantReferences(theme, variant);
    return schemes.some((each) => reaches(overrides, base, each, name, referencedNames(css)));
  });
}
