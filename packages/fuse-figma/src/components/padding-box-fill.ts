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
 * an instance at another size resizes it with no override.
 *
 * The clip stays unmapped, and the fill stays on the box, in these cases:
 *
 * - A corner's two borders differ in width and the corner is round. CSS draws an elliptical inner
 *   corner there, which a Figma corner radius cannot hold.
 * - The box sets a corner it does not map, or no synced variable holds a bound corner's inner corner.
 * - A content box stays as it reads, so the frame's edges are not the border box's.
 * - The padding and borders lay the box out larger than the literal length its frame takes, as
 *   `size-[4px] p-[2px] border-2` lays out 8px (CSS Box Sizing 3 §4.1).
 * - The box sets a padding the kit does not read, as `p-[1em]`, where the box's length is one the
 *   build can tell. At a 16px font `size-[4px] p-[1em] border-2` lays out 36px, with a 32px padding
 *   box, so an unread padding could leave room inside the border.
 * - The borders take an axis's whole used length, so the padding box is empty. The build tells that
 *   for a literal length, and for a box that hugs no layer in the flow, as an empty `inline-flex`
 *   with 1px borders hugs 2px across. Nothing paints inside the border there, but an instance
 *   resized larger does paint inside it: a 4px wide main with 2px borders, resized to 40px, paints
 *   36px. The layer would have to be in the main for the instance to stretch it, and Figma cannot
 *   draw a frame of negative length, so the fill stays on the box and paints under the border.
 * - Figma would cap the corner inside the border at half the padding box's shorter side.
 *
 * A box that fills its parent or takes its placement's length could still be empty once placed, and
 * draws the layer.
 */
import { innerCornerSyntax } from "../border-inner-corner";
import { cornerCap } from "./box-corners";
import type { PaddingBoxInsets } from "./box-paint";
import type { CornerRadiusSpec, CornersSpec } from "./corner-spec";
import { readNumber } from "./css-values";
import type { VariableIndex } from "./css-values";
import { NO_LIMITS, outOfLayout, ZERO } from "./kit-spec";
import type { BoxSpec, FrameLayerSpec, NumberSpec, SizeSpec, StrokeSide } from "./kit-spec";
import type { LayerStyle } from "./layer-style";

/** The key and name of the layer that holds a box's fill inside its border. */
export const PADDING_BOX_FILL = "padding box";

/** The coverage note of a clip the layer draws. */
const DRAWN =
  "the fill draws on the `padding box` layer, inset by the border under the stroke, so the border shows what lies behind the box";

/** Why a clip stays unmapped where the layer cannot round as CSS does. */
const ELLIPTICAL =
  "a round corner between borders of two widths has an elliptical inner corner (CSS Backgrounds 3 §5.2), which no Figma corner radius holds";

/** Why a clip stays unmapped where the box sets a corner it does not map. */
const UNREAD_CORNER =
  "the box sets a corner it does not map, so the kit cannot round the corner inside the border";

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

/** The length a `stretch` placement leaves the layer, as `SizeSpec` says. */
const PLACED: SizeSpec = { kind: "placed" };

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
  /** The padding box's length along the axis, undefined where the build cannot tell it. */
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

/**
 * The room inside the border along an axis. Under `border-box` the padding and borders floor the
 * used length (CSS Box Sizing 3 §4.1), so a literal length less than they take lays the box out at
 * their sum, which the frame's fixed length does not follow. A box that hugs no layer in the flow,
 * at a literal least length or none, takes its padding and borders, or its least length where that
 * is more. Where the borders take that whole length the padding box is empty, but an instance
 * resized larger paints inside the border, and a main with no layer has none to stretch there, so
 * the clip stays unmapped. A padding the box does not read, as `p-[1em]`, or a bound one of no known
 * greatest value, could floor the box past either length, so the clip stays unmapped beside it. The
 * build cannot tell the length of any other axis, which may still leave no room once the box is
 * placed.
 */
