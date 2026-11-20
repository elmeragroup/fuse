/**
 * The order a box's layers paint in, where some sit outside its auto layout. CSS paints a box's
 * in-flow, non-positioned descendants first, then its positioned ones with `z-index: auto`, absolute
 * and `relative` alike, in tree order among themselves (CSS 2.1 Appendix E, steps 4 to 8), so an
 * absolute overlay, as a frame's `before:absolute before:inset-0`, paints over the content it covers.
 * Figma paints a later layer over an earlier one, and its order of a box's layers is also their flow
 * in the auto layout, so the in-flow layers keep their flow order, while a placed layer, which moves
 * nothing in the flow, can sit anywhere among them.
 *
 * Each placed layer sits at the latest slot that paints it as CSS does: over every in-flow layer that
 * is not positioned and every positioned layer before it in the tree, under every positioned layer
 * after it. That slot is just before the first in-flow positioned layer after it in the tree, and it
 * paints the layer over the non-positioned ones only where none of them flows after that slot. Where
 * one does, as a `relative` block before a static one that an overlay covers, Figma cannot paint the
 * three as CSS does without changing the flow, so the placed layer has no slot. Two in-flow layers
 * paint in flow order in Figma, where CSS paints a `relative` one over a later static one, which shows
 * only where flow lets them overlap, as a negative margin does, which no reader here measures.
 *
 * A positive `z-index` paints a box after every box of the root at a lower level, whatever their tree
 * order (CSS 2.1 Appendix E, step 9). Figma has no level, so the root's last layer stands in for it
 * where the capture measured the box as painting over every other box of the root
 * (`capture/paints-last.ts`) and the root's order draws it last, which `readRaisedLevels` checks.
 */

import type { LayerStyle } from "./layer-style";

/** A layer of a box, in tree order, as far as its paint order needs to know. */
export type PaintedLayer = {
  readonly key: string;
  /** Whether the layer sits outside the box's flow, an absolute part. */
  readonly placed: boolean;
  /** Whether the layer is in the flow and positioned itself, as a `relative` part. */
  readonly positioned: boolean;
};

/** How a box's layers paint: their order, and the placed layers no order paints as CSS does. */
export type PaintArrangement = {
  readonly order: readonly string[];
  readonly unplaceable: ReadonlySet<string>;
};

/**
 * Arrange a box's layers in the order they paint, as the module comment says.
 *
 * @param layers - The box's layers, in tree order.
 * @returns Their keys in paint order, the in-flow ones in their flow order, and the keys of the placed
 *   layers no slot paints as CSS does, which the order leaves out.
 */
export function arrangePaint(layers: readonly PaintedLayer[]): PaintArrangement {
  const flowing = layers.filter((layer) => !layer.placed);
  const slots = new Map<number, string[]>();
  const unplaceable = new Set<string>();
  layers.forEach((layer, tree) => {
    if (!layer.placed) {
      return;
    }
    const laterPositioned = flowing.findIndex((other) => other.positioned && layers.indexOf(other) > tree);
    const slot = laterPositioned === -1 ? flowing.length : laterPositioned;
    if (flowing.slice(slot).some((other) => !other.positioned)) {
      unplaceable.add(layer.key);
      return;
    }
    slots.set(slot, [...(slots.get(slot) ?? []), layer.key]);
  });
  const order = [
    ...flowing.flatMap((layer, index) => [...(slots.get(index) ?? []), layer.key]),
    ...(slots.get(flowing.length) ?? []),
  ];
  return { order, unplaceable };
}

/**
 * A box's layers in an arrangement's order, where every key of it names one: a box whose layers the
 * mapping wrapped in frames of its own, as sections around separators, keeps them as they are.
 *
 * @param children - The box's layers.
 * @param order - The keys in paint order, as {@link arrangePaint} returns them.
 * @returns The layers in that order.
 */
export function inPaintOrder<Layer extends { readonly key: string }>(
  children: readonly Layer[],
  order: readonly string[]
): readonly Layer[] {
  const byKey = new Map(children.map((child) => [child.key, child]));
  const ordered = order.flatMap((key) => {
    const child = byKey.get(key);
    return child === undefined ? [] : [child];
  });
  return ordered.length === children.length ? ordered : children;
}

/** A drawn layer of a box, as far as its `z-index` needs to know. */
export type LeveledLayer = {
  readonly key: string;
  /**
   * Whether the capture measured the layer as painting over every other box of the root by its
   * `z-index` (`paintsLast`).
   */
  readonly paintsLast: boolean;
  /** The layer's style, which notes what became of its `z-index`. */
  readonly style: Pick<LayerStyle, "read" | "mark">;
};

/**
 * Read the `z-index` of each layer of a box that the capture measured as painting last in the root.
 * Figma paints the box's last layer over every other layer, so the level drops where the box's order
 * draws the layer last. A placed layer the order puts after it, as a part with no position of its own
 * leaves room for, would paint over it in Figma, so there the level stays unmapped. A box that paints
 * its first layer on top paints its last layer at the bottom, so no layer of it is topmost.
 *
 * @param layers - The box's drawn layers.
 * @param painted - The box's layer keys in the order it draws them, and whether it paints its first
 *   layer on top.
 */
export function readRaisedLevels(
  layers: readonly LeveledLayer[],
  painted: { readonly order: readonly string[]; readonly firstOnTop: boolean }
): void {
  const topmost = painted.firstOnTop ? undefined : painted.order.at(-1);
  for (const layer of layers.filter(({ paintsLast }) => paintsLast)) {
    if (layer.key === topmost) {
      layer.style.read(
        "z-index",
        (value) => value,
        () => ({
          outcome: "dropped",
          detail:
            "the capture measured the part over every other box of the root by its stacking level, and the root's order draws it last, so over every other layer too",
        }),
        []
      );
    } else {
      layer.style.mark(
        "z-index",
        "unmapped",
        "the capture measured the part over every other box of the root by its stacking level, and the root's order draws another layer after it",
        []
      );
    }
  }
}
