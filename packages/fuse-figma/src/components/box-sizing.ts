/**
 * How a box sizes each axis, read from its CSS and from the room its parent gives it: the length
 * a `width` or `height` sets, a `100%` that fills its parent, a share of a length in pixels, the
 * stretch a column gives an unset width, the `min-*` and `max-*` limits, and whether
 * `overflow: hidden` clips the box. `box-mapping.ts` reads a box's sizing before it maps the
 * box's parts, then asks this module for the room each part gets, in the box's flow or, for an
 * absolute part, against its containing block. `label-layout.ts` reads the box's own text against
 * the same holder.
 */
import type { CoverageNote, LayerStyle } from "./cascade";
import {
  describeNumber,
  evaluateLength,
  evaluatePercentage,
  normalizeCss,
  readNumber,
  readSize,
} from "./css-values";
import type { PercentBasis, VariableIndex } from "./css-values";
import type {
  BoxSpec,
  ChildLayerSpec,
  DirectionSpec,
  LimitsSpec,
  NumberSpec,
  SizeSpec,
  SizingSpec,
} from "./kit-spec";
import type { Layout } from "./placement";

/** What a box's parent gives it on one axis. */
type AxisRoom = {
  /** What the box's `100%` stands for. */
  readonly percent: PercentBasis;
  /** How the axis sizes where no length sets it: it hugs, or fills where a column stretches the box. */
  readonly auto: SizeSpec;
  /**
   * The other layers the box shares its parent's direction with, which a `100%` along it would
   * share the room with. Empty across the direction, and for the parent's only layer.
   */
  readonly siblings: readonly string[];
  /**
   * The length in pixels a fill takes on the axis before the box's own limits, the parent's content
   * length, or undefined where a length the parent's sizing or padding reads is no literal.
   */
  readonly length: number | undefined;
};

/**
 * The widest a box that hugs its width grows in CSS before the text it holds wraps: the content
 * width that the nearest boxes around it that hug their width up to a `max-width` leave, in pixels.
 * `unread` where one of those widths, or a padding or border between, is no literal length, and
 * `none` where no such box caps it.
 */
export type WidthCap =
  | { readonly kind: "none" }
  | { readonly kind: "pixels"; readonly value: number }
  | { readonly kind: "unread" };

/** No cap on a box's width. */
const NO_CAP: WidthCap = { kind: "none" };

/** A cap the build cannot read in pixels. */
const UNREAD_CAP: WidthCap = { kind: "unread" };

/** What a box's parent gives it on each axis. */
export type Room = {
  readonly horizontal: AxisRoom;
  readonly vertical: AxisRoom;
  /** The cap the boxes around the box set on its width, as {@link widthCapInside} reads it. */
  readonly widthCap: WidthCap;
};

const HUG: SizeSpec = { kind: "hug" };
const FILL: SizeSpec = { kind: "fill" };
const NO_BASIS: PercentBasis = { kind: "none" };

/** The `display` values that make a box block-level, whose unset width fills its container (CSS 2.1 §10.3.3). */
const BLOCK_LEVEL = new Set(["block", "flex", "grid", "flow-root"]);

/**
 * The room a variant root has. Its component set has no auto layout, so it fills nothing and an
 * unset length hugs, except where the definition names the width the root's container gives it: a
 * block-level root, such as a `flex` column, then takes that width, as a block box with no width
 * fills its container.
 *
 * @param previewWidth - The width the root's container gives it, which its percentage width takes,
 *   or undefined where the definition names none.
 * @param style - The root's style, whose `display` says whether the root is block-level.
 * @returns The root's room.
 */
export function rootRoom(previewWidth: number | undefined, style: LayerStyle): Room {
  const fills = previewWidth !== undefined && BLOCK_LEVEL.has(normalizeCss(style.raw("display") ?? ""));
  return {
    horizontal: {
      percent:
        previewWidth === undefined ? NO_BASIS : { kind: "length", value: previewWidth, of: "the preview" },
      auto: fills ? { kind: "fixed", length: { kind: "literal", value: previewWidth } } : HUG,
      siblings: [],
      length: undefined,
    },
    vertical: { percent: NO_BASIS, auto: HUG, siblings: [], length: undefined },
    widthCap: NO_CAP,
  };
}

/** A box's border-box length in pixels on each axis, undefined where the build cannot tell it. */
export type Extent = {
  readonly horizontal: number | undefined;
  readonly vertical: number | undefined;
};

/** A box as the parts it holds see it. */
export type Holder = {
  readonly style: LayerStyle;
  readonly layout: Layout;
  readonly sizing: SizingSpec;
  readonly limits: LimitsSpec;
  readonly extent: Extent;
  /**
   * The names of the box's layers in the cell that sit in its flow, in layer order, its parts first.
   * An absolute part sits outside it.
   */
  readonly layers: readonly string[];
  /** The cap the boxes around the box set on its width, from its room. */
  readonly widthCap: WidthCap;
  /** How much of a row each of `layers` takes, in the same order. */
  readonly shares: readonly RowShare[];
};

