/**
 * A part's margins, which Figma has no field for: a margin of zero drops, and the others draw as a
 * transparent frame around the part whose padding is the margins, the part's margin box.
 * `box-mapping.ts` asks once a part maps, with whether a block parent collapses its vertical margins,
 * and gets back the layer its parent holds and, for an instance part, the instance that layer holds,
 * which the stacking of the boxes above reads. `placement.ts` reads the margins of a root.
 */
import { outOfFlow } from "./box-sizing";
import type { LayerStyle, SpecField } from "./cascade";
import { describeNumber, evaluateLength, normalizeCss, readNumber } from "./css-values";
import type { VariableIndex } from "./css-values";
import { NO_LIMITS, ZERO } from "./kit-spec";
import type { FrameLayerSpec, InstanceLayerSpec, NumberSpec } from "./kit-spec";
import type { Layout } from "./placement";

/**
 * A box's margins, by their physical sides. The cascade splits `m-*`, `mx-*`, `ms-*` and the other
 * shorthand and logical margins into these, so they cascade side by side.
 */
export const MARGINS = ["margin-top", "margin-right", "margin-bottom", "margin-left"] as const;

/** The margins above and below a box, which leave its width alone. */
export const VERTICAL_MARGINS: ReadonlySet<string> = new Set(["margin-top", "margin-bottom"]);

/** The padding of the frame around a part that draws each of its margins. */
const PADDING_OF = {
  "margin-top": "paddingTop",
  "margin-right": "paddingRight",
  "margin-bottom": "paddingBottom",
  "margin-left": "paddingLeft",
} as const satisfies Record<(typeof MARGINS)[number], SpecField>;

/**
 * An instance part as its parent holds it: the instance itself, or a frame that draws its margins
 * around it, and the instance layer that sits in the parent's tree either way, which the stacking
 * notes with what the instance paints.
 */
export type InstanceMarginBox = {
  readonly layer: FrameLayerSpec | InstanceLayerSpec;
  readonly instance: InstanceLayerSpec;
};

/**
 * Whether a vertical margin of the part at `index` among a block box's layers in flow adjoins another
 * margin, so the two collapse (CSS 2.1 §8.3.1): the first and last part's margins adjoin the box's own,
 * and a part's top or bottom margin adjoins the bottom or top margin of the part before or after it.
 * A part out of flow, at `index` -1, adjoins nothing.
 *
 * @param styles - The styles of the box's parts in flow, in order.
 * @param index - The part's place among them, or -1 for a part out of flow.
 * @returns True where a margin adjoins the part's.
 */
export function adjoinsMargin(styles: readonly LayerStyle[], index: number): boolean {
  if (index === -1) {
    return false;
  }
  const sets = (style: LayerStyle | undefined, property: string) =>
    style !== undefined && evaluateLength(style.resolved(property) ?? "0px") !== 0;
  return (
    index === 0 ||
    index === styles.length - 1 ||
    sets(styles[index - 1], "margin-bottom") ||
    sets(styles[index + 1], "margin-top")
  );
}

/**
 * Draw a frame part's margins, as {@link drawMargins} says.
 *
 * @param style - The part's style.
 * @param layer - The part's layer as the mapping drew it.
 * @param parent - The part's parent's layout.
 * @param variables - The synced variables a margin can bind.
 * @param collapses - Whether a vertical margin of the part adjoins another margin in a block parent.
 * @param clipped - Whether the parent clips what overflows it and pads nothing across.
 * @returns The frame around the part, or the layer as it was where it has no margin that maps.
 */
export function wrapFrameMargins(
  style: LayerStyle,
  layer: FrameLayerSpec,
  parent: Pick<Layout, "flex" | "blocks" | "direction">,
  variables: VariableIndex,
  collapses: boolean,
  clipped: boolean
): FrameLayerSpec {
  const frame = drawMargins(style, layer, parent, variables, collapses, clipped);
  if (frame === undefined) {
    return layer;
  }
  const { visibleProperty: _shown, ...box } = layer;
  return { ...frame, children: [{ ...box, key: "box", name: "box" }] };
}

