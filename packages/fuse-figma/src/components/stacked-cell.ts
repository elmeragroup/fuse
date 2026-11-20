/**
 * A grid of one cell whose icons stack in it, one of them shown, as Checkbox card's control holds
 * its unchecked and checked icons and crossfades them: the kit draws the shown icon and leaves the
 * others out.
 *
 * A grid that sets no track holds one implicit row and column for items placed at line 1 on both
 * axes (CSS Grid 1 §7.5, §8.3), and every such item sits in that cell, one over another. The box
 * draws the one icon that paints only where:
 *
 * - the box sets no grid template, auto track, area or gap, has a fixed literal width and height,
 *   and no padding or border, so its one cell is its whole box;
 * - it holds two or more icons and nothing else, each placed at line 1 on both axes with no span,
 *   positioned statically with no margin, self-alignment, padding or border, and as wide and tall as
 *   the box with no limit that changes that, so each covers the cell exactly and no alignment moves
 *   it (CSS Box Alignment 3 §6). A hidden icon taller than the cell would make the track taller and
 *   move the shown one;
 * - each icon's `opacity` resolves to 0 or 1, and exactly one to 1.
 *
 * An icon at opacity 0 paints nothing, its filter and transform included, which apply to what it
 * paints (CSS Color 4 §3.2, Filter Effects 1 §5, CSS Transforms 1 §6), so it draws no layer. The
 * shown icon fills the box's frame as the cell does. Its opacity of 1 changes nothing, and so does a
 * `scale` that resolves to 1 on each axis and a `filter` whose functions all substitute to nothing,
 * which leaves the declaration invalid at computed-value time and the property at its initial `none`
 * (CSS Variables 1 §3.1). A motion between the two states draws no frame: the kit draws states.
 */
