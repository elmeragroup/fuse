/**
 * A box's fill drawn inside its border, as `background-clip: padding-box` paints the background
 * inside the border only (CSS Backgrounds 3 §3.7). Figma paints a frame's fill under the whole frame
 * and its INSIDE stroke over it, so a translucent or dashed border would show the fill where CSS shows
 * what lies behind the box. `box-paint.ts` hands this module the border's widths where the clip
 * matters, and the box moves its fill onto its first layer, `padding box`: a frame placed out of the
 * auto layout, inset from each edge by that side's border width and stretched with the box, under the
 * box's other layers and its stroke. The box itself draws no fill there, or the clear fill a spread
 * shadow's ring needs (`ringFill`), whose frame shape still knocks the shadow out under the box. A
 * part with `box-sizing: content-box` takes the layer once its content moves into an inner frame
 * (`content-box.ts`), so the layer sits against the outer frame, whose edges are the border box's.
 *
 * The layer rounds by the corner inside the border, the outer radius less the border width, at least
 * 0 (CSS Backgrounds 3 §5.2). A bound outer corner binds the synced variable whose code syntax is
 * `innerCornerSyntax` of the outer one's, such as `radius-inner/calendar-border`. The layer's
 * constraints stretch it with the box, so it takes the length its placement leaves on both axes, and
 * an instance at another size resizes it with no override. A part that scales draws the layer in its
 * dot, its insets and corner at the dot's share (`slotAroundDot` in `placement.ts`). This module alone
 * tells the layer from an ordinary one (`isPaddingBoxLayer`), so the scaled part, the instance diff
 * and the coverage of an instance's fill all read it through these functions.
 *
 * An instance reaches the layer by one rule: where its composite clears the fill, the instance clears
 * the layer's (`againstMainLayer`). No real set overrides anything else of a box that draws the layer,
 * so the diff leaves every other change to it unmapped: a fill the instance would paint on its frame
 * where the main paints the layer, or on a layer where the main paints its frame, and a border width
 * or corner that would move or reshape the main's layer.
 *
 * The clip stays unmapped, and the fill stays on the box, in these cases:
 *
 * - The box holds a layer keyed `padding box` already, which would share its key path with the layer.
 * - A corner's two borders differ in width and the corner is round. CSS draws an elliptical inner
 *   corner there, which a Figma corner radius cannot hold.
 * - The box sets a corner it does not map, or no synced variable holds a bound corner's inner corner.
 * - A content box stays as it reads, so the frame's edges are not the border box's.
 * - The padding and borders lay the box out larger than the fixed length its frame takes in some
 *   mode, as `size-[4px] p-[2px] border-2` lays out 8px (CSS Box Sizing 3 §4.1). A bound length or
 *   padding fits along an axis where its least length holds the greatest padding and borders, or
 *   where each mode of one collection holds that mode's, as a density mode sets a height and its
 *   padding together. Each axis takes its own collection, so one may set the width and another the
 *   height.
 *   A bound length or padding of no known bounds leaves the clip unmapped.
 * - The box sets a padding the kit does not read, as `p-[1em]`, where the box's length is one the
 *   build can tell. At a 16px font `size-[4px] p-[1em] border-2` lays out 36px, with a 32px padding
 *   box, so an unread padding could leave room inside the border.
 * - The borders take an axis's whole used length in some mode, so the padding box is empty. The
 *   build tells that for a fixed length at its least, and for a box that hugs no layer in the flow
 *   at its least padding and its `min-width` or `min-height` in each mode, as an empty
 *   `inline-flex` with 1px borders and no padding hugs 2px across. Nothing
 *   paints inside the border there, but an instance resized larger does paint inside it: a 4px wide
 *   main with 2px borders, resized to 40px, paints 36px. The layer would have to be in the main for
 *   the instance to stretch it, and Figma cannot draw a frame of negative length, so the fill stays
 *   on the box and paints under the border.
 * - Figma would cap the corner inside the border at half the padding box's shorter side, where CSS
 *   draws more. One radius inside four equal borders is never this case: CSS and Figma both draw it
 *   as at most half the shorter side, less the border.
 *
 * A box that fills its parent or takes its placement's length could still be empty once placed, and
 * draws the layer.
 */