/**
 * How much of a row a layer takes along it, its margins included, in pixels, or `unread` where the
 * build does not know before it maps the layer, as for a text or a box that hugs what it holds.
 */
export type RowShare = { readonly kind: "pixels"; readonly value: number } | { readonly kind: "unread" };

/** A share the build does not know. */
export const UNREAD_SHARE: RowShare = { kind: "unread" };

/**
 * A box's left and right margins together, in pixels. The cascade splits a shorthand or logical
 * margin into its physical sides, so these two hold every horizontal margin.
 *
 * @param style - The box's style.
 * @returns Their sum, 0 for none, or undefined where one is no literal.
 */
function horizontalMargins(style: LayerStyle): number | undefined {
  const left = literalPixels(style, "margin-left");
  const right = literalPixels(style, "margin-right");
  return left === undefined || right === undefined ? undefined : left + right;
}

/**
 * The share of a row a part takes: its literal width and its left and right margins.
 *
 * @param style - The part's style.
 * @returns The share, or `unread` where the part's width is no literal length, as where it hugs.
 */
export function partShare(style: LayerStyle): RowShare {
  const width = style.resolved("width");
  const length = width === undefined ? undefined : evaluateLength(width);
  const margins = horizontalMargins(style);
  return length === undefined || margins === undefined
    ? UNREAD_SHARE
    : { kind: "pixels", value: length + margins };
}

/**
 * A part's room once its own margins are taken off the cap, since a margin takes its room from the
 * space the part's box gets (CSS Sizing 3 §2.3).
 *
 * @param room - The room the part's parent gives it.
 * @param style - The part's style.
 * @returns The room, its cap less the part's left and right margins, or `unread` where they are no
 *   literals.
 */
export function lessMargins(room: Room, style: LayerStyle): Room {
  if (room.widthCap.kind !== "pixels") {
    return room;
  }
  const margins = horizontalMargins(style);
  return {
    ...room,
    widthCap: margins === undefined ? UNREAD_CAP : { kind: "pixels", value: room.widthCap.value - margins },
  };
}

/**
 * Whether a box sits out of its parent's flow, as `position: absolute` and `fixed` take it, so it
 * shares no line with the parent's other layers.
 *
 * @param style - The box's style.
 * @returns True for an absolute or fixed box.
 */
export function outOfFlow(style: LayerStyle): boolean {
  return ["absolute", "fixed"].includes(normalizeCss(style.raw("position") ?? ""));
}

/** The padding sides of each axis. */
const SIDES = {
  horizontal: ["padding-left", "padding-right"],
  vertical: ["padding-top", "padding-bottom"],
} as const;

/**
 * A box's literal length in pixels, 0 where the box does not set it, or undefined where its value is
 * no literal length, such as a bound padding or a percentage.
 */
function literalPixels(style: LayerStyle, property: string): number | undefined {
  const value = style.resolved(property);
  return value === undefined ? 0 : evaluateLength(value);
}

/**
 * The length in pixels of a box's content box or padding box on one axis: its length less its
 * borders, and less its padding for the content box.
 */
function innerLength(holder: Holder, axis: keyof Extent, box: "content" | "padding"): number | undefined {
  const outer = holder.extent[axis];
  const border = literalPixels(holder.style, "border-width");
  const sides = box === "content" ? SIDES[axis].map((side) => literalPixels(holder.style, side)) : [];
  if (outer === undefined || border === undefined || sides.some((side) => side === undefined)) {
    return undefined;
  }
  return sides.reduce<number>((rest, side) => rest - (side ?? 0), outer - 2 * border);
}

/**
 * The room an absolute part has. It sits out of its parent's flow, so it shares no line with the
 * parent's other layers, and an unset length hugs, as CSS shrinks an absolute box to fit what it
 * holds. Its percentages take its containing block, the padding box of its nearest positioned
 * ancestor (CSS 2.1 §10.1). Where the parent is positioned and its lengths are literals, that is the
 * parent's padding box. Elsewhere the block lies further up, so a percentage stays unread.
 *
 * @param holder - The part's parent.
 * @returns The part's room.
 */
export function absoluteRoom(holder: Holder): Room {
  const positioned = !["", "static"].includes(normalizeCss(holder.style.raw("position") ?? ""));
  const axisRoom = (axis: keyof Extent): AxisRoom => {
    const block = positioned ? innerLength(holder, axis, "padding") : undefined;
    return {
      percent: block === undefined ? NO_BASIS : { kind: "length", value: block, of: "the parent's" },
      auto: HUG,
      siblings: [],
      length: undefined,
    };
  };
  return { horizontal: axisRoom("horizontal"), vertical: axisRoom("vertical"), widthCap: NO_CAP };
}

