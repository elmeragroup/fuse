/**
 * An absolute instance part whose containing block lies above its parent, as Toast's root places
 * the close its content column holds. CSS places the part against the block's padding box (CSS 2.1
 * §10.1, §10.3.7), and Figma places a layer against its parent frame only, so the kit draws the part
 * in the block's frame. The manifest keeps the part where the markup puts it. The box whose element
 * is the block lifts the part out of the frame parts between, where the capture measured the block
 * that many steps up (`blockSteps`, `capture/block-frame.ts`), and maps it as one of its own absolute
 * parts, after the frame that held it (`part-preparation.ts` says which parts it lifts).
 *
 * The capture measured that CSS paints the part over everything else in the block, so the part keeps
 * its place only where the box's order also draws it last. The box refuses the place before the part
 * maps where the order of its layers puts another after it (`PAINTED_OVER` in
 * `absolute-placement.ts`), and {@link readLiftedLast} checks the order the box finally draws, which a
 * first layer on top or a wrapper around some layers can still change.
 */
import type { ChildLayerSpec } from "./kit-spec";
import type { LayerStyle } from "./layer-style";
import { placementKey } from "./placement-wrapper";

/** Why a lifted part has no place where the box's final order draws another layer over it. */
const UNDER_ANOTHER =
  "the capture measured CSS painting the part over everything else in its containing block, and the block's frame draws another layer over it";

/** A part a box lifted into its frame, as the check of its paint order reads it. */
export type LiftedLayer = {
  /** The part's key, its own layer's, or the instance's that a placement wrapper holds. */
  readonly key: string;
  /** The part's style, which notes what became of its `position`. */
  readonly style: Pick<LayerStyle, "read">;
};

/**
 * Leave the place of each lifted part the box placed unmapped, with the reason, where the box's
 * frame does not draw it as its topmost layer after all. A box that paints its first layer on top paints its last at the bottom,
 * so no layer of it is topmost. The check reads the box's final order, which the plan of each part's
 * place comes before, so it reads the part's `position` again once the part is drawn, as unmapped,
 * where `readRaisedLevels` in `paint-order.ts` reads a `z-index` once the order is known.
 *
 * @param lifted - The parts the box lifted into its frame.
 * @param painted - The box's layers in the order it draws them, and whether it paints its first
 *   layer on top.
 */
export function readLiftedLast(
  lifted: readonly LiftedLayer[],
  painted: { readonly order: readonly ChildLayerSpec[]; readonly firstOnTop: boolean }
): void {
  const topmost = painted.firstOnTop ? undefined : painted.order.at(-1);
  const holds = (key: string): boolean => topmost?.key === key || topmost?.key === placementKey(key);
  for (const layer of lifted.filter(({ key }) => !holds(key))) {
    layer.style.read(
      "position",
      (value) => value,
      () => ({ outcome: "unmapped", detail: UNDER_ANOTHER }),
      []
    );
  }
}
