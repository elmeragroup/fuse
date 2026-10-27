/**
 * Where an instance sits outside its parent's auto layout, at the parent's end, and down either
 * centred, as a Sidebar menu badge sits over the end of its row, or a fixed distance below the
 * parent's top, as an overlay's corner close sits in its popup's top right. On 2026-10-25 a real file
 * kept such an instance's end inset as the instance widened with its own text and as its parent
 * widened, and kept its centre's offset from the parent's centre through height changes and density
 * switches, in the main and in an outer instance, with MAX across and CENTER down (N11). MIN down keeps
 * `y` as written, which no probe has read beside MAX across yet. So the plugin writes the positioning
 * and the constraints, places the instance once, from its size and its parent's as they settle, and
 * compares the end inset and the centre offset or top inset, never `x` and `y`, which follow sizes the
 * run does not set.
 */
import type { AnchoredSpec } from "../../src/components/kit-spec.ts";
import { near, planScalar } from "./fields.ts";
import type { Held, Run } from "./fields.ts";
import { change } from "./plan.ts";
import { settleInstances } from "./settle.ts";

/** The box that holds an instance layer, a variant or a frame below it. */
type Holder = SceneNode & DimensionAndPositionMixin & ChildrenMixin;

/** The variant or frame an instance layer sits in. */
function holderOf(instance: InstanceNode, label: string): Holder {
  const parent = instance.parent;
  if (
    parent === null ||
    (parent.type !== "COMPONENT" && parent.type !== "FRAME" && parent.type !== "INSTANCE")
  ) {
    throw new Error(`${label} sits in no frame the kit draws, so nothing places it.`);
  }
  return parent;
}

/**
 * Whether the instance sits where the spec places it, read after the instances inside its parent, the
 * instance among them, settle (PI): its end inset, and its centre's offset from the parent's centre or
 * its top's inset below the parent's top, as the spec's vertical constraint keeps.
 */
function heldAt(instance: InstanceNode, holder: Holder, spec: AnchoredSpec): boolean {
  settleInstances(holder);
  const down =
    "centerOffset" in spec
      ? near(instance.y + instance.height / 2 - holder.height / 2, spec.centerOffset)
      : near(instance.y, spec.topInset);
  return near(holder.width - instance.x - instance.width, spec.endInset) && down;
}

/** The `y` the spec places the instance at, from its height and its parent's as they stand. */
function placedY(instance: InstanceNode, holder: Holder, spec: AnchoredSpec): number {
  return "centerOffset" in spec ? holder.height / 2 + spec.centerOffset - instance.height / 2 : spec.topInset;
}

/** How a change line names the spec's place down. */
function downOf(spec: AnchoredSpec): string {
  return "centerOffset" in spec
    ? `its centre ${spec.centerOffset}px from the centre`
    : `its top ${spec.topInset}px below the top`;
}

/**
 * Plan where an instance sits: in its parent's auto layout, or absolute at the spec's end inset and
 * centre offset. Turning an instance absolute takes it out of the flow, and the constraints keep its
 * place from then on (N11).
 *
 * @param run - The run.
 * @param instance - The instance.
 * @param label - The instance's label, for change lines.
 * @param spec - The instance's place, or undefined for one the auto layout places.
 * @param held - `unknown` when the box that holds the instance turns in this run, so the place is
 *   written whatever it reads now.
 */
export function planAnchoring(
  run: Run,
  instance: InstanceNode,
  label: string,
  spec: AnchoredSpec | undefined,
  held: Held
): void {
  const positioning = spec === undefined ? "AUTO" : "ABSOLUTE";
  const turns = instance.layoutPositioning !== positioning;
  planScalar(run, label, "layoutPositioning", instance.layoutPositioning, positioning, () => {
    instance.layoutPositioning = positioning;
  });
  if (spec === undefined) {
    return;
  }
  const { horizontal, vertical } = spec.constraints;
  const constrained =
    instance.constraints.horizontal === horizontal && instance.constraints.vertical === vertical;
  if (!constrained) {
    change(run.plan, label, `constraints → ${horizontal} ${vertical}`, () => {
      instance.constraints = { horizontal, vertical };
    });
  }
  const holder = holderOf(instance, label);
  const unchanged = !turns && constrained && held !== "unknown" && heldAt(instance, holder, spec);
  if (unchanged) {
    return;
  }
  change(run.plan, label, `place → ${spec.endInset}px from the end, ${downOf(spec)}`, () => {
    settleInstances(holder);
    instance.x = holder.width - spec.endInset - instance.width;
    instance.y = placedY(instance, holder, spec);
  });
}
