/**
 * How wide a flex item in a row is in CSS, set against the width its Figma layer draws. The item's
 * grow and shrink factors and its basis come from `flex` or its longhands (CSS Flexbox 1 §7.1). Its
 * flex base size, clamped by its limits and floored at its padding and borders, is its width before
 * the row grows or shrinks it (§9.2), and its factors and minimum decide whether the row can move it
 * from there (§9.7). A Figma layer keeps one width, so the build maps the room beside the item only
 * where CSS holds it at that width.
 */
import { borderBoxInsets } from "./box-insets";
import { evaluateLengthOf, normalizeCss, splitTopLevel } from "./css-values";
import type { LayerStyle } from "./layer-style";

/** A flex item's grow and shrink factors and its basis, as `flex` and its longhands set them. */
type FlexFactors = { readonly grow: number; readonly shrink: number; readonly basis: string };

/** The `flex` keywords, each a shorthand of all three (CSS Flexbox 1 §7.1.1). */
const FLEX_KEYWORDS: ReadonlyMap<string, FlexFactors> = new Map([
  ["none", { grow: 0, shrink: 0, basis: "auto" }],
  ["auto", { grow: 1, shrink: 1, basis: "auto" }],
  ["initial", { grow: 0, shrink: 1, basis: "auto" }],
]);

/** The CSS-wide keywords other than `initial`, whose value comes from elsewhere in the cascade. */
const CASCADED: ReadonlySet<string> = new Set(["inherit", "unset", "revert", "revert-layer"]);

/** A unitless number, which `flex` reads as a factor. */
const UNITLESS = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/**
 * A factor written as a plain number. A `calc()` or `var()` left in the value stays unread, since
 * the build would have to resolve it as CSS does to know which factor it sets.
 */
function factorOf(token: string | undefined): number | undefined {
  return token !== undefined && UNITLESS.test(token) ? Number(token) : undefined;
}

/**
 * A length in pixels: a literal, or a `calc()` of literals that evaluates to pixels. A percentage, a
 * `var()` left in the value, and a unitless number, which CSS takes as no length unless it is a
 * literal 0, stay unread, so `calc(16)` and `calc(0)` do.
 */
function lengthOf(value: string): number | undefined {
  const written = normalizeCss(value);
  if (written.includes("var(")) {
    return undefined;
  }
  const length = evaluateLengthOf(written, Number.NaN);
  return length === 0 && written.includes("(") && !/\d(?:px|rem)/.test(written) ? undefined : length;
}

/** Whether a flex basis is one the build reads: `auto`, `content` or a length in pixels. */
function readsBasis(basis: string): boolean {
  return basis === "auto" || basis === "content" || lengthOf(basis) !== undefined;
}

/**
 * Parse a `flex` value (CSS Flexbox 1 §7.1): `none`, `auto` or `initial`, or a grow factor with an
 * optional shrink factor after it, and a basis before or after the two. An omitted grow or shrink is
 * 1 and an omitted basis is 0, so `flex: 1` is `1 1 0` and `flex: 16px` is `1 1 16px`. A unitless
 * zero is a factor, and the basis only after two factors, so `0 0` sets no basis and `0 0 0` sets 0.
 *
 * @param written - The value, normalized.
 * @returns The factors and basis, or undefined for a value the grammar does not take.
 */
function parseFlex(written: string): FlexFactors | undefined {
  const keyword = FLEX_KEYWORDS.get(written);
  if (keyword !== undefined || CASCADED.has(written)) {
    return keyword;
  }
  const tokens = splitTopLevel(written, " ");
  const leading = factorOf(tokens[0]) === undefined ? tokens[0] : undefined;
  let at = leading === undefined ? 0 : 1;
  const grow = factorOf(tokens[at]);
  at += grow === undefined ? 0 : 1;
  const shrink = grow === undefined ? undefined : factorOf(tokens[at]);
  at += shrink === undefined ? 0 : 1;
  const trailing = leading === undefined ? tokens[at] : undefined;
  at += trailing === undefined ? 0 : 1;
  const basis = leading ?? trailing;
  // A unitless basis is a length only at 0.
  const unitless = factorOf(basis);
  if (
    at !== tokens.length ||
    (unitless !== undefined && unitless !== 0) ||
    (basis !== undefined && unitless === undefined && !readsBasis(basis))
  ) {
    return undefined;
  }
  if (grow === undefined) {
    return basis === undefined ? undefined : { grow: 1, shrink: 1, basis };
  }
  return grow < 0 || (shrink ?? 1) < 0 ? undefined : { grow, shrink: shrink ?? 1, basis: basis ?? "0" };
}

/**
 * Read a flex item's factors and basis. Unset, they are `0 1 auto`. The capture keeps the `flex`
 * shorthand as written beside any longhand and cannot tell which came later, so where both set one,
 * they must agree.
 *
 * @param style - The item's style.
 * @returns The factors, or undefined where they are unread.
 */
function readFlexFactors(style: LayerStyle): FlexFactors | undefined {
  const value = (property: string, initial: string) => normalizeCss(style.resolved(property) ?? initial);
  if (!style.has("flex")) {
    const grow = factorOf(value("flex-grow", "0"));
    const shrink = factorOf(value("flex-shrink", "1"));
    const basis = value("flex-basis", "auto");
    return grow === undefined || shrink === undefined || !readsBasis(basis)
      ? undefined
      : { grow, shrink, basis };
  }
  const factors = parseFlex(value("flex", ""));
  const agrees = (property: string, matches: (longhand: string) => boolean) =>
    !style.has(property) || matches(value(property, ""));
  return factors !== undefined &&
    agrees("flex-grow", (longhand) => factorOf(longhand) === factors.grow) &&
    agrees("flex-shrink", (longhand) => factorOf(longhand) === factors.shrink) &&
    agrees("flex-basis", (longhand) => longhand === factors.basis)
    ? factors
    : undefined;
}

