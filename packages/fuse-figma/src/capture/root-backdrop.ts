/**
 * The background a root shows from the elements around it, where the root paints none: the
 * innermost element exactly behind it whose background paints, where one opaque rectangle across
 * the root draws it, and unmapped rows where it does not. `capture-cell-cascade.ts` reads it for
 * each cell's root.
 */

import { evaluateLength, evaluatePercentage, normalizeCss, readColor } from "../components/css-values.ts";
import type { VariableIndex } from "../components/css-values.ts";
import { LayerStyle } from "../components/layer-style.ts";
import type { CellLedger, Layer } from "../components/layer-style.ts";
import type { CapturedElement } from "./capture-format.ts";

/** Why a background around the root stays unmapped, where the root cannot draw it as one fill. */
const STACKED_BACKDROP =
  "the background shows behind the root through or over another paint, which one fill on the root cannot draw";

/** Why a background around the root stays unmapped, where the root or an element it shows through alters how it paints. */
const ALTERED_BACKDROP =
  "the root or an element between it and the background changes how it paints, by its opacity, corners, filter, backdrop filter, mask, clip or blend mode, which one opaque rectangular fill on the root cannot draw";

/**
 * A box's corner radii: the shorthand, which the cascade keeps whole, and each corner's physical and
 * logical longhand, as `rounded-s-full` sets `border-start-start-radius`. The capture already
 * counts no element behind a root past one Chromium rounds, so a capture never reaches this check
 * with a rounded element. The logical names keep the check from depending on that.
 */
const CORNER_RADII = [
  "border-radius",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
  "border-start-start-radius",
  "border-start-end-radius",
  "border-end-start-radius",
  "border-end-end-radius",
] as const;

/**
 * Whether an element changes how its background, and what shows through it, paints, beyond one
 * opaque rectangle across its box: an opacity below 1 (CSS Color 4 §15.1), a rounded corner (CSS
 * Backgrounds 3 §5), a filter (Filter Effects 1 §5), a backdrop filter, which filters what shows
 * through the element but not its own background (Filter Effects 2 §3), a mask or a clip path (CSS
 * Masking 1 §6, §7), or a blend mode other than `normal` (Compositing 1 §3.2). A value the build does
 * not read counts as a change.
 */
function altersPaint(style: LayerStyle): boolean {
  const value = (property: string, initial: string): string =>
    normalizeCss(style.resolved(property) ?? initial).toLowerCase();
  const opacity = value("opacity", "1");
  const opaque = evaluatePercentage(opacity) === 1 || Number(opacity) === 1;
  const square = CORNER_RADII.every((corner) => evaluateLength(value(corner, "0")) === 0);
  return (
    !opaque ||
    !square ||
    value("filter", "none") !== "none" ||
    value("backdrop-filter", "none") !== "none" ||
    value("-webkit-backdrop-filter", "none") !== "none" ||
    value("mask", "none") !== "none" ||
    value("mask-image", "none") !== "none" ||
    value("clip-path", "none") !== "none" ||
    value("mix-blend-mode", "normal") !== "normal"
  );
}

/**
 * The element around a root whose background the root shows across its box, where the root paints
 * none: among the elements that lie exactly behind the root, as the capture measured them, the
 * innermost whose background paints. A transparent background shows what lies further out, so the
 * search goes on past it. An opaque color hides everything further out, so it is the fill, as the
 * Sidebar Provider's wrapper paints `bg-sidebar` behind an inset panel's container. A synced
 * variable is the fill where nothing further out among them paints. A translucent color, a
 * background image, or a variable over another paint composites more than one layer, which one
 * fill cannot draw, so those backgrounds stay unmapped and the root takes none. An element with
 * padding around the root, as a popup's content around its rows, does not lie exactly behind it, so
 * its background is no fill of the root's.
 *
 * The root draws a fill it takes through its own effects, so a root that changes how it paints, as
 * {@link altersPaint} says, takes none, just as an element between it and the background does: a
 * root at half opacity would fade a background that Chromium paints whole behind it.
 *
 * The search stops at the root element of a set that holds this one as an instance, as Select
 * popup's `select-content` holds Select item's rows: that set draws the paint around its instances
 * itself, so a row that took it would paint it twice. An element no such set roots, as the Sidebar
 * Provider's wrapper, stays in the search.
 *
 * @param ledger - The cell's ledger.
 * @param root - The root's style.
 * @param around - The component's elements around the root, outermost first, with their layers.
 * @param coinciding - How many of them, innermost first, lie exactly behind the root.
 * @param variables - The synced variables a color can bind.
 * @param instancedIn - The root `data-slot` of each set that holds this one as an instance.
 * @returns The element's style, whose reads fill the root's fields, or undefined for none.
 */
export function backdropAround(
  ledger: CellLedger,
  root: LayerStyle,
  around: readonly { readonly element: CapturedElement; readonly layer: Layer }[],
  coinciding: number,
  variables: VariableIndex,
  instancedIn: ReadonlySet<string>
): LayerStyle | undefined {
  const inward = around.toReversed().slice(0, coinciding);
  const holder = inward.findIndex(({ element }) => instancedIn.has(element.attributes["data-slot"] ?? ""));
  const behind = (holder === -1 ? inward : inward.slice(0, holder)).map(
    ({ layer }) => new LayerStyle(ledger, layer, [])
  );
  const image = (style: LayerStyle): boolean =>
    normalizeCss(style.resolved("background-image") ?? "none") !== "none";
  const color = (style: LayerStyle) =>
    style.has("background-color")
      ? readColor(style.resolved("background-color") ?? "", variables)
      : undefined;
  const paints = (style: LayerStyle): boolean => {
    const read = color(style);
    return (
      image(style) || (style.has("background-color") && !(read?.kind === "literal" && read.color.a === 0))
    );
  };
  const refuse = (styles: readonly LayerStyle[], detail: string = STACKED_BACKDROP): undefined => {
    for (const style of styles) {
      for (const property of ["background-color", "background-image"]) {
        style.mark(property, "unmapped", detail, []);
      }
    }
    return undefined;
  };
  for (const [index, style] of behind.entries()) {
    if (!paints(style)) {
      continue;
    }
    const read = color(style);
    const further = behind.slice(index + 1).filter(paints);
    // The background reaches the root as one opaque rectangle only where nothing from the root out
    // to the element that paints it changes how it paints.
    if ([root, ...behind.slice(0, index + 1)].some(altersPaint)) {
      return refuse([style, ...further], ALTERED_BACKDROP);
    }
    // A translucent color or an image shows what lies beneath it. A variable can be translucent in
    // some mode, so it paints the root alone only where nothing else paints beneath it.
    const solid = read?.kind === "literal" ? read.color.a >= 1 : read !== undefined && further.length === 0;
    return image(style) || !solid ? refuse([style, ...further]) : style;
  }
  return undefined;
}
