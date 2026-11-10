"use client";

/**
 * The dial geometry the clock's grid, axes, references and hands share: a spoke from the hole to
 * the rim, a label's place past the rim, and the slot of a reference's instant. Each part keeps its
 * own module, so a route ships only the parts it names, and the label that sits at a place is
 * a component of its own, in `clock-chart-placed-label`.
 */
import type { ClockDrawing } from "./chart-polar-context";
import type { ChartX } from "./chart-types";
import { ChartCompositionError } from "./layout/errors";
import { boxPercent, polarPoint } from "./layout/polar-angle";
import type { SweepBox } from "./layout/polar-angle";
import { angleLabel, rayLabelOffset } from "./layout/polar-labels";
import { pathNumber } from "./layout/rounding";

/** A label's place past the rim at an angle, reading away from the centre: its point and its alignment. */
export type LabelPlace = {
  readonly x: string;
  readonly y: string;
  readonly alignX: string;
  readonly alignY: string;
};

/** A label's place past the rim at an angle, reading away from the centre. */
export function labelPlace(box: SweepBox, angle: number, reach: number): LabelPlace {
  const { point, alignX, alignY } = angleLabel(angle, reach);
  const [x, y] = boxPercent(box, point.x, point.y);
  return { x, y, alignX: `${String(-alignX * 100)}%`, alignY: `${String(-alignY * 100)}%` };
}

/**
 * A label's place on its ray: its centre at the rim point plus the gap and its support along the
 * ray, past the rim or inside it, so it sits centred on its spoke at a constant gap.
 *
 * @param box - The sweep's box.
 * @param angle - The ray's angle in degrees.
 * @param width - The label's estimated width in CSS pixels.
 * @param side - "outside" past the rim, "inside" toward the centre.
 * @returns The place, centred on its point.
 */
export function rayPlace(
  box: SweepBox,
  angle: number,
  width: number,
  side: "outside" | "inside"
): LabelPlace {
  const rim = polarPoint(angle, 1);
  const [x, y] = boxPercent(box, rim.x, rim.y);
  const offset = rayLabelOffset(angle, width, side);
  return { x: `calc(${x} + ${offset.x})`, y: `calc(${y} + ${offset.y})`, alignX: "-50%", alignY: "-50%" };
}

/** The narrowest width a label or its spoke shows at, for the stylesheet's container rules. */
export function minOf(visibility: number | "always" | "none"): number | undefined {
  return visibility === "always" || visibility === "none" ? undefined : visibility;
}

/** A spoke from the hole to the rim at an angle. */
export function spokePath(angle: number, inner: number, outer: number): string {
  const a = polarPoint(angle, inner);
  const b = polarPoint(angle, outer);
  return `M${pathNumber(a.x)},${pathNumber(a.y)}L${pathNumber(b.x)},${pathNumber(b.y)}`;
}

/** The slot of an instant, rejecting a string x, which a dial cannot read. */
export function slotOfX(clock: ClockDrawing, part: string, x: ChartX): number {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- consumer-owned union: an x is a string, a number or a Date
  if (typeof x === "string") {
    throw new ChartCompositionError(
      part,
      "x-type-mismatch",
      "received a string x on a clock dial. Pass a Date or epoch milliseconds, because a date-only string parses as UTC midnight and lands on the wrong day."
    );
  }
  return clock.slotOf(x);
}
