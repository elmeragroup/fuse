/**
 * The height bounds and least width of a mapped layer in every mode: the least and greatest height
 * a row compares its layers by, the least width a layer keeps however narrow its room, whether a
 * filling layer fits its room, and a box's least content width. `box-mapping.ts`, `box-flow.ts`
 * and `clipped-shadows.ts` read them, and `figma:probe` adds a frame's width with `widthAround`.
 */

import { bordersOn, SIDES } from "./box-insets";
import { usedLength } from "./box-limits";
import type { Holder } from "./box-room";
import { readNumber } from "./css-values";
import type { VariableIndex } from "./css-values";
import { outOfLayout, strokeRoom } from "./kit-spec";
import type {
  BoxSpec,
  ChildLayerSpec,
  GridSpec,
  LimitsSpec,
  NumberSpec,
  RotationSpec,
  TextLayerSpec,
} from "./kit-spec";

/**
 * The least and the greatest height in pixels a mapped layer draws at, in every mode and with every
 * text its properties can set, or no greatest where one is unknown.
 */
export type HeightBounds = { readonly min: number; readonly max: number | undefined };

/** A height this module cannot bound: a fill, a layer turned on its side, or an unknown variable. */
const UNBOUNDED: HeightBounds = { min: 0, max: undefined };

const NO_HEIGHT: HeightBounds = { min: 0, max: 0 };

/**
 * A length's bounds: its value where literal, and where a variable sets it, the least and the greatest
 * value the variable holds across its modes, with no least or greatest where the index knows none.
 */
function lengthBounds(length: NumberSpec, variables: VariableIndex): HeightBounds {
  return length.kind === "literal"
    ? { min: length.value, max: length.value }
    : { min: variables.minimum(length.variable) ?? 0, max: variables.maximum(length.variable) };
}

function sum(bounds: readonly HeightBounds[]): HeightBounds {
  return bounds.reduce(
    (total, next) => ({
      min: total.min + next.min,
      max: total.max === undefined || next.max === undefined ? undefined : total.max + next.max,
    }),
    NO_HEIGHT
  );
}

function times(bounds: HeightBounds, least: number, most: number): HeightBounds {
  return { min: bounds.min * least, max: bounds.max === undefined ? undefined : bounds.max * most };
}

/**
 * The height bounds of a mapped layer, as a row compares its layers before it stretches one across
 * its height. A fixed height is its length. A text sets at least one line, and at most one where it
 * hugs a width nothing caps, or as many as its truncation keeps; a percent line is that share of the
 * font size. A hugging box is its padding, its in-layout stroke and its layers in flow: their sum and
 * gaps in a column, the tallest in a row, within its limits. A layer a property can hide draws no
 * height at least. A bound length spans the values its variable holds across its modes. A fill, a
 * layer turned a quarter and a variable the index knows no values of leave the greatest height
 * unknown.
 *
 * @param layer - The layer, or undefined for none, whose height is unknown.
 * @param variables - The synced variables, whose values across their modes bound a bound length.
 * @returns The layer's height bounds.
 */
export function heightBounds(layer: ChildLayerSpec | undefined, variables: VariableIndex): HeightBounds {
  if (layer === undefined) {
    return UNBOUNDED;
  }
  if (layer.kind === "icon") {
    const own = lengthBounds(layer.size, variables);
    return layer.visibleProperty === undefined ? own : { min: 0, max: own.max };
  }
  if (layer.kind === "text") {
    const { sizing, lineHeight, maxWidth, truncation } = layer;
    if (sizing.vertical.kind === "fixed") {
      return lengthBounds(sizing.vertical.length, variables);
    }
    // A percent line height is that share of the font size in each mode (PH).
    const line =
      lineHeight.kind === "percent"
        ? times(lengthBounds(layer.fontSize, variables), lineHeight.value / 100, lineHeight.value / 100)
        : lengthBounds(lineHeight, variables);
    const lines = sizing.horizontal.kind === "hug" && maxWidth === undefined ? 1 : truncation?.maxLines;
    return {
      min: line.min,
      max: lines === undefined || line.max === undefined ? undefined : line.max * lines,
    };
  }
  if (layer.kind === "instance") {
    // A hugging instance takes the inner variant's height, which this spec does not hold.
    const { vertical } = layer.sizing;
    const own = vertical.kind === "fixed" ? lengthBounds(vertical.length, variables) : UNBOUNDED;
    return layer.visibleProperty === undefined ? own : { min: 0, max: own.max };
  }
  if (layer.rotation !== undefined && layer.rotation % 180 !== 0) {
    return UNBOUNDED;
  }
  const own = boxHeightBounds(layer, variables);
  return layer.visibleProperty === undefined ? own : { min: 0, max: own.max };
}

