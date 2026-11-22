import type { CornerRadiusSpec, CornersSpec } from "./corner-spec";
import { describeNumber, isInfiniteLength, readNumber } from "./css-values";
import type { VariableIndex } from "./css-values";
/**
 * A box's corners: one `border-radius` on every corner, or a radius per corner where a class sets
 * one by its physical or logical name, as `first:rounded-t-lg` rounds a list's first row and a
 * range's `rounded-s-full` its first day. `box-mapping.ts` reads them once the box's sizing is known,
 * since an infinite radius takes its length from the box's sides.
 */
import type { LimitsSpec, SizingSpec } from "./kit-spec";
import { fixedLength } from "./kit-spec";
import type { NumberSpec } from "./kit-spec";
import type { CoverageNote, LayerStyle } from "./layer-style";

/** A corner as Figma names it, and the longhands that set it: physical, then logical. */
const CORNERS = [
  { key: "topLeft", physical: "border-top-left-radius", logical: "border-start-start-radius" },
  { key: "topRight", physical: "border-top-right-radius", logical: "border-start-end-radius" },
  { key: "bottomRight", physical: "border-bottom-right-radius", logical: "border-end-end-radius" },
  { key: "bottomLeft", physical: "border-bottom-left-radius", logical: "border-end-start-radius" },
] as const;

/** One of Figma's four corners. */
type Corner = (typeof CORNERS)[number];

/**
 * What a box's corners read of its size, once `box-mapping.ts` knows it. Each corner reader takes the
 * whole box, so a new measure joins this type rather than a reader's own parameters.
 */
export type CornerBox = {
  /** The box's sizing, whose fixed sides an infinite `border-radius` reads. */
  readonly sizing: SizingSpec;
  /**
   * The sizing with the literal length the box holds on each axis it hugs, as `held-size.ts` reads
   * it, whose sides a radius per corner reads.
   */
  readonly held: SizingSpec;
  /**
   * The least height the box takes in any mode, as its layers bound it, which a radius per corner
   * reads where the height is no literal.
   */
  readonly leastHeight: number;
  /**
   * The box's limits, whose minimum width a radius per corner reads beside a fixed height, or
   * undefined where a `min-*` or `max-*` limit the box sets stays unmapped. CSS may then size the box
   * past its sizing, so neither an infinite `border-radius` nor a radius per corner maps.
   */
  readonly limits: LimitsSpec | undefined;
};

/**
 * Read a box's corner radius: `border-radius` on every corner, or a radius per corner.
 *
 * @param reader - The box's style.
 * @param box - What the corners read of the box's size.
 * @param variables - The synced variables a radius can bind.
 * @returns The corner radius, or undefined where the box sets none or it does not map.
 */
export function readCorner(
  reader: LayerStyle,
  box: CornerBox,
  variables: VariableIndex
): CornerRadiusSpec | undefined {
  const own = CORNERS.filter((corner) => cornerProperty(reader, corner) !== undefined);
  return own.length === 0 ? readUniform(reader, box, variables) : readCorners(reader, box, variables);
}

/** The longhand a box sets a corner by, physical or logical, or undefined for neither. */
function cornerProperty(reader: LayerStyle, corner: Corner): string | undefined {
  return [corner.physical, corner.logical].find((property) => reader.has(property));
}

/**
 * Read `border-radius` as the corner. An infinite radius, which `rounded-full` compiles to, reads
 * as half a side. CSS scales down radii whose sum exceeds a side, so it draws any radius above half
 * the shorter side as that half. With both sides fixed, the build writes that half. With one side
 * fixed, it writes half that side: on 2026-10-22 a real file drew a radius above half the shorter
 * side as that half and kept the written value (probe P10), so Figma draws it as CSS does whichever
 * side ends up shorter. A box with no fixed side has no length to halve, so its pill corner stays
 * unmapped, as does one with a `min-*` or `max-*` limit that stays unmapped, since that limit can
 * make CSS's side longer or shorter than the one the build halves. A literal or bound radius reads
 * no side, so it maps either way.
 */
