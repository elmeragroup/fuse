/**
 * An instance part whose inner root is `position: fixed` in a declared viewport, inside a composite
 * that draws the same viewport, as an overlay's popup sits over its scrim. `fixedPlace` recognises
 * where the composite draws the part, and `placeCentredFixed` reads the part's place and `z-index`
 * into the coverage table there, so both halves of the policy live here. `box-mapping.ts` calls
 * the first while it maps the part and the second once the part's room is known.
 */
import type { LayerStyle } from "./cascade";
import { evaluateLength, evaluateLengthOf, evaluatePercentage, inViewport, normalizeCss } from "./css-values";
import type { Viewport } from "./css-values";
import { translateShares } from "./placement";
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
  const translate = translateShares(style);
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
  if (placed) {
    for (const property of FIXED_PLACE_PROPERTIES) {
      style.read(
        property,
        (value) => value,
        () => ({ outcome: "literal", detail }),
        []
      );
    }
  } else {
    refuseFixedPlace(style);
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
 * What `fixedPlace` makes of an instance part fixed in the viewport its composite draws: placed where
 * `placeCentredFixed` reads it, centred on both axes or a length below the top and centred across, or
 * refused, where the composite does not draw it where CSS puts it, which `refuseFixedPlace` records.
 */
export type FixedPlace =
  | { readonly _tag: "placed"; readonly viewport: Viewport; readonly at: FixedAt }
  | { readonly _tag: "refused" };

/** The properties that place a fixed instance, which read together as placed or stay unmapped. */
const FIXED_PLACE_PROPERTIES = ["position", "top", "left", "translate"] as const;

/** Why a fixed instance's place stays unmapped where its composite does not draw it as CSS places it. */
const NOT_AS_DRAWN = "a fixed popup the composite places only where it sits as the composite draws it";

/**
 * Whether a box is the composite's root and its box is the viewport: fixed at the viewport's top left,
 * as large as it, by `inset-0` or by its width and height. Only there does a Figma frame centring its
 * layers centre them where CSS centres a fixed box, on the viewport (CSS 2.1 §10.3.7, §10.6.4). A root
 * of another size, or a frame below the root, centres the part in its own box instead.
 *
 * @param box - The style of the box that holds the part.
 * @param viewport - The declared viewport.
 * @returns True where the box is the viewport.
 */
function coversViewport(box: LayerStyle, viewport: Viewport): boolean {
  const length = (property: string, of: number): number | undefined =>
    evaluateLengthOf(inViewport(box.resolved(property) ?? "auto", viewport), of);
  const spans = (size: string, end: string, of: number): boolean =>
    normalizeCss(box.resolved(size) ?? "auto") === "auto" ? length(end, of) === 0 : length(size, of) === of;
  return (
    box.path.length === 0 &&
    normalizeCss(box.resolved("position") ?? "") === "fixed" &&
    length("top", viewport.height) === 0 &&
    length("left", viewport.width) === 0 &&
    spans("width", "right", viewport.width) &&
    spans("height", "bottom", viewport.height)
  );
}

/**
 * Where an instance part sits fixed in its composite's viewport, where the composite draws it there:
 * the inner set's root is `position: fixed` in the viewport its definition declares, and the
 * composite's root declares the same viewport. The part's parent must be the composite's root, and that
 * root's box the viewport, as {@link coversViewport} says. Then either the root is a flex box that
 * centres its layers on both axes, as Alert dialog's open example, the scrim over the viewport,
 * centres the popup, or the parent is a flex column that centres its layers across and starts them at
 * its top, the part is its first layer, and the part's `top`, read in the viewport, equals the
 * column's top padding, as Command dialog's open example pads its top by the palette's
 * `max(1rem, 12dvh)`. Any other such part is refused. The composite pads nothing on an axis it centres the part on, since CSS centres
 * a fixed box in the viewport whatever the composite pads, while a Figma frame centres its layers in
 * the room its padding leaves. The inner root then takes the viewport as its containing block in place, as its
 * own set does, and `placeCentredFixed` reads its place. Undefined for any other part.
 *
 * @param part - The instance part's viewports and style in place.
 * @param layout - The parent's layout.
 * @param parent - The parent's style.
 * @param first - Whether the part is the parent's first part, out of flow as a fixed part is.
 * @returns Where the composite draws the part, its refusal, or undefined for a part that is not
 *   fixed in the composite's viewport.
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
    normalizeCss(style.raw("position") ?? "") !== "fixed"
  ) {
    return undefined;
  }
  if (!layout.flex || !coversViewport(parent, own)) {
    return REFUSED;
  }
  // CSS centres the fixed box in the viewport whatever the composite pads, while a Figma frame
  // centres its layers in the room its padding leaves, so a centred axis must pad nothing.
  const unpadded = (sides: readonly string[]) =>
    sides.every((side) => evaluateLength(parent.resolved(side) ?? "0px") === 0);
  const across = unpadded(["padding-left", "padding-right"]);
  if (layout.primaryAlign === "CENTER" && layout.counterAlign === "CENTER") {
    return across && unpadded(["padding-top", "padding-bottom"])
      ? { _tag: "placed", viewport: own, at: "centre" }
      : REFUSED;
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
  return startsAtTop ? { _tag: "placed", viewport: own, at: { top } } : REFUSED;
}

const REFUSED: FixedPlace = { _tag: "refused" };

/**
 * Record a refused fixed instance's place as unmapped, with the reason, where `fixedPlace` refused it.
 *
 * @param style - The inner root's style in place.
 */
export function refuseFixedPlace(style: LayerStyle): void {
  for (const property of FIXED_PLACE_PROPERTIES) {
    style.mark(property, "unmapped", NOT_AS_DRAWN, []);
  }
}
