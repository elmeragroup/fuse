/**
 * An instance part placed absolutely at its parent's end, and down either centred, as a Sidebar menu
 * badge's `absolute right-1 top-[calc(var(--row-h)/2-0.625rem)]` sits over the end of its row, or a
 * fixed distance below its top, as an overlay's corner close sits in its popup at `absolute top-4
 * right-4`.
 *
 * An absolute box with `right` set and `left` auto ends `right` from its containing block's padding
 * edge, and `top` puts its top that far below the padding edge (CSS 2.1 §10.3.7, §10.6.4). Figma's MAX
 * keeps an instance's end inset as the instance and its parent resize, and CENTER keeps its centre's
 * offset from the parent's centre through a height change or a density switch (N11). So the build reads
 * `right` as MAX's inset, and `top` as CENTER's offset only where the offset is one length in every
 * mode: the parent's height and the instance's are affine in the synced variables, and the offset
 * `border-top + top + height / 2 − parent height / 2` must leave no variable in it. A `top` that is
 * itself one length in every mode, beside a top border that is one too, keeps the instance's top that
 * far below the padding edge whatever the parent's height, which Figma's MIN keeps from the frame's top
 * edge, so the build reads `border-top + top` as MIN's inset before it tries the centre. A real file
 * kept MIN's inset and MAX's end inset through a density switch, also in a popup instance a composite
 * centres (W5-P14), but MAX keeps the end inset only for an instance whose main is auto layout: a plain
 * frame whose size changes by mode keeps its x instead (W5-P14b). Every box the kit builds is auto
 * layout, as `DirectionSpec` holds and `anchored-instances.test.ts` pins.
 */
import type { LayerStyle } from "./cascade";
import { affineLength, constantOf, normalizeCss, scaleAffine, sumAffine } from "./css-values";
import type { AffineLength } from "./css-values";
import type { AnchoredSpec } from "./kit-spec";

/** Why an absolute instance part stays unmapped, or its placement. */
type Anchoring =
  | { readonly kind: "anchored"; readonly at: AnchoredSpec }
  | { readonly kind: "unmapped"; readonly why: string };

/** The displays whose box positions its absolute descendants: every `position` but `static`. */
const POSITIONED: ReadonlySet<string> = new Set(["relative", "absolute", "fixed", "sticky"]);

const NOT_POSITIONED =
  "the absolute instance's containing block lies above its parent, which the set does not draw";
const NOT_AT_END = "the absolute instance sets no literal `right` with `left` auto, which MAX keeps";
const OFF_CENTRE =
  "the absolute instance's top keeps neither one length below its parent's top nor one offset from its parent's centre in every mode, which MIN or CENTER keeps";

/** The offsets of an absolute box. */
const OFFSETS = ["top", "right", "bottom", "left"] as const;

/** Whether a box sets an offset, one other than `auto`. */
const sets = (style: LayerStyle, property: string): boolean =>
  normalizeCss(style.resolved(property) ?? "auto") !== "auto";

/** A box's length on one side as an affine length, 0 where it sets none. */
const lengthOf = (style: LayerStyle, property: string): AffineLength | undefined =>
  affineLength(style.resolved(property) ?? "0px");

/** The top border's width: the side's own, else `border-width`'s, else none. */
function borderTop(style: LayerStyle): AffineLength | undefined {
  return lengthOf(style, style.has("border-top-width") ? "border-top-width" : "border-width");
}

/** The bottom border's width: the side's own, else `border-width`'s, else none. */
function borderBottom(style: LayerStyle): AffineLength | undefined {
  return lengthOf(style, style.has("border-bottom-width") ? "border-bottom-width" : "border-width");
}

/**
 * The height of a parent's border box where its one layer in flow sets it: the parent sets no height
 * or height limit, and the layer sets its own height and no margin down, so the parent is as tall as
 * the layer and its own padding and borders (CSS 2.1 §10.6.3).
 */
function parentHeight(
  parent: LayerStyle,
  flow: readonly LayerStyle[],
  layers: number
): AffineLength | undefined {
  const [only] = flow;
  const free = ["height", "min-height", "max-height"].every((property) =>
    ["auto", "none", "0px", "0"].includes(normalizeCss(parent.resolved(property) ?? "auto"))
  );
  if (only === undefined || flow.length !== 1 || layers !== 1 || !free) {
    return undefined;
  }
  const margins = ["margin-top", "margin-bottom"].map((property) => lengthOf(only, property));
  if (margins.some((margin) => margin?.constant !== 0 || margin.coefficients.size > 0)) {
    return undefined;
  }
  const parts = [
    lengthOf(parent, "padding-top"),
    lengthOf(parent, "padding-bottom"),
    borderTop(parent),
    borderBottom(parent),
    affineLength(only.resolved("height") ?? ""),
  ];
  return parts.every((part) => part !== undefined) ? sumAffine(parts) : undefined;
}

