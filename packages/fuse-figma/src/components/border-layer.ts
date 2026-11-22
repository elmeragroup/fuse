/**
 * A box's border drawn on a layer under the box's other layers, where one of them casts a sharp shadow
 * onto the border and the box clips neither axis. CSS paints a box's border under its descendants (CSS 2.1 Appendix E), so a Frame panel's
 * highlight, a `::before` inside the border whose `box-shadow` draws a line one pixel down, paints
 * that line over the panel's bottom border. Figma paints a frame's inside stroke over its layers and
 * their shadows (probe FR4), so a stroke on the box would hide the line wherever `--border` is
 * opaque.
 *
 * The box keeps its stroke's weight, so its auto layout still insets its layers by the border, as
 * `box-sizing: border-box` counts it, but the stroke takes a paint at alpha 0, which keeps its weight
 * in the layout as a transparent CSS border's does (`plugin/src/box.ts`). The visible stroke moves
 * onto the layer `border`: a frame placed out of the auto layout, flush with the box's edges and
 * stretched with it, as the `padding box` layer is placed (probe SH1), rounded by the box's corners
 * and stroked inside as the box was. It sits above the `padding box` layer, which holds the fill
 * inside the border, and under every other layer, as CSS paints the border over the background and
 * under the content. Figma paints a later layer's shadow over an earlier layer's stroke (probe FR5).
 *
 * In an instance, the panel's own stroke is the transparent one that keeps the layout. A designer who
 * sets an opaque stroke color there paints over the highlight's line, as FR4 shows, so the border's
 * color changes on the nested `border` layer.
 */
import { borderWidthProperty } from "./box-paint";
import type { BorderWidths } from "./box-paint";
import { clippedAxes, overflowClips } from "./box-sizing";
import { cornerLengths } from "./corner-spec";
import type { VariableIndex } from "./css-values";
import { edgeLayer, fixedLength, outOfLayout, strokeRoom } from "./kit-spec";
import type { BoxSpec, FrameLayerSpec, NumberSpec, SizeSpec, StrokeSide, StrokeSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";
import { isPaddingBoxLayer } from "./padding-box-fill";

/** The key and name of the layer that draws a box's border under its other layers. */
export const BORDER_LAYER = "border";

/** The stroke paint that keeps a stroke's weight in the auto layout and draws nothing. */
const UNPAINTED = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0 } } as const;

/** The sides of a box, in the order a coverage row names the first one a shadow reaches. */
const SIDES = ["top", "right", "bottom", "left"] as const satisfies readonly StrokeSide[];

/** The properties that clip a box's overflow, in the order a coverage row names the first one that clips. */
const OVERFLOWS = ["overflow", "overflow-x", "overflow-y"] as const;

/**
 * How far past its sharp edge a blur paints, per pixel of blur radius. CSS blurs a shadow by a
 * Gaussian whose standard deviation is half the radius (CSS Backgrounds 3 §7.1.1), and Chromium
 * paints it out to three deviations, as it paints a 12px blur 18px out and an 8px blur 12px out.
 */
const BLUR_REACH = 1.5;

/**
 * The length taken for a box's side that holds no fixed length, longer than any inset, offset or
 * border a box sets, so the near and far edges of a layer and its shadow compare as on a box long
 * enough to hold them.
 */
const UNTOLD_LENGTH = 2 ** 20;

/** Why a box that clips keeps its stroke where a layer's shadow reaches its border. */
const CLIPS =
  "the box clips its content while a layer's shadow reaches its border: CSS clips the shadow at the padding box on each axis it clips, and Figma clips both axes at the frame's edges and paints the stroke over the shadow, so neither layer order draws what CSS shows";

/** Why a box keeps its stroke where a layer's blurred shadow reaches its border. */
const BLURRED =
  "a layer's blurred shadow reaches this border, which the stroke over the layers hides, and the kit does not draw the blur's fading edge under a `border` layer";

/** Why a box keeps its stroke where a layer's shadow reaches its border at some of the box's sizes only. */
const UNTOLD =
  "the box's size binds a variable, and a layer's shadow reaches this border at some of the sizes its range allows and not at others, or the build does not know the range, so it cannot tell which layer order draws what CSS shows";

