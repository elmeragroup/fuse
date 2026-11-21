/**
 * Where a frame sits outside its parent's auto layout by its centre, as a Tooltip's arrow hangs from
 * its popup's edge that faces the trigger, turned 45°. CSS turns a box about its centre, while
 * Figma's `x` and `y` are the origin of the layer's transform, which a free layer turns about (rule
 * 26, PQ). So the plugin writes, in this order: `layoutPositioning` ABSOLUTE and the constraints
 * `PIVOT_EDGES` names for the edge, CENTER along it and MIN or MAX across it, before the layer's box,
 * since Figma refuses FILL on an absolute layer (P8); then the box and the turn, as for every frame;
 * and last the place, `x` then `y`, computed from the centre the spec holds, the turn as it stands
 * and the parent's size once it settles. The constraints keep the place as the parent resizes, a
 * density switch among them (fake rule 59). A real file kept the bottom edge's CENTER and MAX (W5-P11,
 * W5-P11b), and on 2026-11-20 a real file kept the inset exactly on all four edges, while CENTER
 * shifted the centre by whole pixels, 0.5px off the middle where the parent's length along the edge
 * changed parity (PG17). The plan compares the centre, never `x` and `y`, which follow the turn and
 * sizes the run does not set.
 */
import { PIVOT_EDGES } from "../../src/components/kit-spec.ts";
import type { PivotSpec, RotationSpec } from "../../src/components/kit-spec.ts";
import { near, planScalar } from "./fields.ts";
import type { Held, Run } from "./fields.ts";
import { holderOf, planConstraints } from "./placing.ts";
import { change } from "./plan.ts";
import { settleInstances } from "./settle.ts";

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
function originFor(
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

/** A point in the parent's frame, in pixels from its top left corner. */
type Point = { readonly x: number; readonly y: number };

/** A parent's size. */
type Size = { readonly width: number; readonly height: number };

/** Where a pivot's centre sits in a parent of `size`. */
function centreOf(spec: PivotSpec, size: Size): Point {
  const { along, from } = PIVOT_EDGES[spec.edge];
  const [alongLength, acrossLength] =
    along === "horizontal" ? [size.width, size.height] : [size.height, size.width];
  const alongAt = alongLength / 2 + spec.along;
  const acrossAt = from === "start" ? spec.inset : acrossLength - spec.inset;
  return along === "horizontal" ? { x: alongAt, y: acrossAt } : { x: acrossAt, y: alongAt };
}

/** The layer's centre as it stands, from its origin, turn and size. */
function heldCentre(frame: FrameNode): Point {
  const { cos, sin } = turnOf(frame.rotation);
  const halfWidth = frame.width / 2;
  const halfHeight = frame.height / 2;
  return {
    x: frame.x + cos * halfWidth + sin * halfHeight,
    y: frame.y - sin * halfWidth + cos * halfHeight,
  };
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
  const constrained = planConstraints(run, frame, label, PIVOT_EDGES[spec.edge].constraints);
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
  if (!moved && held !== "unknown") {
    settleInstances(holder);
    const now = heldCentre(frame);
    const placed = centreOf(spec, holder);
    if (near(now.x, placed.x) && near(now.y, placed.y)) {
      return;
    }
  }
  change(
    run.plan,
    label,
    `place → its centre ${spec.along}px from the centre along the ${spec.edge} edge and ${spec.inset}px inside it`,
    () => {
      settleInstances(holder);
      const origin = originFor(
        centreOf(spec, holder),
        { width: frame.width, height: frame.height },
        rotation ?? 0
      );
      frame.x = origin.x;
      frame.y = origin.y;
    }
  );
}
