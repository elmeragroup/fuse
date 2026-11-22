import { isInfiniteLength, normalizeCss } from "./css-values";
/**
 * A frame part whose `box-sizing` is `content-box`, as Selection item's control slot sets
 * `box-content h-(--selection-first-line)` with 14px of padding above and below. Under `content-box`
 * a box's `width` and `height` set its content box, and its padding and border sit outside them
 * (CSS Box Sizing 3 §4.1), where a Figma frame's length holds its padding and stroke. So on an axis
 * where the frame takes a fixed length and pads or strokes, the kit draws two frames: the outer one
 * keeps the part's key, padding, stroke, corners and paint and hugs that axis, and an inner frame,
 * keyed `content`, takes the length and the layout of what the part holds. Where no axis pads or
 * strokes beside a fixed length, a limit or a percentage, both sizings draw alike, and the frame
 * draws as it reads. A frame that sets a limit or a percentage length on such an axis, where CSS
 * resolves it for the content box and the build read it for the border box, lays out as a grid,
 * holds a frame of a fixed length there, which a percentage of the content box may have set, holds
 * an absolute layer, which the build placed against the frame before its padding moved outside its
 * length, or rounds a corner by an infinite radius or a percentage, which the build resolved against
 * the content length, stays as it reads with its `box-sizing` unmapped, and so does one in an
 * instance part built in place, whose fields the diff reads from one frame.
 */