/** Why a box keeps its stroke where a rounded layer's shadow may reach its border inside the layer's box. */
const ROUNDED =
  "a layer's shadow may paint this border past a rounded corner of the layer, inside the layer's box, which the stroke over the layers hides, and the build does not trace the corner's curve";

/** A length's greatest value across the modes, unbounded where the variables do not know it. */
function most(length: NumberSpec, variables: VariableIndex): number {
  return length.kind === "literal"
    ? length.value
    : (variables.maximum(length.variable) ?? Number.POSITIVE_INFINITY);
}

/** A span along one axis, from its start to its end, in pixels from the box's start edge there. */
type Span = readonly [start: number, end: number];

/** A rectangle in the box, its span across and its span down. */
type Rect = { readonly x: Span; readonly y: Span };

/** Where two spans overlap, empty where its end is not past its start. */
const overlap = ([start, end]: Span, [from, to]: Span): Span => [Math.max(start, from), Math.min(end, to)];

/** Whether a span holds no length. */
const isEmpty = ([start, end]: Span): boolean => end <= start;

/** Whether a span lies inside another. */
const isWithin = ([start, end]: Span, [from, to]: Span): boolean => start >= from && end <= to;

/** A span moved by `by` and grown by `grow` at each end. */
const moved = ([start, end]: Span, by: number, grow: number): Span => [start + by - grow, end + by + grow];

/**
 * The lengths a box's side may take: its fixed literal length, the least and greatest values of the
 * variable it binds, or {@link UNTOLD_LENGTH} for a side that holds no fixed length. Undefined where
 * the variables do not know the bound variable's range.
 */
function sideLengths(size: SizeSpec, variables: VariableIndex): readonly number[] | undefined {
  const length = fixedLength(size);
  if (length === undefined) {
    return [UNTOLD_LENGTH];
  }
  if (length.kind === "literal") {
    return [length.value];
  }
  const least = variables.minimum(length.variable);
  const greatest = variables.maximum(length.variable);
  return least === undefined || greatest === undefined ? undefined : [least, greatest];
}

/** The band a side's border takes in a box `width` by `height`, its room on that side `room` deep. */
function band(side: StrokeSide, room: number, width: number, height: number): Rect {
  const across: Span = [0, width];
  const down: Span = [0, height];
  switch (side) {
    case "top":
      return { x: across, y: [0, room] };
    case "right":
      return { x: [width - room, width], y: down };
    case "bottom":
      return { x: across, y: [height - room, height] };
    case "left":
      return { x: [0, room], y: down };
  }
}

/** Whether a span meets the span `near` long at either end of another. */
const meetsEnd = (span: Span, [start, end]: Span, near: number): boolean =>
  !isEmpty(overlap(span, [start, start + near])) || !isEmpty(overlap(span, [end - near, end]));

/**
 * How a shadow the shape `shadow` covers a band: it `paints` where the two overlap somewhere outside
 * the casting layer's own box, where CSS paints no outer shadow. Where they overlap only inside that
 * box, within `radius` of one of its corners, the shadow may paint past the corner's curve, and it
 * `may` paint the band.
 */
function cover(shadow: Rect, band: Rect, caster: Rect, radius: number): "paints" | "may" | "none" {
  const x = overlap(shadow.x, band.x);
  const y = overlap(shadow.y, band.y);
  if (isEmpty(x) || isEmpty(y)) {
    return "none";
  }
  if (!(isWithin(x, caster.x) && isWithin(y, caster.y))) {
    return "paints";
  }
  return radius > 0 && meetsEnd(x, caster.x, radius) && meetsEnd(y, caster.y, radius) ? "may" : "none";
}

/**
 * How a layer's shadow reaches a side's border: by its sharp shape, within its blur's reach, at some
 * of the box's sizes only, or perhaps past a rounded corner of the layer.
 */
type Reach = { readonly side: StrokeSide; readonly how: "sharp" | Kept };

