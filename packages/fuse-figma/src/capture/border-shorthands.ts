/**
 * The border shorthands as the longhands they set, by the one-to-four-value rule and the `border`
 * grammar (CSS Backgrounds 3 §4 and §5.1). The capture holds each value as written, before CSS
 * substitutes a `var()`, so this module also decides where a `var()` leaves the split unknown. Both
 * the cascade of a box, for a shorthand that wins only some of its longhands, and the cascade of a
 * pseudo-element, which splits every border shorthand, read the split here, so they agree on it.
 */
import { evaluateLength, evaluateLengthOf, normalizeCss, splitTopLevel } from "../components/css-values.ts";

/** The border width keywords, each above zero (CSS Backgrounds 3 §4.3). */
export const WIDTH_KEYWORDS: ReadonlyMap<string, number> = new Map([
  ["thin", 1],
  ["medium", 3],
  ["thick", 5],
]);

/** The border styles a `border` shorthand names (CSS Backgrounds 3 §4.2). */
export const BORDER_STYLES: ReadonlySet<string> = new Set([
  "none",
  "hidden",
  "dotted",
  "dashed",
  "solid",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
]);

/** The sides of a box, in the order a one-to-four-value shorthand names them. */
const SIDES = ["top", "right", "bottom", "left"] as const;

/** The values of a one-to-four-value shorthand for each side, top, right, bottom and left (CSS Backgrounds 3 §4). */
function perSide(values: readonly string[]): readonly string[] | undefined {
  const [top, right, bottom, left] = values;
  if (top === undefined || values.length > 4) {
    return undefined;
  }
  const across = right ?? top;
  return [top, across, bottom ?? top, left ?? across];
}

/**
 * The longhands of each four-sided border shorthand, in the order its values name them: top, right,
 * bottom and left, or the corners clockwise from the top left (CSS Backgrounds 3 §4 and §5.1).
 */
const FOUR_SIDED: ReadonlyMap<string, readonly string[]> = new Map([
  [
    "border-radius",
    [
      "border-top-left-radius",
      "border-top-right-radius",
      "border-bottom-right-radius",
      "border-bottom-left-radius",
    ],
  ],
  ...["width", "style", "color"].map((part): readonly [string, readonly string[]] => [
    `border-${part}`,
    SIDES.map((side) => `border-${side}-${part}`),
  ]),
]);

/**
 * The four-sided shorthands whose value can be one lone `var()` that each longhand takes whole, as
 * Tailwind's base `border-color: var(--color-gray-200, currentcolor)` is. A style or color longhand
 * reads only a style keyword or a color, so a `var()` that stands for several, or for no valid one,
 * reads as no style or color on every side. A width or radius longhand can read a value CSS draws
 * otherwise once it substitutes the `var()`, as CSS rejects a width of `12` with no unit and a
 * negative one, so those stay whole. A width splits where the caller resolves the `var()` to one
 * width, as {@link singleWidth} reads it.
 */
const LONE_VARIABLE: ReadonlySet<string> = new Set(["border-style", "border-color"]);

/**
 * Whether a value is one border width: a width keyword, or a non-negative length in pixels or a
 * unitless 0, with no percentage, which a border width does not take (CSS Backgrounds 3 §4.3).
 */
function singleWidth(value: string): boolean {
  const normalized = normalizeCss(value).toLowerCase();
  if (WIDTH_KEYWORDS.has(normalized)) {
    return true;
  }
  const px = normalized.includes("%") ? undefined : evaluateLengthOf(normalized, 0);
  return px !== undefined && px >= 0;
}

/**
 * The longhands a four-sided border shorthand sets: `border-width`, `border-style`, `border-color`
 * or `border-radius`.
 *
 * @param property - The property.
 * @returns The longhands in the order the shorthand's values name them, or undefined for any other
 *   property.
 */
export function fourSidedLonghands(property: string): readonly string[] | undefined {
  return FOUR_SIDED.get(property);
}

