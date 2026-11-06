/**
 * Where polar labels sit. A slice's label sits inside at d3's centroid when its slice's role has an
 * on-colour role and its box fits the slice, and outside otherwise, with a leader from the rim to an
 * elbow 8 % past it and then a short run sideways. Outside labels on one side relax apart by their
 * own heights, so no two boxes overlap. A radar's or a dial's angle label sits past the rim and
 * aligns away from the centre. Every label is HTML placed in the cell, so these are plain boxes.
 */
import { arcCentroid } from "./arc-path";
import type { ArcSpec } from "./arc-path";
import { angleInSweep, pointerAngle, polarPoint, sweepOf } from "./polar-angle";
import type { PolarPoint } from "./polar-angle";

/** A label's box size, in the layout's unit. */
export type LabelSize = { readonly width: number; readonly height: number };

/** A box from its top left, in the layout's unit, from the centre. */
export type LabelBox = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

/** Where an inside label goes: inside at the centroid, or outside with a leader. */
export type InsidePlacement =
  | { readonly placement: "inside"; readonly box: LabelBox }
  | { readonly placement: "outside" };

/**
 * Whether a slice's label sits inside it: only when the slice's role has an on-colour role, and
 * only when its box, centred on d3's centroid, lies wholly inside the slice.
 *
 * @param arc - The slice's arc.
 * @param size - The label's box size.
 * @param onColour - Whether the slice's role has an on-colour role.
 * @returns The placement, with the box when inside.
 */
export function insideLabel(arc: ArcSpec, size: LabelSize, onColour: boolean): InsidePlacement {
  if (!onColour) return { placement: "outside" };
  const [x, y] = arcCentroid(arc);
  const box = { left: x - size.width / 2, top: y - size.height / 2, width: size.width, height: size.height };
  const pad = (arc.padAngle ?? 0) / 2;
  const direction = arc.endAngle < arc.startAngle ? -1 : 1;
  const sweep = sweepOf(arc.startAngle + pad * direction, arc.endAngle - pad * direction);
  const corners: PolarPoint[] = [
    { x: box.left, y: box.top },
    { x: box.left + box.width, y: box.top },
    { x: box.left, y: box.top + box.height },
    { x: box.left + box.width, y: box.top + box.height },
  ];
  const fits = corners.every(({ x: cx, y: cy }) => {
    const distance = Math.hypot(cx, cy);
    if (distance < arc.innerRadius || distance > arc.outerRadius) return false;
    return angleInSweep(pointerAngle(cx, cy), sweep) !== null;
  });
  return fits ? { placement: "inside", box } : { placement: "outside" };
}

/** One outside label: its leader's three points, the side it reads on and its box. */
export type OutsideLabel = {
  /** Where the leader leaves the rim, on the slice's bisector. */
  readonly anchor: PolarPoint;
  /** Where the leader turns sideways. */
  readonly elbow: PolarPoint;
  /** Where the leader ends, at the box's near edge. */
  readonly end: PolarPoint;
  /** "end" for a label on the right half, which reads away to the right, "start" for the left. */
  readonly side: "start" | "end";
  readonly box: LabelBox;
};

/** How outside labels sit: the rim, the elbow's reach past it and the run sideways. */
export type LeaderGeometry = {
  /** The rim's radius. */
  readonly radius: number;
  /** How far past the rim the elbow sits, as a share of the radius, 0.08 by default. */
  readonly reach: number;
  /** How far the leader runs sideways from the elbow. */
  readonly run: number;
};

/**
 * Outside labels with leaders. Each leader leaves the rim on its slice's bisector, turns at an elbow
 * past the rim and runs sideways to its label. Labels on each side sort top to bottom and move down
 * until each box clears the one above it, so no two boxes overlap. A label on the right half reads
 * from its leader's end rightward, and one on the left half ends at its leader's end.
 *
 * @param bisectors - Each slice's bisector in degrees.
 * @param sizes - Each label's box size.
 * @param geometry - The rim, the elbow's reach and the run.
 * @returns Each label's leader and box, in the input's order.
 */