/** Why a reach the build cannot draw keeps the box's stroke, by how it reaches. */
const KEPT = { blurred: BLURRED, untold: UNTOLD, rounded: ROUNDED } as const;

/** A way of reaching a border that keeps the box's stroke. */
type Kept = keyof typeof KEPT;

/** Whether a reach keeps the box's stroke. */
const keepsStroke = (reach: Reach): reach is Reach & { readonly how: Kept } => reach.how !== "sharp";

/**
 * The borders a layer out of the box's auto layout casts a shadow onto. The layer's box is its
 * placement's insets from the box's edges, and a sharp shadow paints that box moved by its offsets
 * and grown by its spread, outside the layer's box (CSS Backgrounds 3 §7.1, §7.1.2). It reaches a border
 * where that shape overlaps the border's band, as {@link cover} tells, at the spread's and the
 * border's greatest value in any mode, the border's depth as {@link borderDepth} reads it. A shadow
 * whose blur may be nonzero grows by {@link BLUR_REACH} times the blur's greatest value as well, and
 * reaches a border `blurred`. A layer whose corners may be rounded reaches a border `rounded` where
 * its shadow overlaps the band only inside the layer's box, near a corner. A box whose size binds a
 * variable is measured at each end of the variable's range, and a shadow that covers a band at some
 * of them and not at others, or where the layer holds no area at one of them, or any band where the
 * range is unknown, reaches it `untold`. A layer
 * placed in any other way casts onto no border the build can tell.
 */
function shadowReach(
  layer: FrameLayerSpec,
  box: BoxSpec,
  depth: (side: StrokeSide) => number,
  variables: VariableIndex
): readonly Reach[] {
  const placement = layer.placement;
  if (
    placement?.kind !== "edges" ||
    placement.horizontal.kind !== "stretch" ||
    placement.vertical.kind !== "stretch"
  ) {
    return [];
  }
  const { horizontal, vertical } = placement;
  const widths = sideLengths(box.sizing.horizontal, variables);
  const heights = sideLengths(box.sizing.vertical, variables);
  if (widths === undefined || heights === undefined) {
    return layer.shadows.length === 0
      ? []
      : SIDES.flatMap((side) => (depth(side) > 0 ? [{ side, how: "untold" as const }] : []));
  }
  const sizes = widths.flatMap((width) => heights.map((height) => ({ width, height })));
  const radius = Math.max(...cornerLengths(layer.cornerRadius).map((length) => most(length, variables)));
  return layer.shadows.flatMap((shadow) => {
    const blur = most(shadow.radius, variables);
    const grow = most(shadow.spread, variables) + (blur > 0 ? BLUR_REACH * blur : 0);
    const covers = (side: StrokeSide, room: number) =>
      new Set(
        sizes.map(({ width, height }) => {
          const caster: Rect = {
            x: [horizontal.start, width - horizontal.end],
            y: [vertical.start, height - vertical.end],
          };
          // A layer that holds no area at one end of a range may hold some in between.
          if (isEmpty(caster.x) || isEmpty(caster.y)) {
            return "empty";
          }
          const cast: Rect = {
            x: moved(caster.x, shadow.offsetX, grow),
            y: moved(caster.y, shadow.offsetY, grow),
          };
          return cover(cast, band(side, room, width, height), caster, radius);
        })
      );
    return SIDES.flatMap((side): Reach[] => {
      const room = depth(side);
      const [only, ...others] = room > 0 ? covers(side, room) : [];
      if (only === undefined || ((only === "none" || only === "empty") && others.length === 0)) {
        return [];
      }
      const how = others.length > 0 ? "untold" : only === "may" ? "rounded" : blur > 0 ? "blurred" : "sharp";
      return [{ side, how }];
    });
  });
}

/**
 * How deep a side's border band is: the side's used width, or, for a side whose width binds a
 * variable, the weight the stroke takes there at its greatest in any mode.
 */
function borderDepth(
  stroke: StrokeSpec,
  borders: BorderWidths,
  variables: VariableIndex
): (side: StrokeSide) => number {
  return (side) => borders[side] ?? most(strokeRoom(stroke, side), variables);
}

