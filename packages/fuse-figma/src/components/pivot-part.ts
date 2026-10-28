/**
 * An absolute part placed by its centre, as a Tooltip's arrow hangs from its popup's bottom edge, which
 * `placeParts` in `placement.ts` asks for before its other readers. The recognition and the coverage
 * rows it writes live together in `readPivot`.
 */
import type { CoverageNote, LayerStyle } from "./cascade";
import { evaluateLength, evaluateLengthOf, normalizeCss, splitTopLevel } from "./css-values";
import { fixedLength } from "./kit-spec";
import type { FrameLayerSpec, PivotSpec } from "./kit-spec";
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
 * Read an absolute part that hangs from its containing block's bottom edge, centred across it, as a
 * Tooltip's arrow does: `left` half the containing block's width plus a length, `bottom` a length, a
 * translate that moves it down only, and a fixed literal size, with no `top`, `right` or margin. CSS
 * offsets the part's box from its containing block's padding box (CSS 2.1 §10.3.7, §10.6.4), then
 * `translate` moves it, a percentage taking the part's own size, and `rotate` turns it about its centre,
 * which stays where it was (CSS Transforms 2 §6). So its centre sits a fixed distance from the
 * containing block's horizontal centre and from its bottom edge whatever the containing block's size,
 * which CENTER across and MAX down keep, and the plugin places the part from that centre. The parent
 * must be the containing block: positioned itself, or static inside the positioned element its
 * definition names in `positionedBy`, with the box's border box, and it sets no border on any side, so its padding
 * box is the frame Figma places the layer in. A real file drew such a part at -45 centred at
 * (W/2, H - 2) from the plugin's centre, and kept it there through density and text-driven resizes,
 * in the main and in an instance (W5-P11, W5-P11b). Every other part leaves its place to the other
 * readers.
 *
 * @param style - The part's style.
 * @param layer - The part, mapped.
 * @param parent - The box that holds it.
 * @returns The part's centre, or undefined where the pattern does not hold.
 */
export function readPivot(
  style: LayerStyle,
  layer: FrameLayerSpec,
  parent: ParentBox
): PivotSpec | undefined {
  const width = fixedLength(layer.sizing.horizontal);
  const height = fixedLength(layer.sizing.vertical);
  const left = style.resolved("left") ?? "";
  const bottom = evaluateLength(style.resolved("bottom") ?? "");
  const [moveX = "0px", moveY = "0px"] = splitTopLevel(
    normalizeCss(style.resolved("translate") ?? "0px"),
    " "
  ).filter((part) => part !== "none");
  const contains =
    !["", "static"].includes(normalizeCss(parent.style.resolved("position") ?? "")) ||
    parent.positionedBy !== undefined;
  if (
    normalizeCss(style.resolved("position") ?? "") !== "absolute" ||
    !contains ||
    BORDER_WIDTHS.some(
      (property) => parent.style.has(property) && evaluateLength(parent.style.resolved(property) ?? "") !== 0
    ) ||
    style.has("top") ||
    style.has("right") ||
    MARGINS.some((property) => style.has(property) && evaluateLength(style.resolved(property) ?? "") !== 0) ||
    width?.kind !== "literal" ||
    height?.kind !== "literal" ||
    bottom === undefined
  ) {
    return undefined;
  }
  // `left` is a share of the containing block's width plus a length: the share must be a half.
  const start = evaluateLengthOf(left, 0);
  const share = evaluateLengthOf(left, 100);
  const across = evaluateLengthOf(moveX, width.value);
  const down = evaluateLengthOf(moveY, height.value);
  if (
    start === undefined ||
    share === undefined ||
    share - start !== 50 ||
    across !== 0 ||
    down === undefined
  ) {
    return undefined;
  }
  const centerOffset = start + width.value / 2;
  const bottomInset = bottom + height.value / 2 - down;
  const note: CoverageNote = {
    outcome: "literal",
    detail: `the layer's centre sits ${centerOffset}px from its containing block's horizontal centre and ${bottomInset}px above its bottom edge, where the plugin places it by its centre, and CENTER across and MAX down keep it there`,
  };
  for (const property of ["position", "left", "bottom", "translate"]) {
    style.read(
      property,
      () => note,
      (decided) => decided,
      style.feed("pivot")
    );
  }
  return { constraints: { horizontal: "CENTER", vertical: "MAX" }, centerOffset, bottomInset };
}
