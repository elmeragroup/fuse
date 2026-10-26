/**
 * Where an instance sits outside its parent's auto layout, at the parent's end and centred down it,
 * as a Sidebar menu badge sits over the end of its row. On 2026-10-25 a real file kept such an
 * instance's end inset as the instance widened with its own text and as its parent widened, and kept
 * its centre's offset from the parent's centre through height changes and density switches, in the
 * main and in an outer instance, with MAX across and CENTER down (N11). So the plugin writes the
 * positioning and the constraints, places the instance once, from its size and its parent's as they
 * settle, and compares the inset and the offset, never `x` and `y`, which follow sizes the run does
 * not set.
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
 * The instance's end inset and centre offset as they stand, read after the instances inside its
 * parent, the instance among them, settle (PI).
 */
function heldPlace(instance: InstanceNode, holder: Holder): Pick<AnchoredSpec, "endInset" | "centerOffset"> {
  settleInstances(holder);
  return {
    endInset: holder.width - instance.x - instance.width,
    centerOffset: instance.y + instance.height / 2 - holder.height / 2,
  };
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
  const now = turns || !constrained || held === "unknown" ? undefined : heldPlace(instance, holder);
  if (now !== undefined && near(now.endInset, spec.endInset) && near(now.centerOffset, spec.centerOffset)) {
    return;
  }
  change(
    run.plan,
    label,
    `place → ${spec.endInset}px from the end, its centre ${spec.centerOffset}px from the centre`,
    () => {
      settleInstances(holder);
      instance.x = holder.width - spec.endInset - instance.width;
      instance.y = holder.height / 2 + spec.centerOffset - instance.height / 2;
    }
  );
}
