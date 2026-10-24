/**
 * The paint order of a box that stacks blocks, as `box-mapping.ts` maps it: whether the box puts its
 * first layer on top, where CSS paints a ring an earlier block's layer casts over a later block's
 * fill, or why no one order draws it. The stacking reads what each block paints, with every instance
 * inside it, at any depth, drawn as its inner root built in place, as {@link PaintedInstances} keeps
 * them.
 */
import type { LayerStyle } from "./cascade";
import { normalizeCss } from "./css-values";
import { coveredShadow, walkLayers } from "./kit-spec";
import type { BoxSpec, ChildLayerSpec, FrameLayerSpec, InstanceLayerSpec } from "./kit-spec";

/**
 * What each instance layer of a mapping paints: the inner root it draws as built in place, with the
 * instances that root holds drawn so in turn. The spec holds an instance as a link to its set's
 * variant, which says nothing of the paints inside it, so a box's stacking reads the layers below it
 * as {@link resolve} draws them, apart from the spec the mapping emits. A mapping notes each instance
 * layer once its box has placed it, and the boxes above read it from there.
 */
export class PaintedInstances {
  readonly #drawn = new WeakMap<InstanceLayerSpec, FrameLayerSpec>();

  /**
   * Note what an instance layer paints.
   *
   * @param layer - The instance layer, as its box holds it.
   * @param drawn - The inner root built in place, as a frame with the instance layer's key and name,
   *   which {@link resolve} has drawn already.
   */
  note(layer: InstanceLayerSpec, drawn: FrameLayerSpec): void {
    this.#drawn.set(layer, drawn);
  }

  /**
   * A layer as it paints: an instance as its inner root, a frame with every instance below it drawn
   * so, and a text or an icon as it is.
   *
   * @param layer - A layer of the mapping.
   * @returns The layer with no instance at or below it.
   * @throws When an instance layer was never noted, a defect in the mapping.
   */
  resolve(layer: ChildLayerSpec): Exclude<ChildLayerSpec, InstanceLayerSpec> {
    switch (layer.kind) {
      case "instance": {
        const drawn = this.#drawn.get(layer);
        if (drawn === undefined) {
          throw new Error(`the mapping noted nothing the ${layer.name} instance paints`);
        }
        return drawn;
      }
      case "frame":
        return this.resolveBox(layer);
      case "text":
      case "icon":
        return layer;
    }
  }

  /**
   * A box as it paints, with every instance below it drawn as its inner root.
   *
   * @param box - A root or a frame of the mapping.
   * @returns The box with no instance below it.
   */
  resolveBox<Box extends BoxSpec>(box: Box): Box {
    return { ...box, children: box.children.map((child) => this.resolve(child)) };
  }
}

/**
 * A part a box stacks: the frame it draws, which for an instance part is its inner root as built in
 * place, so an instance stacks under the same rule as a frame, with every instance below it drawn so
 * too, its style and whether it paints a fill of its own.
 */
export type StackedPart = {
  readonly layer: FrameLayerSpec;
  readonly style: LayerStyle;
  readonly paints: boolean;
};

/**
 * The properties that put a box in a layer of its own at any value but their initial one: a box
 * that is positioned or that makes a stacking context, which CSS paints after the inline-level boxes
 * of the stacking context around it (CSS 2.1 Appendix E). Each value lists the property's initial
 * values, as the build reads them.
 */
const OWN_LAYER: ReadonlyMap<string, readonly string[]> = new Map([
  ["position", ["static"]],
  ["opacity", ["1", "100%"]],
  ["transform", ["none"]],
  ["translate", ["none"]],
  ["rotate", ["none"]],
  ["scale", ["none"]],
  ["filter", ["none"]],
  ["backdrop-filter", ["none"]],
  ["isolation", ["auto"]],
  ["mix-blend-mode", ["normal"]],
  ["will-change", ["auto"]],
  ["contain", ["none"]],
  ["clip-path", ["none"]],
  ["mask-image", ["none"]],
  ["perspective", ["none"]],
]);

/** Whether a block paints its background with its block siblings': it sets no property of {@link OWN_LAYER}. */
function paintsInFlow(style: LayerStyle): boolean {
  return [...OWN_LAYER].every(([property, initial]) => {
    const value = style.resolved(property);
    return value === undefined || initial.includes(normalizeCss(value));
  });
}

/** Whether a flex block holds a layer that casts a shadow, which paints as a flex item does. */
function ringsAsItem({ layer, style }: StackedPart): boolean {
  return (
    normalizeCss(style.raw("display") ?? "") === "flex" &&
    walkLayers(layer).some((below) => below.kind === "frame" && below.shadows.length > 0)
  );
}

/**
 * Whether a box that stacks blocks paints its first layer on top. CSS paints each block's background
 * and shadows in tree order, then the inline-level boxes, then the positioned boxes and stacking
 * contexts (CSS 2.1 Appendix E), and a flex item paints as an inline block does (CSS Flexbox 1 §4.3).
 * So a ring that a flex block's layer casts paints over a later block's fill, as the Accordion
 * trigger's focus ring over the open panel, while a block's own ring paints below the later block,
 * and a later positioned block or stacking context paints above the ring, as Figma's own order does.
 * Figma paints a later layer above an earlier one, and the first on top with `itemReverseZIndex`
 * (PZ2), which lifts every earlier layer above every later one. So the box puts its first layer on
 * top only where every block after the ring paints in flow, and no earlier layer shows a fill that
 * would cover a later layer's shadow. Otherwise it keeps Figma's order and its `display` stays
 * unmapped, with the reason.
 *
 * @param reader - The box's style, which notes a stacking no order draws.
 * @param parts - The blocks, in the order the box stacks them.
 * @returns True where a flex block's layer casts a shadow, a later block that paints in flow fills,
 *   and one order draws both.
 */
export function stacksFirstOnTop(reader: LayerStyle, parts: readonly StackedPart[]): boolean {
  const lifted = parts.findIndex(
    (part, index) =>
      ringsAsItem(part) && parts.slice(index + 1).some((later) => later.paints && paintsInFlow(later.style))
  );
  if (lifted === -1) {
    return false;
  }
  const refusal = stackingRefusal(parts, lifted);
  if (refusal !== undefined) {
    reader.read(
      "display",
      (value) => value,
      () => ({ outcome: "unmapped", detail: refusal }),
      []
    );
  }
  return refusal === undefined;
}

/**
 * Why no one order of a box's blocks draws the ring of a flex block's layer above a later block's
 * fill as CSS does: a later block paints above the ring as a positioned box or a stacking context,
 * or an earlier fill would cover a later shadow once the first layer is on top.
 *
 * @param parts - The blocks, in the order the box stacks them.
 * @param lifted - The index of the first flex block whose layer's ring a later block's fill meets.
 * @returns The reason, or undefined where the first layer on top draws both.
 */
function stackingRefusal(parts: readonly StackedPart[], lifted: number): string | undefined {
  const lifts = "the ring a flex block's layer casts paints above a later block's fill";
  const raised = parts.slice(lifted + 1).find((later) => !paintsInFlow(later.style));
  if (raised !== undefined) {
    return `${lifts} and below ${raised.layer.name}, a positioned box or a stacking context (CSS 2.1 Appendix E), and Figma paints a box's layers in one order`;
  }
  const covered = coveredShadow(parts.map(({ layer }) => layer));
  return covered === undefined
    ? undefined
    : `${lifts}, and putting the first layer on top would also paint the fill of ${covered.fill} over the shadow ${covered.shadow} casts, which CSS can paint above it`;
}
