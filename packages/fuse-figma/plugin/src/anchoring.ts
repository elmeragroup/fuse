/**
 * Where an instance sits outside its parent's auto layout, at the parent's end, and down either
 * centred, as a Sidebar menu badge sits over the end of its row, or a fixed distance below the
 * parent's top, as an overlay's corner close sits in its popup's top right. On 2026-10-25 a real file
 * kept such an instance's end inset as the instance widened with its own text and as its parent
 * widened, and kept its centre's offset from the parent's centre through height changes and density
 * switches, in the main and in an outer instance, with MAX across and CENTER down (N11). On 2026-10-27
 * a real file kept a 32px close instance at MAX across and MIN down 16px from a 400px popup's end and
 * 16px below its top as the popup's text and density grew it, as the popup widened to 480 and as the
 * close itself widened, and an instance of the popup resized to 300 put it at 252, the close listing
 * only `layoutPositioning` as overridden (W5-P12). On 2026-10-27 a real file kept the Dialog's corner
 * close at the popup's end and 16px below its top in the main, in an instance pinned Comfortable and
 * in the open composite's centred popup instance, its top 16px as a longer description grew the popup,
 * again listing only `layoutPositioning` (W5-P14). The end inset survives a density switch that
 * resizes the instance only because its main is auto layout, which resizes it in place: the Icon
 * button moved from x 400 to 396, while a plain frame whose bound size changed kept its x and drifted
 * to a 12px end inset (W5-P14b). Every box the kit builds is auto layout, which
 * `anchored-instances.test.ts` pins. So the plugin writes the positioning
 * and the constraints, places the instance once, from its size and its parent's as they settle, and
 * compares the end inset and the centre offset or top inset, never `x` and `y`, which follow sizes the
 * run does not set.
 */
import type { AnchoredSpec } from "../../src/components/kit-spec.ts";
import { near, planScalar } from "./fields.ts";
import type { Held, Run } from "./fields.ts";
import { change } from "./plan.ts";
import { settleInstances } from "./settle.ts";

/** The box that holds a layer placed outside its auto layout, a variant or a frame below it. */
export type Holder = SceneNode & DimensionAndPositionMixin & ChildrenMixin;

/**
 * The variant or frame a layer placed outside its auto layout sits in.
 *
 * @param layer - The layer.
 * @param label - The layer's label, for the error.
 * @returns The layer's parent.
 * @throws When the layer sits in no variant, frame or instance.
 */
export function holderOf(layer: SceneNode, label: string): Holder {
  const parent = layer.parent;
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
 * Plan a placed layer's constraints, which keep its place as its parent resizes.
 *
 * @param run - The run.
 * @param layer - The layer.
 * @param label - The layer's label, for change lines.
 * @param constraints - The constraints the spec asks for.
 * @returns Whether the layer holds them already.
 */
export function planConstraints(
  run: Run,
  layer: SceneNode & ConstraintMixin,
  label: string,
  { horizontal, vertical }: Constraints
): boolean {
  const constrained = layer.constraints.horizontal === horizontal && layer.constraints.vertical === vertical;
  if (!constrained) {
    change(run.plan, label, `constraints → ${horizontal} ${vertical}`, () => {
      layer.constraints = { horizontal, vertical };
    });
  }
  return constrained;
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
  const constrained = planConstraints(run, instance, label, spec.constraints);
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