/**
 * A four-sided border shorthand's value for each of its longhands, by the one-to-four-value rule.
 * CSS substitutes a `var()` before it counts the values (CSS Variables 1 §3), so a `var()` among
 * several values can stand for any number of them and the split is unknown. A lone `var()` goes to
 * each longhand only where {@link LONE_VARIABLE} says the longhand's reader checks the value it
 * stands for, or, for `border-width`, where `resolved` is one width. A top-level `/` in `border-radius` separates its horizontal radii from its vertical
 * ones, which the rule does not split. Inside a function, as `rgb(0 0 0 / 50%)`, a `/` splits
 * nothing.
 *
 * @param property - The shorthand, as {@link fourSidedLonghands} names them.
 * @param value - Its value as written.
 * @param resolved - The value with its `var()`s substituted, or undefined where the caller does not
 *   resolve it.
 * @returns Each longhand and its value, or undefined for another property or a value whose split is
 *   unknown.
 */
export function fourSidedValues(
  property: string,
  value: string,
  resolved?: string
): readonly (readonly [string, string])[] | undefined {
  const longhands = FOUR_SIDED.get(property);
  const normalized = normalizeCss(value);
  const tokens = splitTopLevel(normalized, " ");
  const variable = normalized.includes("var(");
  if (
    longhands === undefined ||
    (property === "border-radius" && splitTopLevel(normalized, "/").length > 1) ||
    (variable &&
      (tokens.length > 1 ||
        !(
          LONE_VARIABLE.has(property) ||
          (property === "border-width" && resolved !== undefined && singleWidth(resolved))
        )))
  ) {
    return undefined;
  }
  const values = perSide(tokens);
  return values === undefined
    ? undefined
    : longhands.map((longhand, index) => [longhand, values[index] ?? ""] as const);
}

/**
 * A border shorthand as the longhands it sets, each side's width, style and color, with the initial
 * value for a part it leaves out: `medium`, `none` and `currentcolor` (CSS Backgrounds 3 §4). A
 * `border` or a side's shorthand names each part at most once, in any order. A pseudo-element draws
 * no corner, so `border-radius` stays whole.
 *
 * @param property - The property.
 * @param value - Its value as written.
 * @param resolved - The value with its `var()`s substituted, which {@link fourSidedValues} reads, or
 *   undefined where the caller does not resolve it.
 * @returns Each longhand and its value, or undefined for a property that is no border shorthand, and
 *   for one whose parts the build cannot tell apart, as a `var()` that stands for one of them, or
 *   whose four-sided split {@link fourSidedValues} leaves unknown.
 */
export function borderLonghands(
  property: string,
  value: string,
  resolved?: string
): readonly (readonly [string, string])[] | undefined {
  const side = /^border(?:-(top|right|bottom|left))?$/.exec(property);
  if (side === null) {
    return property === "border-radius" ? undefined : fourSidedValues(property, value, resolved);
  }
  let width: string | undefined;
  let lineStyle: string | undefined;
  let color: string | undefined;
  for (const token of splitTopLevel(normalizeCss(value), " ")) {
    const lower = token.toLowerCase();
    if (token.includes("var(")) {
      return undefined;
    }
    if (BORDER_STYLES.has(lower) && lineStyle === undefined) {
      lineStyle = lower;
    } else if ((evaluateLength(token) !== undefined || WIDTH_KEYWORDS.has(lower)) && width === undefined) {
      width = token;
    } else if (color === undefined) {
      color = token;
    } else {
      return undefined;
    }
  }
  const sides = side[1] === undefined ? SIDES : [side[1]];
  return sides.flatMap((each) => [
    [`border-${each}-width`, width ?? "medium"] as const,
    [`border-${each}-style`, lineStyle ?? "none"] as const,
    [`border-${each}-color`, color ?? "currentcolor"] as const,
  ]);
}
