/**
 * The sizing a box's `width` or `height` sets: a fixed length, a percentage of what its parent
 * gives it, a `100%` that fills or that siblings share, a `fit-content` width, and a count of lines
 * in `lh`. `box-sizing.ts` reads each axis's length here.
 */

import type { AxisProperties } from "./box-axis";
import { FILL, HUG } from "./box-room";
import type { AxisRoom } from "./box-room";
import { listNames } from "./coverage";
import { describeNumber, evaluatePercentage, normalizeCss } from "./css-values";
import type { VariableIndex } from "./css-values";
import type { NumberSpec, SizeSpec } from "./kit-spec";
import type { CoverageNote, Feed, LayerStyle } from "./layer-style";
import { AUTO_HEIGHT } from "./percent-height";
import { readSize } from "./sizing-value";
import { SPANS_HUGGING_PARENT, spansBesideBlocks, spansParent } from "./spanning-block";
import { computedLineHeight } from "./typography";

/**
 * Read `width` or `height` as its axis's sizing, through {@link readSize}. A `100%` along a flex
 * box's direction beside other layers stays unmapped: CSS sizes it at the whole length and then
 * shrinks or overflows it with them (CSS Flexbox 1 §9.7), where a fill takes only the room they
 * leave. A `fit-content` width fills a room that stretches it where `fit` says it draws so, as
 * {@link FitContent} says, and hugs otherwise. The read fills the sizing of the layers inside too,
 * as `inside` names it. `spanned` is the least width `spannedWidth` in `spanning-block.ts` gives a box that spans
 * its parent beside other blocks. A box with an `aspect-ratio` leaves the row of an `auto` length
 * unread, with `readAuto` to record it, since `readAspectRatio` in `box-sizing.ts` alone knows whether the ratio
 * sets the axis. A length in `lh` reads only as a plain count of lines, such as `1lh` or `2lh`, the
 * box's own line height times the count, and only where that comes to Figma's least size,
 * {@link FIGMA_LEAST_SIZE_PX}, or more. A `calc()`, `min()`, `max()` or `clamp()` over `lh` stays
 * unmapped.
 *
 * @returns The sizing, undefined when the value does not map, and `readAuto` for an `auto` length
 *   left unread.
 */
export function readLength(
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
 * What a `fit-content` width draws as. `fit-content` is the smaller of what the box holds on one line
 * and the room its parent gives it (CSS Sizing 3 §5.1). A kit frame's default content fits its room,
 * so the width hugs (`content`). A box whose text wraps at that room, and that draws the same at the
 * room's width, fills the room where its parent stretches it (`room`), as `box-mapping.ts` decides.
 */
export type FitContent = "content" | "room";

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
 * map, and the read it left for `readAspectRatio` in `box-sizing.ts` where the length is `auto`.
 */
type LengthSizing = {
  readonly size: SizeSpec | undefined;
  readonly readAuto: ((note?: CoverageNote) => void) | undefined;
};

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
