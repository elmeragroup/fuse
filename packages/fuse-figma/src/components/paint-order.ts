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
 */

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
