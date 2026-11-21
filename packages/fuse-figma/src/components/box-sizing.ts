import type { MeasuredBox, RatioBox } from "./box-cascade";
import { bordersOn, literalPixels, SIDES } from "./box-insets";
import { readCentredGrowth } from "./centred-row";
import type { CentredGrowth } from "./centred-row";
import type { PreviewLength } from "./component-spec";
import { readContentShares } from "./content-shares";
import {
  affineLength,
  describeNumber,
  evaluateLength,
  evaluateLengthOf,
  evaluateNumber,
  evaluatePercentage,
  inViewport,
  normalizeCss,
  readNumber,
} from "./css-values";
import type { VariableIndex, Viewport } from "./css-values";
import { keepsOwnSize, keepsOwnWidth } from "./flex-item-width";
import { cellRoom } from "./grid-layout";
import type { InstancePlace } from "./hugging-rows";
import { fixedLength, outOfLayout, strokeRoom } from "./kit-spec";
import type {
  BoxSpec,
  ChildLayerSpec,
  DirectionSpec,
  GridSpec,
  LimitsSpec,
  NumberSpec,
  RotationSpec,
  SizeSpec,
  SizingSpec,
  TextLayerSpec,
} from "./kit-spec";
/**
 * How a box sizes each axis, read from its CSS and from the room its parent gives it: the length
 * a `width` or `height` sets, a `100%` that fills its parent, a share of a length in pixels, the
 * stretch a column gives an unset width, the `min-*` and `max-*` limits, and whether the box's
 * `overflow` clips it. `box-mapping.ts` reads a box's sizing before it maps the
 * box's parts, then asks this module for the room each part gets, in the box's flow or, for an
 * absolute part, against its containing block. `label-layout.ts` reads the box's own text against
 * the same holder.
 */
import type { CoverageNote, Feed, LayerStyle } from "./layer-style";
import { AUTO_HEIGHT, autoHeightBasis } from "./percent-height";
import type { Layout } from "./placement";
import { roomyMaximum, withRoom } from "./popup-room";
import { readSize } from "./sizing-value";
import type { PercentBasis } from "./sizing-value";
import { spannedWidth, spansBesideBlocks, spansParent, SPANS_HUGGING_PARENT } from "./spanning-block";
import { subgridCellRoom } from "./subgrid-row";
import type { SubgridCell } from "./subgrid-row";
import { computedLineHeight } from "./typography";
import { limitsNeverMoveVariable } from "./variable-limits";

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
  /**
   * Where `absolute-placement.ts` stretches the box between its distances to its parent's edges: the
   * note its length reads with, and the length the place leaves it where the build knows the parent's
   * padding box, which the box draws as a literal, or none, which the spec names `placed`. Absent
   * elsewhere.
   */
  readonly placed?: {
    /** The coverage table's note on the length's declaration. */
    readonly detail: string;
    /** The length the placement leaves the box, where the parent's padding box is a literal. */
    readonly length: number | undefined;
  };
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
  /**
   * A subgrid row's cell, and the width it fills up to, as `subgridCellRoom` gives them. Absent
   * elsewhere.
   */
  readonly subgridCell?: SubgridCell;
};

const HUG: SizeSpec = { kind: "hug" };
/** The length a box's placement leaves it where the build cannot tell its parent's, as `SizeSpec` says. */
const PLACED: SizeSpec = { kind: "placed" };
const FILL: SizeSpec = { kind: "fill" };
const NO_BASIS: PercentBasis = { kind: "none" };

/**
 * The displays that make a box block-level (CSS Display 3 §2.1), whose unset width fills its
 * container (CSS 2.1 §10.3.3) and which a block box stacks down its content box, a list item's and a
 * flow root's included, and a table caption's, a block box in its table's wrapper box, as wide as the
 * table (CSS 2.1 §17.4).
 */
export const BLOCK_LEVEL: ReadonlySet<string> = new Set([
  "block",
  "list-item",
  "flex",
  "grid",
  "flow-root",
  "table-caption",
]);

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
 *   where the definition names none, and the host's height where the flex rows around a root of
 *   `auto` height stretch it there, which its unset height takes, as `stretchedToHost` in
 *   `percent-height.ts` reads it.
 * @param style - The root's style, whose `display` says whether the root is block-level and whose
 *   `position` whether it sits in its container's flow.
 * @param variables - The synced variables a margin can read, with the values they hold in each mode.
 * @param viewport - The viewport the definition declares, which a fixed root's percentages, `dvh`
 *   and `dvw` take, and whose size its opposing zero insets give it, or undefined for none.
 * @returns The root's room.
 */
