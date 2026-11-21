/**
 * The padding and border lengths of a box along each axis, in pixels, as the box sizing and a flex
 * item's width proof read them.
 */
import type { Extent } from "./box-sizing";
import { evaluateLength, normalizeCss } from "./css-values";
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
  const sides = axisBorders(style, axis)?.widths;
  return sides === undefined || sides.some((side) => side === undefined)
    ? undefined
    : sides.reduce<number>((sum, side) => sum + (side ?? 0), 0);
}

/**
 * A box's two border widths on one axis, as {@link bordersOn} reads them, in the order of the
 * declarations that set them: top then bottom, left then right, or inline start then end where the
 * box sets its borders across by their logical sides. Undefined where `bordersOn` reads no axis.
 */
function axisBorders(
  style: LayerStyle,
  axis: keyof Extent
): { readonly widths: readonly (number | undefined)[]; readonly inline: boolean } | undefined {
  const physical = (side: string) => literalPixels(style, style.has(side) ? side : "border-width");
  const inline = (side: string) =>
    literalPixels(style, style.has(side) ? side : style.has(INLINE_BORDER) ? INLINE_BORDER : "border-width");
  const logical = [...INLINE_BORDERS, INLINE_BORDER].some((property) => style.has(property));
  if (!logical) {
    return { widths: AXIS_BORDERS[axis].map(physical), inline: false };
  }
  if (
    !horizontal(style) ||
    (axis === "horizontal" && AXIS_BORDERS.horizontal.some((side) => style.has(side)))
  ) {
    return undefined;
  }
  return axis === "vertical"
    ? { widths: AXIS_BORDERS.vertical.map(physical), inline: false }
    : { widths: INLINE_BORDERS.map(inline), inline: true };
}

/** A physical side of a box. */
export type Side = "top" | "right" | "bottom" | "left";

/**
 * The pixels a box's border on one side takes, as {@link bordersOn} counts it, the box sizing
 * included. A logical inline border counts on the side a left-to-right box puts it on, the inline
 * start on the left (CSS Logical Properties 1 §4).
 *
 * @param style - The box's style.
 * @param side - The side.
 * @returns The width, or undefined where `bordersOn` reads none on that axis, a width is no literal
 *   length, or a logical inline border sits in a box whose `direction` is other than `ltr`.
 */
export function borderOn(style: LayerStyle, side: Side): number | undefined {
  const axis = side === "top" || side === "bottom" ? "vertical" : "horizontal";
  const read = axisBorders(style, axis);
  const direction = normalizeCss(style.resolved("direction") ?? "ltr");
  if (read === undefined || (read.inline && direction !== "ltr")) {
    return undefined;
  }
  return read.widths[side === "top" || side === "left" ? 0 : 1];
}

/** The `border-style` values that draw a border, so the border takes its width (CSS Backgrounds 3 §3.2). */
const DRAWN_BORDERS: ReadonlySet<string> = new Set([
  "solid",
  "dashed",
  "dotted",
  "double",
  "groove",
  "ridge",
  "inset",
  "outset",
]);

/** The declarations that can set the style of each side's border in a left-to-right box. */
const SIDE_STYLES = {
  top: ["border-style", "border-top-style", "border-block-style", "border-block-start-style"],
  right: ["border-style", "border-right-style", "border-inline-style", "border-inline-end-style"],
  bottom: ["border-style", "border-bottom-style", "border-block-style", "border-block-end-style"],
  left: ["border-style", "border-left-style", "border-inline-style", "border-inline-start-style"],
} as const satisfies Record<Side, readonly string[]>;

/**
 * The pixels a box's border on one side draws, where the box sizing counts the same: its width
 * ({@link borderOn}) where every style the box sets on that side draws a border, or 0 for a side of
 * no width. A side that has a width beside a style of `none` or `hidden` draws none (CSS Backgrounds
 * 3 §4.3), while the box sizing still counts the width, so the box drawn and the box CSS lays out
 * differ there, and the reader leaves it unread.
 *
 * @param style - The box's style.
 * @param side - The side.
 * @returns The width, or undefined where {@link borderOn} reads none, or where a side with a width
 *   sets no style, a style that draws none, a style the reader cannot split by side, or styles that
 *   disagree, since the build keeps each declaration whole and loses their cascade order.
 */
export function drawnBorderOn(style: LayerStyle, side: Side): number | undefined {
  const width = borderOn(style, side);
  if (width === undefined || width === 0) {
    return width;
  }
  // The logical styles fall on these sides only in a horizontal, left-to-right box.
  const leftToRight = horizontal(style) && normalizeCss(style.resolved("direction") ?? "ltr") === "ltr";
  const logical = SIDE_STYLES[side].slice(2).some((property) => style.has(property));
  const styles = SIDE_STYLES[side].flatMap((property) => {
    const value = style.resolved(property);
    return value === undefined ? [] : [normalizeCss(value)];
  });
  return (leftToRight || !logical) &&
    styles.length > 0 &&
    styles.every((value) => value === styles[0] && DRAWN_BORDERS.has(value))
    ? width
    : undefined;
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
