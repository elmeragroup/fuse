/**
 * The padding and border lengths of a box along each axis, in pixels, as the box sizing and a flex
 * item's width proof read them, and two lengths across a box that hold one value in every mode, as
 * its margins do in `root-room.ts` and `placement.ts` and its padding in `hugging-rows.ts`.
 */
import type { Extent } from "./box-room";
import { affineLength, evaluateLength, normalizeCss } from "./css-values";
import type { VariableIndex } from "./css-values";
import type { LayerStyle } from "./layer-style";
import { horizontal } from "./subgrid-row";

/** The padding sides of each axis. */
export const SIDES = {
  horizontal: ["padding-left", "padding-right"],
  vertical: ["padding-top", "padding-bottom"],
} as const;

/**
 * A box's literal length in pixels, 0 where the box does not set it, or undefined where its value is
 * no literal length, such as a bound padding or a percentage.
 */
export function literalPixels(style: LayerStyle, property: string): number | undefined {
  const value = style.resolved(property);
  return value === undefined ? 0 : evaluateLength(value);
}

/**
 * A box's left and right margins together, in pixels, where each is the same length in every mode,
 * as {@link pixelsAcross} reads them.
 *
 * @param style - The box's style.
 * @param variables - The synced variables, with the values they hold in each mode.
 * @returns The margins in pixels, or undefined.
 */
export function marginsAcross(style: LayerStyle, variables: VariableIndex): number | undefined {
  return pixelsAcross(style, ["margin-left", "margin-right"], variables);
}

/**
 * Two lengths of a box together, in pixels, such as its left and right padding, where each is the
 * same length in every mode: a literal, or a sum of synced variables that each hold one value in
 * every mode, as `surface-pad-sm` holds 4px at both densities. Undefined where one is no such length.
 *
 * @param style - The box's style.
 * @param properties - The two properties, such as `padding-left` and `padding-right`.
 * @param variables - The synced variables, with the values they hold in each mode.
 * @returns The lengths in pixels, or undefined.
 */
export function pixelsAcross(
  style: LayerStyle,
  properties: readonly [string, string],
  variables: VariableIndex
): number | undefined {
  const sides = properties.map((property) => {
    const length = affineLength(style.resolved(property) ?? "0px");
    if (length === undefined) {
      return undefined;
    }
    let pixels = length.constant;
    for (const [name, coefficient] of length.coefficients) {
      const ref = variables.lookup(`var(${name})`);
      const least = ref === undefined ? undefined : variables.minimum(ref);
      if (ref === undefined || least === undefined || variables.maximum(ref) !== least) {
        return undefined;
      }
      pixels += coefficient * least;
    }
    return pixels;
  });
  return sides.every((side) => side !== undefined)
    ? sides.reduce<number>((sum, side) => sum + side, 0)
    : undefined;
}

/** The border sides of each axis, which `border-l` and its siblings set alone. */
const AXIS_BORDERS = {
  horizontal: ["border-left-width", "border-right-width"],
  vertical: ["border-top-width", "border-bottom-width"],
} as const;

/** The logical inline border sides, which `border-s` and `border-e` set alone. */
const INLINE_BORDERS = ["border-inline-start-width", "border-inline-end-width"] as const;

/** The logical shorthand of both inline border sides' widths, which `border-x` sets. */
const INLINE_BORDER = "border-inline-width";

/**
 * The pixels a box's borders take on one axis: each side's own width where the box sets one, as
 * `border-r` does, or `border-width` otherwise. A box that sets its borders across by their logical
 * inline sides instead, as `border-s` sets `border-inline-start-width`, takes those. A horizontal
 * writing mode puts them on the left and right in either direction (CSS Logical Properties 1 §4.1),
 * so their sum is the same.
 *
 * @returns The two sides' widths together, or undefined where one is no literal length. It is
 *   undefined too where the box sets a logical inline border in a vertical writing mode, or beside a
 *   physical side across, since the build reads neither that axis nor the cascade order between them.
 */
export function bordersOn(style: LayerStyle, axis: keyof Extent): number | undefined {
  const physical = (side: string) => literalPixels(style, style.has(side) ? side : "border-width");
  const inline = (side: string) =>
    literalPixels(style, style.has(side) ? side : style.has(INLINE_BORDER) ? INLINE_BORDER : "border-width");
  const logical = [...INLINE_BORDERS, INLINE_BORDER].some((property) => style.has(property));
  const sides = !logical
    ? AXIS_BORDERS[axis].map(physical)
    : !horizontal(style)
      ? [undefined]
      : axis === "vertical"
        ? AXIS_BORDERS.vertical.map(physical)
        : AXIS_BORDERS.horizontal.some((side) => style.has(side))
          ? [undefined]
          : INLINE_BORDERS.map(inline);
  return sides.some((side) => side === undefined)
    ? undefined
    : sides.reduce<number>((sum, side) => sum + (side ?? 0), 0);
}

/** The `border-style` values that draw no border, whose width then computes to 0 (CSS Backgrounds 3 §4.3). */
const NO_BORDER: ReadonlySet<string> = new Set(["none", "hidden"]);

/** The declarations that can set the style of a box's left or right border. */
const ACROSS_BORDER_STYLES = [
  "border-style",
  "border-left-style",
  "border-right-style",
  "border-inline-style",
  "border-inline-start-style",
  "border-inline-end-style",
] as const;

/**
 * The pixels a box's left and right borders draw: their widths where every style the box sets on
 * them draws a border, 0 where every one is `none` or `hidden`.
 *
 * @returns The pixels, or undefined where a width is no literal length, or where a border has a width
 *   and the box sets no style across, or styles that disagree.
 */
function drawnBorders(style: LayerStyle): number | undefined {
  const widths = bordersOn(style, "horizontal");
  if (widths === undefined || widths === 0) {
    return widths;
  }
  const styles = ACROSS_BORDER_STYLES.flatMap((property) =>
    normalizeCss(style.resolved(property) ?? "")
      .split(" ")
      .filter((value) => value !== "")
  );
  if (styles.length === 0) {
    return undefined;
  }
  const hidden = styles.filter((value) => NO_BORDER.has(value)).length;
  return hidden === styles.length ? 0 : hidden === 0 ? widths : undefined;
}

/**
 * The pixels a box's left and right padding and borders take together inside its `width`, which its
 * border box is never narrower than (CSS Box Sizing 3 §3). A box counts them so only under an
 * explicit `box-sizing: border-box`. Under any other value its padding and borders add to its
 * `width`, which the build does not compare, so it reads only a box that has none.
 *
 * @param style - The box's style.
 * @returns Their sum, or undefined where one is no literal length or the box sizes its content box
 *   around padding or borders.
 */
export function borderBoxInsets(style: LayerStyle): number | undefined {
  const sides = [...SIDES.horizontal.map((side) => literalPixels(style, side)), drawnBorders(style)];
  if (sides.some((side) => side === undefined)) {
    return undefined;
  }
  const insets = sides.reduce<number>((sum, side) => sum + (side ?? 0), 0);
  const borderBox = normalizeCss(style.resolved("box-sizing") ?? "") === "border-box";
  return insets === 0 || borderBox ? insets : undefined;
}