/**
 * Whether a box is a column whose unset `align-items` stretches its layers across it, as CSS's
 * `normal` does for flex items.
 */
function stretches({ style, layout }: Holder): boolean {
  return layout.flex && layout.direction === "VERTICAL" && !style.has("align-items");
}

/**
 * Whether a flex box's length on an axis is definite: fixed, or filling a definite length. A box that
 * stacks blocks is one too, as the containing block its blocks size against.
 */
function definite({ layout }: Holder, size: SizeSpec): boolean {
  return (layout.flex || layout.blocks) && size.kind !== "hug";
}

/**
 * The room a box gives one of its parts. Where the box's length is definite, a part's `100%`
 * across the box's direction fills it, as a stretch does, and so does a `100%` along it when the
 * part is the box's only layer. A column that stretches its layers fills a part's unset width
 * across a definite width (CSS Flexbox 1 §9.4 step 11), as a box that stacks blocks fills a block's
 * (CSS 2.1 §10.3.3). Every other length hugs.
 *
 * @param holder - The box.
 * @param index - The part's place among the box's layers.
 * @returns The part's room.
 */
export function roomInside(holder: Holder, index: number): Room {
  const { layout, sizing, layers } = holder;
  const percent = (size: SizeSpec): PercentBasis => (definite(holder, size) ? { kind: "parent" } : NO_BASIS);
  const siblings = layers.filter((_name, place) => place !== index);
  const along = (axis: DirectionSpec): readonly string[] =>
    (layout.flex || layout.blocks) && layout.direction === axis ? siblings : [];
  return {
    horizontal: {
      percent: percent(sizing.horizontal),
      auto: (stretches(holder) || layout.blocks) && definite(holder, sizing.horizontal) ? FILL : HUG,
      siblings: along("HORIZONTAL"),
      length: innerLength(holder, "horizontal", "content"),
    },
    vertical: {
      percent: percent(sizing.vertical),
      auto: HUG,
      siblings: along("VERTICAL"),
      length: innerLength(holder, "vertical", "content"),
    },
    widthCap: widthCapInside(holder, index),
  };
}

/**
 * The cap on the width of one layer a box holds, a part or the box's own text. A box that hugs its
 * width is as wide as what it holds, up to its `max-width` and the cap the boxes around it set, and
 * no narrower than its `min-width` (CSS 2.1 §10.4), so what it holds wraps at that width less the
 * box's padding and border (CSS Sizing 3 §5.1). In a row the other layers and the gaps between them
 * take their share of it (CSS Flexbox 1 §9.7), and a share the build cannot read leaves the cap
 * `unread`. A box whose width is fixed or fills sets the width of what it holds instead, so no cap
 * passes through it.
 *
 * @param holder - The box.
 * @param index - The layer's place in the box's flow, as `holder.layers` lists it.
 * @returns The cap in pixels, `unread` where a length it needs is no literal, or `none`.
 */
export function widthCapInside(holder: Holder, index: number): WidthCap {
  const content = contentCap(holder);
  if (content.kind !== "pixels" || holder.layout.direction !== "HORIZONTAL") {
    return content;
  }
  const room = lessShares(holder, index, content.value);
  return room === undefined ? UNREAD_CAP : { kind: "pixels", value: room };
}

/**
 * A row's length less the shares of every layer but one and the gaps between them (CSS Flexbox 1
 * §9.7), in pixels.
 *
 * @param holder - The row.
 * @param index - The one layer's place in the row's flow.
 * @param length - The row's content length.
 * @returns The length left, or undefined where a share or the gap is no literal, or a `column-gap`
 *   is set.
 */
function lessShares(holder: Holder, index: number, length: number): number | undefined {
  const others = holder.shares.filter((_share, place) => place !== index);
  if (others.length === 0) {
    return length;
  }
  const gap = holder.style.has("column-gap") ? undefined : literalPixels(holder.style, "gap");
  let room = length - (gap ?? 0) * others.length;
  for (const share of others) {
    if (share.kind === "unread" || gap === undefined) {
      return undefined;
    }
    room -= share.value;
  }
  return room;
}

/**
 * The room of the part that grows along its box's direction: it fills the box along it, as
 * {@link readGrowth} decides, and in a row its length is the row's content length less the other
 * layers and the gaps, or unknown where one of them does not read in pixels. In a column the other
 * layers' heights are unknown before they map, so its length is unknown.
 *
 * @param holder - The box.
 * @param index - The part's place in the box's flow.
 * @param room - The room the box gives the part.
 * @returns The part's room.
 */
export function growingRoom(holder: Holder, index: number, room: Room): Room {
  if (holder.layout.direction === "VERTICAL") {
    return { ...room, vertical: { ...room.vertical, auto: FILL, length: undefined } };
  }
  const { length } = room.horizontal;
  return {
    ...room,
    horizontal: {
      ...room.horizontal,
      auto: FILL,
      length: length === undefined ? undefined : lessShares(holder, index, length),
    },
  };
}