export function rootRoom(
  preview: {
    readonly width: number | undefined;
    readonly height: PreviewLength | undefined;
    readonly stretched?: number | undefined;
  },
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
        previewHeight === undefined
          ? NO_BASIS
          : { kind: "length", value: previewHeight.pixels, of: "the preview", css: previewHeight.css },
      auto:
        preview.stretched === undefined
          ? HUG
          : { kind: "fixed", length: { kind: "literal", value: preview.stretched } },
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
 *
 * @param style - The fixed root's style.
 * @param viewport - The viewport its definition declares.
 * @returns The root's room.
 */
export function viewportRoom(style: LayerStyle, viewport: Viewport): Room {
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
   * The box's layers in the cell that sit in its flow, in layer order, its parts first. An absolute
   * part sits outside it.
   */
  readonly layers: readonly RowLayer[];
  /** The cap the boxes around the box set on its width, from its room. */
  readonly widthCap: WidthCap;
  /** Whether the width CSS makes available to the box is unbounded, as {@link Room.unbounded} says. */
  readonly unbounded: boolean;
  /**
   * Whether the box's width sizing is what CSS gives it, as the sizing's `known` says: false where its
   * `width` does not map and the box hugs in its place.
   */
  readonly widthKnown: boolean;
};

/** A layer in a box's flow. */
export type RowLayer = {
  /** The layer's name in the cell. */
  readonly name: string;
  /** How much of a row the layer takes. */
  readonly share: RowShare;
  /** What the layer is: one of the box's parts, one of its icons, or its own label. */
  readonly kind: "part" | "icon" | "label";
  /** The layer's style, or undefined for the box's own label. */
  readonly style: LayerStyle | undefined;
  /** The tag of a part's element, where the capture holds one, or undefined for an icon or the label. */
  readonly tag: string | undefined;
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
 * The room of a flex item that stretches across its parent's direction: by its own `align-self:
 * stretch`, as Toolbar's separator stretches across the bar, or, in a row of a fixed height, by an
 * `align-self` and an `align-items` that neither the item nor the row sets, whose `auto` and `normal`
 * stretch it (CSS Box Alignment 3 §6.1), as List detail's root stretches its list and its pane down.
 * A row that hugs its height keeps its items' own heights: there Figma's fill sizes against the row's
 * other layers, and the kit check refuses a layer that fills a hugging parent beside none that sets
 * its height, as Radio row's label would. Where the item's
 * length across is unset or `auto` and no margin across is `auto`, it is as long as the flex line
 * less its margins (CSS Flexbox 1 §9.4 step 11), which a layer that fills the axis draws, its margin
 * box carrying the margins. That holds where the box's one line is its content length across: a
 * single-line flex box's line is (§9.4 step 15), and so is the one line of a wrapping row that
 * `wrapsOnOneLine` in `box-mapping.ts` reads. A column's unset `align-items` stretches its layers
 * through `roomInside`. Every other room stays as it was, and an `align-self` stays unread.
 *
 * @param holder - The item's parent.
 * @param style - The item's style.
 * @param room - The room the parent gives the item.
 * @param lines - Whether the parent lays its items out on one line as long as its content box across,
 *   or may break them into several.
 * @returns The room, filling across where the item stretches.
 */
export function selfStretchedRoom(
  holder: Holder,
  style: LayerStyle,
  room: Room,
  lines: "one" | "several"
): Room {
  const across = holder.layout.direction === "HORIZONTAL" ? "vertical" : "horizontal";
  const length = across === "vertical" ? "height" : "width";
  const margins = across === "vertical" ? ["margin-top", "margin-bottom"] : ["margin-left", "margin-right"];
  const own = normalizeCss(style.resolved("align-self") ?? "auto") === "stretch";
  const unset =
    across === "vertical" &&
    holder.sizing.vertical.kind === "fixed" &&
    !style.has("align-self") &&
    !holder.style.has("align-items");
  const stretches =
    holder.layout.flex &&
    lines === "one" &&
    (own || unset) &&
    normalizeCss(style.resolved(length) ?? "auto") === "auto" &&
    margins.every((margin) => normalizeCss(style.resolved(margin) ?? "0px") !== "auto");
  if (!stretches) {
    return room;
  }
  if (own) {
    style.read(
      "align-self",
      (read) => read,
      () => ({ outcome: "literal", detail: SELF_STRETCH }),
      style.feed("sizing")
    );
  }
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

/**
 * The CSS of a box's content length on one axis, where the box's length is fixed and its border and
 * padding there are literal: the length's own CSS, a variable's `var()` or pixels, less them.
 */
function contentCss(holder: Holder, axis: keyof Extent): string | undefined {
  const outer = outerOf(holder, axis).outer;
  if (outer === undefined) {
    return undefined;
  }
  const length =
    outer.length.kind === "literal"
      ? `${String(outer.length.value)}px`
      : `var(--${outer.length.variable.name})`;
  return outer.inset === 0 ? length : `calc(${length} - ${String(outer.inset)}px)`;
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
 * `normal` does for flex items, or a grid in one column, whose items its unset `justify-items`
 * stretches across (CSS Box Alignment 3 §6.1), since a grid's `align-items` places them down.
 */
function stretches({ style, layout }: Pick<Holder, "style" | "layout">): boolean {
  return (
    layout.oneColumnGrid === true ||
    (layout.flex && layout.direction === "VERTICAL" && !style.has("align-items"))
  );
}

/**
 * Where a part sits in its box, for an instance part as `settleInstanceRoot` in `hugging-rows.ts`
 * reads it: `column-start` where the box stretches the part across, as {@link roomInside} gives it
 * a filling width, a column whose unset `align-items` stretches it, a grid in one column or a box
 * that stacks blocks, and the box's Figma layout places a layer that hugs at its start, where CSS
 * starts a part narrower than the stretch (CSS Box Alignment 3 §6.1, CSS 2.1 §10.3.3). The part
 * sets no auto margin across, which would move it, and no `align-self` but `stretch`. A part that
 * grows along a row, or that an `align-self` stretches in a column that ends its layers, sits
 * `elsewhere`, as does every other part.
 *
 * @param box - The box's style and layout.
 * @param part - The part's style.
 * @param room - The room the box gives the part.
 * @returns Where the part sits.
 */
export function instancePlace(
  box: Pick<Holder, "style" | "layout">,
  part: LayerStyle,
  room: Room
): InstancePlace {
  const { layout } = box;
  const unmoved = ["margin-left", "margin-right"].every(
    (property) => normalizeCss(part.resolved(property) ?? "0px") !== "auto"
  );
  const self = normalizeCss(part.resolved("align-self") ?? "auto");
  return room.horizontal.auto.kind === "fill" &&
    room.horizontal.zeroBasis !== true &&
    layout.direction === "VERTICAL" &&
    (stretches(box) || layout.blocks) &&
    layout.counterAlign === "MIN" &&
    unmoved &&
    ["auto", "normal", "stretch"].includes(self)
    ? "column-start"
    : "elsewhere";
}

/**
 * Whether a flex box's length on an axis is definite: fixed, or filling a definite length. A box that
 * stacks blocks is one too, as the containing block its blocks size against.
 */
function definite({ layout }: Holder, size: SizeSpec): boolean {
  return (layout.flex || layout.blocks) && size.kind !== "hug";
}

/** Whether a box sets a `min-width` above zero, which can widen it past what it holds. */
export function setsMinimumWidth(style: LayerStyle): boolean {
  const minimum = normalizeCss(style.resolved("min-width") ?? "auto");
  return !["auto", "0", "0px"].includes(minimum);
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
  if (layout.grid !== undefined) {
    return cellRoom(layout.grid, index);
  }
  if (layout.subgrid?.kind === "item") {
    return subgridCellRoom(layout.subgrid, index);
  }
  const percent = (size: SizeSpec, axis: keyof Extent): PercentBasis => {
    if (definite(holder, size)) {
      // Along a flex box's direction a part's length is its basis, which it grows or shrinks from
      // beside its margins and its siblings, so only a part across the direction takes the whole
      // content length as the length its own reads against.
      const along = layout.flex && (axis === "horizontal") === (layout.direction === "HORIZONTAL");
      return { kind: "parent", css: along ? undefined : contentCss(holder, axis) };
    }
    // A box that stacks blocks shrinks to fit its one block, which its whole width then spans, but
    // only where nothing sets that width but the block: no minimum or maximum of the box's own, and no
    // room around it that could bind, as `hugsUncapped` says. Otherwise the percentage takes the
    // width those set (CSS Sizing 3 §5.2.1), which the build does not resolve.
    const alone = layout.blocks && layers.length === 1;
    const uncapped = hugsUncapped(holder) && !setsMinimumWidth(holder.style);
    return layout.flex || layout.blocks ? { kind: "hugging", only: alone && uncapped, uncapped } : NO_BASIS;
  };
  if (layout.centresLone === true) {
    return centredRoom(holder);
  }
  const siblings = layers.filter((_layer, place) => place !== index).map(({ name }) => name);
  const along = (axis: DirectionSpec): readonly string[] =>
    (layout.flex || layout.blocks) && layout.direction === axis ? siblings : [];
  return {
    horizontal: {
      percent: percent(sizing.horizontal, "horizontal"),
      auto: (stretches(holder) || layout.blocks) && definite(holder, sizing.horizontal) ? FILL : HUG,
      siblings: along("HORIZONTAL"),
      length: innerLength(holder, "horizontal", "content"),
    },
    vertical: {
      percent: autoHeightBasis(layout, sizing.vertical) ?? percent(sizing.vertical, "vertical"),
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
 * The room a flex column gives the one layer its auto margins centre, as `readCentredLone` in
 * `auto-margins.ts` reads it. Auto margins across stop the stretch, so the layer hugs its width up to the
 * column's content width (CSS Flexbox 1 §9.4 step 11), which caps the text inside it. The content
 * width is the column's measured length, or its fixed literal width, less its border and padding. The
 * layer's height hugs. A content width the build cannot read in pixels leaves the cap unread.
 *
 * @param holder - The column.
 * @returns The layer's room.
 */
function centredRoom(holder: Holder): Room {
  const { outer } = outerOf(holder, "horizontal");
  const width =
    innerLength(holder, "horizontal", "content") ??
    (outer?.length.kind === "literal" ? outer.length.value - outer.inset : undefined);
  const vertical = innerLength(holder, "vertical", "content");
  return {
    horizontal: { percent: NO_BASIS, auto: HUG, siblings: [], length: width },
    vertical: { percent: NO_BASIS, auto: HUG, siblings: [], length: vertical },
    widthCap: width === undefined ? UNREAD_CAP : { kind: "pixels", value: width },
    unbounded: false,
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
  const others = holder.layers.filter((_layer, place) => place !== index).map(({ share }) => share);
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
 * The room of a row's part that fits its content to what the row leaves it, as
 * `fitting-part.ts` decides: it fills, and its length is the row's content length less the other
 * layers, their margins across and the gaps, or unknown where one of them does not read in pixels.
 * A width that binds a synced variable reads in none, so beside it the length is unknown, and only a
 * part whose least width is 0 draws there, as `fitsRoom` says.
 *
 * @param holder - The row.
 * @param index - The part's place in the row's flow.
 * @param room - The room the row gives the part.
 * @returns The part's room.
 */
export function fittingRoom(holder: Holder, index: number, room: Room): Room {
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
 * stretch has no Figma form where a part sets no width of its own. A column that holds one layer in
 * its flow and sets no `min-width` or `max-width` is as wide as that layer (CSS Flexbox 1 §9.2), so
 * its stretch draws as the hug it is.
 *
 * @param holder - The box.
 * @param parts - The style of each part the box holds.
 * @returns The `align-items` the column is missing, or undefined where every stretch draws.
 */
export function unstretched(holder: Holder, parts: readonly LayerStyle[]): MissingDeclaration | undefined {
  // A column that hugs its one layer with no limit of its own is as wide as that layer, so stretching
  // it there changes nothing.
  const alone =
    holder.layers.length === 1 &&
    holder.limits.minWidth === undefined &&
    holder.limits.maxWidth === undefined;
  return stretches(holder) &&
    !alone &&
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
 * The part that grows along its box's direction: its place among the parts in the box's flow, and
 * whether it `fills` the room there, and is the box's one layer, which grows from its content, as
 * `loneGrowth` reads it, where a `flex: 1` part grows from a zero basis, or is `centred` between two
 * others, as `readCentredGrowth` in `centred-row.ts` reads it.
 */
export type Growth =
  | { readonly kind: "fills"; readonly place: number; readonly alone: boolean }
  | CentredGrowth;

/** The properties that size a flex item along its line, which nothing reads outside a flex box. */
const FLEX_ITEM = ["flex", "flex-grow", "flex-shrink", "flex-basis"] as const;

/** Why a block's part drops its flex. */
const NO_FLEX_ITEM =
  "the part's box is a block container, so the part is no flex item and its flex sizes nothing (CSS Flexbox 1 §7)";

/**
 * Read how the parts in a box's flow size along its direction as items. A block container lays its
 * parts out as blocks and inlines and reads no flex (CSS Flexbox 1 §7), so each part's flex drops.
 * Any other box reads the parts' `flex` as {@link readGrowth} says.
 *
 * @param holder - The box.
 * @param parts - The style of each part in the box's flow.
 * @param measured - What {@link readGrowth} reads from the capture's measurement and the parts.
 * @param block - Whether the box is a plain block container, as `isPlainBlock` reads it.
 * @returns The part that fills the box along its direction, or undefined for none.
 */
export function readItemSizing(
  holder: Holder,
  parts: readonly LayerStyle[],
  measured: GrowthMeasure,
  block: boolean
): Growth | undefined {
  if (!block) {
    return readGrowth(holder, parts, measured);
  }
  for (const part of parts) {
    for (const property of FLEX_ITEM) {
      part.read(
        property,
        (value) => value,
        () => ({ outcome: "dropped", detail: NO_FLEX_ITEM }),
        []
      );
    }
  }
  return undefined;
}

/**
 * Why a `flex` that keeps the item's own size drops, as `none` does.
 *
 * @param written - The `flex` as written.
 */
function noFlex(written: string): string {
  return `\`${normalizeCss(written)}\` neither grows nor shrinks the item from its own size (CSS Flexbox 1 §7.1.1), as Figma's auto layout keeps a fixed or hugging layer`;
}

/**
 * Read the `flex` of the parts in a flex box's flow. A box that hugs its length along its direction,
 * with no limit there that can change that length, is as long as its layers, so it leaves no free
 * space (CSS Flexbox 1 §9.7), and the one part that grows keeps its own length, as `flex: 1` does
 * from its zero basis. In a box of definite length along its direction the one part that grows takes
 * the room the others leave, which Figma's fill takes, where it sets no length of its own along the
 * direction, since its zero basis ignores one. Any other `flex` stays unread, so it lands unmapped: a
 * minimum can leave room past the layers and a maximum can take room away, and two parts that grow
 * share the free space by their grow, except where the capture measured each at its own content
 * width, as `content-shares.ts` reads them.
 *
 * @param holder - The box.
 * @param parts - The style of each part in the box's flow.
 * @param measured - The capture's measurement that the box's content stays under its `max-height`,
 *   and that its growing parts each stay at their own content width, and which parts hold only a
 *   label.
 * @returns The part that fills the box along its direction, or undefined for none.
 */
function readGrowth(
  holder: Holder,
  parts: readonly LayerStyle[],
  measured: GrowthMeasure
): Growth | undefined {
  const { underMaxHeight } = measured;
  const { layout, sizing, style } = holder;
  const horizontal = layout.direction === "HORIZONTAL";
  const along = horizontal ? sizing.horizontal : sizing.vertical;
  const axis = horizontal ? WIDTH : HEIGHT;
  for (const part of parts.filter(keepsOwnSize)) {
    part.read(
      "flex",
      (value) => value,
      (written) => ({ outcome: "dropped", detail: noFlex(written) }),
      []
    );
  }
  const growing = parts.filter((part) => part.has("flex") && !keepsOwnSize(part));
  if (readContentShares(holder, growing, measured.itemsAtContent)) {
    return undefined;
  }
  const lone = loneGrowth(holder, parts, growing);
  if (lone !== undefined) {
    return lone;
  }
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
    return fills === undefined ? undefined : { kind: "fills", place: parts.indexOf(only), alone: false };
  }
  const centred = readCentredGrowth(holder, parts, measured.labelOnly, keepsOwnWidth);
  if (centred !== undefined) {
    return centred;
  }
  // A zero minimum never lengthens the box, and any other limit along the axis can. A maximum the
  // definition's measurement says the content stays under never limits the box at all.
  const capped = style.has(axis.max) && !(axis === HEIGHT && underMaxHeight !== undefined);
  // A least width the box takes from beside it, as `spannedWidth` gives one, leaves room past its layers too.
  const limited =
    capped ||
    (style.has(axis.min) && evaluateLength(style.resolved(axis.min) ?? "") !== 0) ||
    (horizontal && holder.limits.minWidth !== undefined);
  if (!limited) {
    only.read(
      "flex",
      one,
      () => ({
        outcome: "dropped",
        detail:
          style.has(axis.max) && underMaxHeight !== undefined
            ? `the ${axis.flow} hugs its layers under its max-height, ${underMaxHeight}, so the one layer that grows has no room to grow into`
            : `the ${axis.flow} hugs its layers, so the one layer that grows has no room to grow into`,
      }),
      []
    );
  }
  return undefined;
}

