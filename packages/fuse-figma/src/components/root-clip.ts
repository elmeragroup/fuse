import { normalizeCss } from "./css-values";
/**
 * Whether a variant's root clips its layers, the one place the build decides it.
 *
 * - Where its definition leaves its layers unclipped (`rootOverflow`), as an anchored composite's
 *   root around a popup's shadow, it does not clip.
 * - Elsewhere a root clips where its CSS clips, through `overflow`, `overflow-x` or `overflow-y`.
 * - Elsewhere a set's roots clip where some cell's root casts a shadow or clips in CSS, since Figma
 *   draws a drop shadow's spread only from a frame that clips, and a focus ring is a spread shadow.
 *   A root that clips costs nothing where every layer sits inside its padding.
 * - A variant whose root casts no shadow and does not clip in CSS needs no clip for its shadow, and
 *   one that holds a layer placed past its own edges, by those edges, as a line Tabs trigger's active
 *   underline 4px below it, or by its centre, as a Popover arrow 6px above its popup, would lose that
 *   layer to a clip where CSS paints it, since its `overflow` is visible. Such a root leaves its
 *   layers unclipped, beside a sibling that clips for its own shadow.
 * - A root that clips only for its shadow, and whose last layers hang past its edges by their centre,
 *   as a Popover arrow 6px above its popup, draws its box as a clipping frame inside an unclipped
 *   root that holds those layers after it ({@link wrapHanging}).
 */
import { fixedLength, NO_LIMITS, ZERO } from "./kit-spec";
import type {
  AxisPlacementSpec,
  ChildLayerSpec,
  ComponentRootSpec,
  FrameLayerSpec,
  ShadowSpec,
} from "./kit-spec";
import type { LayerStyle } from "./layer-style";

/** The `overflow` values that clip a box's content. */
const CSS_CLIPS: ReadonlySet<string> = new Set(["hidden", "clip", "auto", "scroll"]);

/**
 * Whether a box clips its content in CSS, through `overflow` or `overflow-y`, as Tailwind compiles
 * `overflow-hidden` to the shorthand. A `visible` axis beside one that clips computes to `auto` (CSS
 * Overflow 3 §3), so either one clipping clips both.
 *
 * @param style - The box's style.
 * @returns True where it clips.
 */
export function clipsInCss(style: LayerStyle): boolean {
  return ["overflow", "overflow-x", "overflow-y"].some((property) =>
    normalizeCss(style.resolved(property) ?? "")
      .split(" ")
      .some((value) => CSS_CLIPS.has(value))
  );
}

/** Whether a placement on one axis puts the layer past an edge of its parent. */
function pastEdge(axis: AxisPlacementSpec): boolean {
  switch (axis.kind) {
    case "start":
    case "scale":
      return axis.start < 0;
    case "end":
      return axis.end < 0;
    case "stretch":
      return axis.start < 0 || axis.end < 0;
    case "centre":
      return false;
  }
}

/**
 * Whether a root's layers include one past an edge of the root: placed by its edges past one, or by
 * its centre so that it reaches past the edge it hangs from ({@link reachesPast}).
 */
function placedPastEdges(children: readonly ChildLayerSpec[]): boolean {
  return children.some(
    (child) =>
      (child.kind === "frame" && reachesPast(child)) ||
      ((child.kind === "frame" || child.kind === "instance") &&
        child.placement?.kind === "edges" &&
        (pastEdge(child.placement.horizontal) || pastEdge(child.placement.vertical)))
  );
}

/**
 * Whether a variant's root clips its layers, as the module doc says.
 *
 * @param root - The root's style, its shadows and its layers in the cell.
 * @param set - Whether the definition leaves its roots' layers unclipped, and whether some cell's
 *   root of the set casts a shadow or clips in CSS.
 * @returns True where the root clips.
 */
export function rootClips(
  root: {
    readonly style: LayerStyle;
    readonly shadows: readonly ShadowSpec[];
    readonly children: readonly ChildLayerSpec[];
  },
  set: { readonly overflowVisible: boolean; readonly castsShadowOrClips: boolean }
): boolean {
  if (set.overflowVisible) {
    return false;
  }
  if (clipsInCss(root.style)) {
    return true;
  }
  return set.castsShadowOrClips && !(root.shadows.length === 0 && placedPastEdges(root.children));
}

