/**
 * An instance part whose inner root is `position: fixed` in a declared viewport, inside a composite
 * that draws the same viewport, as an overlay's popup sits over its scrim. `fixedPlace` recognises
 * where the composite draws the part, and `placeCentredFixed` reads the part's place and `z-index`
 * into the coverage table there, so both halves of the policy live here. `box-mapping.ts` calls
 * the first while it maps the part and the second once the part's room is known.
 */
import type { LayerStyle } from "./cascade";
import { evaluateLength, evaluatePercentage, inViewport, normalizeCss, splitTopLevel } from "./css-values";
import type { Viewport } from "./css-values";
import type { Layout } from "./placement";

/** The instance part as `fixedPlace` reads it: its inner root's viewport, its composite's, and its style in place. */
export type FixedPart = {
  readonly own: Viewport | undefined;
  readonly composite: Viewport | undefined;
  readonly style: LayerStyle;
};

/** Where a fixed instance sits in its composite's viewport: centred, or a length below the top and centred across. */
export type FixedAt = "centre" | { readonly top: number };

/**
 * Read the place of an instance part's inner root that is fixed in the viewport its composite draws,
 * as {@link fixedPlace} found it.
 *
 * - Centred, as Dialog's `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2` puts its popup at
 *   the viewport's centre: the box's top left on the centre, then moved back by half its own size
 *   (CSS 2.1 §10.3.7, §10.6.4, CSS Transforms 2), which the composite draws by centring the instance.
 * - A length below the top and centred across, as Command's `fixed top-[max(--spacing(4),12dvh)]
 *   left-1/2 -translate-x-1/2` puts its palette, which the composite draws as a column that pads its
 *   top by that length and centres the instance across.
 *
 * Its place then reads as literal there, and `z-index`, which orders it above the page, drops. Any
 * other place stays unmapped.
 *
 * @param style - The inner root's style in place.
 * @param at - Where the composite draws it.
 */
export function placeCentredFixed(style: LayerStyle, at: FixedAt): void {
  const translate = splitTopLevel(normalizeCss(style.resolved("translate") ?? ""), " ").map(
    evaluatePercentage
  );
  const [across, down = 0] = translate;
  const centredAcross = evaluatePercentage(style.resolved("left") ?? "") === 0.5 && across === -0.5;
  const placed =
    !style.has("right") &&
    !style.has("bottom") &&
    centredAcross &&
    (at === "centre"
      ? evaluatePercentage(style.resolved("top") ?? "") === 0.5 && down === -0.5 && translate.length === 2
      : down === 0);
  const detail =
    at === "centre"
      ? "Base UI fixes the popup at the viewport's centre, which the composite, as large as that viewport, draws by centring the popup"
      : `Base UI fixes the popup ${String(at.top)}px below the viewport's top and centres it across, which the composite, as large as that viewport, draws by padding its top by that length and centring the popup across`;
  for (const property of ["position", "top", "left", "translate"]) {
    if (placed) {
      style.read(
        property,
        (value) => value,
        () => ({ outcome: "literal", detail }),
        []
      );
    } else {
      style.mark(
        property,
        "unmapped",
        "a fixed popup the composite places only where it sits as the composite draws it",
        []
      );
    }
  }
  style.read(
    "z-index",
    (value) => value,
    () => ({
      outcome: "dropped",
      detail:
        "the stacking level orders the popup above the page, which the composite draws below it already",
    }),
    []
  );
}

/**
 * Where an instance part is fixed in the viewport its composite draws, as `placeCentredFixed` reads
 * its place: centred on both axes, or a length below the top and centred across.
 */
export type FixedPlace = { readonly viewport: Viewport; readonly at: FixedAt };

/**
 * Where an instance part sits fixed in its composite's viewport, where the composite draws it there:
 * the inner set's root is `position: fixed` in the viewport its definition declares, and the
 * composite's root declares the same viewport. Then either the part's parent is a flex box that
 * centres its layers on both axes, as Alert dialog's open example, the scrim over the viewport,
 * centres the popup, or the parent is a flex column that centres its layers across and starts them at
 * its top, the part is its first layer, and the part's `top`, read in the viewport, equals the
 * column's top padding, as Command dialog's open example pads its top by the palette's
 * `max(1rem, 12dvh)`. The composite pads nothing on an axis it centres the part on, since CSS centres
 * a fixed box in the viewport whatever the composite pads, while a Figma frame centres its layers in
 * the room its padding leaves. The inner root then takes the viewport as its containing block in place, as its
 * own set does, and `placeCentredFixed` reads its place. Undefined for any other part.
 *
 * @param part - The instance part's viewports and style in place.
 * @param layout - The parent's layout.
 * @param parent - The parent's style.
 * @param first - Whether the part is the parent's first part, out of flow as a fixed part is.
 * @returns Where the composite draws the part, or undefined.
 */
export function fixedPlace(
  part: FixedPart,
  layout: Layout,
  parent: LayerStyle,
  first: boolean
): FixedPlace | undefined {
  const { own, composite, style } = part;
  if (
    own === undefined ||
    composite === undefined ||
    own.width !== composite.width ||
    own.height !== composite.height ||
    normalizeCss(style.raw("position") ?? "") !== "fixed" ||
    !layout.flex
  ) {
    return undefined;
  }
  // CSS centres the fixed box in the viewport whatever the composite pads, while a Figma frame
  // centres its layers in the room its padding leaves, so a centred axis must pad nothing.
  const unpadded = (sides: readonly string[]) =>
    sides.every((side) => evaluateLength(parent.resolved(side) ?? "0px") === 0);
  const across = unpadded(["padding-left", "padding-right"]);
  if (layout.primaryAlign === "CENTER" && layout.counterAlign === "CENTER") {
    return across && unpadded(["padding-top", "padding-bottom"])
      ? { viewport: own, at: "centre" }
      : undefined;
  }
  const top = evaluateLength(inViewport(style.resolved("top") ?? "", own));
  const padding = evaluateLength(parent.resolved("padding-top") ?? "0px");
  const startsAtTop =
    across &&
    layout.direction === "VERTICAL" &&
    layout.primaryAlign === "MIN" &&
    layout.counterAlign === "CENTER" &&
    first &&
    top !== undefined &&
    top === padding;
  return startsAtTop ? { viewport: own, at: { top } } : undefined;
}