/** Why a lone layer's `flex-grow` draws as a fill. */
const LONE_GROWTH =
  "the row's one layer grows from its content into all the room the row has, and shrinks to it where its content is wider, which a fill takes";

/**
 * Read the `flex-grow` of a flex row's one layer, which sets no `flex` shorthand, basis, width,
 * width limit or margin across, since a margin takes room the fill would draw. A layer with a `flex` shorthand of its own, as `flex-none` sets, keeps the
 * shorthand's reading, so a `flex-grow` beside it stays unread. Its basis is its content (CSS Flexbox 1 §7.2.3). With no other layer to share the
 * room, a grow of 1 or more takes all the free space, and a shrink of 1 or more gives back all the
 * overflow; a factor below 1 takes or gives back only that share (§9.7). So the layer is as wide as
 * the row's content, as a fill is, down to its automatic minimum, its min-content width (§4.5),
 * which a fill does not keep, as with `flex: 1`. A width or limit of its own can take it past the
 * row or short of it, and a row that hugs has no free space, so each leaves the layer as it is. A
 * column's layer is not read here.
 *
 * @param holder - The row.
 * @param parts - The style of each part in the row's flow.
 * The fill draws the layer only where its least width fits the row in every mode, which the mapping
 * checks once the layer maps, as `fitsRoom` says.
 *
 * @param holder - The row.
 * @param parts - The style of each part in the row's flow.
 * @param growing - The parts that set a `flex` shorthand.
 * @returns The one part, where it fills; undefined otherwise.
 */
