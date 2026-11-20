/**
 * The frame that keeps an absolute instance's right offset where a mode can change the instance's
 * width, as a density switch resizes Dialog's corner close through `control-h-sm`. Figma's MAX keeps
 * a layer's end inset as its parent resizes, but in an instance of the outer component a mode that
 * changes the layer's own width keeps its `x`, so the inset drifts by the change (PG14, PG14b). CSS
 * keeps the declared offset whatever the box's width (CSS 2.1 §10.3.7).
 *
 * A live probe found a frame that holds the offset (PG16): an absolute auto layout row with no fill
 * and no clip, STRETCH across the parent at its full width, aligned to its end and padded there by
 * the right offset, at the parent's top, padded by the top offset and hugging its height, with the
 * instance in its flow. Through resizes of the parent, a density switch in an instance and a BOOLEAN
 * that hides the instance, the instance kept both offsets and the parent's own layout stayed as it
 * was. So the instance keeps its key, its BOOLEAN property and its sizing, and sits in the wrapper
 * with no place of its own. The wrapper paints nothing, so it takes the instance's slot in its
 * parent's paint order.
 *
 * The wrapper's key is the instance's with ` placement` after it, so a Plan finds the same nodes on
 * every run. `absolute-placement.ts` decides which instances need one.
 */
import type { Wrapped } from "./absolute-placement";
import { NO_LIMITS, ZERO } from "./kit-spec";
import type {
  EdgePlacementSpec,
  FrameLayerSpec,
  InstanceAxisPlacementSpec,
  InstanceLayerSpec,
  NumberSpec,
} from "./kit-spec";

/** A literal length. */
const literal = (value: number): NumberSpec => ({ kind: "literal", value });

/**
 * Draw an instance placed at its parent's end across and its start down in a wrapper that keeps both
 * offsets, as the module comment says.
 *
 * @param instance - The instance layer, as its parent would hold it without a place.
 * @param placement - The instance's place: `end` across and `start` down.
 * @param wrapped - The parent's outer width, where the room knows it.
 * @returns The wrapper, which holds the instance.
 * @throws When the place is not the end across and the start down, a defect of the plan.
 */
export function wrapPlaced(
  instance: InstanceLayerSpec,
  placement: EdgePlacementSpec<InstanceAxisPlacementSpec>,
  wrapped: Wrapped
): FrameLayerSpec {
  const { horizontal: end, vertical: start } = placement;
  if (end.kind !== "end" || start.kind !== "start") {
    throw new Error(
      `${instance.key}: a placement wrapper keeps a place at the end across and the start down, and the plan gave ${end.kind} and ${start.kind}.`
    );
  }
  const { placement: _place, ...held } = instance;
  const key = `${instance.key} placement`;
  return {
    kind: "frame",
    key,
    name: key,
    placement: {
      kind: "edges",
      within: "parent",
      horizontal: { kind: "stretch", start: 0, end: 0 },
      vertical: { kind: "start", start: 0 },
    },
    direction: "HORIZONTAL",
    sizing: {
      horizontal:
        wrapped.outer === undefined ? { kind: "placed" } : { kind: "fixed", length: literal(wrapped.outer) },
      vertical: { kind: "hug" },
    },
    limits: NO_LIMITS,
    clips: false,
    paddingTop: literal(start.start),
    paddingRight: literal(end.end),
    paddingBottom: ZERO,
    paddingLeft: ZERO,
    itemSpacing: ZERO,
    primaryAlign: "MAX",
    counterAlign: "MIN",
    cornerRadius: ZERO,
    fill: undefined,
    stroke: undefined,
    shadows: [],
    opacity: 1,
    children: [held],
  };
}