/**
 * The cap on a box's content width: its own limits, resolved as CSS resolves them, and the cap the
 * boxes around it set, less its padding and border.
 */
function contentCap(holder: Holder): WidthCap {
  if (holder.sizing.horizontal.kind !== "hug") {
    return NO_CAP;
  }
  const { minWidth, maxWidth } = holder.limits;
  const own: WidthCap =
    maxWidth === undefined
      ? NO_CAP
      : maxWidth.kind === "literal"
        ? { kind: "pixels", value: maxWidth.value }
        : UNREAD_CAP;
  const outer = narrower(own, holder.widthCap);
  if (outer.kind !== "pixels") {
    return outer;
  }
  if (minWidth !== undefined && minWidth.kind !== "literal") {
    return UNREAD_CAP;
  }
  // The minimum wins over the maximum and the cap (CSS 2.1 §10.4).
  const border = Math.max(outer.value, minWidth?.value ?? 0);
  const insets = ["padding-left", "padding-right", "border-width", "border-width"].map((property) =>
    literalPixels(holder.style, property)
  );
  return insets.some((inset) => inset === undefined)
    ? UNREAD_CAP
    : { kind: "pixels", value: insets.reduce<number>((rest, inset) => rest - (inset ?? 0), border) };
}

/** The narrower of two caps. Either one unread makes the narrower unread. */
function narrower(left: WidthCap, right: WidthCap): WidthCap {
  if (left.kind === "unread" || right.kind === "unread") {
    return UNREAD_CAP;
  }
  if (left.kind === "none") {
    return right;
  }
  return right.kind === "none" ? left : { kind: "pixels", value: Math.min(left.value, right.value) };
}

/** A declaration a box needs and its cascade leaves unset, for `LayerStyle.missing`. */
type MissingDeclaration = {
  readonly property: string;
  /** The property whose class the coverage table files the row under. */
  readonly neededBy: string;
  readonly detail: string;
};

/**
 * Find the stretch a box cannot draw. A column that hugs its width is as wide as its widest layer
 * and stretches the others to it, while Figma stretches a layer that fills a hugging frame only to
 * the width the frame's other layers set (PF). The build cannot tell which layer is widest, so the
 * stretch has no Figma form where a part sets no width of its own.
 *
 * @param holder - The box.
 * @param parts - The style of each part the box holds.
 * @returns The `align-items` the column is missing, or undefined where every stretch draws.
 */
export function unstretched(holder: Holder, parts: readonly LayerStyle[]): MissingDeclaration | undefined {
  return stretches(holder) &&
    !definite(holder, holder.sizing.horizontal) &&
    parts.some((style) => !style.has("width"))
    ? {
        property: "align-items",
        neededBy: "flex-direction",
        detail: "the column hugs its width, so Figma has no width to stretch a layer across",
      }
    : undefined;
}

/**
 * Read the `flex` of the parts in a flex box's flow. A box that hugs its length along its direction,
 * with no limit there that can change that length, is as long as its layers, so it leaves no free
 * space (CSS Flexbox 1 §9.7), and the one part that grows keeps its own length, as `flex: 1` does
 * from its zero basis. In a box of definite length along its direction the one part that grows takes
 * the room the others leave, which Figma's fill takes, where it sets no length of its own along the
 * direction, since its zero basis ignores one. Any other `flex` stays unread, so it lands unmapped: a
 * minimum can leave room past the layers and a maximum can take room away, and two parts that grow
 * share the free space by their grow.
 *
 * @param holder - The box.
 * @param parts - The style of each part in the box's flow.
 * @returns The place in `parts` of the part that fills the box along its direction, or undefined
 *   for none.
 */
export function readGrowth(holder: Holder, parts: readonly LayerStyle[]): number | undefined {
  const { layout, sizing, style } = holder;
  const horizontal = layout.direction === "HORIZONTAL";
  const along = horizontal ? sizing.horizontal : sizing.vertical;
  const axis = horizontal ? WIDTH : HEIGHT;
  const growing = parts.filter((part) => part.has("flex"));
  const [only] = growing;
  if (!layout.flex || growing.length !== 1 || only === undefined) {
    return undefined;
  }
  const one = (value: string) => (normalizeCss(value) === "1" ? value : undefined);
  if (along.kind !== "hug") {
    if (only.has(axis.length)) {
      return undefined;
    }
    const fills = only.read("flex", one, () => ({
      outcome: "literal",
      detail: `the one layer that grows fills the room the ${axis.flow}'s other layers leave`,
    }));
    return fills === undefined ? undefined : parts.indexOf(only);
  }
  // A zero minimum never lengthens the box, and any other limit along the axis can.
  const limited =
    style.has(axis.max) || (style.has(axis.min) && evaluateLength(style.resolved(axis.min) ?? "") !== 0);
  if (!limited) {
    only.read("flex", one, () => ({
      outcome: "dropped",
      detail: `the ${axis.flow} hugs its layers, so the one layer that grows has no room to grow into`,
    }));
  }
  return undefined;
}