function readUniform(
  reader: LayerStyle,
  { sizing, limits }: CornerBox,
  variables: VariableIndex
): NumberSpec | undefined {
  const width = fixedLength(sizing.horizontal);
  const height = fixedLength(sizing.vertical);
  const corner = reader.read(
    "border-radius",
    (value): { readonly radius: NumberSpec; readonly detail: string | undefined } | undefined => {
      const radius = readNumber(value, variables);
      if (radius !== undefined) {
        return { radius, detail: undefined };
      }
      if (!isInfiniteLength(value) || limits === undefined) {
        return undefined;
      }
      if (width?.kind === "literal" && height?.kind === "literal") {
        const half = Math.min(width.value, height.value) / 2;
        return {
          radius: { kind: "literal", value: half },
          detail: `${half}px, half the shorter side, which CSS draws for any larger radius`,
        };
      }
      const fixedSide =
        width === undefined
          ? { side: "height", length: height }
          : height === undefined
            ? { side: "width", length: width }
            : undefined;
      if (fixedSide?.length?.kind !== "literal") {
        return undefined;
      }
      const half = fixedSide.length.value / 2;
      return {
        radius: { kind: "literal", value: half },
        detail: `${half}px, half the fixed ${fixedSide.side}, which Figma and CSS cap at half the shorter side`,
      };
    },
    ({ radius, detail }) => (detail === undefined ? describeNumber(radius) : { outcome: "literal", detail }),
    reader.feed("cornerRadius")
  );
  return corner?.radius;
}

/** A radius CSS takes as infinite, which the scaling below reads as this many pixels. */
const INFINITE_PX = 1e30;

/**
 * A corner's radius before CSS scales it: infinite, a literal, or a variable with the greatest value
 * it holds in any mode.
 */
type RawRadius =
  | { readonly kind: "infinite" }
  | { readonly kind: "literal"; readonly px: number }
  | { readonly kind: "variable"; readonly spec: NumberSpec; readonly most: number };

/**
 * Read a radius per corner where the box sets one by its own longhand, physical, or logical as the
 * kit's left-to-right, horizontal page names it (CSS Logical Properties 1 §6.2): `start-start` is the
 * top left, `start-end` the top right, `end-end` the bottom right and `end-start` the bottom left. A
 * corner the box names no longhand for takes 0.
 *
 * CSS scales every radius by one factor where the radii along a side add up past it (CSS Backgrounds
 * 3 §5.5), so `rounded-s-full` on a 36px square rounds its two left corners by 18px, and a 30px and a
 * 10px corner along a 36px side by 27px and 9px. Figma draws each corner on its own, capped at half
 * the shorter side (probe P10). So the radii map only on a box whose sides are literal, where the
 * radii CSS draws are each within half the shorter side, which Figma then draws as written: scaled
 * literals where CSS scales them, and a variable only where the greatest value it holds in any mode
 * leaves CSS nothing to scale and stays within that half, so every mode draws alike. A box of a
 * literal width whose height follows its layers maps where its least height in any mode, as its
 * layers bound it, proves the same: every radius, a variable at its greatest value, sums within each
 * side's least length and sits within half the shorter side's, so CSS scales nothing at any height
 * it takes and Figma caps nothing, and each radius draws as written. The bound gives a text one line
 * at least, as realistic text does, and a layer a BOOLEAN property can hide no height, so a label a
 * designer would realistically leave out counts as gone. A label emptied through its TEXT property is
 * a known limit: it sets no line in CSS, where the corners could scale, and keeps its line's height in
 * the bound. A box whose sides are no literals maps one more shape, {@link pairedCorners}: one
 * radius on the two corners of its shorter side and none on the others. Every shape reads the box's
 * sides, so a box with a `min-*` or `max-*` limit that stays unmapped maps no radius per corner,
 * since that limit can make CSS's box longer or shorter on either axis than the build reads it, as
 * a variable `min-h-*` past a literal `h-*` does. Any other corner set stays
 * unmapped. A `border-radius` that wins only some corners reaches this reader as those corners'
 * longhands, as `border-shorthands.ts` splits it, so `rounded-[4px] rounded-s-[8px]` reads 8px on the
 * left corners and 4px on the right. One that stays whole there, as a value whose `var()` stands for
 * an unknown number of radii does, leaves the box unmapped beside a corner longhand.
 */
