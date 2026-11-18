/**
 * Where a frame or an instance sits outside its parent's auto layout by its distances to the
 * parent's edges or centre (`EdgePlacementSpec`), as a timeline item's dot, a meter's fill, an
 * overlay's corner close and a Sidebar menu badge sit. The layer turns absolute and takes its
 * constraints with its own fields, so a later resize of the parent moves it by them, and its parent
 * places it once the parent's other layers are planned, from the sizes the parent and its instances
 * settle at, since an axis other than `start` follows the parent's length, which its layers set where
 * it hugs them. The plan compares each axis's distance, never `x` and `y` alone, which follow sizes
 * the run does not set.
 *
 * Real files kept these places: on 2026-10-25 an instance's end inset as the instance widened with its
 * own text and as its parent widened, and its centre's offset from the parent's centre through height
 * changes and density switches, with MAX across and CENTER down (N11); on 2026-10-27 a 32px close
 * instance at MAX across and MIN down 16px from a 400px popup's end and 16px below its top as the
 * popup's text and density grew it, and in an instance of the popup resized to 300 (W5-P12), and the
 * Dialog's corner close in the main, in an instance pinned Comfortable and in the open composite's
 * centred popup instance (W5-P14). MAX keeps an instance's end inset only for an instance whose main
 * is auto layout, which every box the kit builds is (W5-P14b). A meter's fill kept SCALE across and
 * STRETCH down in its bar (P8). No real file has yet held a `stretch` beside a parent that hugs its
 * text, or one whose end lies past the parent's edge, as a timeline connector's does.
 */
import type { AxisPlacementSpec, EdgePlacementSpec } from "../../src/components/kit-spec.ts";
import { AXIS_CONSTRAINT } from "../../src/components/kit-spec.ts";
import { near, planScalar } from "./fields.ts";
import type { Held, Run } from "./fields.ts";
import { change } from "./plan.ts";
import type { Target } from "./plan.ts";
import { settleInstances } from "./settle.ts";

/** The box that holds a layer placed outside its auto layout, a variant or a frame below it. */
export type Holder = SceneNode & DimensionAndPositionMixin & ChildrenMixin;

/** A layer the kit places outside its parent's auto layout. */
type PlacedNode = FrameNode | InstanceNode;

/**
 * The variant or frame a layer placed outside its auto layout sits in.
 *
 * @param layer - The layer.
 * @param label - The layer's label, for the error.
 * @returns The layer's parent.
 * @throws When the layer sits in no variant, frame or instance, a defect of the plan.
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
 * Plan whether a layer sits in its parent's auto layout or outside it, and, outside it, the
 * constraints that keep its place.
 *
 * @param run - The run.
 * @param node - The layer.
 * @param label - The layer's label, for change lines.
 * @param placement - Where the layer sits, or undefined for one the auto layout places.
 */
export function planLeaving(
  run: Run,
  node: PlacedNode,
  label: string,
  placement: EdgePlacementSpec | undefined
): void {
  const positioning = placement === undefined ? "AUTO" : "ABSOLUTE";
  planScalar(run, label, "layoutPositioning", node.layoutPositioning, positioning, () => {
    node.layoutPositioning = positioning;
  });
  if (placement !== undefined) {
    planConstraints(run, node, label, {
      horizontal: AXIS_CONSTRAINT[placement.horizontal.kind],
      vertical: AXIS_CONSTRAINT[placement.vertical.kind],
    });
  }
}

/** The least length Figma lets a layer take. */
const LEAST_LENGTH = 0.01;

/** Where an axis puts a layer: its position and its length along the axis. */
type Placed = { readonly at: number; readonly length: number };

/** Where an axis puts the layer in a parent of `length`, the layer `own` long where the axis keeps it. */
function along(axis: AxisPlacementSpec, length: number, own: number): Placed {
  switch (axis.kind) {
    case "start":
    case "scale":
      return { at: axis.start, length: own };
    case "end":
      return { at: length - axis.end - own, length: own };
    case "centre":
      return { at: length / 2 + axis.offset - own / 2, length: own };
    case "stretch":
      return { at: axis.start, length: Math.max(LEAST_LENGTH, length - axis.start - axis.end) };
  }
}

/** Where the placement puts the layer in its parent, as both stand. */
function placedIn(node: PlacedNode, holder: Holder, placement: EdgePlacementSpec) {
  return {
    across: along(placement.horizontal, holder.width, node.width),
    down: along(placement.vertical, holder.height, node.height),
  };
}

/** Whether the layer sits where the placement puts it in its parent, read after its instances settle. */
function heldAt(node: PlacedNode, holder: Holder, placement: EdgePlacementSpec): boolean {
  settleInstances(holder);
  const { across, down } = placedIn(node, holder, placement);
  return (
    near(node.x, across.at) &&
    near(node.width, across.length) &&
    near(node.y, down.at) &&
    near(node.height, down.length)
  );
}

/** How a change line names an axis's place. */
function describe(axis: AxisPlacementSpec, start: string, end: string): string {
  switch (axis.kind) {
    case "start":
      return `${String(axis.start)}px from the ${start}`;
    case "end":
      return `${String(axis.end)}px from the ${end}`;
    case "centre":
      return `its centre ${String(axis.offset)}px from the centre`;
    case "stretch":
      return `${String(axis.start)}px from the ${start} to ${String(axis.end)}px from the ${end}`;
    case "scale":
      return `${String(axis.start)}px from the ${start}, scaling`;
  }
}

/**
 * Plan where a placed layer sits, once its parent's other layers are planned: the place is written
 * where the layer does not hold it, and wherever the run writes something that can resize the parent,
 * from the sizes the parent and its instances settle at when the write runs. A `stretch` sets the
 * frame's length on its axis too.
 *
 * @param run - The run.
 * @param target - The layer, which an earlier operation may create.
 * @param label - The layer's label, for change lines.
 * @param placement - Where the layer sits.
 * @param held - `unknown` where the run writes a field that can resize the parent.
 */
export function planPlace(
  run: Run,
  target: Target<SceneNode>,
  label: string,
  placement: EdgePlacementSpec,
  held: Held
): void {
  const found = target.existing;
  const placed = found?.type === "FRAME" || found?.type === "INSTANCE" ? found : undefined;
  if (placed !== undefined && held !== "unknown" && heldAt(placed, holderOf(placed, label), placement)) {
    return;
  }
  const line = `place → ${describe(placement.horizontal, "left", "right")}, ${describe(placement.vertical, "top", "bottom")}`;
  change(run.plan, label, line, () => {
    const node = target.get();
    if (node.type !== "FRAME" && node.type !== "INSTANCE") {
      throw new Error(`${label} is no frame or instance, so nothing places it by its parent's edges.`);
    }
    const holder = holderOf(node, label);
    settleInstances(holder);
    const { across, down } = placedIn(node, holder, placement);
    if (node.type === "FRAME" && (!near(node.width, across.length) || !near(node.height, down.length))) {
      node.resize(across.length, down.length);
    }
    node.x = across.at;
    node.y = down.at;
  });
}
