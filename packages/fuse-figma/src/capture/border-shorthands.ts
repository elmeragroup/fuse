/**
 * The border shorthands as the longhands they set, by the one-to-four-value rule and the `border`
 * grammar (CSS Backgrounds 3 §4 and §5.1). The capture holds each value as written, before CSS
 * substitutes a `var()`, so this module also decides where a `var()` leaves the split unknown. Both
 * the cascade of a box, for a shorthand that wins only some of its longhands, and the cascade of a
 * pseudo-element, which splits every physical border shorthand, read the split here, so they agree on
 * it.
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
 * A border width's length in pixels: a non-negative length, or a unitless 0, with no percentage,
 * which a border width does not take (CSS Backgrounds 3 §4.3). CSS rejects any other number, as a
 * `var()` that substitutes `12` with no unit, so a reader that converts a width checks it here first.
 *
 * @param value - A value with no `var()` left in it.
 * @returns The pixels, or undefined for a width keyword or a value that is no border width.
 */
export function borderWidthLength(value: string): number | undefined {
  const normalized = normalizeCss(value).toLowerCase();
  const px = normalized.includes("%") ? undefined : evaluateLengthOf(normalized, 0);
  return px !== undefined && px >= 0 ? px : undefined;
}

/** Whether a value is one border width: a width keyword, or a length {@link borderWidthLength} reads. */
function singleWidth(value: string): boolean {
  return WIDTH_KEYWORDS.has(normalizeCss(value).toLowerCase()) || borderWidthLength(value) !== undefined;
}

/** Whether a value, once the caller resolves its `var()`s, is one border width. */
function resolvesToOneWidth(resolve: (() => string | undefined) | undefined): boolean {
  const resolved = resolve?.();
  return resolved !== undefined && singleWidth(resolved);
}

/**
 * What a four-sided border shorthand sets where it wins only some of its longhands: each of those
 * longhands alone, with its part of the value. A segmented Toggle group item's `rounded-none` loses
 * its outer corners to the later `first:rounded-l-md`, and an outline item's `border` loses its left
 * width to `border-l-0`, so the item sets those corners and sides one by one, as Chromium draws them.
 * `border-color` stays whole, since `box-paint.ts` reads each side's color from the declaration the
 * capture records as winning it.
 *
 * @param property - The property.
 * @param value - Its value as written.
 * @param wins - The physical longhands the declaration wins, as the capture records them.
 * @returns The won longhands and their values, or undefined for a declaration that wins every
 *   longhand it sets, for any other property, and for a value whose split {@link fourSidedValues}
 *   leaves unknown, which stays whole and leaves the corners or sides it wins unmapped.
 */
export function wonLonghands(
  property: string,
  value: string,
  wins: readonly string[]
): readonly { readonly property: string; readonly value: string }[] | undefined {
  const longhands = property === "border-color" ? undefined : FOUR_SIDED.get(property);
  const partial =
    longhands !== undefined &&
    wins.length < longhands.length &&
    wins.every((longhand) => longhands.includes(longhand));
  const values = partial ? fourSidedValues(property, value) : undefined;
  return values?.flatMap(([longhand, part]) =>
    wins.includes(longhand) ? [{ property: longhand, value: part }] : []
  );
}

/**
 * A four-sided border shorthand's value for each of its longhands, by the one-to-four-value rule.
 * CSS substitutes a `var()` before it counts the values (CSS Variables 1 §3), so a `var()` among
 * several values can stand for any number of them and the split is unknown. A lone `var()` goes to
 * each longhand only where {@link LONE_VARIABLE} says the longhand's reader checks the value it
 * stands for, or, for `border-width`, where `resolve` gives one width. A top-level `/` in
 * `border-radius` separates its horizontal radii from its vertical ones, which the rule does not
 * split. Inside a function, as `rgb(0 0 0 / 50%)`, a `/` splits nothing.
 *
 * @param property - A four-sided border shorthand: `border-width`, `border-style`, `border-color` or
 *   `border-radius`.
 * @param value - Its value as written.
 * @param resolve - The value with its `var()`s substituted, which the split asks for only for a
 *   `border-width` that is one `var()`, or undefined where the caller does not resolve it.
 * @returns Each longhand and its value, or undefined for another property or a value whose split is
 *   unknown.
 */