function loneGrowth(
  holder: Holder,
  parts: readonly LayerStyle[],
  growing: readonly LayerStyle[]
): Growth | undefined {
  const { layout, sizing, layers } = holder;
  const [lone] = parts;
  if (
    !layout.flex ||
    layout.direction !== "HORIZONTAL" ||
    growing.length > 0 ||
    layers.length !== 1 ||
    parts.length !== 1 ||
    lone === undefined ||
    sizing.horizontal.kind === "hug" ||
    lone.has("flex") ||
    lone.has("flex-basis") ||
    [WIDTH.length, WIDTH.min, WIDTH.max, "margin-left", "margin-right"].some((property) =>
      lone.has(property)
    ) ||
    (evaluateNumber(lone.resolved("flex-shrink") ?? "1") ?? 0) < 1
  ) {
    return undefined;
  }
  const grows = lone.read(
    "flex-grow",
    (value) => ((evaluateNumber(value) ?? 0) >= 1 ? value : undefined),
    () => ({ outcome: "literal", detail: LONE_GROWTH }),
    lone.feed("sizing")
  );
  return grows === undefined ? undefined : { kind: "fills", place: 0, alone: true };
}

/** What {@link readGrowth} reads besides the box and its parts' styles, as its `measured` says. */
type GrowthMeasure = {
  readonly underMaxHeight: string | undefined;
  readonly itemsAtContent: boolean;
  readonly labelOnly: readonly boolean[];
};

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
  /** The aspect lock of a box whose ratio sets its height, undefined for any other box. */
  readonly aspectLock: BoxSpec["aspectLock"];
  readonly extent: Extent;
  /**
   * Whether each axis's sizing is what CSS gives the box: its length read, or unset and sized as its
   * room says. False where a length does not map, as `w-min` does not, and the axis hugs in its place.
   */
  readonly known: { readonly horizontal: boolean; readonly vertical: boolean };
  /**
   * Whether every `min-*` and `max-*` limit the box sets reaches its limits or its sizing, or drops.
   * False where one stays unmapped, so CSS may size the box past what its sizing and limits say.
   */
  readonly limitsRead: boolean;
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
 * @param measured - What the capture measured of the box: `underMaxWidth`, the box as wide with
 *   its `max-width` 24px lower, so a maximum the build cannot read as a length never narrows it and
 *   drops; and `ratio`, the side its aspect ratio set from the other in every mode, with its border
 *   box.
 * @returns The box's sizing, limits, clipping, extent, and the aspect lock where a ratio sets the
 *   height or the width.
 */
export function readSizing(
  reader: LayerStyle,
  room: Room,
  variables: VariableIndex,
  fit: FitContent,
  inside: Feed,
  measured: Pick<MeasuredBox, "underMaxWidth" | "ratio" | "spansBeside">
): BoxSizing {
  // A parent that hugs its width with nothing bounding it is as wide as each layer it holds.
  const roomy = room.horizontal.percent.kind === "hugging" && room.unbounded;
  const { horizontal, vertical, aspectLock } = readAspectRatio(
    reader,
    readAxis(reader, WIDTH, room.horizontal, variables, {
      fit,
      inside,
      roomy,
      under: measured.underMaxWidth,
      beside: measured.spansBeside,
    }),
    readAxis(reader, HEIGHT, room.vertical, variables, {
      fit: "content",
      inside,
      roomy: false,
      under: false,
      beside: undefined,
    }),
    measured.ratio
  );
  reader.read(
    "field-sizing",
    (value) => (normalizeCss(value) === "content" && vertical.size.kind === "hug" ? value : undefined),
    () => ({ outcome: "literal", detail: "the height hugs its content" }),
    reader.feed("sizing")
  );
  readContainment(reader, room, horizontal.size);
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
    limitsRead: [horizontal, vertical].every(({ notes }) =>
      [...notes.values()].every((note) => note !== undefined)
    ),
    aspectLock,
    extent: {
      horizontal: usedPixels(horizontal, room.horizontal.length),
      vertical: usedPixels(vertical, room.vertical.length),
    },
  };
}

