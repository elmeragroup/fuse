/**
 * How a box sizes each axis, read from its CSS and from the room its parent gives it: the length
 * a `width` or `height` sets, a `100%` that fills its parent, a share of a length in pixels, the
 * stretch a column gives an unset width, the `min-*` and `max-*` limits, and whether the box's
 * `overflow` clips it. `box-mapping.ts` reads a box's sizing before it maps the
 * box's parts, then asks this module for the room each part gets, in the box's flow or, for an
 * absolute part, against its containing block. `label-layout.ts` reads the box's own text against
 * the same holder.
 */
import type { CoverageNote, Feed, LayerStyle } from "./cascade";
import {
  affineLength,
  describeNumber,
  evaluateLength,
  evaluateLengthOf,
  evaluatePercentage,
  inViewport,
  normalizeCss,
  readNumber,
  readSize,
} from "./css-values";
import type { PercentBasis, VariableIndex, Viewport } from "./css-values";
import { outOfLayout, strokeRoom } from "./kit-spec";
import type {
  BoxSpec,
  ChildLayerSpec,
  DirectionSpec,
  LimitsSpec,
  NumberSpec,
  SizeSpec,
  SizingSpec,
} from "./kit-spec";
import { AUTO_HEIGHT, autoHeightBasis } from "./percent-height";
import type { Layout } from "./placement";
import { roomyMaximum, withRoom } from "./popup-room";

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
  /**
   * True on the axis along which the box grows from a zero flex basis, which sizes it there in place
   * of its own length (CSS Flexbox 1 §9.2 step 3). Absent elsewhere.
   */
  readonly zeroBasis?: true;
  /**
   * The parent's fixed length on the axis and the pixels its border and padding take from it, which
   * a `100%` maximum resolves against. Absent where the parent's length is not fixed or an inset is
   * no literal.
   */
  readonly outer?: { readonly length: NumberSpec; readonly inset: number };
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
  /**
   * Whether the width CSS makes available to the box is unbounded, apart from the Figma sizing the
   * box gets: every box around it, up to an in-flow root with no preview width, hugs its width with
   * no `max-width`, so a box that hugs lays out at its max-content width (CSS Sizing 3 §5.1). A box
   * of fixed or filling width narrows a hugging flex item to its own width (CSS Flexbox 1 §9.7) and
   * caps a column's item at it (§9.4), a `max-width` caps what it holds, and an absolute box shrinks
   * to fit its containing block (CSS 2.1 §10.3.7), so each of them bounds the box. Figma draws a part
   * that hugs at its own width whatever bounds it, so where this is false the build cannot tell
   * whether CSS draws the box at that width.
   */
  readonly unbounded: boolean;
  /**
   * The least width a popup that hugs its rows keeps its named row at, for the row and the frames
   * around it, as `hugging-rows.ts` reads it. Absent elsewhere.
   */
  readonly rowMinimum?: NumberSpec;
};

const HUG: SizeSpec = { kind: "hug" };
const FILL: SizeSpec = { kind: "fill" };
const NO_BASIS: PercentBasis = { kind: "none" };

/**
 * The displays that make a box block-level (CSS Display 3 §2.1), whose unset width fills its
 * container (CSS 2.1 §10.3.3) and which a block box stacks down its content box, a list item's and a
 * flow root's included.
 */
export const BLOCK_LEVEL: ReadonlySet<string> = new Set(["block", "list-item", "flex", "grid", "flow-root"]);