function fourSidedValues(
  property: string,
  value: string,
  resolve?: () => string | undefined
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
        !(LONE_VARIABLE.has(property) || (property === "border-width" && resolvesToOneWidth(resolve)))))
  ) {
    return undefined;
  }
  const values = perSide(tokens);
  return values === undefined
    ? undefined
    : longhands.map((longhand, index) => [longhand, values[index] ?? ""] as const);
}

/**
 * The physical sides an axis's border shorthand sets, start then end, on the kit's left-to-right,
 * horizontal page (CSS Logical Properties 1 §4): the inline axis the left and right, the block axis
 * the top and bottom. A box that lays out otherwise leaves its sides unmapped (`logical-sides.ts`),
 * and a pseudo-element's cascade keeps an axis's shorthand whole (`withBorderLonghands`).
 */
const AXIS_SIDES = {
  inline: ["left", "right"],
  block: ["top", "bottom"],
} as const satisfies Record<string, readonly [string, string]>;

/**
 * An axis shorthand of one part, as `border-inline-width: 0` sets both inline sides: one value for
 * both sides, or the start side's and the end side's (CSS Logical Properties 1 §4.4). Undefined for a
 * `var()`, which can stand for either count, a third value, or a width that is no border width.
 */
function axisValues(
  sides: readonly [string, string],
  part: string,
  value: string
): readonly (readonly [string, string])[] | undefined {
  const [start, second, ...rest] = splitTopLevel(normalizeCss(value), " ");
  const end = second ?? start;
  if (
    start === undefined ||
    end === undefined ||
    rest.length > 0 ||
    value.includes("var(") ||
    (part === "width" && !(singleWidth(start) && singleWidth(end)))
  ) {
    return undefined;
  }
  return [
    [`border-${sides[0]}-${part}`, start],
    [`border-${sides[1]}-${part}`, end],
  ];
}

/**
 * A border shorthand as the longhands it sets, each side's width, style and color, with the initial
 * value for a part it leaves out: `medium`, `none` and `currentcolor` (CSS Backgrounds 3 §4). A
 * `border`, a side's or an axis's shorthand names each part at most once, in any order. An axis's
 * shorthand of one part, as `border-inline-width`, splits as {@link axisValues} says. A pseudo-element
 * draws no corner, so `border-radius` stays whole.
 *
 * @param property - The property.
 * @param value - Its value as written.
 * @param resolve - The value with its `var()`s substituted, which {@link fourSidedValues} asks
 *   for, or undefined where the caller does not resolve it.
 * @returns Each longhand and its value, or undefined for a property that is no border shorthand, and
 *   for one whose parts the build cannot tell apart, as a `var()` that stands for one of them, one
 *   that names a number CSS takes as no width, as `12` with no unit, or one whose four-sided split
 *   {@link fourSidedValues} leaves unknown.
 */
export function borderLonghands(
  property: string,
  value: string,
  resolve?: () => string | undefined
): readonly (readonly [string, string])[] | undefined {
  const axis = /^border-(inline|block)(?:-(width|style|color))?$/.exec(property);
  const across =
    axis?.[1] === "inline" ? AXIS_SIDES.inline : axis?.[1] === "block" ? AXIS_SIDES.block : undefined;
  if (across !== undefined && axis?.[2] !== undefined) {
    return axisValues(across, axis[2], value);
  }
  const side = /^border(?:-(top|right|bottom|left))?$/.exec(property);
  if (side === null && across === undefined) {
    return property === "border-radius" ? undefined : fourSidedValues(property, value, resolve);
  }
  let width: string | undefined;
  let lineStyle: string | undefined;
  let color: string | undefined;
  for (const token of splitTopLevel(normalizeCss(value), " ")) {
    const lower = token.toLowerCase();
    // A number that is no border width, as `12` with no unit, leaves the shorthand invalid.
    if (token.includes("var(") || (evaluateLength(token) !== undefined && !singleWidth(token))) {
      return undefined;
    }
    if (BORDER_STYLES.has(lower) && lineStyle === undefined) {
      lineStyle = lower;
    } else if (singleWidth(token) && width === undefined) {
      width = token;
    } else if (color === undefined) {
      color = token;
    } else {
      return undefined;
    }
  }
  const sides = across ?? (side?.[1] === undefined ? SIDES : [side[1]]);
  return sides.flatMap((each) => [
    [`border-${each}-width`, width ?? "medium"] as const,
    [`border-${each}-style`, lineStyle ?? "none"] as const,
    [`border-${each}-color`, color ?? "currentcolor"] as const,
  ]);
}