import { NO_LIMITS, outOfLayout, sideWeights, ZERO } from "./kit-spec";
import type { BoxSpec, ChildLayerSpec, FrameLayerSpec, LimitsSpec, SizeSpec, StrokeSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";

/** One axis of a frame, with the paddings, stroke sides and limits that sit along it. */
type Axis = {
  readonly axis: "horizontal" | "vertical";
  readonly paddings: readonly ("paddingTop" | "paddingBottom" | "paddingLeft" | "paddingRight")[];
  readonly sides: readonly ("top" | "bottom" | "left" | "right")[];
  readonly limits: readonly (keyof LimitsSpec)[];
};

const AXES: readonly Axis[] = [
  {
    axis: "horizontal",
    paddings: ["paddingLeft", "paddingRight"],
    sides: ["left", "right"],
    limits: ["minWidth", "maxWidth"],
  },
  {
    axis: "vertical",
    paddings: ["paddingTop", "paddingBottom"],
    sides: ["top", "bottom"],
    limits: ["minHeight", "maxHeight"],
  },
];

/** How the coverage table names a content box the kit draws as an inner frame. */
const INNER_FRAME =
  "the length sets the content box, so an inner frame takes it inside the frame's padding and border";

/** How the coverage table names a content box no padding or border moves. */
const SAME_BOX = "no padding or border sits outside the frame's length, so both sizings draw alike";

/** Whether a stroke sits on a side, taking room inside the frame. */
function strokes(stroke: StrokeSpec | undefined, side: "top" | "bottom" | "left" | "right"): boolean {
  // An outline's stroke, or a collapsed table border's, `inLayout` false, takes no room.
  if (stroke === undefined || "inLayout" in stroke) {
    return false;
  }
  const weight = sideWeights(stroke)[side];
  return weight.kind === "variable" || weight.value > 0;
}

/** The radius longhands and shorthand a box rounds its corners by. */
const RADII = [
  "border-radius",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
  "border-start-start-radius",
  "border-start-end-radius",
  "border-end-end-radius",
  "border-end-start-radius",
] as const;

/**
 * Whether a box sets its length on an axis, or a limit there, as a percentage, which `content-box`
 * resolves against its container for the content box, where the build reads a fill or a share of the
 * border box.
 */
function percent(style: LayerStyle, { axis }: Axis): boolean {
  const properties =
    axis === "horizontal" ? ["width", "min-width", "max-width"] : ["height", "min-height", "max-height"];
  return properties.some((property) => normalizeCss(style.resolved(property) ?? "").includes("%"));
}

/**
 * Whether a radius takes its length from the box's size, an infinite one or a percentage, which the
 * corner reader resolved against the content length before the padding moved outside it.
 */
function sizedRadius(style: LayerStyle): boolean {
  return RADII.some((property) => {
    const value = normalizeCss(style.resolved(property) ?? "");
    return value.includes("%") || isInfiniteLength(value);
  });
}

/** Whether a padding is more than zero, or bound. */
function pads(box: BoxSpec, padding: Axis["paddings"][number]): boolean {
  const length = box[padding];
  return length.kind === "variable" || length.value > 0;
}

/**
 * Whether a layer's length on an axis follows the inner frame as CSS's follows the content box: an
 * icon's, an instance's or a text's own, and a frame's that hugs or fills. A frame of a fixed length
 * may take it as a percentage of the box, which the build resolves inside the box's padding, where a
 * content box leaves its padding outside.
 */
function ownLength(child: ChildLayerSpec, axis: Axis["axis"]): boolean {
  if (child.kind === "icon" || child.kind === "instance" || child.kind === "text") {
    return child.kind === "icon" || child.sizing[axis].kind !== "fill";
  }
  return child.sizing[axis].kind !== "fixed";
}

/**
 * A part's frame as {@link readContentBox} draws it, and whether its edges are the CSS border box's,
 * `refused` where a content box stays as it reads, so the frame's length is the content box's.
 */
export type ContentBoxRead = { readonly box: BoxSpec; readonly edges: "border box" | "refused" };

/**
 * A frame part as `content-box` draws it, and its `box-sizing` read as it draws.
 *
 * @param style - The part's style.
 * @param box - The part's box as mapped.
 * @param inPlace - Whether the part sits in an instance part built in place.
 * @returns The box, around an inner frame where its content box takes its length, and whether the
 *   frame's edges are the border box's.
 */
export function readContentBox(style: LayerStyle, box: BoxSpec, inPlace: boolean): ContentBoxRead {
  if (normalizeCss(style.resolved("box-sizing") ?? "") !== "content-box") {
    return { box, edges: "border box" };
  }
  // The axes where padding or border sits outside the length, a limit or a percentage the box sets.
  const framed = AXES.filter(
    ({ paddings, sides }) =>
      paddings.some((padding) => pads(box, padding)) || sides.some((side) => strokes(box.stroke, side))
  );
  const limited = ({ limits }: Axis) => limits.some((limit) => box.limits[limit] !== undefined);
  const matters = framed.filter(
    (axis) => box.sizing[axis.axis].kind === "fixed" || limited(axis) || percent(style, axis)
  );
  if (matters.length === 0) {
    style.read(
      "box-sizing",
      (value) => value,
      () => ({ outcome: "dropped", detail: SAME_BOX }),
      []
    );
    return { box, edges: "border box" };
  }
  const flow = box.children.filter((child) => !outOfLayout(child));
  const refused =
    inPlace ||
    box.grid !== undefined ||
    flow.length !== box.children.length ||
    sizedRadius(style) ||
    matters.some(
      (axis) =>
        limited(axis) ||
        percent(style, axis) ||
        box.sizing[axis.axis].kind !== "fixed" ||
        !flow.every((child) => ownLength(child, axis.axis))
    );
  if (refused) {
    return { box, edges: "refused" };
  }
  const moved = matters;
  style.read(
    "box-sizing",
    (value) => value,
    () => ({ outcome: "literal", detail: INNER_FRAME }),
    [...style.feed("sizing"), ...style.feed("layers")]
  );
  const movedAxes = new Set(moved.map(({ axis }) => axis));
  // The inner frame fills an axis the outer frame sets the length of, and hugs one it hugs.
  const innerSize = (axis: Axis["axis"]): SizeSpec =>
    movedAxes.has(axis)
      ? box.sizing[axis]
      : box.sizing[axis].kind === "hug"
        ? { kind: "hug" }
        : { kind: "fill" };
  const inner: FrameLayerSpec = {
    kind: "frame",
    key: "content",
    name: "content",
    direction: box.direction,
    sizing: { horizontal: innerSize("horizontal"), vertical: innerSize("vertical") },
    limits: NO_LIMITS,
    clips: false,
    paddingTop: ZERO,
    paddingRight: ZERO,
    paddingBottom: ZERO,
    paddingLeft: ZERO,
    itemSpacing: box.itemSpacing,
    primaryAlign: box.primaryAlign,
    counterAlign: box.counterAlign,
    cornerRadius: ZERO,
    fill: undefined,
    stroke: undefined,
    shadows: [],
    opacity: 1,
    children: flow,
  };
  const ordered: FrameLayerSpec = box.firstOnTop === true ? { ...inner, firstOnTop: true } : inner;
  const outerSize = (axis: Axis["axis"]): SizeSpec =>
    movedAxes.has(axis) ? { kind: "hug" } : box.sizing[axis];
  return {
    box: {
      ...box,
      direction: "HORIZONTAL",
      sizing: { horizontal: outerSize("horizontal"), vertical: outerSize("vertical") },
      itemSpacing: ZERO,
      primaryAlign: "MIN",
      counterAlign: "MIN",
      children: [ordered, ...box.children.filter((child) => outOfLayout(child))],
    },
    edges: "border box",
  };
}
