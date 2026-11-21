/**
 * Rows that hug inside a popup that hugs them. A Dropdown menu popup has no width of its own, so CSS
 * sizes it to its widest row, while a Figma column whose layers all fill hugs only to its `minWidth`
 * (PM). So the row that sets the popup's width hugs, and an instance of a row set drawn at a definite
 * width then draws its filling text at the text's own width (PH2).
 */
import { isDeepStrictEqual } from "node:util";

import { paintsAnything } from "./box-paint";
import { pixelsAcross } from "./box-sizing";
import type { Room } from "./box-sizing";
import type { VariableIndex } from "./css-values";
import type { BoxSpec, LimitsSpec, NumberSpec, SizeSpec, SizingSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";
import type { Layout } from "./placement";

/**
 * Whether a text the inner variant fills across draws as the hugging text of the root built in place:
 * on 2026-10-25 Figma drew a FILL text that is a direct child of an instance root set to HUG across at
 * the text's own width, and that width followed the TEXT property, as a hugging text's does (PH2). A
 * text deeper down sizes against the frame around it, which the instance's hug does not reach.
 *
 * @param root - The sizing of the inner root built in place, which the instance takes.
 * @param path - The keys of the layers from the inner root down to the text.
 * @param inPlace - The text's sizing in the root built in place.
 * @param variant - The text's sizing in the inner variant.
 * @returns True where the two draw alike.
 */
export function drawsAtOwnWidth(
  root: SizingSpec,
  path: readonly string[],
  inPlace: SizingSpec,
  variant: SizingSpec
): boolean {
  return (
    root.horizontal.kind === "hug" &&
    path.length === 1 &&
    inPlace.horizontal.kind === "hug" &&
    variant.horizontal.kind === "fill" &&
    isDeepStrictEqual(inPlace.vertical, variant.vertical)
  );
}

/**
 * Where an instance part sits in its parent, as `instancePlace` in `box-sizing.ts` reads it in
 * `mapPart`: `column-start` where a column stretches it across and places a layer that hugs at its
 * start, in CSS and in Figma, and `elsewhere` for every other place.
 */
export type InstancePlace = "column-start" | "elsewhere";

/**
 * The sizing an instance takes, and which of its texts' sizings draw as the inner variant's, as
 * {@link settleInstanceRoot} settles them before the diff walks the instance.
 */
export type SettledRoot = {
  /** The sizing the instance takes. */
  readonly sizing: SizingSpec;
  /**
   * Whether a text's sizing in the root built in place draws as its sizing in the inner variant,
   * inside an instance of {@link sizing}.
   */
  readonly textsAlike: (path: readonly string[], inPlace: SizingSpec, variant: SizingSpec) => boolean;
};

/** What the style of the root built in place says of its text and its own width. */
export type InPlaceStyle = {
  /** Whether CSS sets the given characters on one line whatever the room. */
  readonly neverWraps: (characters: string) => boolean;
  /**
   * Whether the root's own `width` is `fit-content`, `max-content` or `min-content` under no
   * `max-width`, so the root is at least as wide as a text that never wraps.
   */
  readonly fitsItsLine: boolean;
};

/**
 * Settle the sizing an instance takes, and so which text sizings draw alike in it. The instance takes
 * the inner root's sizing built in place, and a filling text that is a direct child of a root that
 * hugs across draws at its own width, as {@link drawsAtOwnWidth} says.
 *
 * The one exception is the reverse, as a Date range picker's `w-fit` label in its column: a root that
 * a column stretches across, or fits to its text up to the column's width, fills in place, and so
 * does its one text, where the inner variant's root and text hug. A text that never wraps, holding
 * no soft wrap opportunity under a style that breaks no word, sets one line at its own width
 * whatever the room (CSS Sizing 3 §5.1), and a hugging text draws that width. The root paints
 * nothing, a background blur included, so a root as wide as its text draws what the wider one
 * draws, and the place puts a layer that hugs at the column's start, where CSS starts the text.
 * Nothing clips the word on either side. A root that clips in place cuts its text off where it
 * ends: stretched in an 80px column with 60px of padding at its end, a Label is 20px wide, and CSS
 * cuts `September` there, where a hugging instance draws the whole word. A `fit-content`,
 * `max-content` or `min-content` root under no `max-width` is at least as wide as its one line
 * (CSS Sizing 3 §5.1, §5.2), so in the same column a `w-fit` Label is as wide as `September`, and
 * its clip cuts nothing. The instance clips as its variant does, so a variant that clips cuts the
 * word wherever the instance's widest width, built in place or held by the variant, is narrower than
 * the word, which CSS shows past a cap that does not clip. So the instance hugs across as the
 * variant's root does. A text a designer types with spaces wraps in CSS where it is wider than the
 * column, and runs on in the instance, as it runs on in the inner set's own variant.
 *
 * @param inPlace - The inner root built in place, with the clipping its own style sets there.
 * @param variant - The inner variant's root.
 * @param place - Where the instance sits in its parent.
 * @param style - What the style of the root built in place says of its text and its width.
 * @returns The sizing and the texts that draw alike.
 */
export function settleInstanceRoot(
  inPlace: BoxSpec,
  variant: BoxSpec,
  place: InstancePlace,
  style: InPlaceStyle
): SettledRoot {
  const { neverWraps, fitsItsLine } = style;
  const [built] = inPlace.children;
  const [held] = variant.children;
  const hugs =
    place === "column-start" &&
    inPlace.sizing.horizontal.kind === "fill" &&
    variant.sizing.horizontal.kind === "hug" &&
    !paintsAnything(inPlace) &&
    (!inPlace.clips || fitsItsLine) &&
    (!variant.clips || (inPlace.limits.maxWidth === undefined && variant.limits.maxWidth === undefined)) &&
    inPlace.children.length === 1 &&
    variant.children.length === 1 &&
    built?.kind === "text" &&
    held?.kind === "text" &&
    built.key === held.key &&
    built.align.horizontal === "LEFT" &&
    built.truncation === undefined &&
    fillsWhereHugging([built.key], built.sizing, held.sizing) &&
    neverWraps(built.characters) &&
    neverWraps(held.characters);
  return hugs
    ? {
        sizing: { ...inPlace.sizing, horizontal: variant.sizing.horizontal },
        textsAlike: fillsWhereHugging,
      }
    : {
        sizing: inPlace.sizing,
        textsAlike: (path, built, held) => drawsAtOwnWidth(inPlace.sizing, path, built, held),
      };
}

/**
 * Whether a text that is a direct child of the root fills across in place where it hugs in the
 * variant, at the same sizing down.
 */
function fillsWhereHugging(path: readonly string[], inPlace: SizingSpec, variant: SizingSpec): boolean {
  return (
    path.length === 1 &&
    inPlace.horizontal.kind === "fill" &&
    variant.horizontal.kind === "hug" &&
    isDeepStrictEqual(inPlace.vertical, variant.vertical)
  );
}

/**
 * How a box that hugs its rows sizes them across, or undefined where the rule does not apply. A block
 * box with no width of its own shrinks to fit its widest block, at least its `min-width` (CSS 2.1
 * §10.3.7), and every block in it is that wide (§10.3.3). A Figma column whose layers all fill hugs only
 * to its `minWidth` (PM), and one that hugs a layer takes that layer's width while its filling layers
 * stretch to it (PH2, PF). So in a box that stacks blocks and hugs its width, with a `min-width` or a
 * part that holds the named row, the part that holds the row hugs and every other part fills. A popup
 * that names no row is at its minimum, which its filling rows take.
 *
 * @param box - The box's layout, its width's sizing and its limits.
 * @param holds - Whether each part in its flow holds the named row.
 * @returns HUG or FILL for each part, in order, or undefined where the box is no such popup.
 */
export function rowsAcross(
  box: { readonly layout: Layout; readonly width: SizeSpec; readonly limits: LimitsSpec },
  holds: readonly boolean[]
): readonly SizeSpec[] | undefined {
  const applies =
    box.layout.blocks &&
    box.width.kind === "hug" &&
    (box.limits.minWidth !== undefined || holds.some((each) => each));
  return applies ? holds.map((each) => (each ? HUG_SIZE : FILL_SIZE)) : undefined;
}

const HUG_SIZE: SizeSpec = { kind: "hug" };
const FILL_SIZE: SizeSpec = { kind: "fill" };

/**
 * The least width a popup that hugs its rows keeps its named row at: its `min-width` less its padding
 * across, or, for a frame around the row, what the popup gives it less the frame's own padding, where
 * the padding is the same length in every mode. A hugging instance with that `minWidth` fills its
 * filling text up to it and hugs past it (PH3), so the row never draws narrower than the rows that
 * fill, and never wraps its text where they would.
 *
 * @param own - The box's own `min-width`, or undefined.
 * @param room - What the box around it gives the box, with the minimum it passes down.
 * @param style - The box's style, whose padding across the minimum leaves out.
 * @param variables - The synced variables the padding can read.
 * @returns The minimum as a literal length, or undefined where none reads in pixels.
 */
export function rowMinimum(
  own: NumberSpec | undefined,
  room: Room,
  style: LayerStyle,
  variables: VariableIndex
): NumberSpec | undefined {
  const base = own ?? room.rowMinimum;
  const padding = pixelsAcross(style, ["padding-left", "padding-right"], variables);
  return base?.kind === "literal" && padding !== undefined
    ? { kind: "literal", value: base.value - padding }
    : undefined;
}

/**
 * The room a popup that hugs its rows gives a part: the sizing across `rowsAcross` decides, and, for
 * the part that holds the named row, the minimum it carries down to the row.
 *
 * @param inside - The room the box gives the part before the rule.
 * @param across - The part's sizing across, or undefined where the box is no such popup.
 * @param minimum - The box's row minimum, or undefined.
 * @returns The part's room.
 */
export function rowRoom(inside: Room, across: SizeSpec | undefined, minimum: NumberSpec | undefined): Room {
  const sized =
    across === undefined ? inside : { ...inside, horizontal: { ...inside.horizontal, auto: across } };
  return across?.kind === "hug" && minimum !== undefined ? { ...sized, rowMinimum: minimum } : sized;
}