/**
 * Draw an instance part's margins, as {@link drawMargins} says. An instance has no margin box of its
 * own, so the frame is the composite's own layer around it, the instance then carries only its own
 * sizing, and the reads of the margins fill the frame `around` it.
 *
 * @param style - The inner root's style, built in place.
 * @param layer - The instance layer.
 * @param parent - The part's parent's layout.
 * @param variables - The synced variables a margin can bind.
 * @param collapses - Whether a vertical margin of the part adjoins another margin in a block parent.
 * @param clipped - Whether the parent clips what overflows it and pads nothing across.
 * @returns The layer the parent holds and the instance layer inside it.
 */
export function wrapInstanceMargins(
  style: LayerStyle,
  layer: InstanceLayerSpec,
  parent: Pick<Layout, "flex" | "blocks" | "direction">,
  variables: VariableIndex,
  collapses: boolean,
  clipped: boolean
): InstanceMarginBox {
  const frame = drawMargins(style, layer, parent, variables, collapses, clipped);
  if (frame === undefined) {
    return { layer, instance: layer };
  }
  const { visibleProperty: _shown, ...rest } = layer;
  const instance: InstanceLayerSpec = { ...rest, key: "box", name: "box" };
  return { layer: { ...frame, children: [instance] }, instance };
}

/**
 * The frame that draws a part's margins, with no layers yet, or undefined where no margin maps. A
 * margin of zero adds no space, so it drops, as Item's title and description reset a `<p>`'s margins
 * with `m-0`. A flex item's other margins add to the space between it and its siblings and its
 * parent's edge, and never collapse (CSS Flexbox 1 §4.2), so a transparent frame around the part,
 * hugging it, whose padding is the margins, draws the part's margin box. The frame keeps the part's
 * key, name and BOOLEAN property, so hiding the part hides its margin too, and the part's own box sits
 * in it as a layer named `box`. They map at a positive length, on a part in a flex parent's flow whose
 * sides are fixed or hug: a negative margin pulls a sibling closer, which no padding draws, and a
 * margin beside a fill takes room from it. Where any of them does not map, none does, so no frame
 * draws part of a margin.
 *
 * A flex item that its own `align-self: stretch` fills across its parent's direction draws every
 * margin in a frame that fills across in the parent's direction and hugs the item along it, which
 * fills the frame across: the item spans the flex line less its margins (CSS Flexbox 1 §9.4 step 11),
 * as Toolbar's separator sits 4px short of the bar's items at each end.
 *
 * A part that fills a column across draws its margins above and below it in a frame that fills
 * across and hugs down, as a menu separator's `my-1` sets it 4px from the rows around it. Its margins
 * across stay with the part, for the column's separator rule to read (`full-bleed.ts`). A block
 * column's vertical margins collapse where they adjoin another margin (CSS 2.1 §8.3.1), so there the
 * frame draws them only where `collapses` says no margin adjoins them.
 *
 * Such a part at `width: 100%` keeps its width past a start margin, so it reaches past the column's
 * end by that margin (CSS 2.1 §10.3.3). In a column that clips and pads nothing across, the clip cuts
 * it there (CSS Overflow 3 §3), so it shows from the start margin to the column's end, as
 * `Sidebar.Separator`'s `data-horizontal:w-full mx-2` does in `Sidebar.Content`. There the frame also
 * pads a positive literal start margin, and the end margin drops, since it shows nothing.
 */
