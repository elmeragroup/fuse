/**
 * Where a frame sits outside its parent's auto layout by its centre, as a Tooltip's arrow hangs from
 * its popup's bottom edge, turned 45°. CSS turns a box about its centre, while Figma's `x` and `y` are
 * the origin of the layer's transform, which a free layer turns about (rule 26, PQ). So the plugin
 * writes, in this order: `layoutPositioning` ABSOLUTE and the constraints, CENTER across and MAX down,
 * before the layer's box, since Figma refuses FILL on an absolute layer (P8); then the box and the
 * turn, as for every frame; and last the place, `x` then `y`, computed from the centre the spec holds,
 * the turn as it stands and the parent's size once it settles. The constraints keep the place as the
 * parent resizes, a density switch among them (fake rule 59, unprobed until the U9 arrow probe). The
 * plan compares the centre, never `x` and `y`, which follow the turn and sizes the run does not set.
 */
import type { PivotSpec, RotationSpec } from "../../src/components/kit-spec.ts";
import { near, planScalar } from "./fields.ts";
import type { Held, Run } from "./fields.ts";
import { change } from "./plan.ts";
import { settleInstances } from "./settle.ts";

/** The box that holds the frame: a variant or a frame below it. */
type Holder = SceneNode & DimensionAndPositionMixin & ChildrenMixin;

/** The variant or frame the layer sits in. */
function holderOf(frame: FrameNode, label: string): Holder {
  const parent = frame.parent;
  if (
    parent === null ||
    (parent.type !== "COMPONENT" && parent.type !== "FRAME" && parent.type !== "INSTANCE")
  ) {
    throw new Error(`${label} sits in no frame the kit draws, so nothing places it.`);
  }
  return parent;
}

/** The cosine and sine of a turn in degrees, counterclockwise as Figma counts it. */
function turnOf(degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  return { cos: Math.cos(radians), sin: Math.sin(radians) };
}

/**
 * Where the transform's origin sits for a layer whose centre sits at a point: Figma's transform at a
 * turn `r` is `[[cos r, sin r, x], [-sin r, cos r, y]]`, so the centre of a `w` × `h` box is the origin
 * moved by `(cos r · w/2 + sin r · h/2, -sin r · w/2 + cos r · h/2)`.
 */
export function originFor(
  centre: { readonly x: number; readonly y: number },
  size: { readonly width: number; readonly height: number },
  rotation: number
) {
  const { cos, sin } = turnOf(rotation);
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;
  return {
    x: centre.x - (cos * halfWidth + sin * halfHeight),
    y: centre.y - (-sin * halfWidth + cos * halfHeight),
  };
}

/** The layer's centre offset and bottom inset as they stand, read after the parent's instances settle. */
function heldCentre(frame: FrameNode, holder: Holder): Pick<PivotSpec, "centerOffset" | "bottomInset"> {
  settleInstances(holder);
  const { cos, sin } = turnOf(frame.rotation);
  const halfWidth = frame.width / 2;
  const halfHeight = frame.height / 2;
  const x = frame.x + cos * halfWidth + sin * halfHeight;
  const y = frame.y - sin * halfWidth + cos * halfHeight;
  return { centerOffset: x - holder.width / 2, bottomInset: holder.height - y };
}

/**
 * Plan the frame's positioning and constraints, before its box. Turning a layer absolute moves it,
 * so the place is written whatever it reads, as {@link planPivotPlace} learns from the result.
 *
 * @returns Whether the layer turns absolute or its constraints change in this run.
 */
export function planPivotPositioning(run: Run, frame: FrameNode, label: string, spec: PivotSpec): boolean {
  const turns = frame.layoutPositioning !== "ABSOLUTE";
  planScalar(run, label, "layoutPositioning", frame.layoutPositioning, "ABSOLUTE", () => {
    frame.layoutPositioning = "ABSOLUTE";
  });
  const { horizontal, vertical } = spec.constraints;
  const constrained = frame.constraints.horizontal === horizontal && frame.constraints.vertical === vertical;
  if (!constrained) {
    change(run.plan, label, `constraints → ${horizontal} ${vertical}`, () => {
      frame.constraints = { horizontal, vertical };
    });
  }
  return turns || !constrained;
}

/**
 * Plan the frame's place, after its box and its turn: `x` then `y`, from the spec's centre, the turn
 * the spec asks for and the parent's size once it settles.
 *
 * @param moved - Whether the run moves the layer before this: it turns absolute, its constraints or
 *   its turn change, or its parent resizes (`held` unknown), so the place is written whatever it reads.
 */
export function planPivotPlace(
  run: Run,
  frame: FrameNode,
  label: string,
  spec: PivotSpec,
  rotation: RotationSpec | undefined,
  moved: boolean,
  held: Held
): void {
  const holder = holderOf(frame, label);
  const now = moved || held === "unknown" ? undefined : heldCentre(frame, holder);
  if (
    now !== undefined &&
    near(now.centerOffset, spec.centerOffset) &&
    near(now.bottomInset, spec.bottomInset)
  ) {
    return;
  }
  change(
    run.plan,
    label,
    `place → its centre ${spec.centerOffset}px from the centre across and ${spec.bottomInset}px above the bottom`,
    () => {
      settleInstances(holder);
      const origin = originFor(
        { x: holder.width / 2 + spec.centerOffset, y: holder.height - spec.bottomInset },
        { width: frame.width, height: frame.height },
        rotation ?? 0
      );
      frame.x = origin.x;
      frame.y = origin.y;
    }
  );
}