import { isDeepStrictEqual } from "node:util";

import { innerCornerSyntax } from "../border-inner-corner";
import { cornerCap } from "./box-corners";
import type { PaddingBoxInsets } from "./box-paint";
import { cornerLengths, scaledCorners } from "./corner-spec";
import type { CornerRadiusSpec, CornersSpec } from "./corner-spec";
import { readNumber } from "./css-values";
import type { ModeView, VariableIndex } from "./css-values";
import { edgeLayer, outOfLayout, ringFill, ZERO } from "./kit-spec";
import type {
  BoxSpec,
  ChildLayerSpec,
  FillSpec,
  FrameLayerSpec,
  NumberSpec,
  SizeSpec,
  StrokeSide,
} from "./kit-spec";
import type { LayerStyle } from "./layer-style";

/** The key and name of the layer that holds a box's fill inside its border. */
export const PADDING_BOX_FILL = "padding box";

/**
 * The fill a box paints of its own: its frame's, or its `padding box` layer's where the fill draws
 * inside the border.
 *
 * @param box - The box as mapped.
 * @returns The fill, or undefined for none.
 */
export function ownFill(box: BoxSpec): FillSpec | undefined {
  return paddingBoxLayer(box)?.fill ?? box.fill;
}

/**
 * Whether a layer is the `padding box` layer that paints its box's fill inside the border: a frame
 * by that key, placed against its parent's edges and stretched with it on both axes. A layer the box
 * places in its auto layout under that key is an ordinary layer.
 *
 * @param layer - A layer the box holds.
 * @returns Whether the layer is the box's `padding box` layer.
 */
export function isPaddingBoxLayer(layer: ChildLayerSpec): layer is FrameLayerSpec {
  return (
    layer.kind === "frame" &&
    layer.key === PADDING_BOX_FILL &&
    layer.placement?.kind === "edges" &&
    layer.placement.horizontal.kind === "stretch" &&
    layer.placement.vertical.kind === "stretch"
  );
}

/** A box's `padding box` layer, or undefined where it draws its fill on its own frame. */
function paddingBoxLayer(box: BoxSpec): FrameLayerSpec | undefined {
  return box.children.find(isPaddingBoxLayer);
}

/**
 * The path of the box whose fill the layer at `path` paints inside its border, where that layer is
 * the box's `padding box` layer. A composite's fill reads that box's fill, which the layer holds.
 *
 * @param root - The root that holds the layer.
 * @param path - The layer's key path below the root.
 * @returns The box's key path, or undefined where the layer at `path` is no `padding box` layer.
 */
export function fillOwner(root: BoxSpec, path: readonly string[]): readonly string[] | undefined {
  const owner = path.slice(0, -1);
  let box: BoxSpec | undefined = root;
  for (const key of owner) {
    const layer: ChildLayerSpec | undefined = box?.children.find((child) => child.key === key);
    box = layer?.kind === "frame" ? layer : undefined;
  }
  const layer = box === undefined ? undefined : paddingBoxLayer(box);
  return layer !== undefined && path.length > 0 && path.at(-1) === layer.key ? owner : undefined;
}

/**
 * Whether a part that scales can draw a layer it holds at its share (`readScale` in
 * `placement.ts`): only its `padding box` layer, with literal corners, whose insets and corner scale
 * with the border.
 *
 * @param layer - A layer the part holds.
 * @returns Whether {@link scaledPaddingBox} draws the layer at the part's share.
 */
export function scalesWithPart(layer: ChildLayerSpec): boolean {
  return (
    isPaddingBoxLayer(layer) && cornerLengths(layer.cornerRadius).every(({ kind }) => kind === "literal")
  );
}

/**
 * A scaled part's `padding box` layer at the part's share: its insets are the border's widths and its
 * corner the one inside the border, so both scale with the border. The layer stretches with the
 * part's dot, so its length follows the dot's.
 *
 * @param layer - A layer the part holds, which {@link scalesWithPart} accepts.
 * @param share - The share of its size the part's paint takes.
 * @returns The layer at the share.
 */