import { evaluateLength, evaluateNumber, evaluatePercentage, normalizeCss } from "./css-values";
import type { SizingSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";

/** The grid properties that set a track, an area or a gap, any of which the one-cell stack refuses. */
const TRACKS = [
  "grid",
  "grid-template",
  "grid-template-columns",
  "grid-template-rows",
  "grid-template-areas",
  "grid-auto-columns",
  "grid-auto-rows",
  "grid-auto-flow",
  "gap",
  "row-gap",
  "column-gap",
] as const;

/** The insets of a box that would make its one cell smaller than its border box, or an icon larger than its size. */
const INSETS = [
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
] as const;

/** The declarations of an icon that would move it within the cell or take it out of the stack. */
const MOVES = [
  "grid-area",
  "grid-column",
  "grid-row",
  "justify-self",
  "align-self",
  "place-self",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
] as const;

/** Why an icon of the stack that paints nothing draws no layer. */
export const STACK_HIDDEN =
  "the icon sits in its grid's one cell at opacity 0, which paints nothing of it, its filter and transform included, so it draws no layer";

/** Why the stack's grid draws as a frame around its shown icon. */
const STACK_DISPLAY =
  "a grid of one cell whose icons stack in it, each covering the cell, of which one shows: a frame around that icon";

/** Why each icon's placement at line 1 drops. */
const IN_THE_CELL = "every icon of the stack sits in the grid's one cell, which the shown icon fills";

/** The one cell's stack: the place among the box's icons of the one that shows. */
export type StackedCell = { readonly shown: number };

/**
 * A length a box's sizing holds as a literal, in pixels.
 *
 * @param size - The sizing on one axis.
 */
function literalSize(size: SizingSpec["horizontal"]): number | undefined {
  return size.kind === "fixed" && size.length.kind === "literal" ? size.length.value : undefined;
}

/**
 * Whether a style leaves a property unset, or sets it to a length of zero.
 *
 * @param style - The style.
 * @param property - The property.
 */
function zero(style: LayerStyle, property: string): boolean {
  return !style.has(property) || evaluateLength(style.resolved(property) ?? "") === 0;
}

/**
 * Whether an icon's used size on one axis is the cell's: its length is the cell's, a minimum no
 * greater and a maximum no less leave that length (CSS 2.1 §10.4, §10.7), and with no padding or
 * border its `box-sizing` changes nothing. A limit that does not resolve to a length, or a variable
 * that may differ across modes, can take the icon past the cell, which a hidden icon then enlarges.
 *
 * @param icon - The icon's style.
 * @param axis - The axis's length, minimum and maximum properties.
 * @param cell - The cell's length on the axis, in pixels.
 */
function usedSizeIs(
  icon: LayerStyle,
  axis: { readonly length: string; readonly min: string; readonly max: string },
  cell: number
): boolean {
  const limit = (property: string, unset: string, within: (length: number) => boolean) => {
    if (!icon.has(property)) {
      return true;
    }
    const value = normalizeCss(icon.resolved(property) ?? "");
    const length = evaluateLength(value);
    return value === unset || (length !== undefined && within(length));
  };
  return (
    evaluateLength(icon.resolved(axis.length) ?? "") === cell &&
    limit(axis.min, "auto", (length) => length <= cell) &&
    limit(axis.max, "none", (length) => length >= cell)
  );
}

/**
 * Read a box as a one-cell stack of icons, as the module says.
 *
 * @param box - The box's style.
 * @param sizing - The box's sizing, as it read.
 * @param icons - The style of each icon the box holds, in order.
 * @param holdsOthers - Whether the box holds a label or a part besides its icons.
 * @returns The stack, or undefined where the box is no such stack.
 */
export function readStackedCell(
  box: LayerStyle,
  sizing: SizingSpec,
  icons: readonly LayerStyle[],
  holdsOthers: boolean
): StackedCell | undefined {
  const display = normalizeCss(box.resolved("display") ?? "");
  const width = literalSize(sizing.horizontal);
  const height = literalSize(sizing.vertical);
  if (
    !["grid", "inline-grid"].includes(display) ||
    holdsOthers ||
    icons.length < 2 ||
    width === undefined ||
    height === undefined ||
    TRACKS.some((property) => box.has(property)) ||
    !INSETS.every((property) => zero(box, property))
  ) {
    return undefined;
  }
  const opacities = icons.map((icon) => evaluateNumber(icon.resolved("opacity") ?? "1"));
  const covers = (icon: LayerStyle) =>
    ["grid-column-start", "grid-row-start"].every(
      (property) => normalizeCss(icon.resolved(property) ?? "") === "1"
    ) &&
    ["grid-column-end", "grid-row-end"].every((property) =>
      ["", "auto"].includes(normalizeCss(icon.resolved(property) ?? ""))
    ) &&
    ["", "static"].includes(normalizeCss(icon.resolved("position") ?? "")) &&
    MOVES.every((property) => !icon.has(property)) &&
    INSETS.every((property) => zero(icon, property)) &&
    usedSizeIs(icon, { length: "width", min: "min-width", max: "max-width" }, width) &&
    usedSizeIs(icon, { length: "height", min: "min-height", max: "max-height" }, height);
  const shown = opacities.flatMap((opacity, place) => (opacity === 1 ? [place] : []));
  const [only] = shown;
  return icons.every(covers) &&
    opacities.every((opacity) => opacity === 0 || opacity === 1) &&
    shown.length === 1 &&
    only !== undefined
    ? { shown: only }
    : undefined;
}

/**
 * Read the stack's grid `display` as the frame around its shown icon.
 *
 * @param box - The box's style.
 * @param lays - The fields the display fills.
 */
export function readStackDisplay(box: LayerStyle, lays: Parameters<LayerStyle["read"]>[3]): void {
  box.read(
    "display",
    (value) => value,
    () => ({ outcome: "literal", detail: STACK_DISPLAY }),
    lays
  );
}

/**
 * Whether a `scale` resolves to 1 on every axis it names, as a number or a percentage.
 *
 * @param value - The resolved `scale`.
 */
function identityScale(value: string): boolean {
  const factors = normalizeCss(value).split(/\s+/);
  return (
    normalizeCss(value) === "none" ||
    factors.every((factor) => (evaluatePercentage(factor) ?? evaluateNumber(factor)) === 1)
  );
}

/**
 * Drop what the shown icon of a stack sets that draws nothing at rest: its placement at line 1, its
 * opacity of 1, an identity `scale`, and a `filter` whose functions substitute to nothing. Any other
 * value of these stays unread, so it lands unmapped.
 *
 * @param icon - The shown icon's style.
 */
export function dropShownStackRest(icon: LayerStyle): void {
  for (const property of ["grid-column-start", "grid-row-start"]) {
    icon.read(
      property,
      (value) => value,
      () => ({ outcome: "dropped", detail: IN_THE_CELL }),
      []
    );
  }
  icon.read(
    "opacity",
    (value) => (evaluateNumber(value) === 1 ? value : undefined),
    () => ({ outcome: "dropped", detail: "an opacity of 1 draws the icon as it is" }),
    []
  );
  icon.read(
    "scale",
    (value) => (identityScale(value) ? value : undefined),
    () => ({ outcome: "dropped", detail: "the scale is 1 on each axis, which draws the icon as it is" }),
    []
  );
  icon.read(
    "filter",
    (value) => (normalizeCss(value) === "" || normalizeCss(value) === "none" ? value : undefined),
    () => ({
      outcome: "dropped",
      detail:
        "every filter function substitutes to nothing, which leaves the filter at its initial none (CSS Variables 1 §3.1)",
    }),
    []
  );
}
