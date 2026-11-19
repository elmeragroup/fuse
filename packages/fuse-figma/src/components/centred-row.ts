/**
 * A row that hugs above a least width and centers its middle layer between two that keep their own
 * width, as Calendar's header centers its heading between its month buttons, and the column around
 * such a row that centers the blocks beside it, as Calendar's card centers its month grid under a
 * header wider than the grid.
 *
 * `box-sizing.ts` asks {@link readCentredGrowth} while it reads the row's `flex` parts. `box-mapping.ts`
 * then pads the middle layer's margin frame ({@link padCentred}), folds the row's gap into it
 * ({@link foldGap}), and asks whether the row's parent centers its layers ({@link centresBesideSpan}).
 */
import type { BoxCascade } from "./box-cascade";
import type { Holder } from "./box-sizing";
import { KitUnmappable } from "./build-errors";
import type { PartDefinition } from "./component-spec";
import { evaluateLength, evaluatePercentage, normalizeCss } from "./css-values";
import { paintsNothing } from "./empty-part";
import { ZERO } from "./kit-spec";
import type { ChildLayerSpec, FrameLayerSpec, InstanceLayerSpec, NumberSpec, SizeSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";
import type { Layout } from "./placement";

/**
 * The middle layer of a row that {@link readCentredGrowth} reads: its place among the parts in the
 * row's flow, and the padding the frame that draws its margins takes on each side, its margin and
 * the row's gap.
 */
export type CentredGrowth = { readonly kind: "centred"; readonly place: number; readonly padding: number };

/** Why the middle layer's `flex: 1` draws as a hugging layer the row spaces out between its ends. */
const CENTRED_GROWTH =
  "the middle layer grows into the room past the row's content, which the row has only past its least width, and centers its text there, so the text sits halfway between the other two layers, where Figma's SPACE_BETWEEN puts the middle layer, its margins and the row's gap drawn as its padding";

/**
 * Whether a part holds a label and nothing else, the only middle layer {@link readCentredGrowth}
 * takes: a frame part, not a pseudo-element, with a label and no parts.
 *
 * @param part - The part as its box shows it.
 * @returns True for a part with a label and no parts.
 */
export function holdsOnlyLabel(part: {
  readonly kind: string;
  readonly pseudo?: true;
  readonly child?: Pick<PartDefinition, "label" | "parts">;
}): boolean {
  return (
    part.kind === "frame" &&
    part.pseudo !== true &&
    part.child?.label !== undefined &&
    (part.child.parts ?? []).length === 0
  );
}

/**
 * Read a row of three layers whose middle one grows between two that keep their own width, in a row
 * that hugs its layers above a least width. Past its content the row has free space only once its
 * least width binds, and the middle layer's `flex: 1` takes all of it (CSS Flexbox 1 §9.7). The
 * middle layer centers its text, and its margins are equal, so the text sits halfway between the
 * other two layers wherever the row's width lands: `start + gap + margin + (room - gap - margin -
 * text - margin - gap) / 2` puts it at `start + (room - text) / 2`. A Figma row spacing out a hugging
 * middle layer, its margins and the gap drawn as its padding on each side, puts the same text at the
 * same place and is as wide as CSS's row at its least width and past it: on 2026-11-19 a hugging row
 * with a 252px minimum and SPACE_BETWEEN centered a hugging middle frame between two fixed ones at
 * either density, and grew to hold a wider one, with no space beside it, since SPACE_BETWEEN drops
 * `itemSpacing` (CAL2). A middle layer that fills the row instead never widened it (CAL1). So the row
 * draws SPACE_BETWEEN with no item spacing, and the frame around the middle layer pads it by its
 * margin and the gap.
 *
 * The middle layer paints nothing of its own, no background, border, outline or shadow, since CSS
 * paints those across the whole width it grows to, which the hugging layer does not draw. Where the
 * row is no such row, the middle layer's `flex` stays unread. So does a `flex` that a later
 * `flex-grow`, `flex-shrink` or sizing declaration overrides, since `grow-0` after `flex-1` keeps the
 * layer at its text, and CSS then leaves the room after it.
 *
 * @param holder - The row, with its least width.
 * @param parts - The style of each part in the row's flow.
 * @param labelOnly - Whether each part holds a label and nothing else, as {@link holdsOnlyLabel} says.
 * @param keepsWidth - Whether a part neither grows nor shrinks from its `auto` basis.
 * @returns The middle part's growth, or undefined where the row is no such row.
 */
export function readCentredGrowth(
  holder: Holder,
  parts: readonly LayerStyle[],
  labelOnly: readonly boolean[],
  keepsWidth: (part: LayerStyle) => boolean
): CentredGrowth | undefined {
  const { layout, sizing, limits, style, layers } = holder;
  const [first, middle, last] = parts;
  if (
    !layout.flex ||
    layout.direction !== "HORIZONTAL" ||
    layout.justify !== "unset" ||
    sizing.horizontal.kind !== "hug" ||
    limits.minWidth === undefined ||
    limits.maxWidth !== undefined ||
    layers.length !== 3 ||
    parts.length !== 3 ||
    first === undefined ||
    middle === undefined ||
    last === undefined ||
    !keepsWidth(first) ||
    !keepsWidth(last) ||
    labelOnly[1] !== true ||
    !paintsNothing(middle) ||
    normalizeCss(style.resolved("flex-wrap") ?? "nowrap") !== "nowrap" ||
    normalizeCss(middle.resolved("flex") ?? "") !== "1" ||
    normalizeCss(middle.resolved("text-align") ?? "") !== "center" ||
    ["width", "min-width", "max-width", "flex-basis", "flex-grow", "flex-shrink"].some((property) =>
      middle.has(property)
    )
  ) {
    return undefined;
  }
  const margin = evaluateLength(middle.resolved("margin-left") ?? "");
  // `gap` of one length sets the column gap too, which the cascade keeps as the shorthand.
  const gap = evaluateLength(style.resolved("column-gap") ?? style.resolved("gap") ?? "");
  if (
    margin === undefined ||
    gap === undefined ||
    margin <= 0 ||
    evaluateLength(middle.resolved("margin-right") ?? "") !== margin
  ) {
    return undefined;
  }
  middle.read(
    "flex",
    (value) => value,
    () => ({ outcome: "literal", detail: CENTRED_GROWTH }),
    middle.feed("sizing")
  );
  return { kind: "centred", place: 1, padding: margin + gap };
}

/**
 * Pad the frame that draws the middle layer's margins, which {@link readCentredGrowth} read, by its
 * margin and the row's gap on each side, since the row draws SPACE_BETWEEN, which drops the gap.
 *
 * @param layer - The middle part's layer as mapped.
 * @param framed - Whether the layer is the frame that draws the part's margins, as `margin-box.ts`
 *   wrapped it.
 * @param padding - Its margin and the row's gap, in pixels.
 * @param variant - The variant's key, for the error.
 * @returns The margin frame, padded.
 * @throws `KitUnmappable` where the part draws no margin frame, which the margins
 *   {@link readCentredGrowth} requires rule out.
 */
export function padCentred(
  layer: FrameLayerSpec | InstanceLayerSpec,
  framed: boolean,
  padding: number,
  variant: string
): FrameLayerSpec {
  if (!framed || layer.kind !== "frame") {
    throw new KitUnmappable({
      message: `${variant}: the layer that grows between its row's two others draws no frame for its margins`,
    });
  }
  const side: NumberSpec = { kind: "literal", value: padding };
  return { ...layer, paddingLeft: side, paddingRight: side };
}

/**
 * Read a row's gap where {@link readCentredGrowth} folds it into its middle layer's padding: the row
 * draws no item spacing, since SPACE_BETWEEN would drop it.
 *
 * @param reader - The row's style.
 * @returns No item spacing.
 */
export function foldGap(reader: LayerStyle): NumberSpec {
  reader.read(
    "gap",
    (value) => value,
    () => ({
      outcome: "literal",
      detail:
        "padding on each side of the frame around the layer that grows, beside its margin, since the row spaces its layers out between its ends and Figma's SPACE_BETWEEN drops the gap",
    }),
    []
  );
  return ZERO;
}

/** The outer `display` values that lay a box out as a block, which spans its block parent at an `auto` width. */
const BLOCK_LEVEL: ReadonlySet<string> = new Set(["block", "flow-root", "flex", "grid"]);

/**
 * Whether a block spans its block parent's content width in CSS: it is block-level, its `width` is
 * unset, `auto` or `100%`, and it sets no width limit or horizontal margin (CSS 2.1 §10.3.3). A
 * `fit-content` or `max-content` width keeps it at its content's width at the parent's start instead.
 */
function spansAsBlock(style: LayerStyle): boolean {
  const width = normalizeCss(style.resolved("width") ?? "auto");
  const zero = (property: string): boolean => evaluateLength(style.resolved(property) ?? "0") === 0;
  return (
    BLOCK_LEVEL.has(normalizeCss(style.resolved("display") ?? "block")) &&
    (width === "auto" || evaluatePercentage(width) === 1) &&
    ["min-width", "max-width"].every((property) => !style.has(property)) &&
    ["margin-left", "margin-right"].every(zero)
  );
}

/**
 * Where a block box that hugs its width aligns its layers across, beside the one that spans it. The
 * spanning block hugs with the others' widest width as its minimum (`spannedWidth` in
 * `spanning-block.ts`), so it is the box's widest layer, and in CSS every other block spans the box
 * too, where it is block-level at an `auto` or `100%` width. Where each other block is a row that
 * centers its content and draws nothing of its own, no fill, stroke, shadow or padding across, CSS
 * draws that content centered in the box, which a Figma column that centers its hugging rows draws:
 * on 2026-11-19 a hugging column holding a hugging row and a fixed 252px frame centered the frame
 * under the row once the row grew past it (CAL3). A block at `fit-content` or `max-content` sits at
 * the box's start instead, so the box keeps its alignment.
 *
 * @param layout - The box's layout.
 * @param width - The box's width sizing.
 * @param flowing - The parts in the box's flow, each with its cascade.
 * @param layerOf - A part's layer as mapped.
 * @returns `CENTER` where the box centers its layers across, or undefined.
 */
export function centresBesideSpan<Part extends { readonly cascade: Pick<BoxCascade, "style" | "measured"> }>(
  layout: Layout,
  width: SizeSpec,
  flowing: readonly Part[],
  layerOf: (part: Part) => ChildLayerSpec | undefined
): "CENTER" | undefined {
  const spans = (part: Part): boolean => part.cascade.measured?.spansBeside !== undefined;
  const [span, ...more] = flowing.filter(spans);
  const spanLayer = span === undefined ? undefined : layerOf(span);
  const centresContent = (part: Part): boolean => {
    const layer = layerOf(part);
    return (
      spansAsBlock(part.cascade.style) &&
      layer?.kind === "frame" &&
      layer.direction === "HORIZONTAL" &&
      layer.primaryAlign === "CENTER" &&
      layer.sizing.horizontal.kind === "hug" &&
      layer.fill === undefined &&
      layer.stroke === undefined &&
      layer.shadows.length === 0 &&
      [layer.paddingLeft, layer.paddingRight].every((side) => side.kind === "literal" && side.value === 0)
    );
  };
  return layout.blocks &&
    layout.direction === "VERTICAL" &&
    width.kind === "hug" &&
    more.length === 0 &&
    spanLayer?.kind === "frame" &&
    spanLayer.limits.minWidth !== undefined &&
    flowing.every((part) => spans(part) || centresContent(part))
    ? "CENTER"
    : undefined;
}