export function scaledPaddingBox(layer: ChildLayerSpec, share: number): ChildLayerSpec {
  if (!isPaddingBoxLayer(layer) || layer.placement?.kind !== "edges") {
    return layer;
  }
  const { horizontal, vertical } = layer.placement;
  const axis = (placed: typeof horizontal) =>
    placed.kind === "stretch" ? { ...placed, start: placed.start * share, end: placed.end * share } : placed;
  return {
    ...layer,
    placement: { ...layer.placement, horizontal: axis(horizontal), vertical: axis(vertical) },
    cornerRadius: scaledCorners(layer.cornerRadius, share),
  };
}

/**
 * How an instance diff compares a box built in place with the main's box at the same key path,
 * where either draws its fill on a `padding box` layer.
 *
 * - `compared`: the diff compares `box` with the main's as it compares any box. Neither holds the
 *   layer, both hold it at the same insets, or the box built in place paints nothing, in which case
 *   `box` holds the main's layer with its fill cleared.
 * - `unmatched`: one box holds the layer and the other does not, or the two hold it at different
 *   insets. No override moves, adds or removes the main's layer, so the diff leaves a difference in
 *   the fill, the stroke's weights or the corner unmapped.
 */
export type LayerAgainstMain = {
  /** The box the diff compares with the main's. */
  readonly box: BoxSpec;
  /** Whether the two boxes draw their fill alike, as the type says. */
  readonly layer: "compared" | "unmatched";
};

/**
 * Compare a box built in place with the main's box for an instance diff, as
 * {@link LayerAgainstMain} says. One instance rule reaches the layer: a box that paints nothing, as
 * `bg-transparent` on a white Calendar does, clears the main layer's fill, since a transparent
 * background paints nothing inside the border either, and an override at the layer's key path
 * carries that. A box with no fill paints nothing, and so does one whose only fill is the clear one
 * its spread ring needs (`ringFill`).
 *
 * @param inPlace - The box built in place.
 * @param main - The main's box at the same key path.
 * @returns The box the diff compares, and whether the two draw their fill alike.
 */
export function againstMainLayer(inPlace: BoxSpec, main: BoxSpec): LayerAgainstMain {
  const held = paddingBoxLayer(main);
  const own = paddingBoxLayer(inPlace);
  if (held === undefined && own === undefined) {
    return { box: inPlace, layer: "compared" };
  }
  if (held !== undefined && own !== undefined) {
    return {
      box: inPlace,
      layer: isDeepStrictEqual(held.placement, own.placement) ? "compared" : "unmatched",
    };
  }
  const paintsNothing =
    inPlace.fill === undefined ||
    isDeepStrictEqual(inPlace.fill, ringFill({ fill: undefined, shadows: inPlace.shadows }));
  if (held === undefined || !paintsNothing) {
    return { box: inPlace, layer: "unmatched" };
  }
  const cleared: FrameLayerSpec = { ...held, fill: undefined };
  const children =
    main.children[0] === held ? [cleared, ...inPlace.children] : [...inPlace.children, cleared];
  return { box: { ...inPlace, children }, layer: "compared" };
}

/** The coverage note of a clip the layer draws. */
const DRAWN =
  "the fill draws on the `padding box` layer, inset by the border under the stroke, so the border shows what lies behind the box";

/** Why a clip stays unmapped where the layer cannot round as CSS does. */
const ELLIPTICAL =
  "a round corner between borders of two widths has an elliptical inner corner (CSS Backgrounds 3 §5.2), which no Figma corner radius holds";

/** Why a clip stays unmapped where the box sets a corner it does not map. */
const UNREAD_CORNER =
  "the box sets a corner it does not map, so the kit cannot round the corner inside the border";

/** Why a clip stays unmapped where a layer of the box already takes the layer's key. */
const OCCUPIED =
  "the box holds a layer keyed `padding box`, the key the layer that draws its fill inside the border takes";

