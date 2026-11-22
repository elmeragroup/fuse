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

/**
 * The per-corner longhands, physical and logical, that {@link readCorner} reads a radius per corner
 * from. The capture measures `cornersFit` only on an element that declares one of them.
 */
export const CORNER_LONGHANDS: ReadonlySet<string> = new Set(
  CORNERS.flatMap((corner) => [corner.physical, corner.logical])
);

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
   * The least width the box takes in any mode, its padding and stroke across within its width limits,
   * which a radius per corner reads where the box hugs its width.
   */
  readonly leastWidth: number;
  /**
   * The least height the box takes in any mode, as its layers bound it, which a radius per corner
   * reads where the height is no literal.
   */
  readonly leastHeight: number;
  /**
   * Whether the capture measured the box, with its sample text, wider than twice its largest radius
   * by a margin in every mode (`cornersFit`), which proves its radii fit across whatever its least
   * width.
   */
  readonly holdsCorners: boolean;
  /**
   * The box's limits, whose minimum width a radius per corner reads beside a fixed height, or
   * undefined where a `min-*` or `max-*` limit the box sets stays unmapped. CSS may then size the box
   * past its sizing, so neither an infinite `border-radius` nor a radius per corner maps, except four
   * equal radii, which read no side.
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

/**
 * Whether a box sets a corner radius at all, by `border-radius` or a longhand, which a corner that
 * {@link readCorner} leaves undefined then leaves unmapped.
 *
 * @param reader - The box's style.
 * @returns True where the box's style sets a radius on any corner.
 */
export function setsCorner(reader: LayerStyle): boolean {
  return (
    reader.has("border-radius") || CORNERS.some((corner) => cornerProperty(reader, corner) !== undefined)
  );
}

/**
 * The greatest corner Figma draws as written on a box: half its shorter side. Figma caps a larger
 * radius there (probe P10).
 *
 * @param width - The box's width in pixels.
 * @param height - The box's height in pixels.
 * @returns Half the shorter side.
 */
export function cornerCap(width: number, height: number): number {
  return Math.min(width, height) / 2;
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
 * the bound. A box that hugs its width, and hugs or fixes its height, maps the same way where its
 * least width and its least height in any mode prove it, as a framed Table's corner cell rounds one
 * corner. The least width is what `leastHugWidth` gives, its padding and stroke across within its
 * width limits. Where the capture measured the box, with its sample text, wider than twice its
 * largest radius in every mode (`cornersFit`), that measure proves the radii fit across, and only its
 * least height decides, so a realistic text maps. A text much shorter than the sample is a known limit there: in the dense TKAS theme an
 * edge cell's padding and border take 25px beside a 15px corner, so a cell holding `1` still fits,
 * one holding `i` is about 28.4px wide, where Figma caps the corner at about 14.2px, one holding `.`
 * caps it too, and an emptied one is 25px wide, capped at 12.5px. A box whose sides are no literals
 * maps one more shape, {@link pairedCorners}: one radius on the two corners of its shorter side and
 * none on the others. These shapes read the box's sides, so a box with a `min-*` or `max-*` limit
 * that stays unmapped maps none of them, since that limit can make CSS's box longer or shorter on
 * either axis than the build reads it, as a variable `min-h-*` past a literal `h-*` does. Four equal
 * radii are the exception to all of these: they read no side, so they map first, as written, on a
 * box of any size, {@link equalCorners}, as a Frame panel's `rounded-t-*` and `rounded-b-*` give. Any
 * other corner set stays unmapped. A `border-radius` that wins only some corners reaches this reader
 * as those corners' longhands, as `border-shorthands.ts` splits it, so `rounded-[4px]
 * rounded-s-[8px]` reads 8px on the left corners and 4px on the right. One that stays whole there, as
 * a value whose `var()` stands for an unknown number of radii does, leaves the box unmapped beside a
 * corner longhand.
 */
function readCorners(
  reader: LayerStyle,
  { held: sizing, leastWidth, leastHeight, holdsCorners, limits }: CornerBox,
  variables: VariableIndex
): CornersSpec | undefined {
  if (reader.has("border-radius")) {
    return undefined;
  }
  const raw = CORNERS.map((corner) => rawRadius(reader, corner, variables));
  const width = fixedLength(sizing.horizontal);
  const height = fixedLength(sizing.vertical);
  // Four equal radii come first: written as is, they draw alike at any size a designer gives the box.
  const equal = equalCorners(raw);
  const drawn =
    equal !== undefined || limits === undefined
      ? equal
      : width?.kind === "literal" && height?.kind === "literal"
        ? drawnCorners(raw, width.value, height.value)
        : width?.kind === "literal" && sizing.vertical.kind === "hug"
          ? unscaledCorners(raw, width.value, leastHeight)
          : ((sizing.horizontal.kind === "hug" && sizing.vertical.kind !== "fill"
              ? unscaledCorners(raw, holdsCorners ? HELD_ACROSS : leastWidth, leastHeight)
              : undefined) ?? pairedCorners(raw, { sizing, limits }, variables));
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
        read.kind !== "literal"
          ? describeNumber(read)
          : equal === undefined
            ? {
                outcome: "literal",
                detail: `${read.value}px on the ${corner.key} corner, as CSS draws it on the box's sides`,
              }
            : {
                outcome: "literal",
                detail: `${read.value}px on the ${corner.key} corner, as written on all four, which CSS and Figma both cap at half the shorter side`,
              },
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