/** Whether a frame placed by its centre reaches past the edge it hangs from, its turned box counted. */
function reachesPast(layer: FrameLayerSpec): boolean {
  const width = fixedLength(layer.sizing.horizontal);
  const height = fixedLength(layer.sizing.vertical);
  if (layer.placement?.kind !== "pivot" || width?.kind !== "literal" || height?.kind !== "literal") {
    return false;
  }
  const radians = ((layer.rotation ?? 0) * Math.PI) / 180;
  const [cos, sin] = [Math.abs(Math.cos(radians)), Math.abs(Math.sin(radians))];
  const { edge, inset } = layer.placement;
  // Half the turned box's extent across the edge, from its centre.
  const across =
    edge === "top" || edge === "bottom"
      ? (cos * height.value + sin * width.value) / 2
      : (cos * width.value + sin * height.value) / 2;
  return inset < across;
}

/**
 * Whether a frame placed by its centre reaches past the edge it hangs from and casts no shadow, so a
 * frame that clips around the others cuts no shadow of its own.
 */
function hangsPast(layer: FrameLayerSpec): boolean {
  return layer.shadows.length === 0 && reachesPast(layer);
}

/**
 * Draw a root that clips only for its shadow, and whose last layers hang past its edges by their
 * centre, as an unclipped root around a frame that draws the root's box, with those layers after
 * the frame. Figma draws a shadow's spread only from a frame that clips (PR2), and CSS paints a layer
 * past an `overflow: visible` box's edge, as a Popover arrow 6px above its popup. The frame keeps the
 * box's fill, stroke, corners, padding, layout, shadows, clip and every other layer. The hanging
 * layers come after it because CSS paints them over the box and its shadow (CSS 2.1 Appendix E), and
 * they cast no shadow, so the frame's clip cuts the shadows it cuts on the unwrapped root. The root
 * has no padding, so a layer placed by its centre sits where it sat against the box. It takes the
 * box's opacity, which CSS applies to the box and the layers as one group, and the box's width where
 * that is fixed, which the frame fills (FILL across a column takes the column's width, NH), so a
 * layer centred along the root stays centred on the box as an instance resizes. A real file kept the
 * frame's spreads and painted the arrow past the unclipped root, over the ring
 * (https://github.com/elmeragroup/fuse/issues/844#issuecomment-7061135720). That probe resized a
 * fixed frame under a hugging root. No real file has resized an instance of this shape yet (#922).
 *
 * @param root - The variant's root, as mapped.
 * @param clippedInCss - Whether the root's CSS clips it.
 * @param key - The key and name of the frame that draws the box.
 * @returns The wrapped root, or undefined where the root does not clip only for its shadow or no
 *   last layer hangs past its edges.
 */
export function wrapHanging(
  root: ComponentRootSpec,
  clippedInCss: boolean,
  key: string
): ComponentRootSpec | undefined {
  if (!root.clips || clippedInCss) {
    return undefined;
  }
  const hanging = (layer: ChildLayerSpec) => layer.kind === "frame" && hangsPast(layer);
  const first = root.children.findIndex(hanging);
  if (first === -1 || !root.children.slice(first).every(hanging)) {
    return undefined;
  }
  const { name, opacity, children, sizing, limits, ...box } = root;
  const fixedWidth = sizing.horizontal.kind === "fixed";
  const frame: FrameLayerSpec = {
    ...box,
    kind: "frame",
    key,
    name: key,
    sizing: fixedWidth ? { ...sizing, horizontal: { kind: "fill" } } : sizing,
    limits: fixedWidth ? { ...limits, minWidth: undefined, maxWidth: undefined } : limits,
    opacity: 1,
    children: children.slice(0, first),
  };
  return {
    name,
    direction: "VERTICAL",
    sizing: { horizontal: fixedWidth ? sizing.horizontal : { kind: "hug" }, vertical: { kind: "hug" } },
    limits: fixedWidth ? { ...NO_LIMITS, minWidth: limits.minWidth, maxWidth: limits.maxWidth } : NO_LIMITS,
    clips: false,
    paddingTop: ZERO,
    paddingRight: ZERO,
    paddingBottom: ZERO,
    paddingLeft: ZERO,
    itemSpacing: ZERO,
    primaryAlign: "MIN",
    counterAlign: "MIN",
    cornerRadius: ZERO,
    fill: undefined,
    stroke: undefined,
    shadows: [],
    opacity,
    children: [frame, ...children.slice(first)],
  };
}
