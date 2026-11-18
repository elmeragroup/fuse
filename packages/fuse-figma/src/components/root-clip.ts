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
 *   one that holds a layer placed past its own edges, as a line Tabs trigger's active underline 4px
 *   below it, would lose that layer to a clip where CSS paints it, since its `overflow` is visible.
 *   Such a root leaves its layers unclipped.
 */
import type { AxisPlacementSpec, ChildLayerSpec, ShadowSpec } from "./kit-spec";
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

/** Whether a root's layers include one placed by its edges past an edge of the root. */
function placedPastEdges(children: readonly ChildLayerSpec[]): boolean {
  return children.some(
    (child) =>
      (child.kind === "frame" || child.kind === "instance") &&
      child.placement?.kind === "edges" &&
      (pastEdge(child.placement.horizontal) || pastEdge(child.placement.vertical))
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