function axisRoom(box: BoxSpec, axis: Axis, variables: VariableIndex): AxisRoom {
  const [start, end] = axis.borders;
  const padding = axis.padding.map((length) => (length === "unread" ? undefined : most(length, variables)));
  const floor = padding.some((length) => length === undefined)
    ? undefined
    : padding.reduce<number>((sum, length) => sum + (length ?? 0), start + end);
  const hugsNothing =
    axis.size.kind === "hug" &&
    box.grid === undefined &&
    box.aspectLock === undefined &&
    box.children.every(outOfLayout);
  const declared =
    axis.size.kind === "fixed" && axis.size.length.kind === "literal"
      ? axis.size.length.value
      : hugsNothing && (axis.least === undefined || axis.least.kind === "literal")
        ? (axis.least?.value ?? 0)
        : undefined;
  if (declared === undefined) {
    return { kind: "room", length: undefined };
  }
  if (axis.padding.includes("unread")) {
    return { kind: "unmapped", reason: UNREAD_PADDING };
  }
  if (floor === undefined) {
    return { kind: "unmapped", reason: FLOORED };
  }
  const used = Math.max(declared, floor);
  if (used - start - end <= 0) {
    return { kind: "unmapped", reason: EMPTY };
  }
  return floor > declared && !hugsNothing
    ? { kind: "unmapped", reason: FLOORED }
    : { kind: "room", length: used - start - end };
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
 * Whether Figma draws every corner inside the border as written, which it caps at half the shorter
 * side (probe P10, {@link cornerCap}). Along an axis whose length the build can tell, the padding
 * box's length there bounds the corner. Along any other axis the corner keeps the room the outer
 * corner had where the borders at that axis's ends take no more than twice the border at the
 * corner, since the inner corner is the outer one less that border.
 */
function cornersFit(
  radius: CornerRadiusSpec,
  insets: PaddingBoxInsets,
  [width, height]: readonly [number | undefined, number | undefined],
  variables: VariableIndex
): boolean {
  const cap = cornerCap(width ?? Number.POSITIVE_INFINITY, height ?? Number.POSITIVE_INFINITY);
  return CORNERS.every((corner) => {
    const length = radius.kind === "corners" ? radius[corner.key] : radius;
    const drawn = most(length, variables);
    if (drawn === 0) {
      return true;
    }
    const border = insets[corner.sides[0]];
    const keepsRoom =
      (width !== undefined || insets.left + insets.right <= 2 * border) &&
      (height !== undefined || insets.top + insets.bottom <= 2 * border);
    return keepsRoom && (cap === Number.POSITIVE_INFINITY || (drawn !== undefined && drawn <= cap));
  });
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
 * @param variables - The synced variables, which an inner corner binds.
 * @returns The box, its fill on its first layer, or on its last where it paints its first layer on
 *   top.
 */
export function drawPaddingBoxFill(
  reader: LayerStyle,
  box: BoxSpec,
  { insets, corners, edges }: PaddingBoxClip,
  variables: VariableIndex
): BoxSpec {
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
  const rooms = [
    axisRoom(
      box,
      {
        size: box.sizing.horizontal,
        least: box.limits.minWidth,
        borders: [insets.left, insets.right],
        padding: paddingsOf(reader, box, ["left", "right"], variables),
      },
      variables
    ),
    axisRoom(
      box,
      {
        size: box.sizing.vertical,
        least: box.limits.minHeight,
        borders: [insets.top, insets.bottom],
        padding: paddingsOf(reader, box, ["top", "bottom"], variables),
      },
      variables
    ),
  ] as const;
  const unread = rooms.find((room) => room.kind === "unmapped");
  if (unread !== undefined) {
    reader.mark("background-clip", "unmapped", unread.reason, []);
    return box;
  }
  const lengths = rooms.map((room) => (room.kind === "room" ? room.length : undefined));
  if (!cornersFit(radius.value, insets, [lengths[0], lengths[1]], variables)) {
    reader.mark("background-clip", "unmapped", CAPPED, []);
    return box;
  }
  reader.read(
    "background-clip",
    (value) => value,
    () => ({ outcome: "literal", detail: DRAWN }),
    reader.feed("layers")
  );
  moveFill(reader, [...reader.path, PADDING_BOX_FILL]);
  const layer: FrameLayerSpec = {
    kind: "frame",
    key: PADDING_BOX_FILL,
    name: PADDING_BOX_FILL,
    placement: {
      kind: "edges",
      within: "parent",
      horizontal: { kind: "stretch", start: insets.left, end: insets.right },
      vertical: { kind: "stretch", start: insets.top, end: insets.bottom },
    },
    direction: "HORIZONTAL",
    // The layer's constraints stretch it with the box, an instance's resized box included.
    sizing: { horizontal: PLACED, vertical: PLACED },
    limits: NO_LIMITS,
    clips: false,
    paddingTop: ZERO,
    paddingRight: ZERO,
    paddingBottom: ZERO,
    paddingLeft: ZERO,
    itemSpacing: ZERO,
    primaryAlign: "MIN",
    counterAlign: "MIN",
    cornerRadius: radius.value,
    fill: box.fill,
    stroke: undefined,
    shadows: [],
    opacity: 1,
    children: [],
  };
  const children = box.firstOnTop === true ? [...box.children, layer] : [layer, ...box.children];
  return { ...box, fill: undefined, children };
}