/** Why a clip stays unmapped where a content box leaves the frame its content box's length. */
const CONTENT_EDGES =
  "the frame takes the content box's length, so its edges are not the border box's that the border insets";

/** Why a clip stays unmapped where the borders leave no room inside them at the main's length. */
const EMPTY =
  "the border leaves no padding box at the length the main component takes, so an instance resized larger would have no layer to fill inside the border";

/** Why a clip stays unmapped beside a padding the box sets and the kit does not read. */
const UNREAD_PADDING =
  "the box sets a padding the kit does not read, which could lay the box out larger than the length its frame takes, so the kit cannot size the padding box";

/** Why a clip stays unmapped where the padding and borders floor the box past its frame's length. */
const FLOORED =
  "the padding and borders lay the box out larger than the length its frame takes, so the kit cannot size the padding box";

/** Why a clip stays unmapped where Figma would cap the corner inside the border. */
const CAPPED =
  "the corner inside the border is more than half the padding box's shorter side, which Figma caps it at";

/** Why a clip stays unmapped where no synced variable holds the inner corner of a bound radius. */
const UNSYNCED = "no synced variable holds the corner inside the border, the radius less the border width";

/** Each corner and the two sides whose borders meet there. */
const CORNERS = [
  { key: "topLeft", sides: ["top", "left"] },
  { key: "topRight", sides: ["top", "right"] },
  { key: "bottomRight", sides: ["bottom", "right"] },
  { key: "bottomLeft", sides: ["bottom", "left"] },
] as const satisfies readonly {
  readonly key: Exclude<keyof CornersSpec, "kind">;
  readonly sides: readonly [StrokeSide, StrokeSide];
}[];

/** What sits inside the border: the length or radius CSS draws there, or why no Figma field holds it. */
type Inner<Value> =
  | { readonly kind: "inner"; readonly value: Value }
  | { readonly kind: "unmapped"; readonly reason: string };

/** A length inside the border. */
const inner = <Value>(value: Value): Inner<Value> => ({ kind: "inner", value });

/** Why nothing inside the border maps. */
const unmapped = (reason: string): Inner<never> => ({ kind: "unmapped", reason });

/**
 * The corner inside a border `width` wide, from an outer corner: the outer corner less the width, at
 * least 0, or the synced variable whose code syntax spells that from the outer variable's.
 */
function innerCorner(outer: NumberSpec, width: number, variables: VariableIndex): Inner<NumberSpec> {
  if (width === 0) {
    return inner(outer);
  }
  if (outer.kind === "literal") {
    return inner({ kind: "literal", value: Math.max(0, outer.value - width) });
  }
  const syntax = variables.syntaxOf(outer.variable);
  const bound = syntax === undefined ? undefined : variables.lookup(innerCornerSyntax(syntax, width));
  return bound === undefined ? unmapped(UNSYNCED) : inner({ kind: "variable", variable: bound });
}

/**
 * The border width a corner's inner radius takes: the width of the two borders that meet there, or
 * either where the corner is square.
 */
function cornerWidth(
  outer: NumberSpec,
  [first, second]: readonly [StrokeSide, StrokeSide],
  insets: PaddingBoxInsets
): Inner<number> {
  const square = outer.kind === "literal" && outer.value === 0;
  return insets[first] === insets[second] || square ? inner(insets[first]) : unmapped(ELLIPTICAL);
}

/** The radius inside the border: one length, or a length per corner where they differ. */
function innerRadius(
  outer: CornerRadiusSpec,
  insets: PaddingBoxInsets,
  variables: VariableIndex
): Inner<CornerRadiusSpec> {
  const lengths: NumberSpec[] = [];
  for (const corner of CORNERS) {
    const length = outer.kind === "corners" ? outer[corner.key] : outer;
    const width = cornerWidth(length, corner.sides, insets);
    if (width.kind === "unmapped") {
      return width;
    }
    const drawn = innerCorner(length, width.value, variables);
    if (drawn.kind === "unmapped") {
      return drawn;
    }
    lengths.push(drawn.value);
  }
  const [topLeft = ZERO, topRight = ZERO, bottomRight = ZERO, bottomLeft = ZERO] = lengths;
  const same = [topRight, bottomRight, bottomLeft].every(
    (corner) => JSON.stringify(corner) === JSON.stringify(topLeft)
  );
  return inner(same ? topLeft : { kind: "corners", topLeft, topRight, bottomRight, bottomLeft });
}