/**
 * Whether a flex item neither grows nor shrinks from its `auto` basis, however `flex` or its
 * longhands spell that: `flex: none`, `flex: 0 0 auto` or `flex-shrink: 0` alone.
 *
 * @param style - The item's style.
 */
export function keepsOwnWidth(style: LayerStyle): boolean {
  const factors = readFlexFactors(style);
  return factors?.grow === 0 && factors.shrink === 0 && factors.basis === "auto";
}

/**
 * Whether a box's `flex` neither grows nor shrinks it from its own size, as `none` and `0 0 auto` do
 * (CSS Flexbox 1 §7.1.1), so the declaration has nothing for Figma to draw.
 *
 * @param style - The box's style.
 */
export function keepsOwnSize(style: LayerStyle): boolean {
  return style.has("flex") && keepsOwnWidth(style);
}

/**
 * The width a row's layer draws along it: its `width` as declared, or its content's where it sets
 * none, as an icon draws and a part draws before it maps, or the fixed width a frame part maps, its
 * limits folded in.
 */
export type DrawnWidth = { readonly kind: "declared" } | { readonly kind: "fixed"; readonly value: number };

/** A layer that draws its `width` as declared. */
export const DECLARED_WIDTH: DrawnWidth = { kind: "declared" };

/** The declarations that set a flex item's factors and basis. */
const FLEX_FACTORS = ["flex", "flex-grow", "flex-shrink", "flex-basis"] as const;

/** A declaration that can hold a flex item at its width, as {@link widthHeldBy} names it. */
export type HoldingDeclaration = (typeof FLEX_FACTORS)[number] | "min-width" | "max-width";

/**
 * The declarations that hold a flex item in a row at the width its layer draws, however much or
 * little room the row leaves. The item starts from its flex base size, its `flex-basis` where that
 * is a length and its `width` where the basis is `auto`. Its `max-width` and then its `min-width`
 * clamp that (CSS Flexbox 1 §9.2 and §9.7), and its border box is never narrower than its padding
 * and borders (CSS Box Sizing 3 §3). That must be the width the layer draws. A grow of 0 keeps it
 * from taking free space. A shrink of 0, or a `min-width` at least that wide, keeps it from giving
 * width back where the row overflows. An item that shrinks otherwise narrows to its automatic
 * minimum, its content's min-content width where that is smaller than its `width` (§4.5).
 * `fixed-icon.chromium.test.ts` measures these rules in Chromium.
 *
 * Every factor must be a plain number and every width, limit and basis a length in pixels, as
 * {@link lengthOf} reads it. A `calc()` CSS may read as another factor, a percentage or a `var()`
 * leaves the used width unknown. The exception is an item that sets no `width`, with no basis or
 * limit beside it, which keeps its content's width when it neither grows nor shrinks. Padding and
 * borders count inside the width only under `box-sizing: border-box`, as `borderBoxInsets` reads them.
 *
 * @param style - The item's style.
 * @param drawn - The width the item's layer draws.
 * @returns The declarations that hold the width: the item's flex declarations and each limit without
 *   which the clamped width would differ. Undefined where the item may take another width than the
 *   layer draws.
 */
export function widthHeldBy(style: LayerStyle, drawn: DrawnWidth): readonly HoldingDeclaration[] | undefined {
  const factors = readFlexFactors(style);
  if (factors?.grow !== 0) {
    return undefined;
  }
  // A limit that never moves the item reads as `none`, and one that is no length in pixels as undefined.
  const limit = (property: string, unset: readonly string[]): number | "none" | undefined => {
    const written = normalizeCss(style.resolved(property) ?? unset[0] ?? "");
    return unset.includes(written) ? "none" : lengthOf(written);
  };
  const minimum = limit("min-width", ["auto", "0", "0px"]);
  const maximum = limit("max-width", ["none"]);
  if (minimum === undefined || maximum === undefined) {
    return undefined;
  }
  const flex = FLEX_FACTORS.filter((property) => style.has(property));
  const width = style.resolved("width");
  const declared = width === undefined ? undefined : lengthOf(width);
  const basis =
    factors.basis === "auto" ? declared : factors.basis === "content" ? undefined : lengthOf(factors.basis);
  if (basis === undefined) {
    // The item keeps its content's width only with no width, basis or limit to move it.
    const keeps =
      factors.basis === "auto" &&
      drawn.kind === "declared" &&
      minimum === "none" &&
      maximum === "none" &&
      factors.shrink === 0 &&
      width === undefined;
    return keeps ? flex : undefined;
  }
  const insets = borderBoxInsets(style);
  if (insets === undefined) {
    return undefined;
  }
  const floor = minimum === "none" ? 0 : minimum;
  const ceiling = maximum === "none" ? Number.POSITIVE_INFINITY : maximum;
  const clamped = (low: number, high: number) => Math.max(insets, low, Math.min(high, basis));
  const used = clamped(floor, ceiling);
  const target = drawn.kind === "fixed" ? drawn.value : declared;
  if (used !== target || (factors.shrink !== 0 && floor < used)) {
    return undefined;
  }
  // A limit holds the width where the clamped width would differ without it, and a minimum where it
  // alone stops the item shrinking.
  const raises = floor > 0 && (factors.shrink !== 0 || clamped(0, ceiling) !== used);
  const lowers = ceiling !== Number.POSITIVE_INFINITY && clamped(floor, Number.POSITIVE_INFINITY) !== used;
  return [...flex, ...(raises ? (["min-width"] as const) : []), ...(lowers ? (["max-width"] as const) : [])];
}