export function outsideLabels(
  bisectors: readonly number[],
  sizes: readonly LabelSize[],
  geometry: LeaderGeometry
): readonly OutsideLabel[] {
  const { radius, reach, run } = geometry;
  const placed = bisectors.map((angle, index) => {
    const elbow = polarPoint(angle, radius * (1 + reach));
    const side: "start" | "end" = elbow.x >= 0 ? "end" : "start";
    return { index, angle, centre: elbow.y, side, size: sizes[index] ?? { width: 0, height: 0 } };
  });
  for (const side of ["start", "end"] as const) {
    const group = placed.filter((label) => label.side === side).sort((a, b) => a.centre - b.centre);
    for (let at = 1; at < group.length; at += 1) {
      const above = group[at - 1];
      const label = group[at];
      if (above === undefined || label === undefined) continue;
      const least = above.centre + (above.size.height + label.size.height) / 2;
      if (label.centre < least) label.centre = least;
    }
  }
  return placed.map(({ angle, centre, side, size }): OutsideLabel => {
    const reached = polarPoint(angle, radius * (1 + reach));
    const elbow = { x: reached.x, y: centre };
    const end = { x: elbow.x + (side === "end" ? run : -run), y: centre };
    return {
      anchor: polarPoint(angle, radius),
      elbow,
      end,
      side,
      box: {
        left: side === "end" ? end.x : end.x - size.width,
        top: centre - size.height / 2,
        width: size.width,
        height: size.height,
      },
    };
  });
}

/** The gap between the rim and an angle label's nearest edge along its ray, in CSS pixels (Fix R4). */
export const LABEL_GAP = 6;

/** A label centre's offset from its rim point, as CSS length expressions along x and y. */
export type RayLabelOffset = { readonly x: string; readonly y: string };

/** A number as a short CSS literal. */
function cssNumber(value: number): string {
  return String(Number(value.toFixed(4)));
}

/**
 * How far a label's centre sits from its rim point along the ray, as CSS lengths along x and y: the
 * gap, then the box's half-extent along the ray, its support, `|sin θ| · w/2 + |cos θ| · h/2`, so its
 * nearest edge keeps the gap at any angle and its centre stays on the ray (MOTION-REVIEW Fix R4).
 * The width and the height read `--_w` and `--_h`, the ink's size, which the client measures, and
 * fall back to the server's width estimate and one cap height.
 *
 * @param angle - The ray's angle in degrees from 12 o'clock.
 * @param width - The label's estimated width in CSS pixels, from the label-width table.
 * @param side - "outside" past the rim, or "inside" toward the centre.
 * @returns The offsets along x and y, each a CSS length expression for `calc()`.
 */
export function rayLabelOffset(angle: number, width: number, side: "outside" | "inside"): RayLabelOffset {
  const radians = (angle * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  const sign = side === "outside" ? 1 : -1;
  const support = `(${String(LABEL_GAP)}px + ${cssNumber(Math.abs(sin) / 2)} * var(--_w, ${cssNumber(width)}px) + ${cssNumber(Math.abs(cos) / 2)} * var(--_h, 1cap))`;
  return { x: `${cssNumber(sign * sin)} * ${support}`, y: `${cssNumber(-sign * cos)} * ${support}` };
}

/** Where an angle label sits and how it aligns: the share of its box that lies before its point on each axis. */
export type AngleLabel = {
  readonly point: PolarPoint;
  /** 0 aligns the box's left edge on the point, 0.5 its centre and 1 its right edge. */
  readonly alignX: 0 | 0.5 | 1;
  /** 0 aligns the box's top edge on the point, 0.5 its centre and 1 its bottom edge. */
  readonly alignY: 0 | 0.5 | 1;
};

/**
 * An angle label past the rim, such as a radar spoke's category or a dial's hour. It aligns away
 * from the centre, so it never covers the rim: centred near 12 and 6 o'clock along x, and near 3
 * and 9 o'clock along y.
 *
 * @param angle - The label's angle in degrees.
 * @param radius - The radius its point sits at.
 * @returns The point and the alignment.
 */
export function angleLabel(angle: number, radius: number): AngleLabel {
  const point = polarPoint(angle, radius);
  const sin = point.x / (radius || 1);
  const cos = -point.y / (radius || 1);
  return {
    point,
    alignX: Math.abs(sin) < 0.2 ? 0.5 : sin > 0 ? 0 : 1,
    alignY: Math.abs(cos) < 0.2 ? 0.5 : cos > 0 ? 1 : 0,
  };
}