function drawMargins(
  style: LayerStyle,
  layer: FrameLayerSpec | InstanceLayerSpec,
  parent: Pick<Layout, "flex" | "blocks" | "direction">,
  variables: VariableIndex,
  collapses: boolean,
  clipped: boolean
): FrameLayerSpec | undefined {
  const zero = dropZeroMargins(style);
  const { horizontal, vertical } = layer.sizing;
  // A flex item that its own `align-self: stretch` fills across its parent's direction.
  const stretched =
    parent.flex &&
    normalizeCss(style.resolved("align-self") ?? "auto") === "stretch" &&
    layer.sizing[parent.direction === "HORIZONTAL" ? "vertical" : "horizontal"].kind === "fill" &&
    layer.sizing[parent.direction === "HORIZONTAL" ? "horizontal" : "vertical"].kind !== "fill";
  const across =
    !stretched && parent.direction === "VERTICAL" && horizontal.kind === "fill" && vertical.kind !== "fill";
  const overshoots = across && clipped && overshootsEnd(style, zero, variables);
  const set = MARGINS.filter(
    (property) =>
      style.has(property) &&
      !zero(property) &&
      (!across || VERTICAL_MARGINS.has(property) || (overshoots && property === "margin-left"))
  );
  const fixedOrHugs = horizontal.kind !== "fill" && vertical.kind !== "fill";
  const length = (value: string): NumberSpec | undefined => {
    const spec = readNumber(value, variables);
    return spec?.kind === "literal" && spec.value < 0 ? undefined : spec;
  };
  const maps = set.every((property) => length(style.resolved(property) ?? "") !== undefined);
  const flows = parent.flex || (parent.blocks && !collapses);
  if (set.length === 0 || !flows || outOfFlow(style) || !(fixedOrHugs || across || stretched) || !maps) {
    return undefined;
  }
  if (overshoots && style.has("margin-right") && !zero("margin-right")) {
    style.mark("margin-right", "dropped", CLIPPED_END, []);
  }
  // A frame part's own box moves into the frame, and so do the fields its reads filled. An instance
  // keeps its fields, which the build diffs against the inner variant.
  if (layer.kind === "frame") {
    style.relocateFeeds("box", new Set());
  }
  const margin = (property: (typeof MARGINS)[number]): NumberSpec =>
    (set.includes(property)
      ? style.read(
          property,
          length,
          (spec) =>
            spec.kind !== "literal"
              ? describeNumber(spec)
              : overshoots && property === "margin-left"
                ? {
                    outcome: "literal",
                    detail: `${spec.value}px of padding at the start of a frame around the part, which keeps its 100% width past the margin, so its column's clip cuts its end`,
                  }
                : {
                    outcome: "literal",
                    detail: `${spec.value}px of padding on a frame around the part, the space the margin adds`,
                  },
          layer.kind === "frame" ? style.feed(PADDING_OF[property]) : style.feed("around")
        )
      : undefined) ?? ZERO;
  const frame: FrameLayerSpec = {
    kind: "frame",
    key: layer.key,
    name: layer.name,
    direction: across ? "VERTICAL" : stretched ? parent.direction : "HORIZONTAL",
    sizing: stretched
      ? stretchedFrame(parent.direction)
      : across
        ? { horizontal: { kind: "fill" }, vertical: { kind: "hug" } }
        : { horizontal: { kind: "hug" }, vertical: { kind: "hug" } },
    limits: NO_LIMITS,
    clips: false,
    paddingTop: margin("margin-top"),
    paddingRight: margin("margin-right"),
    paddingBottom: margin("margin-bottom"),
    paddingLeft: margin("margin-left"),
    itemSpacing: ZERO,
    primaryAlign: across || stretched ? "MIN" : "CENTER",
    counterAlign: across || stretched ? "MIN" : "CENTER",
    cornerRadius: ZERO,
    fill: undefined,
    stroke: undefined,
    shadows: [],
    opacity: 1,
    children: [],
  };
  return layer.visibleProperty === undefined ? frame : { ...frame, visibleProperty: layer.visibleProperty };
}

/**
 * The sizing of the frame around a stretched flex item: it fills across its parent's direction, as
 * the item's margin box spans the flex line (CSS Flexbox 1 §9.4 step 11), and hugs the item along it.
 */
function stretchedFrame(direction: Layout["direction"]): FrameLayerSpec["sizing"] {
  return direction === "HORIZONTAL"
    ? { horizontal: { kind: "hug" }, vertical: { kind: "fill" } }
    : { horizontal: { kind: "fill" }, vertical: { kind: "hug" } };
}

/** Why the end margin of a part that overshoots its clipping column drops. */
const CLIPPED_END =
  "the part keeps its 100% width past its start margin, so it reaches past its column's end, which clips it, and the end margin shows nothing";

/**
 * Whether a part is as wide as its column and sets a positive literal start margin, and its end
 * margin is zero or a positive literal, so it reaches past the column's end by the start margin.
 *
 * @param style - The part's style.
 * @param zero - The test of whether a margin of the part is zero.
 * @param variables - The synced variables a margin can bind, which make it no literal.
 * @returns True where the part overshoots the column's end.
 */