/** The room inside the border along one axis. */
type AxisRoom =
  /** Why the build cannot size the padding box along the axis, as {@link axisRoom} says. */
  | { readonly kind: "unmapped"; readonly reason: string }
  /** The padding box's least length along the axis, undefined where the build cannot tell it. */
  | { readonly kind: "room"; readonly length: number | undefined };

/** A side's padding as the box maps it, or `unread` where the box sets one the kit does not read. */
type Padding = NumberSpec | "unread";

/** One axis of a box: its sizing, its least length, and its borders and padding at each end. */
type Axis = {
  readonly size: SizeSpec;
  readonly least: NumberSpec | undefined;
  readonly borders: readonly [number, number];
  readonly padding: readonly [Padding, Padding];
};

/** A length in pixels: a literal, or a variable at its greatest value in any mode, if known. */
function most(length: NumberSpec, variables: VariableIndex): number | undefined {
  return length.kind === "literal" ? length.value : variables.maximum(length.variable);
}

/** A length in pixels: a literal, or a variable at its least value in any mode, if known. */
function least(length: NumberSpec, variables: VariableIndex): number | undefined {
  return length.kind === "literal" ? length.value : variables.minimum(length.variable);
}

/** The least and greatest of a length the variables resolve, each undefined where unknown. */
type Bounds = { readonly least: number | undefined; readonly most: number | undefined };

/** The sum of bounds, each end undefined where any term's is. */
function sumBounds(terms: readonly Bounds[], base: number): Bounds {
  const sum = (end: "least" | "most") =>
    terms.reduce<number | undefined>((total, term) => {
      const value = term[end];
      return total === undefined || value === undefined ? undefined : total + value;
    }, base);
  return { least: sum("least"), most: sum("most") };
}

/**
 * The room inside the border along an axis, in one measure of the variables: the bounds across all
 * modes, or one mode's values. Under `border-box` the padding and borders floor the used length in
 * each mode (CSS Box Sizing 3 §4.1), so a fixed length less than they take lays the box out at their
 * sum, which the frame's fixed length does not follow. The length fits only where its least value is
 * at least the greatest the padding and borders take. A box that hugs no layer in the flow takes
 * its padding and borders, or its `min-width` or `min-height` in the measure where that is more. Where the borders take that whole length at the least padding the padding box is empty, but
 * an instance resized larger paints inside the border, and a main with no layer has none to stretch
 * there, so the clip stays unmapped. A padding the box does not read, as `p-[1em]`, or a length or
 * padding of no known bounds, could floor the box past either length, so the clip stays unmapped
 * beside it. The build cannot tell the length of any other axis, which may still leave no room once
 * the box is placed.
 */
function axisRoom(box: BoxSpec, axis: Axis, variables: VariableIndex): AxisRoom {
  const [start, end] = axis.borders;
  const hugsNothing =
    axis.size.kind === "hug" &&
    box.grid === undefined &&
    box.aspectLock === undefined &&
    box.children.every(outOfLayout);
  const declared: Bounds | undefined =
    axis.size.kind === "fixed"
      ? { least: least(axis.size.length, variables), most: most(axis.size.length, variables) }
      : hugsNothing
        ? axis.least === undefined
          ? { least: 0, most: 0 }
          : { least: least(axis.least, variables), most: most(axis.least, variables) }
        : undefined;
  if (declared === undefined) {
    return { kind: "room", length: undefined };
  }
  const paddings: Bounds[] = [];
  for (const padding of axis.padding) {
    if (padding === "unread") {
      return { kind: "unmapped", reason: UNREAD_PADDING };
    }
    paddings.push({ least: least(padding, variables), most: most(padding, variables) });
  }
  const floor = sumBounds(paddings, start + end);
  if (declared.least === undefined || floor.least === undefined || floor.most === undefined) {
    return { kind: "unmapped", reason: FLOORED };
  }
  const room = Math.max(declared.least, floor.least) - start - end;
  if (room <= 0) {
    return { kind: "unmapped", reason: EMPTY };
  }
  return floor.most > declared.least && !hugsNothing
    ? { kind: "unmapped", reason: FLOORED }
    : { kind: "room", length: room };
}