/**
 * The least and the greatest height in pixels a mapped layer draws at, in every mode and with every
 * text its properties can set, or no greatest where one is unknown.
 */
export type HeightBounds = { readonly min: number; readonly max: number | undefined };

/** A height this module cannot bound: a bound length, a fill, or a layer turned on its side. */
const UNBOUNDED: HeightBounds = { min: 0, max: undefined };

const NO_HEIGHT: HeightBounds = { min: 0, max: 0 };

/** A length's bounds: its value where literal, unknown where a variable takes a length per mode. */
function lengthBounds(length: NumberSpec): HeightBounds {
  return length.kind === "literal" ? { min: length.value, max: length.value } : UNBOUNDED;
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
 * hugs a width nothing caps, or as many as its truncation keeps. A hugging box is its padding, its
 * in-layout stroke and its layers in flow: their sum and gaps in a column, the tallest in a row,
 * within its limits. A layer a property can hide draws no height at least. A bound length, a fill and
 * a layer turned a quarter leave the greatest height unknown.
 *
 * @param layer - The layer, or undefined for none, whose height is unknown.
 * @returns The layer's height bounds.
 */
export function heightBounds(layer: ChildLayerSpec | undefined): HeightBounds {
  if (layer === undefined) {
    return UNBOUNDED;
  }
  if (layer.kind === "icon") {
    return lengthBounds(layer.size);
  }
  if (layer.kind === "text") {
    const { sizing, lineHeight, maxWidth, truncation } = layer;
    if (sizing.vertical.kind === "fixed") {
      return lengthBounds(sizing.vertical.length);
    }
    // A percent line height follows a font size a variable sets per mode, so its pixels are unknown.
    const line = lineHeight.kind === "percent" ? UNBOUNDED : lengthBounds(lineHeight);
    const lines = sizing.horizontal.kind === "hug" && maxWidth === undefined ? 1 : truncation?.maxLines;
    return {
      min: line.min,
      max: lines === undefined || line.max === undefined ? undefined : line.max * lines,
    };
  }
  if (layer.rotation !== undefined && layer.rotation % 180 !== 0) {
    return UNBOUNDED;
  }
  const own = boxHeightBounds(layer);
  return layer.visibleProperty === undefined ? own : { min: 0, max: own.max };
}

function boxHeightBounds(box: BoxSpec): HeightBounds {
  const { vertical } = box.sizing;
  if (vertical.kind !== "hug") {
    return vertical.kind === "fixed" ? lengthBounds(vertical.length) : UNBOUNDED;
  }
  const flowing = box.children.filter((child) => child.kind !== "frame" || child.absolute === undefined);
  const heights = flowing.map((child) => heightBounds(child));
  const shown = flowing.filter((child) => child.kind !== "frame" || child.visibleProperty === undefined);
  const gaps = times(
    lengthBounds(box.itemSpacing),
    Math.max(0, shown.length - 1),
    Math.max(0, flowing.length - 1)
  );
  const layers = box.direction === "VERTICAL" ? sum([...heights, gaps]) : tallest(heights);
  const stroke =
    box.stroke === undefined || box.stroke.inLayout === false ? NO_HEIGHT : lengthBounds(box.stroke.weight);
  const hugged = sum([lengthBounds(box.paddingTop), layers, lengthBounds(box.paddingBottom), stroke, stroke]);
  return withinLimits(hugged, box.limits);
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
 * Bounds kept within a box's `minHeight` and `maxHeight`. A bound `minHeight` leaves the greatest
 * height unknown, and a bound `maxHeight` the least.
 */
function withinLimits(bounds: HeightBounds, { minHeight, maxHeight }: LimitsSpec): HeightBounds {
  const floor = minHeight === undefined ? NO_HEIGHT : lengthBounds(minHeight);
  const raised = {
    min: Math.max(bounds.min, floor.min),
    max: bounds.max === undefined || floor.max === undefined ? undefined : Math.max(bounds.max, floor.max),
  };
  if (maxHeight === undefined) {
    return raised;
  }
  const ceiling = lengthBounds(maxHeight).max;
  return ceiling === undefined
    ? { min: 0, max: raised.max }
    : { min: Math.min(raised.min, ceiling), max: Math.min(raised.max ?? ceiling, ceiling) };
}

/** The properties that size one axis, and the words its coverage rows use. */
type AxisProperties = {
  readonly length: "width" | "height";
  readonly min: "min-width" | "min-height";
  readonly max: "max-width" | "max-height";
  /** What a minimum does to the box when it raises the length. */
  readonly grows: string;
  /** What a maximum does to the box when it lowers the length. */
  readonly shrinks: string;
  /** The flex box that lays its layers out along the axis. */
  readonly flow: "row" | "column";
};

const WIDTH: AxisProperties = {
  length: "width",
  min: "min-width",
  max: "max-width",
  grows: "widens",
  shrinks: "narrows",
  flow: "row",
};

const HEIGHT: AxisProperties = {
  length: "height",
  min: "min-height",
  max: "max-height",
  grows: "lengthens",
  shrinks: "shortens",
  flow: "column",
};

/**
 * A box's sizing on each axis, the limits Figma keeps it within, whether it clips, and its length in
 * pixels where the build can tell it.
 */
type BoxSizing = Pick<BoxSpec, "sizing" | "limits" | "clips"> & { readonly extent: Extent };

/**
 * What a `fit-content` width draws as. `fit-content` is the smaller of what the box holds on one line
 * and the room its parent gives it (CSS Sizing 3 §5.1). A kit frame's default content fits its room,
 * so the width hugs (`content`). A box whose text wraps at that room, and that draws the same at the
 * room's width, fills the room where its parent stretches it (`room`), as `box-mapping.ts` decides.
 */
export type FitContent = "content" | "room";

/**
 * Read a box's sizing and limits on both axes, `field-sizing: content`, and `overflow: hidden`.
 * `field-sizing: content` sizes a form control to its content on each side no length sets (CSS
 * Basic UI 4). The kit hugs such a side already, so it reads where the height hugs. `overflow:
 * hidden` clips the box's content at its padding box, as Figma's clipping does. A part shows what
 * overflows it otherwise, as a CSS box does, and a variant root clips whatever it sets.
 *
 * @param reader - The box's style.
 * @param room - What the box's parent gives it.
 * @param variables - The synced variables a length can bind.
 * @param fit - What a `fit-content` width draws as.
 * @returns The box's sizing, limits, clipping and extent.
 */
export function readSizing(
  reader: LayerStyle,
  room: Room,
  variables: VariableIndex,
  fit: FitContent
): BoxSizing {
  const horizontal = readAxis(reader, WIDTH, room.horizontal, variables, fit);
  const vertical = readAxis(reader, HEIGHT, room.vertical, variables, "content");
  reader.read(
    "field-sizing",
    (value) => (normalizeCss(value) === "content" && vertical.size.kind === "hug" ? value : undefined),
    () => ({ outcome: "literal", detail: "the height hugs its content" })
  );
  const clips = reader.read(
    "overflow",
    (value) => (normalizeCss(value) === "hidden" ? true : undefined),
    () => ({ outcome: "literal", detail: "the box clips its content" })
  );
  return {
    sizing: { horizontal: horizontal.size, vertical: vertical.size },
    limits: {
      minWidth: horizontal.min,
      maxWidth: horizontal.max,
      minHeight: vertical.min,
      maxHeight: vertical.max,
    },
    clips: clips ?? false,
    extent: {
      horizontal: usedPixels(horizontal, room.horizontal.length),
      vertical: usedPixels(vertical, room.vertical.length),
    },
  };
}

/**
 * An axis's used length in pixels, as CSS lays the box out: a literal fixed length, which holds its
 * limits already, or the room a fill takes, lowered to its maximum and raised to its minimum (CSS 2.1
 * §10.4), as Figma keeps a fill within its limits. Undefined where the axis hugs, the fill's room is
 * unknown, or a limit is no literal or stays unmapped, since CSS applies a limit whatever the build
 * makes of it.
 *
 * @param read - The axis as {@link readAxis} read it.
 * @param room - The length in pixels a fill takes before its limits, or undefined where unknown.
 */
function usedPixels(read: AxisRead, room: number | undefined): number | undefined {
  if ([...read.notes.values()].includes(undefined)) {
    return undefined;
  }
  switch (read.size.kind) {
    case "fixed":
      return read.size.length.kind === "literal" ? read.size.length.value : undefined;
    case "hug":
      return undefined;
    case "fill": {
      const bounds = [...read.notes.keys()];
      const min = comparable(bounds, "min");
      const max = comparable(bounds, "max");
      return room === undefined || min.kind === "incomparable" || max.kind === "incomparable"
        ? undefined
        : usedLength(room, pixelsOf(min), pixelsOf(max));
    }
  }
}

/** A `min-*` or `max-*` the box sets, and its value as a number field where it reads as one. */
type Bound = {
  readonly side: "min" | "max";
  readonly property: string;
  readonly value: NumberSpec | undefined;
};

/**
 * One axis as the box reads it: its sizing, the limits Figma keeps it within, and what became of
 * each `min-*` and `max-*` the box sets, where undefined leaves it unmapped.
 */
type AxisRead = {
  readonly size: SizeSpec;
  readonly min: NumberSpec | undefined;
  readonly max: NumberSpec | undefined;
  readonly notes: ReadonlyMap<Bound, CoverageNote | undefined>;
};

/** Why a zero minimum drops: `min-w-0` lets a flex item shrink below its content. */
const ZERO_MINIMUM = "Figma takes no zero minimum, and its auto layout never shrinks a layer";

/**
 * Read one axis: its length through {@link readLength}, an unset length as the room gives it, and
 * its limits as {@link resolveLimits} decides.
 */
function readAxis(
  reader: LayerStyle,
  axis: AxisProperties,
  room: AxisRoom,
  variables: VariableIndex,
  fit: FitContent
): AxisRead {
  const size = reader.has(axis.length) ? (readLength(reader, axis, room, variables, fit) ?? HUG) : room.auto;
  const bounds = (["min", "max"] as const).flatMap((side): Bound[] => {
    const property = axis[side];
    const value = reader.resolved(property);
    return value === undefined ? [] : [{ side, property, value: readNumber(value, variables) }];
  });
  const read = resolveLimits(size, bounds, axis);
  // Each note was decided from the value the read substitutes, so the read only records it.
  for (const [bound, note] of read.notes) {
    reader.read(
      bound.property,
      () => note,
      (decided) => decided
    );
  }
  return read;
}

/**
 * Decide an axis's limits. A zero minimum drops. Beside a length that hugs or fills, each other
 * limit becomes a Figma limit, except a maximum of zero or less, which Figma refuses, as the plugin
 * typings require a positive limit. Beside a fixed length, CSS resolves the length against its
 * limits (CSS 2.1 §10.4 and §10.7): lowered to the maximum, then raised to the minimum, so the
 * minimum wins a conflict. Figma would clamp a fixed length to a limit on every resize, so the
 * limits fold into the length: one that moves it sets it, and one that never moves it drops. A
 * length bound to a variable that every limit binds too never moves in any mode, as the md control
 * rung's `min-h-(--control-h-md)` beside its `h-(--control-h-md)`, so those limits drop. A fold to a
 * length of zero or less, and a limit that any other bound or non-literal value on either side keeps
 * from comparing, stay unmapped.
 */
function resolveLimits(size: SizeSpec, bounds: readonly Bound[], axis: AxisProperties): AxisRead {
  const isZeroMinimum = (bound: Bound): boolean =>
    bound.side === "min" && bound.value?.kind === "literal" && bound.value.value === 0;
  const kept = bounds.filter((bound) => !isZeroMinimum(bound));
  const zeroNotes = bounds
    .filter(isZeroMinimum)
    .map((bound): [Bound, CoverageNote] => [bound, { outcome: "dropped", detail: ZERO_MINIMUM }]);
  if (size.kind !== "fixed") {
    const positive = (bound: Bound): NumberSpec | undefined =>
      bound.side === "max" && bound.value?.kind === "literal" && bound.value.value <= 0
        ? undefined
        : bound.value;
    const limit = (side: Bound["side"]) => {
      const bound = kept.find((candidate) => candidate.side === side);
      return bound === undefined ? undefined : positive(bound);
    };
    return {
      size,
      min: limit("min"),
      max: limit("max"),
      notes: new Map([
        ...zeroNotes,
        ...kept.map((bound): [Bound, CoverageNote | undefined] => {
          const value = positive(bound);
          return [bound, value === undefined ? undefined : describeNumber(value)];
        }),
      ]),
    };
  }
  const { length } = size;
  if (kept.length > 0 && kept.every((bound) => sameVariable(bound.value, length))) {
    return {
      size,
      min: undefined,
      max: undefined,
      notes: new Map([
        ...zeroNotes,
        ...kept.map((bound): [Bound, CoverageNote] => [bound, neverMoves(bound, axis)]),
      ]),
    };
  }
  const min = comparable(kept, "min");
  const max = comparable(kept, "max");
  const unmapped: AxisRead = {
    size,
    min: undefined,
    max: undefined,
    notes: new Map([...zeroNotes, ...kept.map((bound): [Bound, undefined] => [bound, undefined])]),
  };
  // Whether a limit moves the length depends on the length and on the other limit, so every one of
  // them must be a literal before any limit folds or drops.
  if (length.kind !== "literal" || min.kind === "incomparable" || max.kind === "incomparable") {
    return unmapped;
  }
  const used = usedLength(length.value, pixelsOf(min), pixelsOf(max));
  if (used <= 0) {
    return unmapped;
  }
  const foldNote = (bound: Bound): CoverageNote => {
    const without = usedLength(
      length.value,
      bound.side === "min" ? undefined : pixelsOf(min),
      bound.side === "max" ? undefined : pixelsOf(max)
    );
    return without === used
      ? neverMoves(bound, axis)
      : { outcome: "literal", detail: `the fixed ${axis.length} resolves to ${used}px against it` };
  };
  return {
    size: { kind: "fixed", length: { kind: "literal", value: used } },
    min: undefined,
    max: undefined,
    notes: new Map([...zeroNotes, ...kept.map((bound): [Bound, CoverageNote] => [bound, foldNote(bound)])]),
  };
}

/** Why a limit that never moves a fixed length drops. */
function neverMoves(bound: Bound, axis: AxisProperties): CoverageNote {
  const [than, never] = bound.side === "min" ? ["more", axis.grows] : ["less", axis.shrinks];
  return {
    outcome: "dropped",
    detail: `it is no ${than} than the fixed ${axis.length}, so it never ${never} the box`,
  };
}

/** Whether a limit binds the variable a length binds, so it holds the length's value in every mode. */
function sameVariable(limit: NumberSpec | undefined, length: NumberSpec): boolean {
  return (
    limit?.kind === "variable" &&
    length.kind === "variable" &&
    limit.variable.collection === length.variable.collection &&
    limit.variable.name === length.variable.name
  );
}

/** A limit as the fold compares it: unset, a literal length in pixels, or a value it cannot compare. */
type Comparable =
  | { readonly kind: "absent" }
  | { readonly kind: "literal"; readonly px: number }
  | { readonly kind: "incomparable" };

function comparable(bounds: readonly Bound[], side: Bound["side"]): Comparable {
  const bound = bounds.find((candidate) => candidate.side === side);
  if (bound === undefined) {
    return { kind: "absent" };
  }
  return bound.value?.kind === "literal"
    ? { kind: "literal", px: bound.value.value }
    : { kind: "incomparable" };
}

/** A comparable limit's pixels, or undefined where it is unset. */
function pixelsOf(limit: Comparable): number | undefined {
  return limit.kind === "literal" ? limit.px : undefined;
}

/** The used length CSS gives a length within its limits (CSS 2.1 §10.4). */
function usedLength(length: number, min: number | undefined, max: number | undefined): number {
  const capped = max === undefined ? length : Math.min(length, max);
  return min === undefined ? capped : Math.max(capped, min);
}

/**
 * Read `width` or `height` as its axis's sizing, through {@link readSize}. A `100%` along a flex
 * box's direction beside other layers stays unmapped: CSS sizes it at the whole length and then
 * shrinks or overflows it with them (CSS Flexbox 1 §9.7), where a fill takes only the room they
 * leave. A `fit-content` width fills a room that stretches it where `fit` says it draws so, as
 * {@link FitContent} says, and hugs otherwise.
 *
 * @returns The sizing, or undefined when the value does not map.
 */
function readLength(
  reader: LayerStyle,
  axis: AxisProperties,
  room: AxisRoom,
  variables: VariableIndex,
  fit: FitContent
): SizeSpec | undefined {
  const { siblings, percent } = room;
  const read = reader.read(
    axis.length,
    (value) => {
      // `auto` is a length's initial value, which sizes the axis as no length does.
      if (normalizeCss(value) === "auto") {
        return { size: room.auto, share: undefined };
      }
      if (normalizeCss(value) === "fit-content" && fit === "room" && room.auto.kind === "fill") {
        return { size: { kind: "fitted" } as const, share: undefined };
      }
      const share = evaluatePercentage(value);
      if (share === 1 && siblings.length > 0) {
        return { size: { kind: "shared" } as const, share };
      }
      const size = readSize(value, variables, percent);
      return size === undefined ? undefined : { size, share };
    },
    ({ size, share }): CoverageNote => {
      switch (size.kind) {
        case "shared": {
          const [shares, leaves] = siblings.length === 1 ? ["shares", "it leaves"] : ["share", "they leave"];
          return {
            outcome: "unmapped",
            detail: `${listNames(siblings)} ${shares} the ${axis.flow}, and a fill takes only the room ${leaves}, where CSS sizes 100% of the ${axis.flow}`,
          };
        }
        case "fitted":
          return {
            outcome: "literal",
            detail: `the box fits its text up to the ${axis.length} its parent gives it, where its text wraps, which a fill draws, since the box paints nothing and starts its text at its start`,
          };
        case "hug":
          return { outcome: "literal", detail: "the box hugs its content" };
        case "fill":
          return { outcome: "literal", detail: `the box fills its parent's ${axis.length}` };
        case "fixed": {
          if (share === undefined || percent.kind !== "length" || size.length.kind !== "literal") {
            return describeNumber(size.length);
          }
          const of = `${percent.of} ${axis.length}`;
          const detail =
            share === 1
              ? `${size.length.value}px, ${of} that 100% takes`
              : `${size.length.value}px, ${Math.round(share * 10_000) / 100}% of ${of}`;
          return { outcome: "literal", detail };
        }
      }
    }
  )?.size;
  if (read?.kind === "fitted") {
    return FILL;
  }
  return read === undefined || read.kind === "shared" ? undefined : read;
}

/**
 * Layer names as prose.
 *
 * @param names - The names, in layer order.
 * @returns `a`, `a and b`, or `a, b and c`.
 */
export function listNames(names: readonly string[]): string {
  const last = names.at(-1) ?? "";
  return names.length < 2 ? last : `${names.slice(0, -1).join(", ")} and ${last}`;
}
