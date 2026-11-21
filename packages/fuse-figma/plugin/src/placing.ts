/**
 * Where a frame, an instance or an icon sits outside its parent's auto layout by its distances to the
 * parent's edges or centre (`EdgePlacementSpec`), as a timeline item's dot, a meter's fill, an
 * overlay's corner close and a Sidebar menu badge sit. A turned icon's place is its unturned box's. The layer turns absolute and takes its
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
 * is auto layout, which every box the kit builds is (W5-P14b). On 2026-11-19 an instance of the outer
 * component kept a placed close's `x` as a density switch grew it from 24 to 32, so its right inset
 * fell from 16 to 8, while the main kept 16 (PG14, PG14b). W5-P14's record does not say whether the
 * close changed size in its instance pinned Comfortable, so the two readings may not conflict. The
 * build follows PG14b: a placed instance a mode resizes sits in a placement wrapper, a row STRETCH
 * across the parent that pads the inset, which held it (PG16, `placement-wrapper.ts`). A meter's fill kept SCALE across and STRETCH down in its bar (P8). No real
 * file has yet held a `stretch` beside a parent that hugs its text, or one whose end lies past the
 * parent's edge, as a timeline connector's does.
 */
import type { AxisPlacementSpec, EdgePlacementSpec, SizingSpec } from "../../src/components/kit-spec.ts";
import { AXIS_CONSTRAINT } from "../../src/components/kit-spec.ts";
import { near, planScalar } from "./fields.ts";
import type { Held, Run } from "./fields.ts";
import { heldCentre, originFor } from "./layer-turn.ts";
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

/** Where the placement puts the layer's unturned box in its parent, as both stand. */
function placedIn(node: PlacedNode, holder: Holder, placement: EdgePlacementSpec) {
  return {
    across: along(placement.horizontal, holder.width, node.width),
    down: along(placement.vertical, holder.height, node.height),
  };
}

/**
 * Whether the layer sits where the placement puts it in its parent, read after its instances settle:
 * its unturned box at its distances, a turned icon's box about the centre its origin and turn give it
 * (`layer-turn.ts`). A layer that turns absolute or turns in the run records an operation, which makes
 * its parent write the place whatever it reads.
 */
function heldAt(node: PlacedNode, holder: Holder, placement: EdgePlacementSpec): boolean {
  settleInstances(holder);
  const { across, down } = placedIn(node, holder, placement);
  const centre = heldCentre(node);
  return (
    near(centre.x - node.width / 2, across.at) &&
    near(node.width, across.length) &&
    near(centre.y - node.height / 2, down.at) &&
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
 * frame's length on its axis too. That resize turns both of the frame's sizing modes FIXED (fake rule
 * 5), so an axis the frame hugs, as a placement wrapper hugs across, takes HUG again after it. A
 * turned icon's place is its unturned box's, so the write puts its origin where the turn as it stands
 * then, after the icon's own turn, puts the box there (`layer-turn.ts`). No real file has yet held an
 * absolute layer turned this way.
 *
 * @param run - The run.
 * @param target - The layer, which an earlier operation may create.
 * @param label - The layer's label, for change lines.
 * @param placement - Where the layer sits.
 * @param held - `unknown` where the run writes a field that can resize the parent, or the layer's
 *   positioning, constraints or turn.
 * @param sizing - A frame's sizing, or undefined for an instance or an icon, which keeps its own.
 */
export function planPlace(
  run: Run,
  target: Target<SceneNode>,
  label: string,
  placement: EdgePlacementSpec,
  held: Held,
  sizing: SizingSpec | undefined
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
      if (sizing?.horizontal.kind === "hug") {
        node.layoutSizingHorizontal = "HUG";
      }
      if (sizing?.vertical.kind === "hug") {
        node.layoutSizingVertical = "HUG";
      }
    }
    const origin = originFor(
      { x: across.at + node.width / 2, y: down.at + node.height / 2 },
      node,
      node.rotation
    );
    node.x = origin.x;
    node.y = origin.y;
  });
}