/** The paddings on a box's two sides along an axis, each `unread` where the box sets one the kit does not read. */
function paddingsOf(
  reader: LayerStyle,
  box: BoxSpec,
  sides: readonly [PaddingSide, PaddingSide],
  variables: VariableIndex
): readonly [Padding, Padding] {
  const padding = (side: PaddingSide): Padding => {
    const property = `padding-${side}`;
    const read =
      !reader.has(property) || readNumber(reader.resolved(property) ?? "", variables) !== undefined;
    return read ? box[PADDING_FIELD[side]] : "unread";
  };
  return [padding(sides[0]), padding(sides[1])];
}

/** A side a box pads. */
type PaddingSide = keyof typeof PADDING_FIELD;

/** The box field each side's padding maps to. */
const PADDING_FIELD = {
  top: "paddingTop",
  right: "paddingRight",
  bottom: "paddingBottom",
  left: "paddingLeft",
} as const satisfies Record<StrokeSide, keyof BoxSpec>;

/**
 * Whether Figma draws every corner inside the border as CSS does along one axis. Figma caps a corner
 * at half the shorter side (probe P10, {@link cornerCap}), so at half each axis's length. One radius
 * inside four equal borders draws alike at any size: CSS scales an outer radius r on a box whose
 * shorter side is m to the least of r and m/2 (CSS Backgrounds 3 §5.5), so it draws min(r, m/2) - b
 * inside borders b wide, and Figma caps the written r - b at half the padding box's shorter side,
 * (m - 2b)/2, the same length. Otherwise the corner must fit as written. Where the build can tell the
 * padding box's length along the axis, that length bounds the corner. Where it cannot, the corner
 * keeps the room the outer corner had along the axis where the borders at the axis's ends take no
 * more than twice the border at the corner, since the inner corner is the outer one less that border.
 */
function cornersFitAlong(
  radius: CornerRadiusSpec,
  insets: PaddingBoxInsets,
  [start, end]: readonly [number, number],
  length: number | undefined,
  variables: VariableIndex
): boolean {
  const borders = [insets.top, insets.right, insets.bottom, insets.left];
  if (radius.kind !== "corners" && borders.every((border) => border === insets.top)) {
    return true;
  }
  const cap = length === undefined ? Number.POSITIVE_INFINITY : cornerCap(length, length);
  return CORNERS.every((corner) => {
    const drawn = most(radius.kind === "corners" ? radius[corner.key] : radius, variables);
    if (drawn === 0) {
      return true;
    }
    const keepsRoom = length !== undefined || start + end <= 2 * insets[corner.sides[0]];
    return keepsRoom && (cap === Number.POSITIVE_INFINITY || (drawn !== undefined && drawn <= cap));
  });
}

/**
 * Whether the padding box fits along an axis in every combination of modes, where the bounds across
 * all modes cannot tell: in each mode of one collection, as `fits` measures it, with every other
 * collection's variables at their bounds. A density mode sets a control's height and its padding
 * together, so each mode can hold its own padding where the least height is less than the greatest
 * padding. Each axis takes its own collection, as one sets a width and its side paddings and another
 * a height and its top and bottom ones.
 *
 * @param modes - Each mode view the build knows.
 * @param fits - Why the padding box does not fit in a measure of the variables, or undefined.
 */
function fitsEachModeOfOne(
  modes: readonly ModeView[],
  fits: (measure: VariableIndex) => string | undefined
): boolean {
  const collections = new Set(modes.map((mode) => mode.collection));
  return [...collections].some((collection) =>
    modes.every((mode) => mode.collection !== collection || fits(mode.variables) === undefined)
  );
}