/** Leave the first of `properties` the box sets to a value `names` holds unmapped, for `detail`. */
function leaveUnmapped(
  reader: LayerStyle,
  properties: readonly string[],
  names: (value: string) => boolean,
  detail: string
): void {
  const property = properties.find((each) => names(reader.resolved(each) ?? ""));
  if (property !== undefined) {
    reader.read(
      property,
      (value) => value,
      () => ({ outcome: "unmapped", detail }),
      []
    );
  }
}

/**
 * Draw a box's border on a layer under its other layers where one of them casts a sharp shadow onto
 * the border, as the module doc says. A box no shadow reaches keeps its stroke. So does a box where
 * one reaches but the build cannot draw what CSS paints, which leaves one declaration unmapped:
 *
 * - A box that clips on either axis leaves the `overflow` it sets unmapped. CSS clips the shadow at
 *   the padding box on each axis it clips (CSS Overflow 3 §3), Figma clips both axes at the frame's
 *   edges, and neither layer order draws the shadow on the border and past the box as CSS does.
 * - A box a blurred shadow reaches leaves the declaration that wins that side's border width
 *   unmapped. The kit does not draw the blur's fading edge, which CSS paints over the border.
 * - So does a box where the build cannot tell whether a shadow reaches a side's border: a box whose
 *   size binds a variable, where the shadow reaches the border at one end of the variable's range and
 *   not at the other or the range is unknown, and a layer whose rounded corner the shadow may paint
 *   past, inside the layer's box. The build does not trace the corner's curve.
 *
 * @param reader - The box's style, whose stroke feeds the layer as well.
 * @param variables - The synced variables a shadow's spread or blur can bind.
 * @param box - The box as mapped, its fill inside the border on its `padding box` layer where it
 *   clips its background there.
 * @param borders - The box's used border width on each side, as its stroke draws them.
 * @returns The box, its stroke unpainted and its border on the layer above `padding box`.
 */
export function drawBorderUnderLayers(
  reader: LayerStyle,
  variables: VariableIndex,
  box: BoxSpec,
  borders: BorderWidths
): BoxSpec {
  const { stroke } = box;
  if (stroke === undefined || stroke.inLayout === false) {
    return box;
  }
  const depth = borderDepth(stroke, borders, variables);
  const reaches = box.children.flatMap((child) =>
    child.kind === "frame" && outOfLayout(child) ? shadowReach(child, box, depth, variables) : []
  );
  if (reaches.length === 0) {
    return box;
  }
  const clipped = clippedAxes(reader);
  if (clipped.horizontal || clipped.vertical) {
    leaveUnmapped(reader, OVERFLOWS, overflowClips, CLIPS);
    return box;
  }
  const kept = reaches.find(keepsStroke);
  if (kept !== undefined) {
    const property = borderWidthProperty(reader, kept.side);
    leaveUnmapped(reader, property === undefined ? [] : [property], (value) => value !== "", KEPT[kept.how]);
    return box;
  }
  const { path } = reader;
  // The border's width feeds both strokes, and its color the layer's.
  reader.moveFeeds((feed) =>
    feed.field === "stroke" &&
    feed.path.length === path.length &&
    path.every((key, index) => feed.path[index] === key)
      ? [feed, { path: [...path, BORDER_LAYER], field: "stroke" }]
      : [feed]
  );
  const layer = edgeLayer({
    key: BORDER_LAYER,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    cornerRadius: box.cornerRadius,
    fill: undefined,
    stroke,
  });
  // Figma paints a frame's first layer at the bottom, or its last where it paints its first on top.
  const inPaintOrder = box.firstOnTop === true ? box.children.toReversed() : box.children;
  const [first, ...rest] = inPaintOrder;
  const ordered =
    first !== undefined && isPaddingBoxLayer(first) ? [first, layer, ...rest] : [layer, ...inPaintOrder];
  return {
    ...box,
    // An opaque color here, as an instance override would set, hides the highlight's line (FR4).
    stroke: { ...stroke, color: UNPAINTED },
    children: box.firstOnTop === true ? ordered.toReversed() : ordered,
  };
}