/**
 * The height a preferred aspect ratio gives a box, as a fraction of its width: `16 / 9` gives
 * 9/16, and a lone `1` gives 1, as CSS Sizing 4 §4.1 writes a ratio's height after its width.
 *
 * @param value - The computed `aspect-ratio`.
 * @returns The height per pixel of width, or undefined for a value that holds `auto` or no
 *   positive ratio.
 */
function heightPerWidth(value: string): number | undefined {
  const match = /^(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?$/u.exec(normalizeCss(value));
  if (match === null) {
    return undefined;
  }
  const across = Number(match[1]);
  const down = match[2] === undefined ? 1 : Number(match[2]);
  return across > 0 && down > 0 ? down / across : undefined;
}

/**
 * Chromium's layout unit, 1/64 of a CSS pixel, within which a length the build works out matches
 * one the capture measured, as the capture's own facts compare two readings of a layout.
 */
const LAYOUT_UNIT_PX = 1 / 64;

/**
 * An axis as {@link readAxis} reads it, and whether its length mapped. `readAuto` records the row of
 * an `auto` length that {@link readLength} left to {@link readAspectRatio}, with `note` in place of
 * the row `auto` gets on a box with no ratio.
 */
type KnownAxis = AxisRead & {
  readonly known: boolean;
  readonly readAuto?: (note?: CoverageNote) => void;
};

/** Both axes once the aspect ratio has sized one of them, and the lock that keeps the ratio. */
type RatioSizing = {
  readonly horizontal: KnownAxis;
  readonly vertical: KnownAxis;
  /** The lengths Figma's aspect lock keeps, or undefined where the ratio sets neither side. */
  readonly aspectLock: BoxSpec["aspectLock"];
};

/**
 * Read `aspect-ratio`, which this function alone maps, drops or leaves unmapped, and give each axis
 * the length the ratio sets. A box with a preferred aspect ratio and an automatic size on one side
 * takes that side from the other through the ratio (CSS Sizing 4 §4.2), so beside a fixed length in
 * pixels the other side is a fixed length too, and Figma's aspect lock keeps the ratio as a designer
 * resizes an instance (PG18, PG19). The build takes the side the capture measured the ratio setting
 * in every mode, `ratio`, where it measured the box at the lengths the build works out:
 *
 * - The height, on a box that hugs its height with no `height` of its own but `auto` and no
 *   `min-height` or `max-height`, beside a fixed width, as wide as that width and as tall as width ÷
 *   (width / height), as a 448px `aspect-16/9` box is 448 ÷ (16 / 9) = 252px tall. Content taller
 *   than the ratio's height grows an `overflow: visible` box past it (§4.3), and a flex row shrinks
 *   a box below its `width` (CSS Flexbox 1 §9.7).
 * - The width, as Button's `icon-inline` square is as wide as its `1lh` height, on a box that hugs
 *   its width with no `width` of its own but `auto` and no `min-width` or `max-width`, beside a fixed
 *   height, as tall as that height and as wide as height × (width / height), as a 90px `aspect-[2/3]`
 *   box is 90 × (2 / 3) = 60px wide. Content wider than that width keeps the box wider through its
 *   automatic minimum (§5.1), and a flex basis or a stretch can set the width, which the capture's
 *   measurement rules out.
 *
 * A ratio beside a fixed width and a fixed height it did not set sizes neither and drops, as Radio's
 * `aspect-square` beside its `size-4`. Any other ratio stays unmapped: Figma's auto layout has no
 * field that sizes one side from the other. An `auto` length on the box, which {@link readLength}
 * leaves to this function, says on its row that the ratio sets the side only where it does.
 *
 * @param reader - The box's style.
 * @param width - The box's width as {@link readAxis} read it.
 * @param height - The box's height as {@link readAxis} read it.
 * @param ratio - What the capture measured: the side the ratio set in every mode, with the box's
 *   border box.
 * @returns Both axes with the length the ratio gives one of them, and the lock that keeps the ratio
 *   where the ratio sets one.
 */
function readAspectRatio(
  reader: LayerStyle,
  width: KnownAxis,
  height: KnownAxis,
  ratio: RatioBox | undefined
): RatioSizing {
  const sized =
    ratio === undefined || !ratioMayApply(reader, ratio.sets, ratio.sets === "height" ? height : width)
      ? undefined
      : ratioSide(reader, ratio, fixedPixels(ratio.sets === "height" ? width.size : height.size));
  for (const axis of [width, height]) {
    const setByRatio = sized !== undefined && axis === (ratio?.sets === "width" ? width : height);
    axis.readAuto?.(
      setByRatio
        ? {
            outcome: "literal",
            detail:
              axis === width
                ? "auto, so the aspect ratio sets the width from the height"
                : "auto, so the aspect ratio sets the height from the width",
          }
        : undefined
    );
  }
  if (sized !== undefined) {
    const size: SizeSpec = { kind: "fixed", length: { kind: "literal", value: sized.length } };
    return ratio?.sets === "width"
      ? { horizontal: { ...width, size, known: true }, vertical: height, aspectLock: sized.lock }
      : { horizontal: width, vertical: { ...height, size, known: true }, aspectLock: sized.lock };
  }
  reader.read(
    "aspect-ratio",
    (value) =>
      fixedLength(width.size) !== undefined && fixedLength(height.size) !== undefined ? value : undefined,
    () => ({ outcome: "dropped", detail: "both sides are fixed, so the ratio sizes neither" }),
    []
  );
  return { horizontal: width, vertical: height, aspectLock: undefined };
}

/**
 * Whether the side a ratio sets is free for it: the axis hugs, and the box sets no length on it but
 * `auto`, and no minimum or maximum.
 */
function ratioMayApply(reader: LayerStyle, sets: RatioBox["sets"], axis: KnownAxis): boolean {
  const { length, min, max } = sets === "height" ? HEIGHT : WIDTH;
  const own = reader.resolved(length);
  return (
    axis.size.kind === "hug" &&
    (own === undefined || normalizeCss(own) === "auto") &&
    !reader.has(min) &&
    !reader.has(max)
  );
}

/**
 * Read `aspect-ratio` as the length it gives the side the capture measured it setting, from the
 * other side's fixed pixels, where the box the capture measured is that length by the other.
 *
 * @returns The length and the lock that keeps the ratio, or undefined where the ratio sets none.
 */
function ratioSide(
  reader: LayerStyle,
  measured: RatioBox,
  other: number | undefined
): { readonly length: number; readonly lock: NonNullable<BoxSpec["aspectLock"]> } | undefined {
  if (other === undefined) {
    return undefined;
  }
  const near = (left: number, right: number): boolean => Math.abs(left - right) < LAYOUT_UNIT_PX;
  const byWidth = measured.sets === "height";
  return reader.read(
    "aspect-ratio",
    (value) => {
      const perWidth = heightPerWidth(value);
      if (perWidth === undefined) {
        return undefined;
      }
      const [across, down] = byWidth ? [other, other * perWidth] : [other / perWidth, other];
      return near(across, measured.width) && near(down, measured.height)
        ? {
            length: byWidth ? down : across,
            lock: { width: across, height: down },
            ratio: value.includes("/") ? normalizeCss(value) : `${normalizeCss(value)} / 1`,
          }
        : undefined;
    },
    ({ length, ratio }) => {
      const [set, from] = [pixelsText(length), pixelsText(other)];
      return {
        outcome: "literal",
        detail: byWidth
          ? `Height = ${from} ÷ (${ratio}) = ${set}. Figma keeps this ratio when you resize.`
          : `Width = ${from} × (${ratio}) = ${set}. Figma keeps this ratio when you resize.`,
      };
    },
    reader.feed("sizing")
  );
}

/** Pixels as a coverage row writes them, to two decimals. */
function pixelsText(pixels: number): string {
  return `${String(Math.round(pixels * 100) / 100)}px`;
}

/** The pixels of a fixed literal length, or undefined for any other sizing. */
function fixedPixels(size: SizeSpec): number | undefined {
  return size.kind === "fixed" && size.length.kind === "literal" ? size.length.value : undefined;
}

/** Why inline-size containment drops on a box its parent stretches across. */
const STRETCHED_CONTAINMENT =
  "a column, a grid in one column or a block stretches the box across, which no content sizes";

/** Why inline-size containment drops on a root the preview's host sets the width of. */
const HOSTED_CONTAINMENT = "the root is block-level in the preview's block host, which sets its width";

/** Why inline-size containment drops on a box whose own width reads as a fixed length. */
const DECLARED_CONTAINMENT =
  "the box's own width is a fixed length, which no content sizes, and no flex or grid line sizes it along that width";

/**
 * The sizing keywords whose length content sets (CSS Sizing 3 §5.2), and `stretch`, which the build
 * does not resolve, as a `min-width` or `max-width` may hold them. Its prefixed spelling
 * `-webkit-fill-available` starts with a hyphen, where `\b` finds no word boundary at the start of
 * a value, so the pattern matches the whole keyword after no letter, digit or hyphen.
 */
const INTRINSIC_LIMIT =
  /\b(?:min-content|max-content|fit-content|stretch)\b|(?<![\w-])-webkit-fill-available\b/;

/**
 * Read `container-type: inline-size`, which Tailwind's `@container` writes through the `container`
 * shorthand, its name before a slash. Inline-size containment sizes a box's width as if it held
 * nothing (CSS Containment 2 §3.2), which also drops the content-based minimum of a flex or grid
 * item (CSS Flexbox 1 §4.5), so it changes nothing only where no content contributes to the width.
 * The build knows three such widths, each in a place where no flex or grid line sizes the box along
 * its width, and each where the box's `min-width` and `max-width` hold no sizing keyword that
 * content sets: a `min-content` minimum lifts the width to what the box holds, which the containment
 * takes to nothing (CSS 2.1 §10.4).
 *
 * - a box with no `width` its parent stretches across: a column's or a grid's item, whose cross size
 *   the parent gives it, or a block in a block, whose width is its containing block's (CSS 2.1
 *   §10.3.3);
 * - a block-level root with no `width`, which takes its preview's width in the block host it
 *   renders in;
 * - a box in either place whose own `width` reads as a fixed length, a length or a percentage of
 *   that fixed width (CSS 2.1 §10.2).
 *
 * A `width` of `auto` is the width the box takes with none, so it counts as no `width`.
 *
 * A width that does not read as fixed, a flex item that grows or shrinks along a row, and a box that
 * hugs its content keep the containment unmapped, since there content or a sibling's share sets the
 * width. A container name only lets a query find the box, so it draws nothing either way.
 *
 * @param reader - The box's style.
 * @param room - The room the box's parent gives it.
 * @param width - How the box's own width sizes it.
 */
function readContainment(reader: LayerStyle, room: Room, width: SizeSpec): void {
  const { auto, zeroBasis } = room.horizontal;
  const placed = auto.kind === "fill" || auto.kind === "fixed";
  const limited = ["min-width", "max-width"].some((property) =>
    INTRINSIC_LIMIT.test(normalizeCss(reader.resolved(property) ?? ""))
  );
  const detail =
    zeroBasis === true || !placed || limited
      ? undefined
      : normalizeCss(reader.resolved("width") ?? "auto") === "auto"
        ? auto.kind === "fill"
          ? STRETCHED_CONTAINMENT
          : HOSTED_CONTAINMENT
        : width.kind === "fixed"
          ? DECLARED_CONTAINMENT
          : undefined;
  for (const property of ["container-type", "container"]) {
    reader.read(
      property,
      (value) =>
        detail !== undefined && normalizeCss(value.split("/").at(-1) ?? "") === "inline-size"
          ? value
          : undefined,
      () => ({ outcome: "dropped", detail: detail ?? "" }),
      []
    );
  }
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

/**
 * Why a maximum of the whole parent or more drops beside a length that fills the parent, as
 * preflight's `max-width: 100%` beside an image's `size-full` does.
 */
const FILLING_MAXIMUM = "the box fills its parent, so it is never longer than 100% of the parent";

/** Why a maximum the capture measured never narrowing the box drops. */
const UNDER_MAXIMUM =
  "the capture measured the box as wide with this maximum 24px lower, so it never narrows the box, at a margin no font moves";

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
 * its viewport. Beside a fixed length, a percentage, or such a `calc()`, resolves against a basis of
 * literal pixels too, as an Attachment root's `max-w-full` is its preview's width: there the limit
 * only folds into the length or drops (`resolveLimits`), so the basis never becomes a Figma limit.
 */
function readLimit(
  value: string,
  variables: VariableIndex,
  percent: PercentBasis,
  fixed: boolean
): NumberSpec | undefined {
  const own = readNumber(value, variables);
  if (own !== undefined || percent.kind !== "length" || (percent.viewport === undefined && !fixed)) {
    return own;
  }
  const resolved = evaluateLengthOf(inViewport(value, percent.viewport), percent.value);
  return resolved === undefined ? undefined : { kind: "literal", value: resolved };
}

/**
 * Read one axis: its length through {@link readLength}, an unset length as the room gives it, and
 * its limits as {@link resolveLimits} decides. Each read fills the sizing of the layers inside too,
 * as `inside` names it. Where the parent is at least as long as each layer it holds (`roomy`), or the
 * box fills the parent, a maximum of `100%` or more never limits the box, so it drops. A minimum
 * that reads the same `100%` as a length that fills drops too, where no zero flex basis or maximum
 * that may bind takes over from the length. A length that does not map leaves
 * the axis hugging in its place, which the result marks as not `known`.
 */
function readAxis(
  reader: LayerStyle,
  axis: AxisProperties,
  room: AxisRoom,
  variables: VariableIndex,
  {
    fit,
    inside,
    roomy,
    under,
    beside,
  }: {
    readonly fit: FitContent;
    readonly inside: Feed;
    readonly roomy: boolean;
    /** Whether the capture measured the box as wide with its maximum 24px lower, on the width only. */
    readonly under: boolean;
    /** The width the capture measured beside a box that spans its parent, on the width only. */
    readonly beside: number | undefined;
  }
): KnownAxis {
  if (room.placed !== undefined) {
    const { detail, length } = room.placed;
    reader.read(
      axis.length,
      (value) => value,
      () => ({ outcome: "literal", detail }),
      reader.feed("sizing")
    );
    const size: SizeSpec =
      length === undefined ? PLACED : { kind: "fixed", length: { kind: "literal", value: length } };
    return { size, min: undefined, max: undefined, notes: new Map(), known: length !== undefined };
  }
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
  const spanned = axis === WIDTH ? spannedWidth(reader, room.percent, beside) : undefined;
  const { size: read, readAuto } = reader.has(axis.length)
    ? readLength(reader, axis, room, variables, { fit, inside }, spanned)
    : { size: room.auto, readAuto: undefined };
  const size = read ?? HUG;
  const maximum = reader.resolved(axis.max);
  const inertMaximum =
    (roomy || size.kind === "fill") && maximum !== undefined && (evaluatePercentage(maximum) ?? 0) >= 1;
  if (inertMaximum) {
    reader.read(
      axis.max,
      (value) => value,
      () => ({ outcome: "dropped", detail: roomy ? WHOLE_PARENT_MAXIMUM : FILLING_MAXIMUM }),
      []
    );
  }
  // A maximum the build cannot read as a length, which the capture measured never narrowing the box.
  const measuredUnder =
    !inertMaximum &&
    under &&
    maximum !== undefined &&
    readLimit(maximum, variables, room.percent, size.kind === "fixed") === undefined;
  if (measuredUnder) {
    reader.read(
      axis.max,
      (value) => value,
      () => ({ outcome: "dropped", detail: UNDER_MAXIMUM }),
      []
    );
  }
  const popupMaximum = roomyMaximum(axis.max, reader.raw(axis.max) ?? "", variables);
  // Whether a maximum is declared that may bind: one that reads the available room binds unless the
  // kit's room makes it none, and any other binds unless the build proved it inert or the capture
  // measured it never narrowing the box. A maximum the build cannot resolve may bind.
  const maximumMayBind =
    popupMaximum === undefined
      ? reader.has(axis.max) && !inertMaximum && !measuredUnder
      : popupMaximum.kind !== "none";
  const minimum = reader.resolved(axis.min);
  const length = reader.resolved(axis.length);
  // A whole `100%` that fills the column sizes the box at the column's length, and a minimum of the
  // same `100%` resolves against the same basis, so it never moves the box, as a Combobox popup's
  // `min-w-(--anchor-width)` beside its `w-(--anchor-width)` where the anchor spans the column. That
  // holds only while the length decides the box's size: a zero flex basis sizes it in place of the
  // length, and a maximum that may bind loses to the minimum (CSS 2.1 §10.4), so there the minimum
  // stays a limit or unmapped. Along a row, a `100%` fills only as the row's one layer, whose
  // declared basis the minimum raises to the whole row, which the fill draws.
  const lengthMinimum =
    read?.kind === "fill" &&
    room.zeroBasis !== true &&
    !maximumMayBind &&
    length !== undefined &&
    evaluatePercentage(length) === 1 &&
    minimum !== undefined &&
    normalizeCss(minimum) === normalizeCss(length);
  if (lengthMinimum) {
    reader.read(
      axis.min,
      (value) => value,
      () => ({
        outcome: "dropped",
        detail: `it is the same value as the ${axis.length}, so it never ${axis.grows} the box`,
      }),
      []
    );
  }
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
    return value === undefined ||
      (side === "max" && (inertMaximum || measuredUnder)) ||
      (side === "min" && lengthMinimum)
      ? []
      : [{ side, property, value: readLimit(value, variables, room.percent, size.kind === "fixed") }];
  });
  const limited = resolveLimits(size, bounds, axis, variables);
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
  // The width beside a box that spans its parent is the least width the parent leaves it.
  const known: KnownAxis =
    spanned === undefined || read?.kind !== "hug"
      ? { ...limited, known: read !== undefined }
      : { ...limited, min: { kind: "literal", value: spanned }, known: true };
  return readAuto === undefined ? known : { ...known, readAuto };
}