/**
 * The height bounds of a mapped box, as {@link heightBounds} says for a box layer. A grid stacks its
 * rows, each as tall as its tallest layer, with its row gap between them.
 *
 * @param box - The box.
 * @param variables - The synced variables, whose values across their modes bound a bound length.
 * @returns The box's height bounds.
 */
export function boxHeightBounds(box: BoxSpec, variables: VariableIndex): HeightBounds {
  const { vertical } = box.sizing;
  if (vertical.kind !== "hug") {
    return vertical.kind === "fixed" ? lengthBounds(vertical.length, variables) : UNBOUNDED;
  }
  const flowing = box.children.filter((child) => !outOfLayout(child));
  const heights = flowing.map((child) => heightBounds(child, variables));
  const shown = flowing.filter(
    (child) => (child.kind !== "frame" && child.kind !== "icon") || child.visibleProperty === undefined
  );
  const gaps = times(
    lengthBounds(box.itemSpacing, variables),
    Math.max(0, shown.length - 1),
    Math.max(0, flowing.length - 1)
  );
  const layers =
    box.grid !== undefined
      ? gridHeight(box.grid, flowing, heights, variables)
      : box.direction === "VERTICAL"
        ? sum([...heights, gaps])
        : tallest(heights);
  const hugged = sum([
    lengthBounds(box.paddingTop, variables),
    layers,
    lengthBounds(box.paddingBottom, variables),
    lengthBounds(strokeRoom(box.stroke, "top"), variables),
    lengthBounds(strokeRoom(box.stroke, "bottom"), variables),
  ]);
  return withinLimits(hugged, box.limits, variables);
}

/**
 * The least width a box that hugs its width takes in any mode, within its `min-width` and
 * `max-width`: its padding across, a bound padding at the least value its variable holds, and the
 * room its stroke takes on each side. A text a designer types counts no width, since the kit cannot
 * measure it, so a box whose text the designer empties can shrink to this width.
 *
 * @param box - The box.
 * @param variables - The synced variables, whose least values bound a bound length.
 * @returns The width in pixels.
 */
export function leastHugWidth(box: BoxSpec, variables: VariableIndex): number {
  const hugged = sum([
    lengthBounds(box.paddingLeft, variables),
    lengthBounds(box.paddingRight, variables),
    lengthBounds(strokeRoom(box.stroke, "left"), variables),
    lengthBounds(strokeRoom(box.stroke, "right"), variables),
  ]).min;
  const { minWidth, maxWidth } = box.limits;
  return usedLength(
    hugged,
    minWidth === undefined ? undefined : lengthBounds(minWidth, variables).min,
    maxWidth === undefined ? undefined : lengthBounds(maxWidth, variables).min
  );
}

/** The bounds of a grid's rows, each its tallest layer, stacked with the row gap between them. */
function gridHeight(
  grid: GridSpec,
  flowing: readonly ChildLayerSpec[],
  heights: readonly HeightBounds[],
  variables: VariableIndex
): HeightBounds {
  const rows = grid.rows.map((_row, row) =>
    tallest(
      flowing.flatMap((child, index) =>
        grid.cells.find((cell) => cell.key === child.key)?.row === row ? [heights[index] ?? UNBOUNDED] : []
      )
    )
  );
  return sum([...rows, times(lengthBounds(grid.rowGap, variables), rows.length - 1, rows.length - 1)]);
}