/**
 * The room a variant root has. Its component set has no auto layout, so it fills nothing and an
 * unset length hugs, except where the definition names the width the root's container gives it: a
 * block-level root, such as a `flex` column, then takes that width, as a block box with no width
 * fills its container less its margins across (CSS 2.1 §10.3.3), where each is the same length in
 * every mode, as a menu separator's `-mx-(--surface-pad-sm)` widens it by 4px on each side at both
 * densities. With no preview width, an in-flow block-level root with no margins, padding or border
 * across takes `100%` as its unset width, which hugs. An in-flow root with no preview width lays out
 * in unbounded room, as {@link Room.unbounded} says, since nothing in its component set gives it a
 * width.
 *
 * @param preview - The width the root's container gives it, which its percentage width takes, and
 *   the height its containing block gives it, which its percentage height takes, each undefined
 *   where the definition names none.
 * @param style - The root's style, whose `display` says whether the root is block-level and whose
 *   `position` whether it sits in its container's flow.
 * @param variables - The synced variables a margin can read, with the values they hold in each mode.
 * @param viewport - The viewport the definition declares, which a fixed root's percentages, `dvh`
 *   and `dvw` take, and whose size its opposing zero insets give it, or undefined for none.
 * @returns The root's room.
 */
export function rootRoom(
  preview: { readonly width: number | undefined; readonly height: number | undefined },
  style: LayerStyle,
  variables: VariableIndex,
  viewport: Viewport | undefined
): Room {
  if (viewport !== undefined && normalizeCss(style.raw("position") ?? "") === "fixed") {
    return viewportRoom(style, viewport);
  }
  const { width: previewWidth, height: previewHeight } = preview;
  const blockLevel = BLOCK_LEVEL.has(normalizeCss(style.raw("display") ?? ""));
  const fills = previewWidth !== undefined && blockLevel;
  const margins = marginsAcross(style, variables) ?? 0;
  const inFlow = !outOfFlow(style);
  const percent = (): PercentBasis => {
    if (previewWidth !== undefined) {
      return { kind: "length", value: previewWidth, of: "the preview" };
    }
    // An absolute root's 100% takes its containing block, while its unset width shrinks to fit.
    return inFlow && blockLevel && noInsetsAcross(style) ? { kind: "unset" } : NO_BASIS;
  };
  return {
    horizontal: {
      percent: percent(),
      auto: fills ? { kind: "fixed", length: { kind: "literal", value: previewWidth - margins } } : HUG,
      siblings: [],
      length: undefined,
    },
    vertical: {
      percent:
        previewHeight === undefined ? NO_BASIS : { kind: "length", value: previewHeight, of: "the preview" },
      auto: HUG,
      siblings: [],
      length: undefined,
    },
    widthCap: NO_CAP,
    unbounded: inFlow && previewWidth === undefined,
  };
}

/**
 * The room of a fixed root in a declared viewport, its containing block (CSS 2.1 §10.1): its
 * percentages take the viewport's width and height, and its `dvh` and `dvw` the viewport. Where both
 * insets of an axis are literal lengths and the root sets no size there, they size it to the viewport
 * less the insets (CSS 2.1 §10.3.7, §10.6.4), as a scrim's `inset-0` fills the window; otherwise the
 * root shrinks to fit, as an absolute box does.
 */
