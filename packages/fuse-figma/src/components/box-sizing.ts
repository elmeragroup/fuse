/**
 * How a box's CSS sizes each axis: the length a `width` or `height` sets, as `box-length.ts` reads
 * it, the `min-*` and `max-*` limits, as `box-limits.ts` decides them, an `aspect-ratio` that sets
 * one side from the other, `field-sizing`, inline-size containment, as `size-containment.ts` reads
 * it, and whether the box's `overflow` clips it. `box-mapping.ts` reads a box's sizing here before
 * it maps the box's parts.
 */

import { HEIGHT, WIDTH } from "./box-axis";
import type { AxisProperties } from "./box-axis";
import type { MeasuredBox, RatioBox } from "./box-cascade";
import { readLength } from "./box-length";
import type { FitContent } from "./box-length";
import { resolveLimits, sameVariable, usedPixels } from "./box-limits";
import type { AxisRead, Bound } from "./box-limits";
import { FILL, HUG } from "./box-room";
import type { AxisRoom, Extent, Room } from "./box-room";
import { evaluateLengthOf, evaluatePercentage, inViewport, normalizeCss, readNumber } from "./css-values";
import type { VariableIndex } from "./css-values";
import { fixedLength } from "./kit-spec";
import type { BoxSpec, NumberSpec, SizeSpec } from "./kit-spec";
import type { CoverageNote, Feed, LayerStyle } from "./layer-style";
import { roomyMaximum, withRoom } from "./popup-room";
import { readContainment } from "./size-containment";
import type { PercentBasis } from "./sizing-value";
import { spannedWidth } from "./spanning-block";

/** The length a box's placement leaves it where the build cannot tell its parent's, as `SizeSpec` says. */
const PLACED: SizeSpec = { kind: "placed" };

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

/** The properties that clip a box's overflow, on both axes and on each. */
const OVERFLOWS = ["overflow", "overflow-x", "overflow-y"] as const;

/**
 * The overflow values that clip a box's content at its padding box. `auto` and `scroll` scroll it
 * too, which a static frame does not show (CSS Overflow 3 §3).
 */
const CLIPPING: ReadonlySet<string> = new Set(["hidden", "clip", "auto", "scroll"]);

/**
 * An `overflow`, `overflow-x` or `overflow-y` value's keyword on each axis: the first for x, and the
 * second, or the first again, for y, as the shorthand sets its longhands (CSS Overflow 3 §3). A
 * longhand's one keyword stands for both.
 */
function overflowAxes(value: string): readonly [x: string, y: string] {
  const [x = "", y = x] = normalizeCss(value).split(/\s+/u);
  return [x, y];
}

/**
 * Whether an `overflow`, `overflow-x` or `overflow-y` value clips on any axis it sets, as `hidden
 * auto` does on both.
 *
 * @param value - The computed value.
 * @returns Whether a keyword it holds clips the box's content at its padding box.
 */
export function overflowClips(value: string): boolean {
  return overflowAxes(value).some((keyword) => CLIPPING.has(keyword));
}

/** The axes on which a box clips its content at its padding box. */
export type ClippedAxes = {
  /** Whether the box clips across, by its `overflow-x`. */
  readonly horizontal: boolean;
  /** Whether the box clips down, by its `overflow-y`. */
  readonly vertical: boolean;
};

/** The overflow values that make a `visible` on the other axis compute to `auto` (CSS Overflow 3 §3). */
const SCROLLING: ReadonlySet<string> = new Set(["hidden", "auto", "scroll"]);

/**
 * The axes on which a box clips its content at its padding box, without recording a read. An axis
 * takes its `overflow-x` or `overflow-y`, or else its keyword of the `overflow` shorthand, as
 * {@link overflowAxes} splits it. `clip` clips its own axis only, while `hidden`, `auto` or `scroll`
 * on either axis clips both, since a `visible` beside one computes to `auto` (CSS Overflow 3 §3).
 *
 * @param reader - The box's style.
 * @returns Whether the box clips across, and whether it clips down.
 */
export function clippedAxes(reader: LayerStyle): ClippedAxes {
  const value = (property: string): string => normalizeCss(reader.resolved(property) ?? "");
  const [x, y] = overflowAxes(value("overflow"));
  const horizontal = value("overflow-x") || x;
  const vertical = value("overflow-y") || y;
  const both = SCROLLING.has(horizontal) || SCROLLING.has(vertical);
  return { horizontal: both || horizontal === "clip", vertical: both || vertical === "clip" };
}

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
  for (const property of OVERFLOWS) {
    reader.read(
      property,
      (value) => (overflowClips(value) ? true : undefined),
      () => ({ outcome: "literal", detail: "the box clips its content" }),
      reader.feed("clips")
    );
  }
  // Figma clips both axes or neither, so a box that clips either clips both.
  const axes = clippedAxes(reader);
  const clips = axes.horizontal || axes.vertical;
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