/** The bounds of the tallest of a row's layers. */
function tallest(bounds: readonly HeightBounds[]): HeightBounds {
  return bounds.reduce(
    (most, next) => ({
      min: Math.max(most.min, next.min),
      max: most.max === undefined || next.max === undefined ? undefined : Math.max(most.max, next.max),
    }),
    NO_HEIGHT
  );
}

/**
 * The greatest least width a mapped layer keeps in any mode, however narrow the room it fills: the
 * width its own lengths and minimums hold it at, as a block's min-content width does (CSS Sizing 3
 * §5.1). An icon is its size, and a fixed layer its length. A frame is at least its minimum, and
 * where it does not have a fixed width, its horizontal padding and stroke around its layers in flow,
 * their sum and gaps in a row, the widest in a column. A text that wraps at any width it fills keeps
 * none here; its longest word is a limit the fill does not keep. A text that does not wrap keeps its
 * line's width, which is unknown. A bound length takes the greatest value its variable holds across
 * its modes.
 *
 * @param layer - The layer.
 * @param variables - The synced variables, whose greatest values bound a bound length.
 * @returns The least width in pixels, or undefined where a length's greatest value, a text that does
 *   not wrap, a hugging instance's width, a grid's columns or a quarter-turned frame's width is
 *   unknown.
 */
export function leastWidth(layer: ChildLayerSpec, variables: VariableIndex): number | undefined {
  const greatest = (length: NumberSpec) => lengthBounds(length, variables).max;
  if (layer.kind === "icon") {
    return greatest(layer.size);
  }
  const { horizontal } = layer.sizing;
  if (horizontal.kind === "fixed") {
    const own = greatest(horizontal.length);
    const minimum = layer.kind === "frame" ? layer.limits.minWidth : undefined;
    const least = minimum === undefined ? 0 : greatest(minimum);
    return own === undefined || least === undefined ? undefined : Math.max(own, least);
  }
  if (layer.kind === "text") {
    return wrapsAnywhere(layer) ? 0 : undefined;
  }
  if (layer.kind === "instance") {
    return undefined;
  }
  const flowing = layer.children.filter((child) => !outOfLayout(child));
  return widthAround(
    layer,
    layer.limits.minWidth,
    flowing.map((child) => leastWidth(child, variables)),
    greatest
  );
}

/**
 * The width an auto layout frame draws around the widths of its layers in flow: their sum and the
 * gaps between them in a row, the widest in a column, with its horizontal padding and the room its
 * stroke takes on each side, held at its minimum. `leastWidth` reads it at each length's greatest
 * value, and `figma:probe` at the probe page's density.
 *
 * @param frame - The frame.
 * @param minWidth - The least width the frame takes: its own, or an instance's in place of its root's.
 * @param widths - The width of each layer in flow, undefined where it is unknown.
 * @param pixels - A length's pixels, undefined where they are unknown.
 * @returns The width in pixels, or undefined for a grid, whose layers sit in tracks, a quarter-turned
 *   frame, or where a width or a length is unknown.
 */
export function widthAround(
  frame: BoxSpec & { readonly rotation?: RotationSpec },
  minWidth: NumberSpec | undefined,
  widths: readonly (number | undefined)[],
  pixels: (length: NumberSpec) => number | undefined
): number | undefined {
  if (frame.grid !== undefined || (frame.rotation !== undefined && frame.rotation % 180 !== 0)) {
    return undefined;
  }
  // Figma puts the gap between a row's layers only, so a column's or a lone layer's width needs none.
  const gap = frame.direction === "HORIZONTAL" && widths.length >= 2 ? pixels(frame.itemSpacing) : 0;
  const around = [
    pixels(frame.paddingLeft),
    pixels(frame.paddingRight),
    pixels(strokeRoom(frame.stroke, "left")),
    pixels(strokeRoom(frame.stroke, "right")),
  ];
  const minimum = minWidth === undefined ? 0 : pixels(minWidth);
  if (!allKnown(widths) || !allKnown(around) || gap === undefined || minimum === undefined) {
    return undefined;
  }
  const layers =
    frame.direction === "HORIZONTAL"
      ? total(widths) + Math.max(0, widths.length - 1) * gap
      : Math.max(0, ...widths);
  return Math.max(minimum, layers + total(around));
}

