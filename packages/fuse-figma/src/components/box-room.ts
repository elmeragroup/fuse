/**
 * The room a box's parent gives it on each axis, and the box as the parts it holds see it: what a
 * `100%` stands for, the stretch a column gives an unset width, the share of a row a part takes,
 * the room of the part that grows or fits its row, an absolute part's room, and the stretch a
 * column that hugs cannot draw. `box-mapping.ts` asks this module for the room each part gets, in
 * the box's flow or, for an absolute part, against its containing block, and `label-layout.ts` reads
 * the box's own text against the same holder.
 *
 * A root's room is in `root-room.ts`, the width cap the boxes around a box set in `width-cap.ts`,
 * and a mapped layer's height bounds and least width in `layer-bounds.ts`. A box's own sizing,
 * read from its CSS, is in `box-sizing.ts`, its lengths in `box-length.ts`, its limits and the
 * length after them in `box-limits.ts`, its inline-size containment in `size-containment.ts`, and
 * the part that grows in `growing-part.ts`.
 */

import { bordersOn, literalPixels, SIDES } from "./box-insets";
import { evaluateLength, normalizeCss } from "./css-values";
import { keepsOwnWidth } from "./flex-item-width";
import { cellRoom } from "./grid-layout";
import type { InstancePlace } from "./hugging-rows";
import type { DirectionSpec, LimitsSpec, NumberSpec, SizeSpec, SizingSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";
import { autoHeightBasis } from "./percent-height";
import type { Layout } from "./placement";
import type { PercentBasis } from "./sizing-value";
import { subgridCellRoom } from "./subgrid-row";
import type { SubgridCell } from "./subgrid-row";
import { hugsUncapped, lessShares, NO_CAP, UNREAD_CAP, widthCapInside } from "./width-cap";
import type { WidthCap } from "./width-cap";

/** What a box's parent gives it on one axis. */
export type AxisRoom = {
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

/** The sizing of an axis that hugs what the box holds. */
export const HUG: SizeSpec = { kind: "hug" };

/** The sizing of an axis that fills the room its parent gives it. */
export const FILL: SizeSpec = { kind: "fill" };
/** The percent basis of an axis whose parent gives a percentage nothing to resolve against. */
export const NO_BASIS: PercentBasis = { kind: "none" };

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
 * The room of the part that grows along its box's direction: it fills the box along it, as
 * `readGrowth` in `growing-part.ts` decides, and in a row its length is the row's content length less the other
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
