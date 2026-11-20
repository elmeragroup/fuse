/**
 * A flex row's part that fits its content to the room the row's other layers leave it, drawn as a
 * fill: its last part, or the first of two that the row spaces between its ends.
 *
 * A flex item with an `auto` basis that does not grow is as wide as its max-content width, and,
 * where that is wider than the room the row's other layers leave, shrinks to that room (CSS Flexbox
 * 1 §9.7), down to its min-content width (§4.5). Where every other layer of the row keeps its own
 * width, the part alone gives back what overflows, so it is as wide as its content up to the room,
 * which is `fit-content` against that room (CSS Sizing 3 §5.1), and its text wraps at the room as a
 * fill's does. The row decides whether a part is placed so ({@link fitsRowRoom}); the part's own layers,
 * once mapped, decide whether the room's width draws as its content's width does
 * ({@link drawsAtRoom}). A part wider than the room by one word, its min-content width, overflows
 * in CSS where a fill wraps the word: a known limit, as for `flex: 1`.
 */
import { fitsRoom, partShare } from "./box-sizing";
import type { Holder, RowShare } from "./box-sizing";
import { evaluateLength, evaluateNumber, normalizeCss, readNumber } from "./css-values";
import type { VariableIndex } from "./css-values";
import { outOfLayout } from "./kit-spec";
import type { ChildLayerSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";

/** The `justify-content` values that pack a row's layers from its start, its initial `normal` among them. */
const FROM_START: ReadonlySet<string> = new Set(["", "normal", "start", "flex-start", "left"]);

/**
 * The declarations that size a part along its row, any of which the fit leaves to the part: a basis,
 * a length or a limit, the `flex` shorthand, and margins across, which take room from it.
 */
const OWN_WIDTH = [
  "width",
  "min-width",
  "max-width",
  "flex",
  "flex-basis",
  "margin-left",
  "margin-right",
] as const;

/**
 * The elements whose auto width is not their text's max-content width, so the fit does not take
 * them: a field's, a select's, a meter's or a progress bar's width comes from the control, as a
 * `<textarea>`'s `cols` holds it at 176px at 16px whatever it holds (HTML §4.10.11), and a replaced
 * element's from its content. A `<button>` sizes to its content as a block does, so the fit takes it.
 */
const SIZED_BY_ELEMENT: ReadonlySet<string> = new Set([
  "input",
  "textarea",
  "select",
  "img",
  "video",
  "canvas",
  "iframe",
  "object",
  "embed",
  "meter",
  "progress",
]);

/**
 * The declarations that can set a flex item's width past its `width`, which the room the row leaves
 * reads alone: a limit, which clamps it (CSS Flexbox 1 §9.7), and a basis.
 */
const WIDTH_PAST_OWN = ["min-width", "max-width", "flex-basis"] as const;

/**
 * Whether a flex item keeps its own width in a row, and that width is a length in every mode: it
 * does not shrink or grow, sets no limit or basis, and its `width`, where it sets one, is a literal
 * length or binds a synced variable, as `readNumber` reads an `icon-sm` Icon button's
 * `var(--control-h-sm)`, which holds a length in every mode.
 *
 * @param style - The item's style.
 * @param variables - The synced variables.
 */
function keepsWidth(style: LayerStyle, variables: VariableIndex): boolean {
  const factor = (property: string, initial: string) =>
    evaluateNumber(style.resolved(property) ?? initial) ?? Number.NaN;
  const width = style.resolved("width");
  return (
    factor("flex-shrink", "1") === 0 &&
    factor("flex-grow", "0") === 0 &&
    WIDTH_PAST_OWN.every((property) => !style.has(property)) &&
    (width === undefined || readNumber(width, variables) !== undefined)
  );
}

/**
 * Whether a part beside the one that fits draws its margins across as CSS takes them from the row:
 * each is unset or a length of 0 or more, which a frame around the part pads. A negative margin, as
 * `-mr-1` sets, gives the room back in CSS, where no padding draws it, so the fill would be narrower
 * than the part CSS sets. A margin that resolves to no length leaves the room unknown.
 *
 * @param style - The part's style.
 */
function padsMargins(style: LayerStyle): boolean {
  return ["margin-left", "margin-right"].every((property) => {
    const length = style.has(property) ? evaluateLength(style.resolved(property) ?? "") : 0;
    return length !== undefined && length >= 0;
  });
}

/**
 * A layer of a row that is no part, beside the part that fits: an icon, with its style and the width
 * it takes along the row, or the box's label.
 */
export type BesideLayer =
  | { readonly kind: "icon"; readonly style: LayerStyle; readonly share: RowShare }
  | { readonly kind: "label" };

/**
 * Whether an icon beside the fitting part takes a known width of the row: it keeps its own width, as
 * {@link keepsWidth} says for a part, and the width it draws, its size and the margins its frame pads,
 * is its margin box's width in CSS, its literal width and margins across, as `partShare` reads a
 * part's. A negative margin, which no padding draws, or a margin that binds a variable leaves them apart.
 * A margin across that resolves to no length leaves the icon's width unknown, though `partShare`
 * reads it as none. A label's width is its text's, which the fit does not read.
 *
 * @param layer - The layer beside the part.
 * @param variables - The synced variables.
 */
function keepsShare(layer: BesideLayer, variables: VariableIndex): boolean {
  if (layer.kind === "label") {
    return false;
  }
  const { style } = layer;
  const outer = partShare(style);
  return (
    keepsWidth(style, variables) &&
    ["margin-left", "margin-right"].every(
      (property) => !style.has(property) || evaluateLength(style.resolved(property) ?? "") !== undefined
    ) &&
    layer.share.kind === "pixels" &&
    outer.kind === "pixels" &&
    outer.value === layer.share.value
  );
}

/** The declarations of {@link OWN_WIDTH} whose zero is no sizing of the part's own. */
const ZERO_IS_NONE: ReadonlySet<string> = new Set(["min-width", "margin-left", "margin-right"]);

/**
 * Where a part that fits the room its row leaves it sits in the row, as {@link fitsRowRoom} reads it:
 * last, in a row that packs from its start, or first of two, in a row that spaces them between its ends.
 */
export type FitPlace = "last" | "spaced-first";

/**
 * Where a part fits its content to the room its row leaves it, as the module says: the row is a
 * horizontal flex line of definite width that does not wrap or reverse, the part is the one that
 * shrinks, by 1 or more so it gives back all the overflow (CSS Flexbox 1 §9.7), with no grow,
 * basis, length, limit or margin across, and every other layer of the row is a part that keeps its
 * own width or an icon that keeps its width the same way, so the room is the row's less those
 * widths. A part keeps its width with no limit or basis, a `width`, where it sets one, that is a
 * length in every mode, and margins across of 0 or more. An icon keeps it with literal margins
 * across, as Toast's status icon sits before its text column. The part's `display` holds the unmapped row where its layers do not draw alike.
 *
 * The part sits in one of two places, where the fill draws the other layers where CSS places them:
 *
 * - Last, in a row that packs its layers from its start, so the layers before it sit at their own
 *   widths with the gap between them, as a fill's row draws them.
 * - First of the row's two layers, in a row that spaces them between its ends, as Tour's header holds
 *   its title before Close and Alert dialog's header holds its title before the icon. A part that
 *   fits takes its content's width and the other layer ends the row, and a longer part shrinks to the
 *   room and wraps there, so the fill draws both, and the row packs its layers at its start with its
 *   gap, which Figma's SPACE_BETWEEN would drop beside a fill (PV). The part holds its own text and
 *   nothing else, so the fill draws one text that wraps. A part with layers of its own can hold a
 *   text that hugs, as Tour's progress holds its count beside its dots, and the build does not
 *   measure a hugging text's width, so such a part keeps its own width there.
 *
 * A `min-width` of zero, as `min-w-0` sets, is no limit of the part's own: it lets the part shrink
 * past its min-content width, all the way to the room (§4.5), as a fill does, so a word longer than
 * the room overflows the part in both. A zero margin across, as `m-0` sets on List detail's title,
 * takes no room.
 *
 * The part draws as a frame, whatever it holds: parts, as Checkbox card's text column beside its
 * control, its own text, as File upload's description beside its trigger, or both. It may sit alone
 * in its row, where the room is the row's content width, as Card's footer paragraph and Radio row's
 * label do. A form control or a replaced element sizes itself, so it keeps its own sizing.
 *
 * @param holder - The row.
 * @param parts - The style of each part in the row's flow, in layer order.
 * @param index - The part's place among `parts`.
 * @param part - The place of the part that grows in the row, as `readGrowth` reads it, whether the
 *   part draws as a frame of its own, not as an instance, an icon or a pseudo-element, its element's
 *   tag, where the capture holds one, and whether it holds its own text and no layer.
 * @param variables - The synced variables, which a width beside the part may bind.
 * @returns The part's place, or undefined where it does not fit the room.
 */
export function fitsRowRoom(
  holder: Holder,
  parts: readonly LayerStyle[],
  index: number,
  {
    growing,
    frame,
    tag,
    ownText,
    layer,
    beside,
  }: {
    readonly growing: number | undefined;
    readonly frame: boolean;
    readonly tag: string | undefined;
    readonly ownText: boolean;
    /** The part's place among the row's layers. */
    readonly layer: number;
    /** The row's layers that are no part, its icons and its label, in no order. */
    readonly beside: readonly BesideLayer[];
  },
  variables: VariableIndex
): FitPlace | undefined {
  const { layout, sizing, style, layers } = holder;
  const part = parts[index];
  const row = (property: string) => normalizeCss(style.resolved(property) ?? "");
  const place: FitPlace | undefined =
    FROM_START.has(row("justify-content")) && index === parts.length - 1 && layer === layers.length - 1
      ? "last"
      : // The box mapping reads a row's `space-between` once its layers map, so the row can pack at its start.
        ownText && layout.spaceBetweenUnread === true && layers.length === 2 && index === 0 && layer === 0
        ? "spaced-first"
        : undefined;
  const fits =
    place !== undefined &&
    part !== undefined &&
    frame &&
    (tag === undefined || !SIZED_BY_ELEMENT.has(tag)) &&
    layout.flex &&
    layout.direction === "HORIZONTAL" &&
    sizing.horizontal.kind !== "hug" &&
    growing === undefined &&
    ["", "row"].includes(row("flex-direction")) &&
    ["", "nowrap"].includes(row("flex-wrap")) &&
    layers.length === parts.length + beside.length &&
    beside.every((each) => keepsShare(each, variables)) &&
    parts.every((each, place) => place === index || (keepsWidth(each, variables) && padsMargins(each))) &&
    // A failed draw files its row under the part's `display`, so the part must set one.
    part.has("display") &&
    OWN_WIDTH.every(
      (property) =>
        !part.has(property) ||
        (ZERO_IS_NONE.has(property) && evaluateLength(part.resolved(property) ?? "") === 0)
    ) &&
    (evaluateNumber(part.resolved("flex-grow") ?? "0") ?? Number.NaN) === 0 &&
    (evaluateNumber(part.resolved("flex-shrink") ?? "1") ?? 0) >= 1;
  return fits ? place : undefined;
}

/**
 * Whether a layer that fills draws at any width as it does at its content's width: it paints
 * nothing, does not turn, and lays its layers out from its start, each that fills doing the same. A
 * layer that fills it with no width cap takes all the room its row leaves, so a row that centres or
 * ends its layers packs them from its start with its gaps, as Radio row's label centres its radio
 * and its filling content. A column's layers start at its start where each fills it with no width
 * cap. A text that fills sets its lines from the left. A frame that hugs or is fixed keeps its width
 * whatever its parent's, and so does an icon. An instance that fills, a grid, a placed layer and a
 * layer that paints can draw wider, so they do not, and a frame that turns about its centre moves
 * what it holds as its width changes.
 *
 * @param layer - The layer, as its part mapped.
 * @returns True where the width draws alike.
 */
export function drawsFromStart(layer: ChildLayerSpec): boolean {
  if (layer.kind === "icon") {
    return true;
  }
  if (layer.kind === "text") {
    return layer.sizing.horizontal.kind !== "fill" || layer.align.horizontal === "LEFT";
  }
  if (layer.sizing.horizontal.kind !== "fill") {
    return true;
  }
  if (layer.kind === "instance") {
    return false;
  }
  const flowing = layer.children.filter((child) => !outOfLayout(child));
  // A fill under a width cap spans the layer only up to the cap, so the layer's alignment places it.
  // An instance's cap is its own component's, which this layer does not show.
  const fillsAcross = (child: ChildLayerSpec) =>
    (child.kind === "text" || child.kind === "frame") &&
    child.sizing.horizontal.kind === "fill" &&
    (child.kind === "text" ? child.maxWidth : child.limits.maxWidth) === undefined;
  const fromStart =
    layer.direction === "HORIZONTAL"
      ? layer.primaryAlign === "MIN" || flowing.some(fillsAcross)
      : layer.direction === "VERTICAL" && (layer.counterAlign === "MIN" || flowing.every(fillsAcross));
  return (
    fromStart &&
    layer.fill === undefined &&
    layer.stroke === undefined &&
    layer.shadows.length === 0 &&
    layer.placement === undefined &&
    (layer.rotation ?? 0) === 0 &&
    flowing.length === layer.children.length &&
    layer.children.every(drawsFromStart)
  );
}

/**
 * Whether a part that fits the room draws as a fill of it: it draws alike at any width, as
 * {@link drawsFromStart} says, and the least width it keeps in any mode is within the room, as
 * `fitsRoom` says. A wider minimum makes CSS set the part at that minimum, past the room the fill
 * draws.
 *
 * @param layer - The part's layer, as it mapped.
 * @param room - The room the row leaves the part, in pixels, or undefined where it is unknown.
 * @param variables - The synced variables, whose greatest values bound a bound length.
 * @returns True where the fill draws the part.
 */
export function drawsAtRoom(
  layer: ChildLayerSpec,
  room: number | undefined,
  variables: VariableIndex
): boolean {
  return drawsFromStart(layer) && fitsRoom(layer, room, variables);
}
