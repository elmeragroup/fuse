/**
 * An absolute part placed by its centre, as a Tooltip's arrow hangs from its popup's edge,
 * which `placeParts` in `placement.ts` asks for before its other readers. The recognition and the
 * coverage rows it writes live together in `readPivot`.
 */
import { evaluateLength, evaluateLengthOf, normalizeCss, shareLength, splitTopLevel } from "./css-values";
import { fixedLength, PIVOT_EDGES } from "./kit-spec";
import type { FrameLayerSpec, PivotEdge, PivotSpec } from "./kit-spec";
import type { CoverageNote, LayerStyle } from "./layer-style";
import { MARGINS } from "./margin-box";
import type { ParentBox } from "./placement";

/**
 * Every property that sets a width on one or more of a box's border sides, physical and logical, so
 * that a border on any side keeps the pivot from reading the padding box as the frame's edge.
 */
const BORDER_WIDTHS = [
  "border-width",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-inline-width",
  "border-block-width",
  "border-inline-start-width",
  "border-inline-end-width",
  "border-block-start-width",
  "border-block-end-width",
];

/**
 * The CSS that places a part on one axis: its two inset properties, start first, its size there and
 * the component of its translate along it. Each inset property names the edge it measures from.
 */
type AxisInsets = {
  readonly start: "left" | "top";
  readonly end: "right" | "bottom";
  readonly size: number;
  readonly move: string;
};

/**
 * Where one axis puts the part's centre: a fixed distance from the containing block's centre along
 * it, a fixed distance inside one of its edges, or no fixed place, for the reason given.
 */
type AxisRole =
  | { readonly role: "along"; readonly property: string; readonly offset: number }
  | { readonly role: "across"; readonly edge: PivotEdge; readonly inset: number }
  | { readonly role: "refused"; readonly why: string };

/** How far a start inset's share may sit from a half and still read as one. */
const HALF_TOLERANCE = 1e-9;

/**
 * Read where one axis puts the part's centre. The part sets one of the axis's two insets. A start
 * inset of half the containing block's length plus a length puts the centre a fixed distance from
 * the block's centre along the axis. A length alone on either side puts the centre a fixed distance
 * inside the edge that inset names. The translate moves the centre in either case, a percentage
 * taking the part's own size there. A start inset that reads the block's length any other way, such
 * as `min(50%, 60px)`, which is half the length up to 120px and 60px past it, moves the centre
 * against the block's centre as the block resizes, so the axis has no fixed place. The reader takes
 * the block's length only in the start inset, so an end inset that reads it gives no place either.
 */
function readAxis(style: LayerStyle, insets: AxisInsets): AxisRole | undefined {
  const { start, end, size } = insets;
  const move = evaluateLengthOf(insets.move, size);
  if (style.has(start) === style.has(end) || move === undefined) {
    return undefined;
  }
  const edge = style.has(start) ? start : end;
  const value = style.resolved(edge) ?? "";
  const length = evaluateLength(value);
  if (length !== undefined) {
    // An end inset measures from the far edge, so the translate moves the centre toward it.
    const inset = length + size / 2 + (edge === start ? move : -move);
    return { role: "across", edge, inset };
  }
  if (edge === end) {
    return !value.includes("%")
      ? undefined
      : {
          role: "refused",
          why: `\`${edge}: ${value}\` reads the containing block's length, which the reader takes only in a start inset, \`${start}\`, so set the equivalent \`${start}\` instead`,
        };
  }
  const share = shareLength(value);
  // `shareLength` scales and sums percentages in binary floating point, which reads
  // `calc(85% - 35% - 5px)` as 0.49999999999999994 of the length and `calc(255% - 205% - 5px)` as
  // 0.5000000000000004, so a half is any share within 1e-9 of 0.5, far below any share a stylesheet
  // writes on purpose. A `min()` or `max()` over a percentage reads as no share at all.
  if (share !== undefined && Math.abs(share.share - 0.5) <= HALF_TOLERANCE) {
    return { role: "along", property: edge, offset: share.constant + size / 2 + move };
  }
  return !value.includes("%")
    ? undefined
    : {
        role: "refused",
        why: `\`${edge}: ${value}\` is no half of the containing block's length plus a constant, so the turned part's centre moves against the block's centre as the block resizes, and no constraint keeps it`,
      };
}

/** The pivot an absolute part reads, or why a turned one has none. */
export type PivotRead =
  | { readonly kind: "pivot"; readonly spec: PivotSpec }
  | { readonly kind: "refused"; readonly why: string };