/**
 * The offset of the instance's centre from its parent's centre, where it is one length in every mode.
 *
 * @returns The offset in pixels, or undefined where a variable is left in it or a length is unread.
 */
function centreOffset(
  style: LayerStyle,
  parent: LayerStyle,
  flow: readonly LayerStyle[],
  layers: number
): number | undefined {
  const top = affineLength(style.resolved("top") ?? "");
  const height = affineLength(style.resolved("height") ?? "");
  const outer = parentHeight(parent, flow, layers);
  const border = borderTop(parent);
  if (
    top === undefined ||
    height === undefined ||
    outer === undefined ||
    border === undefined ||
    sets(style, "bottom")
  ) {
    return undefined;
  }
  return constantOf(sumAffine([border, top, scaleAffine(height, 0.5), scaleAffine(outer, -0.5)]));
}

/**
 * The distance from the parent's top edge down to the instance's top, where it is one length in every
 * mode: the parent's top border and the instance's `top`, with no `bottom` beside it.
 *
 * @returns The inset in pixels, or undefined where a variable is left in it or a length is unread.
 */
function topInset(style: LayerStyle, parent: LayerStyle): number | undefined {
  const top = affineLength(style.resolved("top") ?? "");
  const border = borderTop(parent);
  if (top === undefined || border === undefined || sets(style, "bottom")) {
    return undefined;
  }
  return constantOf(sumAffine([border, top]));
}

/** Where an absolute instance part sits, as the module comment says. */
function anchoring(
  style: LayerStyle,
  parent: LayerStyle,
  flow: readonly LayerStyle[],
  layers: number
): Anchoring {
  if (!POSITIONED.has(normalizeCss(parent.resolved("position") ?? "static"))) {
    return { kind: "unmapped", why: NOT_POSITIONED };
  }
  const right = affineLength(style.resolved("right") ?? "");
  if (sets(style, "left") || right === undefined || right.coefficients.size > 0) {
    return { kind: "unmapped", why: NOT_AT_END };
  }
  const inset = topInset(style, parent);
  if (inset !== undefined) {
    return {
      kind: "anchored",
      at: { constraints: { horizontal: "MAX", vertical: "MIN" }, endInset: right.constant, topInset: inset },
    };
  }
  const centerOffset = centreOffset(style, parent, flow, layers);
  return centerOffset === undefined
    ? { kind: "unmapped", why: OFF_CENTRE }
    : {
        kind: "anchored",
        at: {
          constraints: { horizontal: "MAX", vertical: "CENTER" },
          endInset: right.constant,
          centerOffset,
        },
      };
}

/**
 * Read where an absolute instance part sits: MAX across at its `right`, and MIN down at the inset its
 * `top` keeps below its parent's top or CENTER down at the offset it keeps from its parent's centre, as
 * the module comment says. Any other place leaves its
 * position and offsets unmapped, with the reason.
 *
 * @param style - The instance's style in place.
 * @param parent - The style of the box that holds it, its containing block where it is positioned.
 * @param flow - The styles of the parts in the parent's flow.
 * @param layers - How many layers sit in the parent's flow: its parts, icons and label.
 * @returns The placement, or undefined where it stays unmapped.
 */
export function readAnchored(
  style: LayerStyle,
  parent: LayerStyle,
  flow: readonly LayerStyle[],
  layers: number
): AnchoredSpec | undefined {
  const placed = anchoring(style, parent, flow, layers);
  const offsets = OFFSETS.filter((property) => sets(style, property));
  if (placed.kind === "unmapped") {
    for (const property of ["position", ...offsets]) {
      style.mark(property, "unmapped", placed.why, []);
    }
    return undefined;
  }
  const { at } = placed;
  const details = new Map([
    [
      "position",
      at.constraints.vertical === "CENTER"
        ? "an absolute instance at its parent's end and centred down it, MAX across and CENTER down (N11)"
        : "an absolute instance at its parent's end and top, MAX across and MIN down",
    ],
    [
      "right",
      `${at.endInset}px from its parent's end, which MAX keeps as the instance and its parent resize (N11)`,
    ],
    [
      "top",
      "centerOffset" in at
        ? `its centre ${at.centerOffset}px from its parent's centre in every mode, which CENTER keeps (N11)`
        : `${at.topInset}px below its parent's top edge in every mode, which MIN keeps as its parent resizes`,
    ],
  ]);
  for (const property of ["position", ...offsets]) {
    style.read(
      property,
      (value) => value,
      () => ({ outcome: "literal", detail: details.get(property) ?? "" }),
      style.feed("absolute")
    );
  }
  return at;
}