/** What `box-paint.ts` and the box's corner read leave the padding box. */
export type PaddingBoxClip = {
  /** The border's width on each side. */
  readonly insets: PaddingBoxInsets;
  /** Whether the box maps every corner it sets, `unread` where it sets one it does not map. */
  readonly corners: "read" | "unread";
  /** Whether the frame's edges are the border box's, `refused` where a content box stays as it reads. */
  readonly edges: "border box" | "refused";
};

/** Move the box's fill feed to `into`, the layer's path. */
function moveFill(reader: LayerStyle, into: readonly string[]): void {
  const { path } = reader;
  reader.moveFeeds((feed) =>
    feed.field === "fill" &&
    feed.path.length === path.length &&
    path.every((key, index) => feed.path[index] === key)
      ? [{ path: into, field: "fill" }]
      : [feed]
  );
}

/**
 * Draw a box's fill inside its border, on a layer of its own, as the module doc says, and read the
 * box's `background-clip`. Where the layer cannot take the shape CSS gives the padding box, the clip
 * stays unmapped and the box keeps its fill.
 *
 * @param reader - The box's style.
 * @param box - The box as mapped, its corners read, after any content box moved inside it.
 * @param clip - The border's widths, and whether the box maps the corners it sets.
 * @param variables - The synced variables, which an inner corner binds, with their bounds across all
 *   modes.
 * @param modes - Each mode of the synced collections, with the variables as it resolves them.
 * @returns The box, its fill on its first layer, or on its last where it paints its first layer on
 *   top.
 */
export function drawPaddingBoxFill(
  reader: LayerStyle,
  box: BoxSpec,
  { insets, corners, edges }: PaddingBoxClip,
  variables: VariableIndex,
  modes: readonly ModeView[]
): BoxSpec {
  if (box.children.some((child) => child.key === PADDING_BOX_FILL)) {
    reader.mark("background-clip", "unmapped", OCCUPIED, []);
    return box;
  }
  if (edges === "refused") {
    reader.mark("background-clip", "unmapped", CONTENT_EDGES, []);
    return box;
  }
  if (corners === "unread") {
    reader.mark("background-clip", "unmapped", UNREAD_CORNER, []);
    return box;
  }
  const radius = innerRadius(box.cornerRadius, insets, variables);
  if (radius.kind === "unmapped") {
    reader.mark("background-clip", "unmapped", radius.reason, []);
    return box;
  }
  const axes: readonly Axis[] = [
    {
      size: box.sizing.horizontal,
      least: box.limits.minWidth,
      borders: [insets.left, insets.right],
      padding: paddingsOf(reader, box, ["left", "right"], variables),
    },
    {
      size: box.sizing.vertical,
      least: box.limits.minHeight,
      borders: [insets.top, insets.bottom],
      padding: paddingsOf(reader, box, ["top", "bottom"], variables),
    },
  ];
  const reason = axes
    .map((axis) => {
      const fits = (measure: VariableIndex): string | undefined => {
        const room = axisRoom(box, axis, measure);
        if (room.kind === "unmapped") {
          return room.reason;
        }
        return cornersFitAlong(radius.value, insets, axis.borders, room.length, measure) ? undefined : CAPPED;
      };
      const across = fits(variables);
      return across === undefined || fitsEachModeOfOne(modes, fits) ? undefined : across;
    })
    .find((unfit) => unfit !== undefined);
  if (reason !== undefined) {
    reader.mark("background-clip", "unmapped", reason, []);
    return box;
  }
  reader.read(
    "background-clip",
    (value) => value,
    () => ({ outcome: "literal", detail: DRAWN }),
    reader.feed("layers")
  );
  moveFill(reader, [...reader.path, PADDING_BOX_FILL]);
  const layer = edgeLayer({
    key: PADDING_BOX_FILL,
    insets,
    cornerRadius: radius.value,
    fill: box.fill,
    stroke: undefined,
  });
  const children = box.firstOnTop === true ? [...box.children, layer] : [layer, ...box.children];
  return { ...box, fill: undefined, children };
}
