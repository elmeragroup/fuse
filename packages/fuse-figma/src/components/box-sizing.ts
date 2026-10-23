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
import type { BoxSpec, DirectionSpec, LimitsSpec, NumberSpec, SizeSpec, SizingSpec } from "./kit-spec";
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

/** What a box's parent gives it on each axis. */
export type Room = {
  readonly horizontal: AxisRoom;
  readonly vertical: AxisRoom;
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
};

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
  return { horizontal: axisRoom("horizontal"), vertical: axisRoom("vertical") };
}

/**
 * Whether a box is a column whose unset `align-items` stretches its layers across it, as CSS's
 * `normal` does for flex items.
 */
function stretches({ style, layout }: Holder): boolean {
  return layout.flex && layout.direction === "VERTICAL" && !style.has("align-items");
}

/** Whether a flex box's length on an axis is definite: fixed, or filling a definite length. */
function definite({ layout }: Holder, size: SizeSpec): boolean {
  return layout.flex && size.kind !== "hug";
}

/**
 * The room a box gives one of its parts. Where the box's length is definite, a part's `100%`
 * across the box's direction fills it, as a stretch does, and so does a `100%` along it when the
 * part is the box's only layer. A column that stretches its layers fills a part's unset width
 * across a definite width (CSS Flexbox 1 §9.4 step 11). Every other length hugs.
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
    layout.flex && layout.direction === axis ? siblings : [];
  return {
    horizontal: {
      percent: percent(sizing.horizontal),
      auto: stretches(holder) && definite(holder, sizing.horizontal) ? FILL : HUG,
      siblings: along("HORIZONTAL"),
      length: innerLength(holder, "horizontal", "content"),
    },
    vertical: {
      percent: percent(sizing.vertical),
      auto: HUG,
      siblings: along("VERTICAL"),
      length: innerLength(holder, "vertical", "content"),
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
 * and stretches the others to it, and Figma shrinks a layer that fills a hugging frame, so the
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
 * from its zero basis. Any other `flex` stays unread, so it lands unmapped: in a box of definite
 * length the part takes the room the others leave, a minimum can leave room past the layers and a
 * maximum can take room away, and two parts that grow share the free space by their grow.
 *
 * @param holder - The box.
 * @param parts - The style of each part in the box's flow.
 */
export function readGrowth(holder: Holder, parts: readonly LayerStyle[]): void {
  const { layout, sizing, style } = holder;
  const horizontal = layout.direction === "HORIZONTAL";
  const along = horizontal ? sizing.horizontal : sizing.vertical;
  const axis = horizontal ? WIDTH : HEIGHT;
  // A zero minimum never lengthens the box, and any other limit along the axis can.
  const limited =
    style.has(axis.max) || (style.has(axis.min) && evaluateLength(style.resolved(axis.min) ?? "") !== 0);
  const growing = parts.filter((part) => part.has("flex"));
  const [only] = growing;
  if (!layout.flex || along.kind !== "hug" || limited || growing.length !== 1 || only === undefined) {
    return;
  }
  only.read(
    "flex",
    (value) => (normalizeCss(value) === "1" ? value : undefined),
    () => ({
      outcome: "dropped",
      detail: `the ${axis.flow} hugs its layers, so the one layer that grows has no room to grow into`,
    })
  );
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
 * Read a box's sizing and limits on both axes, `field-sizing: content`, and `overflow: hidden`.
 * `field-sizing: content` sizes a form control to its content on each side no length sets (CSS
 * Basic UI 4). The kit hugs such a side already, so it reads where the height hugs. `overflow:
 * hidden` clips the box's content at its padding box, as Figma's clipping does. A part shows what
 * overflows it otherwise, as a CSS box does, and a variant root clips whatever it sets.
 *
 * @param reader - The box's style.
 * @param room - What the box's parent gives it.
 * @param variables - The synced variables a length can bind.
 * @returns The box's sizing, limits, clipping and extent.
 */
export function readSizing(reader: LayerStyle, room: Room, variables: VariableIndex): BoxSizing {
  const horizontal = readAxis(reader, WIDTH, room.horizontal, variables);
  const vertical = readAxis(reader, HEIGHT, room.vertical, variables);
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
  variables: VariableIndex
): AxisRead {
  const size = reader.has(axis.length) ? (readLength(reader, axis, room, variables) ?? HUG) : room.auto;
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
 * limits fold into the length: one that moves it sets it, and one that never moves it drops. A fold
 * to a length of zero or less, and a limit that a bound or non-literal value on either side keeps
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
    if (without !== used) {
      return { outcome: "literal", detail: `the fixed ${axis.length} resolves to ${used}px against it` };
    }
    const [than, never] = bound.side === "min" ? ["more", axis.grows] : ["less", axis.shrinks];
    return {
      outcome: "dropped",
      detail: `it is no ${than} than the fixed ${axis.length}, so it never ${never} the box`,
    };
  };
  return {
    size: { kind: "fixed", length: { kind: "literal", value: used } },
    min: undefined,
    max: undefined,
    notes: new Map([...zeroNotes, ...kept.map((bound): [Bound, CoverageNote] => [bound, foldNote(bound)])]),
  };
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
 * leave.
 *
 * @returns The sizing, or undefined when the value does not map.
 */
function readLength(
  reader: LayerStyle,
  axis: AxisProperties,
  room: AxisRoom,
  variables: VariableIndex
): SizeSpec | undefined {
  const { siblings, percent } = room;
  const read = reader.read(
    axis.length,
    (value) => {
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