/**
 * Read an absolute part that hangs from one edge of its containing block, centred along it, as
 * a Tooltip's arrow does from the popup's edge that faces its trigger: on one axis a start inset of
 * half the containing block's length plus a length, on the other one inset of a length, a translate
 * of lengths or shares of the part's own size, a fixed literal size and no margin. CSS offsets the
 * part's box from its containing block's padding box (CSS 2.1 §10.3.7, §10.6.4), then `translate`
 * moves it, a percentage taking the part's own size, and `rotate` turns it about its centre, which
 * stays where it was (CSS Transforms 2 §6). So its centre sits a fixed distance from the containing
 * block's centre along the edge and a fixed distance inside the edge whatever the block's size, which
 * the constraints {@link PIVOT_EDGES} names keep, and the plugin places the part from that centre.
 * An unturned part reads here too, since `absolute-placement.ts` refuses a translate and an offset
 * that takes a share of the block's length. A turned part has no other reader, since the plugin
 * places an absolute layer by an `x` and `y` that a turn moves. The
 * parent must be the containing block: positioned itself, or static inside the positioned
 * element its definition names in `positionedBy`, with the box's border box, and it sets no border on
 * any side, so its padding box is the frame Figma places the layer in. On 2026-10-27 a real file drew
 * such a part hanging from the bottom edge at -45 centred at (W/2, H - 2) from the plugin's centre,
 * and kept it there through density and text-driven resizes, in the main and in an instance (W5-P11,
 * W5-P11b). On 2026-11-20 a real file held the inset on all four edges through every resize (PG17).
 * Every other part leaves its place to the other readers, except a turned one whose start inset
 * reads the containing block's length other than as a half plus a constant, or whose end inset reads
 * it at all. That part has no place, for the reason the read gives, and `placeParts` fails the build
 * with it.
 *
 * @param style - The part's style.
 * @param layer - The part, mapped: its turn and its sizing.
 * @param parent - The box that holds it: its style and the positioned element around it, if any.
 * @returns The part's centre, why it has none, or undefined where the pattern does not hold.
 */
export function readPivot(
  style: LayerStyle,
  layer: Pick<FrameLayerSpec, "rotation" | "sizing">,
  parent: Pick<ParentBox, "style" | "positionedBy">
): PivotRead | undefined {
  const width = fixedLength(layer.sizing.horizontal);
  const height = fixedLength(layer.sizing.vertical);
  const translate = normalizeCss(style.resolved("translate") ?? "none");
  const [moveX = "0px", moveY = "0px"] = splitTopLevel(translate, " ").filter((part) => part !== "none");
  const turned = layer.rotation !== undefined && layer.rotation !== 0;
  const contains =
    !["", "static"].includes(normalizeCss(parent.style.resolved("position") ?? "")) ||
    parent.positionedBy !== undefined;
  if (
    normalizeCss(style.resolved("position") ?? "") !== "absolute" ||
    !contains ||
    BORDER_WIDTHS.some(
      (property) => parent.style.has(property) && evaluateLength(parent.style.resolved(property) ?? "") !== 0
    ) ||
    MARGINS.some((property) => style.has(property) && evaluateLength(style.resolved(property) ?? "") !== 0) ||
    width?.kind !== "literal" ||
    height?.kind !== "literal"
  ) {
    return undefined;
  }
  const axes = [
    readAxis(style, { start: "left", end: "right", size: width.value, move: moveX }),
    readAxis(style, { start: "top", end: "bottom", size: height.value, move: moveY }),
  ];
  const refused = axes.find((axis) => axis?.role === "refused");
  if (refused?.role === "refused") {
    return turned ? { kind: "refused", why: refused.why } : undefined;
  }
  const along = axes.find((axis) => axis?.role === "along");
  const across = axes.find((axis) => axis?.role === "across");
  if (along?.role !== "along" || across?.role !== "across") {
    return undefined;
  }
  const { edge, inset } = across;
  const alongAxis = PIVOT_EDGES[edge].along === "horizontal" ? "horizontal centre" : "vertical centre";
  const { constraints } = PIVOT_EDGES[edge];
  const note: CoverageNote = {
    outcome: "literal",
    detail: `the layer's centre sits ${along.offset}px from its containing block's ${alongAxis} and ${inset}px inside its ${edge} edge, where the plugin places it by its centre, and ${constraints.horizontal} across and ${constraints.vertical} down keep it there`,
  };
  for (const property of ["position", along.property, edge, "translate"]) {
    style.read(
      property,
      () => note,
      (decided) => decided,
      style.feed("placement")
    );
  }
  return { kind: "pivot", spec: { kind: "pivot", edge, along: along.offset, inset } };
}
