import type { IconCascade, PaintedBeside } from "./box-cascade";
import { ownTurn } from "./box-transform";
/**
 * The place a kit module declares for an absolute icon, which the build takes as declared and reads
 * from no CSS rule. One icon has one: Accordion item's `infodropdown` caret, `absolute right-0
 * size-4` in a `relative flex items-center` trigger with no padding or border. `accordion-kit.ts`
 * declares it: the caret's right edge on the trigger's right edge, its centre on the trigger's
 * centre, 16px square, and a half turn in an open item. Figma keeps that place by MAX × CENTER as
 * the trigger resizes (N11), and draws the caret as the trigger's last layer, over the label, as CSS
 * paints a positioned box over the flow.
 *
 * `accordion-caret.chromium.test.ts` holds the place to Chromium's layout of the real
 * `Accordion.Item` in every mode, at three host widths and with a label that wraps: the caret's
 * box, its turn, and that it paints on top. The build checks the captured caret against the
 * declaration: its `position`, its offsets, its size and its `rotate`, and that nothing in the
 * trigger paints after it. So a changed `right`, size or turn fails the build instead of drawing a
 * stale place. Every other absolute icon stays in its box's flow with its `position` unmapped. #846
 * records why the kit reads no general rule for one.
 */
import { KitUnmappable } from "./build-errors";
import { evaluateLength, normalizeCss } from "./css-values";
import type { IconLayerSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";

/**
 * Where a kit module declares an absolute icon sits in its box. Each field is a literal type, so the
 * one place the type admits is the `infodropdown` caret's, and `manifestDefinition` refuses it on
 * any icon but the one `icon` names, in the part `part` names, in the cells of the `variant` of the
 * set `set` names.
 */
export type DeclaredIconPlace = {
  /** The set whose kit module declares the place. */
  readonly set: "accordion-item";
  /** The key of the part that holds the icon. */
  readonly part: "trigger";
  /** The icon, by its name in the icon set. */
  readonly icon: "CaretDown";
  /** The value of the set's `variant` axis in each cell that declares the place. */
  readonly variant: "infodropdown";
  /** The icon's right edge, in pixels inside its box's right edge, which MAX keeps. */
  readonly end: 0;
  /** The icon's width and height in pixels. */
  readonly size: 16;
  /** The icon's turn in the cell, as Figma's `rotation` counts it: none closed, a half turn open. */
  readonly turn: 0 | 180;
};

/** The offsets the declared place leaves `auto`. */
const AUTO_OFFSETS = ["top", "bottom", "left"] as const;

/**
 * Place an icon where its kit module declares it, out of its box's auto layout. Its `position` and
 * `right` land as literals of the declared place.
 *
 * @param place - The declared place.
 * @param cascade - The icon's style, and what its box paints beside it.
 * @param icon - The icon's layer, as it maps in the flow.
 * @param variant - The variant's key, for the error.
 * @returns The icon's layer with its placement.
 * @throws KitUnmappable where the captured icon no longer declares what the place stands for, a
 *   kit module the component's CSS has outgrown.
 */
export function placeDeclaredIcon(
  place: DeclaredIconPlace,
  cascade: IconCascade,
  icon: IconLayerSpec,
  variant: string
): IconLayerSpec {
  const { style } = cascade;
  const stale = staleDeclaration(place, style, icon) ?? paintedOver(cascade.beside);
  if (stale !== undefined) {
    throw new KitUnmappable({
      message: `${variant}: ${icon.name} has the place its kit module declares, but ${stale}`,
    });
  }
  const feed = style.feed("placement");
  style.read(
    "position",
    (value) => value,
    () => ({
      outcome: "literal",
      detail: "an absolute icon at the place `accordion-kit.ts` declares for it",
    }),
    feed
  );
  style.read(
    "right",
    (value) => value,
    () => ({
      outcome: "literal",
      detail: `${String(place.end)}px from its parent's right edge, as \`accordion-kit.ts\` declares, which MAX keeps`,
    }),
    feed
  );
  return {
    ...icon,
    placement: {
      kind: "edges",
      within: "parent",
      horizontal: { kind: "end", end: place.end },
      vertical: { kind: "centre", offset: 0 },
    },
  };
}

/** What the captured icon declares apart from the place, or undefined where it declares the place. */
function staleDeclaration(
  place: DeclaredIconPlace,
  style: LayerStyle,
  icon: IconLayerSpec
): string | undefined {
  const position = normalizeCss(style.resolved("position") ?? "static");
  if (position !== "absolute") {
    return `its \`position\` is ${position}`;
  }
  const right = style.resolved("right") ?? "auto";
  if (evaluateLength(right) !== place.end) {
    return `its \`right\` is ${right}`;
  }
  const offset = AUTO_OFFSETS.find((property) => normalizeCss(style.resolved(property) ?? "auto") !== "auto");
  if (offset !== undefined) {
    return `it sets \`${offset}\``;
  }
  if (icon.size.kind !== "literal" || icon.size.value !== place.size) {
    return `it is not ${String(place.size)}px square`;
  }
  // The turn reads as `ownTurn` does, so an angle it does not read, as `.5turn`, refuses instead of
  // counting as no turn.
  const own = ownTurn(style);
  if (own.kind === "unread") {
    return `its \`rotate\` is ${own.value}, an angle the kit does not read`;
  }
  const turn = own.kind === "turned" ? own.turn : 0;
  return turn === place.turn ? undefined : `it turns ${String(turn)}°`;
}

/**
 * What in the icon's box can paint over it, or undefined where nothing can. The kit draws the icon
 * as its box's last layer, which holds only where the icon is its box's last element child and its
 * box renders no `::before` or `::after`, which a `z-index` lifts over it.
 */
function paintedOver(beside: PaintedBeside | undefined): string | undefined {
  if (beside === undefined) {
    return "the capture holds it in no markup of its box";
  }
  const [later] = beside.later;
  if (later !== undefined) {
    return `a <${later}> follows it in its box, which paints after it`;
  }
  const [generated] = beside.generated;
  return generated === undefined
    ? undefined
    : `its box renders a \`::${generated}\`, which can paint over it`;
}
