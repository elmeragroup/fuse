import { viewportRoom } from "./box-sizing";
import type { Room } from "./box-sizing";
import { evaluateLength, evaluateLengthOf, evaluatePercentage, inViewport, normalizeCss } from "./css-values";
import type { Viewport } from "./css-values";
/**
 * An instance part whose inner root is `position: fixed` in a declared viewport, inside a composite
 * that draws the same viewport, as an overlay's popup sits over its scrim. `fixedPlace` recognises
 * where the composite draws the part and the room it maps in, and `placeFixed` reads the part's
 * place and `z-index` into the coverage table there, so both halves of the policy live here.
 * `box-mapping.ts` calls the first while it maps the part and the second once the part has mapped.
 */
import type { LayerStyle } from "./layer-style";
import { translateShares } from "./placement";
import type { Layout } from "./placement";

/** The instance part as `fixedPlace` reads it: its inner root's viewport, its composite's, and its style in place. */
export type FixedPart = {
  readonly own: Viewport | undefined;
  readonly composite: Viewport | undefined;
  readonly style: LayerStyle;
};

/**
 * Where a box fixed in a viewport sits, as {@link fixedAtOf} reads it from the box's own place in
 * that viewport: centred, a length in pixels below the top and centred across, or against the right
 * edge from the top to the bottom.
 */
export type FixedAt =
  | { readonly _tag: "centre" }
  | { readonly _tag: "top"; readonly top: number }
  | { readonly _tag: "right" };

/**
 * Record in the coverage table an instance part that {@link fixedPlace} placed: the properties that
 * put it where it sits read as literal, and its `z-index`, which orders it above the page, drops.
 *
 * @param style - The inner root's style in place.
 * @param placed - Where `fixedPlace` found the composite draws it.
 */