/** A finite radius as written: its variable, or its literal length. */
const writtenRadius = (radius: Exclude<RawRadius, { readonly kind: "infinite" }>): NumberSpec =>
  radius.kind === "variable" ? radius.spec : { kind: "literal", value: radius.px };

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
 * any radius and any length. Undefined for any other corner set; four equal radii, every corner 0
 * among them, are {@link equalCorners}'.
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
    rounded.length === 2 &&
    side !== undefined &&
    first !== undefined &&
    second !== undefined &&
    sameRadius(first, second) &&
    noLongerThanOther(box, side.length, variables);
  return paired ? known.map(writtenRadius) : undefined;
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
 * A box's width where the capture measured it wider than twice its largest radius in every mode
 * (`cornersFit`), so no radius along its top or bottom scales or reaches half its width.
 */
const HELD_ACROSS = "held";

/**
 * The radii as written, on a box whose sides are at least the given lengths, where they prove CSS
 * scales none of them and Figma caps none, each a variable at its greatest value: the radii along
 * each side sum within its least length, and each sits within {@link cornerCap}. A width of
 * {@link HELD_ACROSS} proves the top and bottom fit, so only the height decides. Undefined otherwise,
 * or for a radius that reads as no length.
 */
function unscaledCorners(
  raw: readonly (RawRadius | undefined)[],
  width: number | typeof HELD_ACROSS,
  height: number
): readonly NumberSpec[] | undefined {
  const known = raw.flatMap((each) => (each === undefined || each.kind === "infinite" ? [] : [each]));
  if (known.length !== raw.length) {
    return undefined;
  }
  const px = known.map((each) => (each.kind === "literal" ? each.px : each.most));
  const [topLeft = 0, topRight = 0, bottomRight = 0, bottomLeft = 0] = px;
  const cap = cornerCap(width === HELD_ACROSS ? Number.POSITIVE_INFINITY : width, height);
  const within = (first: number, second: number, length: number) => first + second <= length;
  const fits =
    px.every((radius) => radius <= cap) &&
    (width === HELD_ACROSS || (within(topLeft, topRight, width) && within(bottomLeft, bottomRight, width))) &&
    within(topRight, bottomRight, height) &&
    within(topLeft, bottomLeft, height);
  return fits ? known.map(writtenRadius) : undefined;
}

/**
 * The radii as written where all four are one literal or one variable, which CSS and Figma draw alike
 * on a box of any size, its limits unread: CSS scales each by the least of 1 and every side over twice
 * the radius (CSS Backgrounds 3 §5.5), so it draws the radius, at most half the shorter side, which is
 * where Figma caps it (probe P10). Undefined where any corner differs, is infinite or reads as no
 * length.
 */
function equalCorners(raw: readonly (RawRadius | undefined)[]): readonly NumberSpec[] | undefined {
  const known = raw.flatMap((each) => (each === undefined || each.kind === "infinite" ? [] : [each]));
  const [first] = known;
  return first !== undefined &&
    known.length === CORNERS.length &&
    known.every((each) => sameRadius(each, first))
    ? known.map(writtenRadius)
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
  const cap = cornerCap(width, height);
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