function overshootsEnd(
  style: LayerStyle,
  zero: (property: string) => boolean,
  variables: VariableIndex
): boolean {
  const positive = (property: string) => {
    const spec = readNumber(style.resolved(property) ?? "", variables);
    return spec?.kind === "literal" && spec.value > 0;
  };
  const end = !style.has("margin-right") || zero("margin-right") || positive("margin-right");
  return normalizeCss(style.resolved("width") ?? "") === "100%" && positive("margin-left") && end;
}

/**
 * Drop a part's margins of zero, which add no space, as Item's title and description reset a `<p>`'s
 * margins with `m-0`.
 *
 * @param style - The part's style.
 * @returns The test of whether the style's margin on a side is zero.
 */
export function dropZeroMargins(style: LayerStyle): (property: string) => boolean {
  const zero = (property: string) => evaluateLength(style.resolved(property) ?? "") === 0;
  for (const property of MARGINS.filter((side) => style.has(side) && zero(side))) {
    style.read(
      property,
      (value) => value,
      () => ({ outcome: "dropped", detail: "a zero margin adds no space" }),
      []
    );
  }
  return zero;
}

/** What a box is to the fold of its negative margins: what it paints, its width and its parent. */
export type FoldingBox = {
  /** Whether the box paints a fill, a stroke or a shadow. */
  readonly paints: boolean;
  /** Whether the box's width hugs what it holds. */
  readonly hugs: boolean;
  /** Whether the box is a flex item in a row. */
  readonly inFlexRow: boolean;
};

/**
 * Fold a negative margin across a row into the padding on its side, where the box paints nothing.
 * A flex item's outer size along the row is its margin box (CSS Flexbox 1 §9.2, CSS 2.1 §8.3), so a
 * negative end margin of 4px takes 4px from the room it uses and pulls the next item, or the row's
 * end, 4px nearer its content. A box that paints nothing and hugs its width shows only its content,
 * which sits in the same place when the 4px come off its padding instead, as Input group's trailing
 * addon pulls its button toward the field's edge with `-mr-1`. Figma has no negative padding, so the
 * fold holds only where the padding less the margin is 0 or more in every mode, and where it reads a
 * variable, only where a synced variable's formula is that difference.
 *
 * @param style - The box's style.
 * @param side - The side of the margin and the padding, `left` or `right`.
 * @param box - What the box paints, whether it hugs, and whether it sits in a row.
 * @param variables - The synced variables the folded padding can bind.
 * @returns The padding on that side, with both declarations read, or undefined where nothing folds.
 */
export function foldNegativeMargin(
  style: LayerStyle,
  side: "left" | "right",
  box: FoldingBox,
  variables: VariableIndex
): NumberSpec | undefined {
  const marginProperty = side === "left" ? "margin-left" : "margin-right";
  const paddingProperty = `padding-${side}`;
  const margin = evaluateLength(style.resolved(marginProperty) ?? "");
  const padding = style.resolved(paddingProperty) ?? "0px";
  if (margin === undefined || margin >= 0 || box.paints || !box.hugs || !box.inFlexRow) {
    return undefined;
  }
  const held = readNumber(padding, variables);
  const least = held?.kind === "literal" ? held.value : held && variables.minimum(held.variable);
  if (held === undefined || least === undefined || least + margin < 0) {
    return undefined;
  }
  const ref = held.kind === "literal" ? undefined : variables.lookupAffine(`calc(${padding} + ${margin}px)`);
  const folded: NumberSpec | undefined =
    held.kind === "literal"
      ? { kind: "literal", value: held.value + margin }
      : ref && { kind: "variable", variable: ref };
  if (folded === undefined) {
    return undefined;
  }
  const field = PADDING_OF[marginProperty];
  const { outcome, detail } = describeNumber(folded);
  style.read(
    paddingProperty,
    () => folded,
    () => ({ outcome, detail: `${detail}, this padding less the negative margin on its side` }),
    style.feed(field)
  );
  style.read(
    marginProperty,
    () => folded,
    () => ({
      outcome,
      detail: `${detail}, the padding on its side less this margin, since the box paints nothing and its width hugs`,
    }),
    style.feed(field)
  );
  return folded;
}