function readCorners(
  reader: LayerStyle,
  { held: sizing, leastHeight, limits }: CornerBox,
  variables: VariableIndex
): CornersSpec | undefined {
  if (reader.has("border-radius")) {
    return undefined;
  }
  const raw = CORNERS.map((corner) => rawRadius(reader, corner, variables));
  const width = fixedLength(sizing.horizontal);
  const height = fixedLength(sizing.vertical);
  const drawn =
    limits === undefined
      ? undefined
      : width?.kind === "literal" && height?.kind === "literal"
        ? drawnCorners(raw, width.value, height.value)
        : width?.kind === "literal" && sizing.vertical.kind === "hug"
          ? unscaledCorners(raw, width.value, leastHeight)
          : pairedCorners(raw, { sizing, limits }, variables);
  const [topLeft, topRight, bottomRight, bottomLeft] = drawn ?? [];
  const corners =
    topLeft === undefined || topRight === undefined || bottomRight === undefined || bottomLeft === undefined
      ? undefined
      : ({ kind: "corners", topLeft, topRight, bottomRight, bottomLeft } as const);
  for (const corner of CORNERS) {
    const property = cornerProperty(reader, corner);
    if (property === undefined) {
      continue;
    }
    const length = corners?.[corner.key];
    reader.read(
      property,
      () => length,
      (read): CoverageNote =>
        read.kind === "literal"
          ? {
              outcome: "literal",
              detail: `${read.value}px on the ${corner.key} corner, as CSS draws it on the box's sides`,
            }
          : describeNumber(read),
      reader.feed("cornerRadius")
    );
  }
  return corners;
}

/** The sides of a box by the two corners each one joins, in {@link CORNERS}' order, and its axis. */
const SIDES = [
  { corners: [0, 1], length: "width" },
  { corners: [1, 2], length: "height" },
  { corners: [2, 3], length: "width" },
  { corners: [3, 0], length: "height" },
] as const;

/** Whether two radii are the same length in every mode: one literal, or one variable. */
function sameRadius(left: RawRadius, right: RawRadius): boolean {
  if (left.kind === "literal" && right.kind === "literal") {
    return left.px === right.px;
  }
  return (
    left.kind === "variable" &&
    right.kind === "variable" &&
    left.spec.kind === "variable" &&
    right.spec.kind === "variable" &&
    left.spec.variable.collection === right.spec.variable.collection &&
    left.spec.variable.name === right.spec.variable.name
  );
}

/** Whether a radius is a literal 0. */
const isZero = (radius: RawRadius): boolean => radius.kind === "literal" && radius.px === 0;

/**
 * Whether a box's side along one axis is no longer than the other axis in any mode: its fixed length
 * is the length the other axis is fixed at or held to at least, as a min-square control's height is
 * its minimum width, or a literal no longer than the other axis's literal.
 */
function noLongerThanOther(
  { sizing, limits }: { readonly sizing: SizingSpec; readonly limits: LimitsSpec },
  axis: "width" | "height",
  variables: VariableIndex
): boolean {
  const side = fixedLength(axis === "width" ? sizing.horizontal : sizing.vertical);
  const others = [
    fixedLength(axis === "width" ? sizing.vertical : sizing.horizontal),
    axis === "width" ? limits.minHeight : limits.minWidth,
  ];
  const most =
    side?.kind === "literal" ? side.value : side === undefined ? undefined : variables.maximum(side.variable);
  return others.some(
    (other) =>
      side !== undefined &&
      other !== undefined &&
      (JSON.stringify(other) === JSON.stringify(side) ||
        (other.kind === "literal" && most !== undefined && most <= other.value))
  );
}

/**
 * The radii as written where a box rounds the two corners of one side by one radius and no other
 * corner, and that side is no longer than the other axis in any mode, as a segmented Toggle group's
 * first item rounds its left corners and its height is its minimum width. CSS scales the two radii by
 * the side's length over their sum where they overrun it, so each draws at most half the side (CSS
 * Backgrounds 3 §5.5), and the sides beside them hold one radius each and are at least as long. Figma
 * caps each corner at half the shorter side (probe P10), the same half. So the shape draws alike at
 * any radius and any length. A box with every corner a literal 0 draws square in both. Undefined for
 * any other corner set.
 */