/**
 * Whether a text breaks its lines at any width it fills: it fills, so it wraps, and it does not end
 * in an ellipsis after one line, as a text that does not wrap, such as `truncate`, does. A text that
 * hugs sets each line as wide as its characters, as `whitespace-nowrap` and `whitespace-pre` keep a
 * CSS text, and its least width is that line's, which the build does not measure.
 */
function wrapsAnywhere(layer: TextLayerSpec): boolean {
  return layer.sizing.horizontal.kind === "fill" && layer.truncation?.maxLines !== 1;
}

/**
 * Whether a layer that fills a room draws at that room's width in every mode, as `leastWidth`
 * bounds it: its least width is 0, or known and within a known room.
 *
 * @param layer - The layer, as it mapped.
 * @param room - The least room in pixels, or undefined where it is unknown.
 * @param variables - The synced variables, whose greatest values bound a bound length.
 * @returns True where the layer's least width fits the room.
 */
export function fitsRoom(layer: ChildLayerSpec, room: number | undefined, variables: VariableIndex): boolean {
  const least = leastWidth(layer, variables);
  return least !== undefined && (least === 0 || (room !== undefined && least <= room));
}

/** Whether every length of a list is known. */
function allKnown(lengths: readonly (number | undefined)[]): lengths is readonly number[] {
  return lengths.every((each) => each !== undefined);
}

/** The sum of a list of lengths. */
function total(lengths: readonly number[]): number {
  return lengths.reduce((sum, each) => sum + each, 0);
}

/**
 * Bounds kept within a box's `minHeight` and `maxHeight`, each a length's bounds, as
 * {@link usedLength} keeps one length: capped by the maximum, then raised to the minimum, which wins
 * where they conflict (CSS 2.1 §10.7). The least height takes each limit's least value, and the
 * greatest each limit's greatest, so the bounds hold in every mode. A maximum with no greatest value
 * only lowers a height, which leaves the greatest as it is, and a minimum with none leaves it unknown.
 */
function withinLimits(
  bounds: HeightBounds,
  { minHeight, maxHeight }: LimitsSpec,
  variables: VariableIndex
): HeightBounds {
  const floor = minHeight === undefined ? undefined : lengthBounds(minHeight, variables);
  const ceiling = maxHeight === undefined ? undefined : lengthBounds(maxHeight, variables);
  const highest = bounds.max ?? ceiling?.max;
  return {
    min: usedLength(bounds.min, floor?.min, ceiling?.min),
    max:
      highest === undefined || (floor !== undefined && floor.max === undefined)
        ? undefined
        : usedLength(highest, floor?.max, ceiling?.max),
  };
}

/**
 * The least content width a box has in any mode: its width in pixels less its literal borders and
 * the greatest padding each side takes in any mode, as a bound padding's variable holds it.
 *
 * @param holder - The box.
 * @param variables - The synced variables, whose greatest values bound a bound padding.
 * @returns The width in pixels, or undefined where the box's width, a border or a padding's greatest
 *   value is unknown.
 */
export function leastContentWidth(holder: Holder, variables: VariableIndex): number | undefined {
  const outer = holder.extent.horizontal;
  const borders = bordersOn(holder.style, "horizontal");
  const sides = SIDES.horizontal.map((side) => {
    const value = holder.style.resolved(side);
    if (value === undefined) {
      return 0;
    }
    const length = readNumber(value, variables);
    return length === undefined ? undefined : lengthBounds(length, variables).max;
  });
  if (outer === undefined || borders === undefined || !allKnown(sides)) {
    return undefined;
  }
  return outer - borders - total(sides);
}