export function placeFixed(style: LayerStyle, placed: PlacedFixed): void {
  const { at } = placed;
  for (const property of placeProperties(at)) {
    style.read(
      property,
      (value) => value,
      () => ({ outcome: "literal", detail: placedDetail(at) }),
      []
    );
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

/** Why a placed fixed instance's place reads as literal, by where the composite draws it. */
function placedDetail(at: FixedAt): string {
  switch (at._tag) {
    case "centre":
      return "Base UI fixes the popup at the viewport's centre, which the composite, as large as that viewport, draws by centring the popup";
    case "top":
      return `Base UI fixes the popup ${String(at.top)}px below the viewport's top and centres it across, which the composite, as large as that viewport, draws by padding its top by that length and centring the popup across`;
    case "right":
      return "the panel is fixed against the viewport's right edge from its top to its bottom, which the composite, as large as that viewport, draws as a row that packs the panel at its end and stretches it from top to bottom";
  }
}

/** The properties that place a fixed instance where the composite draws it. */
function placeProperties(at: FixedAt): readonly string[] {
  return at._tag === "right" ? EDGE_PLACE_PROPERTIES : CENTRED_PLACE_PROPERTIES;
}

/**
 * Where a box fixed in a viewport sits, read from its own place. Undefined for any other place, a
 * length below the top that does not resolve to pixels in the viewport, or a box that is not fixed.
 *
 * - Centred, as Dialog's `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2` puts its popup:
 *   `top` and `left` put the box's top left on the viewport's centre, and the translate moves it back
 *   by half its own size (CSS 2.1 §10.3.7, §10.6.4, CSS Transforms 2).
 * - A length below the top and centred across, as Command's `fixed top-[max(--spacing(4),12dvh)]
 *   left-1/2 -translate-x-1/2` puts its palette: centred across in the same way, and a `top` that
 *   resolves to pixels in the viewport.
 * - Against the right edge from the top to the bottom, as Sheet's `fixed inset-y-0 right-0 h-full`
 *   puts its right panel, as {@link atRightEdge} reads it.
 *
 * @param style - The box's style.
 * @param viewport - The viewport the box is fixed in, which its `dvh` and `dvw` lengths read.
 * @returns Where it sits, or undefined.
 */
function fixedAtOf(style: LayerStyle, viewport: Viewport): FixedAt | undefined {
  if (normalizeCss(style.raw("position") ?? "") !== "fixed") {
    return undefined;
  }
  if (atRightEdge(style)) {
    return { _tag: "right" };
  }
  if (style.has("right") || style.has("bottom")) {
    return undefined;
  }
  const translate = translateShares(style);
  const [across, down = 0] = translate;
  if (evaluatePercentage(style.resolved("left") ?? "") !== 0.5 || across !== -0.5) {
    return undefined;
  }
  if (evaluatePercentage(style.resolved("top") ?? "") === 0.5 && down === -0.5 && translate.length === 2) {
    return { _tag: "centre" };
  }
  const top = down === 0 ? evaluateLength(inViewport(style.resolved("top") ?? "", viewport)) : undefined;
  return top === undefined ? undefined : { _tag: "top", top };
}

/**
 * Whether a fixed box sits against the right edge of its containing block from the top to the
 * bottom: `right`, `top` and `bottom` zero, a `left` that is absent or `auto`, as `inset: 0 0 0
 * auto` expands to, no `translate`, and a height that is `auto` or `100%`, so the box is as tall as
 * the viewport whichever insets size it (CSS 2.1 §10.6.4). The other edges stay unread, since the
 * kit draws no Sheet on another side.
 *
 * @param style - The fixed box's style.
 * @returns True for a box against the right edge.
 */
function atRightEdge(style: LayerStyle): boolean {
  const zero = (property: string): boolean => evaluateLength(style.resolved(property) ?? "") === 0;
  const height = normalizeCss(style.resolved("height") ?? "auto");
  return (
    zero("right") &&
    zero("top") &&
    zero("bottom") &&
    normalizeCss(style.resolved("left") ?? "auto") === "auto" &&
    normalizeCss(style.resolved("translate") ?? "none") === "none" &&
    (height === "auto" || evaluatePercentage(height) === 1)
  );
}

/**
 * The layout a modal composite's root, the Backdrop over the viewport, gives its popup, as the
 * popup's own fixed place says: a flex box centring it on both axes, a column that centres it
 * across and pads its top by the popup's distance below the viewport's top, or a row that packs it
 * at its end, whose `normal` alignment stretches it across (CSS Box Alignment 3 §6.2). Undefined
 * for a popup fixed anywhere else, which the composite cannot draw where CSS puts it.
 *
 * @param popup - The popup's style.
 * @param viewport - The viewport both are fixed in.
 * @returns The root's layout declarations, or undefined.
 */
export function modalLayout(
  popup: LayerStyle,
  viewport: Viewport
): readonly { readonly property: string; readonly value: string }[] | undefined {
  const at = fixedAtOf(popup, viewport);
  switch (at?._tag) {
    case undefined:
      return undefined;
    case "centre":
      return [
        { property: "display", value: "flex" },
        { property: "align-items", value: "center" },
        { property: "justify-content", value: "center" },
      ];
    case "top":
      return [
        { property: "display", value: "flex" },
        { property: "flex-direction", value: "column" },
        { property: "align-items", value: "center" },
        { property: "padding-top", value: `${String(at.top)}px` },
      ];
    case "right":
      return [
        { property: "display", value: "flex" },
        { property: "justify-content", value: "flex-end" },
      ];
  }
}

/**
 * An instance part fixed in the viewport its composite draws, which the composite draws where CSS
 * puts it: where it sits, as {@link fixedAtOf} read it once in that viewport, and the room the
 * instance maps in. `placeFixed` records its place as read.
 */
export type PlacedFixed = { readonly _tag: "placed"; readonly at: FixedAt; readonly room: Room };

/**
 * What `fixedPlace` makes of an instance part fixed in the viewport its composite draws: placed, or
 * refused, where the composite does not draw it where CSS puts it, which `refuseFixedPlace` records.
 */
export type FixedPlace = PlacedFixed | { readonly _tag: "refused" };

/** The properties that place a centred or top fixed instance. */
const CENTRED_PLACE_PROPERTIES = ["position", "top", "left", "translate"] as const;

/** The properties that place a fixed instance against the right edge, `left` where it is `auto`. */
const EDGE_PLACE_PROPERTIES = ["position", "top", "right", "bottom", "left"] as const;

/** Every property that places a fixed instance, which a refused place leaves unmapped. */
const FIXED_PLACE_PROPERTIES = [...new Set([...CENTRED_PLACE_PROPERTIES, ...EDGE_PLACE_PROPERTIES])];

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
 * composite's root declares the same viewport. The part's parent must be the composite's root, and
 * that root's box the viewport, as {@link coversViewport} says. {@link fixedAtOf} reads where the part
 * sits in that viewport once, and the parent must draw it there:
 *
 * - Centred: the parent is a flex box that centres its layers on both axes, as Alert dialog's open
 *   example, the scrim over the viewport, centres the popup.
 * - A length below the top: the parent is a flex column that centres its layers across and starts
 *   them at its top, the part is its first layer, and the part's `top` equals the column's top
 *   padding, as Command dialog's open example pads its top by the palette's `max(1rem, 12dvh)`.
 * - Against the right edge: the parent is a row that packs its layers at its end, the part its
 *   last, so no layer after it takes the edge, and the part's top, right and bottom margins are
 *   zero, since CSS puts its margin box, not its border box, against the edge (CSS 2.1 §10.3.7,
 *   §10.6.4), as the open Sheet's scrim holds its right panel.
 *
 * Any other such part is refused. The composite pads nothing on an axis it centres the part on,
 * since CSS centres a fixed box in the viewport whatever the composite pads, while a Figma frame
 * centres its layers in the room its padding leaves, and the row that holds a panel against the edge
 * pads nothing at all. The inner root then takes the viewport as its containing block in place, as
 * its own set does. A panel against the edge takes the parent's height in place of the viewport's,
 * so its `100%` or inset height fills the row across, as CSS sizes it to the viewport the unpadded
 * parent covers, and a designer who resizes the composite keeps the panel against its edge and as
 * tall as the composite. Its width stays its own, as the README's Sheet section says of narrower
 * frames. Undefined for any other part.
 *
 * @param part - The instance part's viewports and style in place.
 * @param layout - The parent's layout.
 * @param parent - The parent's style.
 * @param among - Where the part sits among the parts the parent draws, out of flow as a fixed part is.
 * @returns Where the composite draws the part, its refusal, or undefined for a part that is not
 *   fixed in the composite's viewport.
 */
export function fixedPlace(
  part: FixedPart,
  layout: Layout,
  parent: LayerStyle,
  among: DrawnAmong
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
  const at = fixedAtOf(style, own);
  if (
    at === undefined ||
    !layout.flex ||
    !coversViewport(parent, own) ||
    !drawsAt(at, layout, parent, among) ||
    !flushAt(at, style)
  ) {
    return REFUSED;
  }
  const room = viewportRoom(style, own);
  return { _tag: "placed", at, room: at._tag === "right" ? edgeRoom(room) : room };
}

/**
 * Where a part sits among the parts its parent draws: its index, from zero, and how many there are.
 */
export type DrawnAmong = { readonly index: number; readonly count: number };

/**
 * Whether a parent that covers the viewport draws its fixed part where the part sits, as
 * {@link fixedPlace} lists the layouts.
 *
 * @param at - Where the part sits in the viewport.
 * @param layout - The parent's layout.
 * @param parent - The parent's style.
 * @param among - Where the part sits among the parts the parent draws.
 * @returns True where the parent draws the part there.
 */
function drawsAt(at: FixedAt, layout: Layout, parent: LayerStyle, among: DrawnAmong): boolean {
  const unpadded = (sides: readonly string[]) =>
    sides.every((side) => evaluateLength(parent.resolved(side) ?? "0px") === 0);
  const across = unpadded(["padding-left", "padding-right"]);
  switch (at._tag) {
    case "centre":
      return (
        layout.primaryAlign === "CENTER" &&
        layout.counterAlign === "CENTER" &&
        across &&
        unpadded(["padding-top", "padding-bottom"])
      );
    case "top":
      return (
        across &&
        among.index === 0 &&
        layout.direction === "VERTICAL" &&
        layout.primaryAlign === "MIN" &&
        layout.counterAlign === "CENTER" &&
        at.top === evaluateLength(parent.resolved("padding-top") ?? "0px")
      );
    case "right":
      return (
        across &&
        among.index === among.count - 1 &&
        unpadded(["padding-top", "padding-bottom"]) &&
        layout.direction === "HORIZONTAL" &&
        layout.primaryAlign === "MAX"
      );
  }
}

/**
 * Whether a part against the right edge has no margin on the sides it sits flush with, the top, the
 * right and the bottom, where CSS puts its margin box (CSS 2.1 §10.3.7, §10.6.4) and the composite
 * draws its border box. A part fixed anywhere else needs none.
 *
 * @param at - Where the part sits in the viewport.
 * @param style - The part's style.
 * @returns True where the composite's place for the part is its border box's.
 */
function flushAt(at: FixedAt, style: LayerStyle): boolean {
  return (
    at._tag !== "right" ||
    ["margin-top", "margin-right", "margin-bottom"].every(
      (side) => evaluateLength(style.resolved(side) ?? "0px") === 0
    )
  );
}

const REFUSED: FixedPlace = { _tag: "refused" };

/**
 * The room of a panel against the viewport's edge in its composite: the viewport across, and the
 * parent's height down, whose whole a `100%` height or an automatic one fills.
 *
 * @param room - The panel's room in the viewport.
 * @returns The room in its composite.
 */
function edgeRoom(room: Room): Room {
  return {
    ...room,
    vertical: { ...room.vertical, percent: { kind: "parent" }, auto: { kind: "fill" } },
  };
}

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