function pairedCorners(
  raw: readonly (RawRadius | undefined)[],
  box: { readonly sizing: SizingSpec; readonly limits: LimitsSpec },
  variables: VariableIndex
): readonly NumberSpec[] | undefined {
  const known = raw.flatMap((each) => (each === undefined || each.kind === "infinite" ? [] : [each]));
  if (known.length !== CORNERS.length) {
    return undefined;
  }
  const rounded = known.flatMap((each, index) => (isZero(each) ? [] : [index]));
  const side = SIDES.find(({ corners }) => corners.every((corner) => rounded.includes(corner)));
  const [first, second] = side === undefined ? [] : side.corners.map((corner) => known[corner]);
  const paired =
    rounded.length === 0 ||
    (rounded.length === 2 &&
      side !== undefined &&
      first !== undefined &&
      second !== undefined &&
      sameRadius(first, second) &&
      noLongerThanOther(box, side.length, variables));
  return paired
    ? known.map((each): NumberSpec =>
        each.kind === "variable" ? each.spec : { kind: "literal", value: each.px }
      )
    : undefined;
}

/**
 * A corner's radius before CSS scales it, or undefined for a value that reads as no length. A radius
 * is a non-negative length, so CSS clamps a negative `calc()` literal to 0 (CSS Values 4 §10.12).
 */
function rawRadius(reader: LayerStyle, corner: Corner, variables: VariableIndex): RawRadius | undefined {
  const property = cornerProperty(reader, corner);
  const value = property === undefined ? "0px" : (reader.resolved(property) ?? "");
  if (isInfiniteLength(value)) {
    return { kind: "infinite" };
  }
  const spec = readNumber(value, variables);
  if (spec?.kind === "literal") {
    return { kind: "literal", px: Math.max(0, spec.value) };
  }
  const most = spec === undefined ? undefined : variables.maximum(spec.variable);
  return spec === undefined || most === undefined ? undefined : { kind: "variable", spec, most };
}

/**
 * The radii as written, on a box whose sides are at least the given lengths, where they prove CSS
 * scales none of them and Figma caps none, each a variable at its greatest value: the radii along
 * each side sum within its least length, and each sits within half the shorter one. Undefined
 * otherwise, or for a radius that reads as no length.
 */
function unscaledCorners(
  raw: readonly (RawRadius | undefined)[],
  width: number,
  height: number
): readonly NumberSpec[] | undefined {
  const known = raw.flatMap((each) => (each === undefined || each.kind === "infinite" ? [] : [each]));
  if (known.length !== raw.length) {
    return undefined;
  }
  const px = known.map((each) => (each.kind === "literal" ? each.px : each.most));
  const [topLeft = 0, topRight = 0, bottomRight = 0, bottomLeft = 0] = px;
  const fits =
    topLeft + topRight <= width &&
    bottomRight + bottomLeft <= width &&
    topRight + bottomRight <= height &&
    bottomLeft + topLeft <= height &&
    px.every((radius) => radius <= Math.min(width, height) / 2);
  return fits
    ? known.map((each): NumberSpec =>
        each.kind === "variable" ? each.spec : { kind: "literal", value: each.px }
      )
    : undefined;
}

/**
 * The radii CSS draws on a box of literal sides (CSS Backgrounds 3 §5.5), each its radius times the
 * least of 1 and every side's length over the radii along it, a variable at its greatest value, or
 * undefined where Figma would draw one otherwise: a drawn radius past half the shorter side, which
 * Figma caps, or a variable CSS would scale in some mode, which one bound length cannot follow.
 */
function drawnCorners(
  raw: readonly (RawRadius | undefined)[],
  width: number,
  height: number
): readonly NumberSpec[] | undefined {
  const known = raw.flatMap((each) => (each === undefined ? [] : [each]));
  if (known.length !== raw.length) {
    return undefined;
  }
  const px = known.map((each) =>
    each.kind === "infinite" ? INFINITE_PX : each.kind === "literal" ? each.px : each.most
  );
  const [topLeft = 0, topRight = 0, bottomRight = 0, bottomLeft = 0] = px;
  const ratio = (length: number, sum: number) => (sum === 0 ? 1 : length / sum);
  const factor = Math.min(
    1,
    ratio(width, topLeft + topRight),
    ratio(height, topRight + bottomRight),
    ratio(width, bottomRight + bottomLeft),
    ratio(height, bottomLeft + topLeft)
  );
  const cap = Math.min(width, height) / 2;
  const scaled = factor < 1;
  const fits = px.every((radius) => radius * factor <= cap + 1e-9);
  if (!fits || (scaled && known.some((each) => each.kind === "variable"))) {
    return undefined;
  }
  return known.map((each, index): NumberSpec =>
    each.kind === "variable"
      ? each.spec
      : { kind: "literal", value: Math.round((px[index] ?? 0) * factor * 1e6) / 1e6 }
  );
}