/**
 * Decide an axis's limits. A zero minimum drops. Beside a length that hugs or fills, each other
 * limit becomes a Figma limit, except a maximum of zero or less, which Figma refuses, as the plugin
 * typings require a positive limit. Beside a fixed length, CSS resolves the length against its
 * limits (CSS 2.1 §10.4 and §10.7): lowered to the maximum, then raised to the minimum, so the
 * minimum wins a conflict. Figma would clamp a fixed length to a limit on every resize, so the
 * limits fold into the length: one that moves it sets it, and one that never moves it drops. A
 * length bound to a variable that every limit binds too never moves in any mode, as the md control
 * size's `min-h-(--control-h-md)` beside its `h-(--control-h-md)`, so those limits drop, and so do
 * literal limits its range never reaches, as `variable-limits.ts` decides. A fold to a
 * length of zero or less, and a limit that any other bound or non-literal value on either side keeps
 * from comparing, stay unmapped.
 */
function resolveLimits(
  size: SizeSpec,
  bounds: readonly Bound[],
  axis: AxisProperties,
  variables: VariableIndex
): AxisRead {
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
  const inertBesideVariable = limitsNeverMoveVariable(length, kept, variables);
  if (kept.length > 0 && (inertBesideVariable || kept.every((bound) => sameVariable(bound.value, length)))) {
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
 * as `inside` names it. `spanned` is the least width {@link spannedWidth} gives a box that spans
 * its parent beside other blocks. A box with an `aspect-ratio` leaves the row of an `auto` length
 * unread, with `readAuto` to record it, since {@link readAspectRatio} alone knows whether the ratio
 * sets the axis. A length in `lh` reads only as a plain count of lines, such as `1lh` or `2lh`, the
 * box's own line height times the count, and only where that comes to Figma's least size,
 * {@link FIGMA_LEAST_SIZE_PX}, or more. A `calc()`, `min()`, `max()` or `clamp()` over `lh` stays
 * unmapped.
 *
 * @returns The sizing, undefined when the value does not map, and `readAuto` for an `auto` length
 *   left unread.
 */
function readLength(
  reader: LayerStyle,
  axis: AxisProperties,
  room: AxisRoom,
  variables: VariableIndex,
  { fit, inside }: { readonly fit: FitContent; readonly inside: Feed },
  spanned: number | undefined
): LengthSizing {
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
    return { size: room.auto, readAuto: undefined };
  }
  // CSS computes an `lh` length where it is declared, so a length a box inherits from its parent
  // is the parent's line height, which the box's own does not give; it stays unmapped.
  const computed =
    LINE_LENGTH.test(reader.resolved(axis.length) ?? "") && !reader.inherits(axis.length)
      ? computedLineHeight(reader, variables)
      : undefined;
  // A percent of a synced font size is no length a fixed size holds, so a length in `lh` beside it
  // stays unmapped, as beside `normal`.
  const line = computed?.line.kind === "percent" ? undefined : computed?.line;
  const feed = [...reader.feed("sizing"), ...inside];
  const describe = ({ size, share }: LengthRead): CoverageNote => {
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
              : spanned !== undefined
                ? spansBesideBlocks(spanned)
                : share === 1 && percent.kind === "hugging"
                  ? SPANS_HUGGING_PARENT
                  : share === 1 && percent.kind === "unset"
                    ? "100% sizes an in-flow block-level box with no margins, padding or border as its unset width does, which hugs, since the root sits alone in its component set"
                    : "the box hugs its content",
        };
      case "fill":
        return { outcome: "literal", detail: `the box fills its parent's ${axis.length}` };
      case "placed":
        return { outcome: "literal", detail: "the box's placement sets the length" };
      case "fixed": {
        if (line !== undefined) {
          return size.length.kind === "literal"
            ? {
                outcome: "literal",
                detail: `${String(size.length.value)}px, the lh length at the box's own ${describeLine(line)} line height`,
              }
            : describeNumber(size.length);
        }
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
  };
  if (reader.has("aspect-ratio") && normalizeCss(reader.resolved(axis.length) ?? "") === "auto") {
    return {
      size: room.auto,
      readAuto: (note) => {
        reader.read(
          axis.length,
          () => room.auto,
          () => note ?? describe({ size: room.auto, share: undefined }),
          feed
        );
      },
    };
  }
  const read = reader.read(
    axis.length,
    (value): LengthRead | undefined => {
      if (LINE_LENGTH.test(value)) {
        return line === undefined ? undefined : linesTall(value, line);
      }
      // `auto` is a length's initial value, which sizes the axis as no length does.
      if (normalizeCss(value) === "auto") {
        return { size: room.auto, share: undefined };
      }
      if (normalizeCss(value) === "fit-content" && fit === "room" && room.auto.kind === "fill") {
        return { size: { kind: "fitted" } as const, share: undefined };
      }
      const share = evaluatePercentage(value);
      if (share === 1 && axis.length === "width" && spansParent(reader, percent, spanned)) {
        return { size: HUG, share };
      }
      // A percentage that computes to `auto` sizes the box by its content, so siblings share nothing.
      if (share === 1 && siblings.length > 0 && percent.kind !== "auto") {
        return { size: { kind: "shared" } as const, share };
      }
      const size = readSize(value, variables, percent);
      return size === undefined ? undefined : { size, share };
    },
    describe,
    feed
  )?.size;
  if (computed !== undefined && line !== undefined && read?.kind === "fixed") {
    for (const property of computed.reads) {
      reader.read(
        property,
        (value) => value,
        () => ({
          outcome: line.kind === "variable" ? "bound" : "literal",
          detail: `the box's line height is ${describeLine(line)}, which the ${axis.length}'s lh length reads`,
        }),
        reader.feed("sizing"),
        property === "line-height" ? computed.also : []
      );
    }
  }
  if (read?.kind === "fitted") {
    return { size: FILL, readAuto: undefined };
  }
  return { size: read === undefined || read.kind === "shared" ? undefined : read, readAuto: undefined };
}

/**
 * A `width` or `height` as {@link readLength} maps it: the sizing, a `100%` that siblings share or a
 * `fit-content` that fits its text, and the percentage it holds.
 */
type LengthRead = {
  readonly size: SizeSpec | { readonly kind: "shared" } | { readonly kind: "fitted" };
  readonly share: number | undefined;
};

/**
 * An axis's length as {@link readLength} returns it: the sizing, undefined where the value does not
 * map, and the read it left for {@link readAspectRatio} where the length is `auto`.
 */
type LengthSizing = { readonly size: SizeSpec | undefined; readonly readAuto: KnownAxis["readAuto"] };

/** A length in `lh`, the line height of the box's own text (CSS Values 4 §6.1.1). */
const LINE_LENGTH = /\dlh\b/;

/** A plain count of lines, such as Tailwind's `h-lh`, `1lh`. */
const LINE_COUNT = /^([+-]?(?:\d+\.?\d*|\.\d+))lh$/;

/** The least width or height Figma resizes a layer to, in pixels. */
const FIGMA_LEAST_SIZE_PX = 0.01;

/**
 * A length that is a plain count of lines, as a fixed sizing: the line height times the count. A
 * synced line height binds a length of exactly one line, which no other count of lines does. A length
 * under {@link FIGMA_LEAST_SIZE_PX} does not read.
 *
 * @param value - The resolved length, which holds `lh`.
 * @param lineHeight - The box's own line height.
 * @returns The sizing, or undefined for any other length in `lh`.
 */
function linesTall(value: string, lineHeight: NumberSpec): LengthRead | undefined {
  const count = LINE_COUNT.exec(normalizeCss(value))?.[1];
  if (count === undefined) {
    return undefined;
  }
  if (lineHeight.kind === "variable") {
    return Number(count) === 1
      ? { size: { kind: "fixed", length: lineHeight }, share: undefined }
      : undefined;
  }
  const pixels = Number(count) * lineHeight.value;
  return pixels >= FIGMA_LEAST_SIZE_PX
    ? { size: { kind: "fixed", length: { kind: "literal", value: pixels } }, share: undefined }
    : undefined;
}

/** A line height as the coverage table names it: its pixels, or its variable. */
function describeLine(length: NumberSpec): string {
  return length.kind === "literal"
    ? `${String(length.value)}px`
    : `${length.variable.collection} / ${length.variable.name}`;
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