function viewportRoom(style: LayerStyle, viewport: Viewport): Room {
  const axis = (length: number, size: string, insets: readonly [string, string]): AxisRoom => {
    const offsets = insets.map((property) => evaluateLength(style.resolved(property) ?? ""));
    const automatic = normalizeCss(style.resolved(size) ?? "auto") === "auto";
    const [start, end] = offsets;
    return {
      percent: { kind: "length", value: length, of: "the viewport", viewport },
      auto:
        automatic && start !== undefined && end !== undefined
          ? { kind: "fixed", length: { kind: "literal", value: length - start - end } }
          : HUG,
      siblings: [],
      length: undefined,
    };
  };
  return {
    horizontal: axis(viewport.width, "width", ["left", "right"]),
    vertical: axis(viewport.height, "height", ["top", "bottom"]),
    widthCap: NO_CAP,
    unbounded: false,
  };
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

/**
 * Whether a box sets no margin, padding or border across: each margin zero or `auto`, which beside
 * a `100%` width resolves to zero (CSS 2.1 §10.3.3), and each padding and the border zero.
 */
function noInsetsAcross(style: LayerStyle): boolean {
  const margins = ["margin-left", "margin-right"].every((property) => {
    const value = style.resolved(property);
    return value === undefined || normalizeCss(value) === "auto" || evaluateLength(value) === 0;
  });
  return (
    margins &&
    ["padding-left", "padding-right", "border-width", "border-left-width", "border-right-width"].every(
      (property) => literalPixels(style, property) === 0
    )
  );
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
  /** Whether the width CSS makes available to the box is unbounded, as {@link Room.unbounded} says. */
  readonly unbounded: boolean;
  /**
   * Whether the box's width sizing is what CSS gives it, as the sizing's `known` says: false where its
   * `width` does not map and the box hugs in its place.
   */
  readonly widthKnown: boolean;
  /** How much of a row each of `layers` takes, in the same order. */
  readonly shares: readonly RowShare[];
};

/**
 * How much of a row a layer takes along it, its margins included, in pixels, or `unread` where the
 * build does not know before it maps the layer, as for a text or a box that hugs what it holds.
 * `hugs` is an unread share that keeps its own width, as {@link partShare} says.
 */
export type RowShare =
  | { readonly kind: "pixels"; readonly value: number }
  | { readonly kind: "unread" }
  | { readonly kind: "hugs" };

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
 * @returns The share, or `unread` where the part's width is no literal length, as where it hugs, or
 *   `hugs` where it sets no width and neither shrinks nor grows, so it keeps its max-content width
 *   (CSS Flexbox 1 §9.7), as a Figma frame that hugs what it holds draws it.
 */
export function partShare(style: LayerStyle): RowShare {
  const width = style.resolved("width");
  if (width === undefined) {
    return keepsOwnWidth(style) ? { kind: "hugs" } : UNREAD_SHARE;
  }
  const length = evaluateLength(width);
  const margins = horizontalMargins(style);
  return length === undefined || margins === undefined
    ? UNREAD_SHARE
    : { kind: "pixels", value: length + margins };
}

/** Whether a flex item neither shrinks nor grows from its `auto` basis, as `shrink-0` alone sets. */
function keepsOwnWidth(style: LayerStyle): boolean {
  return (
    normalizeCss(style.resolved("flex-shrink") ?? "") === "0" &&
    !style.has("flex") &&
    !style.has("flex-basis") &&
    ["", "0"].includes(normalizeCss(style.resolved("flex-grow") ?? ""))
  );
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

/** How the coverage table names an `align-self: stretch` that {@link selfStretchedRoom} draws. */
const SELF_STRETCH =
  "the item stretches across the counter axis to the flex line less its margins, as a layer that fills that axis does";

/**
 * The room of a flex item that its own `align-self: stretch` stretches across its parent's direction,
 * as Toolbar's separator stretches across the bar. Where the item's length across is unset or `auto`
 * and no margin across is `auto`, it is as long as the flex line less its margins (CSS Flexbox 1 §9.4
 * step 11), which a layer that fills the axis draws, its margin box carrying the margins. That holds
 * only in a single-line flex box, whose one line is the box's content length across (§9.4 step 15).
 * Every other room stays as it was, and the `align-self` stays unread.
 *
 * @param holder - The item's parent.
 * @param style - The item's style.
 * @param room - The room the parent gives the item.
 * @returns The room, filling across where the item stretches.
 */
export function selfStretchedRoom(holder: Holder, style: LayerStyle, room: Room): Room {
  const across = holder.layout.direction === "HORIZONTAL" ? "vertical" : "horizontal";
  const length = across === "vertical" ? "height" : "width";
  const margins = across === "vertical" ? ["margin-top", "margin-bottom"] : ["margin-left", "margin-right"];
  const stretches =
    holder.layout.flex &&
    normalizeCss(holder.style.resolved("flex-wrap") ?? "nowrap") === "nowrap" &&
    normalizeCss(style.resolved("align-self") ?? "auto") === "stretch" &&
    normalizeCss(style.resolved(length) ?? "auto") === "auto" &&
    margins.every((margin) => normalizeCss(style.resolved(margin) ?? "0px") !== "auto");
  if (!stretches) {
    return room;
  }
  style.read(
    "align-self",
    (read) => read,
    () => ({ outcome: "literal", detail: SELF_STRETCH }),
    style.feed("sizing")
  );
  return { ...room, [across]: { ...room[across], auto: FILL } };
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

/** The border sides of each axis, which `border-l` and its siblings set alone. */
const AXIS_BORDERS = {
  horizontal: ["border-left-width", "border-right-width"],
  vertical: ["border-top-width", "border-bottom-width"],
} as const;

/**
 * The pixels a box's borders take on one axis: each side's own width where the box sets one, as
 * `border-r` does, or `border-width` otherwise.
 *
 * @returns The two sides' widths together, or undefined where one is no literal length.
 */
function bordersOn(style: LayerStyle, axis: keyof Extent): number | undefined {
  const sides = AXIS_BORDERS[axis].map((side) =>
    literalPixels(style, style.has(side) ? side : "border-width")
  );
  return sides.some((side) => side === undefined)
    ? undefined
    : sides.reduce<number>((sum, side) => sum + (side ?? 0), 0);
}

/**
 * The length in pixels of a box's content box or padding box on one axis: its length less its
 * borders, and less its padding for the content box.
 */
function innerLength(holder: Holder, axis: keyof Extent, box: "content" | "padding"): number | undefined {
  const outer = holder.extent[axis];
  const borders = bordersOn(holder.style, axis);
  const sides = box === "content" ? SIDES[axis].map((side) => literalPixels(holder.style, side)) : [];
  if (outer === undefined || borders === undefined || sides.some((side) => side === undefined)) {
    return undefined;
  }
  return sides.reduce<number>((rest, side) => rest - (side ?? 0), outer - borders);
}

/** A box's fixed length on one axis and its literal border and padding there, as {@link AxisRoom.outer}. */
function outerOf(holder: Holder, axis: keyof Extent): Pick<AxisRoom, "outer"> {
  const size = holder.sizing[axis];
  const borders = bordersOn(holder.style, axis);
  const sides = SIDES[axis].map((side) => literalPixels(holder.style, side));
  if (size.kind !== "fixed" || borders === undefined || sides.some((side) => side === undefined)) {
    return {};
  }
  return {
    outer: { length: size.length, inset: sides.reduce<number>((sum, side) => sum + (side ?? 0), borders) },
  };
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
  // The containing block bounds the width an absolute box shrinks to fit (CSS 2.1 §10.3.7).
  return {
    horizontal: axisRoom("horizontal"),
    vertical: axisRoom("vertical"),
    widthCap: NO_CAP,
    unbounded: false,
  };
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
 * (CSS 2.1 §10.3.3). Every other length hugs. The part's room is unbounded only where the box hugs
 * its width with nothing bounding it, as {@link hugsUncapped} says.
 *
 * @param holder - The box.
 * @param index - The part's place among the box's layers.
 * @returns The part's room.
 */
export function roomInside(holder: Holder, index: number): Room {
  const { layout, sizing, layers } = holder;
  const percent = (size: SizeSpec): PercentBasis => {
    if (definite(holder, size)) {
      return { kind: "parent" };
    }
    return layout.flex || layout.blocks ? { kind: "hugging" } : NO_BASIS;
  };
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
      percent: autoHeightBasis(layout, sizing.vertical) ?? percent(sizing.vertical),
      auto: HUG,
      siblings: along("VERTICAL"),
      length: innerLength(holder, "vertical", "content"),
      ...outerOf(holder, "vertical"),
    },
    widthCap: widthCapInside(holder, index),
    unbounded: hugsUncapped(holder),
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
    if (share.kind !== "pixels" || gap === undefined) {
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
    return { ...room, vertical: { ...room.vertical, auto: FILL, length: undefined, zeroBasis: true } };
  }
  const { length } = room.horizontal;
  return {
    ...room,
    horizontal: {
      ...room.horizontal,
      auto: FILL,
      zeroBasis: true,
      length: length === undefined ? undefined : lessShares(holder, index, length),
    },
  };
}

/**
 * The `display` values whose box lays what it holds out in a context the kit models as hugging it:
 * unset, which takes an inline or a block box from the element, flow layout, and a flex box.
 */
const FLOW_DISPLAYS: ReadonlySet<string> = new Set([
  "",
  "inline",
  "block",
  "inline-block",
  "flow-root",
  "list-item",
  "flex",
  "inline-flex",
]);

/**
 * Whether a box hugs its width with nothing bounding the width CSS makes available to what it holds.
 *
 * - Its room is unbounded, as {@link Room.unbounded} says.
 * - Its hug is one CSS gives it, as `widthKnown` says, and no `width` that does not map, such as
 *   `w-min`, which can make it narrower than what it holds.
 * - It sets no `max-width` but one of `100%` or more, which never binds there, since every box around
 *   it hugs what it holds.
 * - It lays what it holds out in a context the kit models as hugging it, flow or flex, as
 *   {@link FLOW_DISPLAYS} lists. A grid sizes each item against its track (CSS Grid 1 §6.2), which
 *   the kit does not read, and no other context is modeled.
 *
 * Such a box lays what it holds out at its max-content width (CSS Sizing 3 §5.1), so its row never
 * runs out of room, a text in it sets no line narrower than a word, and each layer it holds has
 * unbounded room too.
 *
 * @param holder - The box.
 * @returns True where the box hugs and nothing bounds it.
 */
export function hugsUncapped(holder: Holder): boolean {
  const maximum = holder.style.resolved("max-width");
  const unlimited =
    maximum === undefined || normalizeCss(maximum) === "none" || (evaluatePercentage(maximum) ?? 0) >= 1;
  return (
    holder.sizing.horizontal.kind === "hug" &&
    holder.widthKnown &&
    holder.unbounded &&
    unlimited &&
    FLOW_DISPLAYS.has(normalizeCss(holder.style.raw("display") ?? ""))
  );
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
  const insets = [
    ...["padding-left", "padding-right"].map((property) => literalPixels(holder.style, property)),
    bordersOn(holder.style, "horizontal"),
  ];
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
    if (only.has(axis.length) && !replacesAutomaticMinimum(only, axis)) {
      return undefined;
    }
    const fills = only.read(
      "flex",
      one,
      () => ({
        outcome: "literal",
        detail: `the one layer that grows fills the room the ${axis.flow}'s other layers leave`,
      }),
      only.feed("sizing")
    );
    return fills === undefined ? undefined : parts.indexOf(only);
  }
  // A zero minimum never lengthens the box, and any other limit along the axis can.
  const limited =
    style.has(axis.max) || (style.has(axis.min) && evaluateLength(style.resolved(axis.min) ?? "") !== 0);
  if (!limited) {
    only.read(
      "flex",
      one,
      () => ({
        outcome: "dropped",
        detail: `the ${axis.flow} hugs its layers, so the one layer that grows has no room to grow into`,
      }),
      []
    );
  }
  return undefined;
}

/**
 * Whether a growing layer sets its own minimum along its parent's direction, which replaces the
 * automatic minimum (CSS Flexbox 1 §4.5). The automatic minimum reads the layer's own length as its
 * specified size suggestion, so without a minimum of its own that length can still widen it.
 */
function replacesAutomaticMinimum(layer: LayerStyle, axis: AxisProperties): boolean {
  const minimum = layer.resolved(axis.min);
  return minimum !== undefined && normalizeCss(minimum) !== "auto";
}

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

function boxHeightBounds(box: BoxSpec, variables: VariableIndex): HeightBounds {
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
  const layers = box.direction === "VERTICAL" ? sum([...heights, gaps]) : tallest(heights);
  const hugged = sum([
    lengthBounds(box.paddingTop, variables),
    layers,
    lengthBounds(box.paddingBottom, variables),
    lengthBounds(strokeRoom(box.stroke, "top"), variables),
    lengthBounds(strokeRoom(box.stroke, "bottom"), variables),
  ]);
  return withinLimits(hugged, box.limits, variables);
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
 * A box's sizing on each axis, the limits Figma keeps it within, whether it clips, its length in
 * pixels where the build can tell it, and whether each axis's sizing is what CSS gives it.
 */
type BoxSizing = Pick<BoxSpec, "sizing" | "limits" | "clips"> & {
  readonly extent: Extent;
  /**
   * Whether each axis's sizing is what CSS gives the box: its length read, or unset and sized as its
   * room says. False where a length does not map, as `w-min` does not, and the axis hugs in its place.
   */
  readonly known: { readonly horizontal: boolean; readonly vertical: boolean };
};

/**
 * What a `fit-content` width draws as. `fit-content` is the smaller of what the box holds on one line
 * and the room its parent gives it (CSS Sizing 3 §5.1). A kit frame's default content fits its room,
 * so the width hugs (`content`). A box whose text wraps at that room, and that draws the same at the
 * room's width, fills the room where its parent stretches it (`room`), as `box-mapping.ts` decides.
 */
export type FitContent = "content" | "room";

/** The properties that clip a box's overflow, on both axes and on each. */
const OVERFLOWS = ["overflow", "overflow-x", "overflow-y"] as const;

/**
 * The overflow values that clip a box's content at its padding box. `auto` and `scroll` scroll it
 * too, which a static frame does not show (CSS Overflow 3 §3).
 */
const CLIPPING: ReadonlySet<string> = new Set(["hidden", "clip", "auto", "scroll"]);

/**
 * Read a box's sizing and limits on both axes, `field-sizing: content`, and its overflow.
 * `field-sizing: content` sizes a form control to its content on each side no length sets (CSS
 * Basic UI 4). The kit hugs such a side already, so it reads where the height hugs. An `overflow`,
 * `overflow-x` or `overflow-y` of `hidden`, `clip`, `auto` or `scroll` clips the box's content at
 * its padding box, as Figma's clipping does. A part shows what overflows it otherwise, as a CSS box
 * does, and a variant root clips whatever it sets.
 *
 * @param reader - The box's style.
 * @param room - What the box's parent gives it.
 * @param variables - The synced variables a length can bind.
 * @param fit - What a `fit-content` width draws as.
 * @param inside - The sizing of the layers inside the box, which its lengths and limits decide too:
 *   whether a layer fills or hugs, the length a share takes, and where a text wraps.
 * @returns The box's sizing, limits, clipping and extent.
 */
export function readSizing(
  reader: LayerStyle,
  room: Room,
  variables: VariableIndex,
  fit: FitContent,
  inside: Feed
): BoxSizing {
  // A parent that hugs its width with nothing bounding it is as wide as each layer it holds.
  const roomy = room.horizontal.percent.kind === "hugging" && room.unbounded;
  const horizontal = readAxis(reader, WIDTH, room.horizontal, variables, { fit, inside, roomy });
  const vertical = readAxis(reader, HEIGHT, room.vertical, variables, {
    fit: "content",
    inside,
    roomy: false,
  });
  reader.read(
    "field-sizing",
    (value) => (normalizeCss(value) === "content" && vertical.size.kind === "hug" ? value : undefined),
    () => ({ outcome: "literal", detail: "the height hugs its content" }),
    reader.feed("sizing")
  );
  // A `visible` axis beside one that clips computes to `auto` (CSS Overflow 3 §3), so either clips both.
  const clips = OVERFLOWS.map((property) =>
    reader.read(
      property,
      (value) => (CLIPPING.has(normalizeCss(value)) ? true : undefined),
      () => ({ outcome: "literal", detail: "the box clips its content" }),
      reader.feed("clips")
    )
  ).some((clipped) => clipped === true);
  return {
    sizing: { horizontal: horizontal.size, vertical: vertical.size },
    limits: {
      minWidth: horizontal.min,
      maxWidth: horizontal.max,
      minHeight: vertical.min,
      maxHeight: vertical.max,
    },
    clips,
    known: { horizontal: horizontal.known, vertical: vertical.known },
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

/** Why a maximum of the whole parent or more drops in a parent as wide as each layer it holds. */
const WHOLE_PARENT_MAXIMUM =
  "its parent hugs what it holds and nothing bounds the width CSS gives the parent, so 100% of the parent is never narrower than the box";

const CAPPED_LENGTH =
  "the 100% maximum lowers the height to the parent's content height, which a fill down draws";
const CAPPING_MAXIMUM = "the box fills its parent's content height, which the height reaches";

/**
 * Whether a box's `max-height: 100%` lowers its height to its parent's content height (CSS 2.1 §10.5,
 * §10.7): the parent's length is fixed, and the box's own height is that length's variable, or literal
 * pixels at least the parent's content height. Then the box is exactly as tall as the parent's
 * content box, which a fill down draws. Only the height is read this way, and only with no minimum
 * beside it, which could raise the height again.
 */
function capsAtParent(
  reader: LayerStyle,
  axis: AxisProperties,
  room: AxisRoom,
  variables: VariableIndex
): boolean {
  const { outer } = room;
  const maximum = reader.resolved(axis.max);
  const own = reader.resolved(axis.length);
  if (
    axis !== HEIGHT ||
    outer === undefined ||
    maximum === undefined ||
    own === undefined ||
    reader.has(axis.min)
  ) {
    return false;
  }
  if (evaluatePercentage(maximum) !== 1) {
    return false;
  }
  const length = readNumber(own, variables);
  if (length === undefined) {
    return false;
  }
  if (sameVariable(length, outer.length)) {
    return true;
  }
  return (
    length.kind === "literal" &&
    outer.length.kind === "literal" &&
    length.value >= outer.length.value - outer.inset
  );
}

/**
 * Read a `min-*` or `max-*` as a length: a synced variable or a literal, or, against a declared
 * viewport, a `calc()`, `min()` or `max()` that mixes percentages with lengths, its `dvh` and `dvw`
 * read against that viewport, as Dialog's `max-h-[calc(100%-2rem)]` resolves in
 * its viewport.
 */
function readLimit(value: string, variables: VariableIndex, percent: PercentBasis): NumberSpec | undefined {
  const own = readNumber(value, variables);
  if (own !== undefined || percent.kind !== "length" || percent.viewport === undefined) {
    return own;
  }
  const resolved = evaluateLengthOf(inViewport(value, percent.viewport), percent.value);
  return resolved === undefined ? undefined : { kind: "literal", value: resolved };
}

/**
 * Read one axis: its length through {@link readLength}, an unset length as the room gives it, and
 * its limits as {@link resolveLimits} decides. Each read fills the sizing of the layers inside too,
 * as `inside` names it. Where the parent is at least as long as each layer it holds (`roomy`), a
 * maximum of `100%` or more never limits the box, so it drops. A length that does not map leaves
 * the axis hugging in its place, which the result marks as not `known`.
 */
function readAxis(
  reader: LayerStyle,
  axis: AxisProperties,
  room: AxisRoom,
  variables: VariableIndex,
  { fit, inside, roomy }: { readonly fit: FitContent; readonly inside: Feed; readonly roomy: boolean }
): AxisRead & { readonly known: boolean } {
  if (capsAtParent(reader, axis, room, variables)) {
    reader.read(
      axis.length,
      () => FILL,
      () => ({ outcome: "dropped", detail: CAPPED_LENGTH }),
      []
    );
    reader.read(
      axis.max,
      () => FILL,
      () => ({ outcome: "literal", detail: CAPPING_MAXIMUM }),
      [...reader.feed("sizing"), ...inside]
    );
    return { size: FILL, min: undefined, max: undefined, notes: new Map(), known: true };
  }
  const read = reader.has(axis.length)
    ? readLength(reader, axis, room, variables, { fit, inside })
    : room.auto;
  const size = read ?? HUG;
  const maximum = reader.resolved(axis.max);
  const inertMaximum = roomy && maximum !== undefined && (evaluatePercentage(maximum) ?? 0) >= 1;
  if (inertMaximum) {
    reader.read(
      axis.max,
      (value) => value,
      () => ({ outcome: "dropped", detail: WHOLE_PARENT_MAXIMUM }),
      []
    );
  }
  const popupMaximum = roomyMaximum(axis.max, reader.raw(axis.max) ?? "", variables);
  // Nothing sets the available room outside a positioner, so the value never resolves and the
  // maximum is marked rather than read.
  if (popupMaximum?.kind === "none") {
    reader.mark(axis.max, "dropped", withRoom(axis.max), []);
  }
  const bounds = (["min", "max"] as const).flatMap((side): Bound[] => {
    const property = axis[side];
    if (side === "max" && popupMaximum !== undefined) {
      return popupMaximum.kind === "length" ? [{ side, property, value: popupMaximum.value }] : [];
    }
    const value = reader.resolved(property);
    return value === undefined || (side === "max" && inertMaximum)
      ? []
      : [{ side, property, value: readLimit(value, variables, room.percent) }];
  });
  const limited = resolveLimits(size, bounds, axis);
  // Each note was decided from the value the read substitutes, so the read only records it.
  for (const [bound, note] of limited.notes) {
    // A limit that stays a limit fills the box's limits, and one that folds into the length its sizing.
    const limit = bound.side === "min" ? limited.min : limited.max;
    const feed = [...reader.feed(limit === undefined ? "sizing" : "limits"), ...inside];
    if (bound.side === "max" && popupMaximum !== undefined && note !== undefined) {
      reader.mark(bound.property, note.outcome, `${note.detail}, since ${withRoom(axis.max)}`, feed);
      continue;
    }
    reader.read(
      bound.property,
      () => note,
      (decided) => decided,
      feed
    );
  }
  return { ...limited, known: read !== undefined };
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
 * {@link FitContent} says, and hugs otherwise. The read fills the sizing of the layers inside too,
 * as `inside` names it.
 *
 * @returns The sizing, or undefined when the value does not map.
 */
function readLength(
  reader: LayerStyle,
  axis: AxisProperties,
  room: AxisRoom,
  variables: VariableIndex,
  { fit, inside }: { readonly fit: FitContent; readonly inside: Feed }
): SizeSpec | undefined {
  const { siblings, percent } = room;
  if (room.zeroBasis === true) {
    // `readGrowth` lets a growing layer keep a length only where its own minimum stands in for the
    // automatic one, so the zero basis alone sizes it along its parent's direction.
    reader.read(
      axis.length,
      () => room.auto,
      () => ({
        outcome: "dropped",
        detail: `the layer grows from a zero flex basis, which sizes it along the ${axis.flow} in place of its ${axis.length}, and its own ${axis.min} replaces the automatic minimum that would read the ${axis.length}`,
      }),
      []
    );
    return room.auto;
  }
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
      // A percentage that computes to `auto` sizes the box by its content, so siblings share nothing.
      if (share === 1 && siblings.length > 0 && percent.kind !== "auto") {
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
          return {
            outcome: "literal",
            detail:
              percent.kind === "auto" && share !== undefined
                ? AUTO_HEIGHT
                : share === 1 && percent.kind === "unset"
                  ? "100% sizes an in-flow block-level box with no margins, padding or border as its unset width does, which hugs, since the root sits alone in its component set"
                  : "the box hugs its content",
          };
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
    },
    [...reader.feed("sizing"), ...inside]
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
