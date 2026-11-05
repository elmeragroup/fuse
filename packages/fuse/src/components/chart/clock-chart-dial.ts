"use client";

/**
 * The dial geometry the clock's grid, axes, references and hands share: a spoke from the hole to
 * the rim, a label's place past the rim, and the slot of a reference's instant. Each part keeps its
 * own module, so a route ships only the parts it names (Q1), and the label that sits at a place is
 * a component of its own, in `clock-chart-placed-label`.
 */
import type { ClockDrawing } from "./chart-polar-context";
import type { ChartX } from "./chart-types";
import { ChartCompositionError } from "./layout/errors";
import { polarPoint } from "./layout/polar-angle";
import type { SweepBox } from "./layout/polar-angle";
import { angleLabel } from "./layout/polar-labels";
import { pathNumber } from "./layout/rounding";

/** The radius a cycle label sits at, as a share of the outer radius. */
export const LABEL_REACH = 1.1;

/** A point's place in the cell, as percentages of the sweep's box. */
export function percent(box: SweepBox, x: number, y: number): readonly [string, string] {
  const left = ((x - box.left) / (box.right - box.left)) * 100;
  const top = ((y - box.top) / (box.bottom - box.top)) * 100;
  return [`${left.toFixed(3)}%`, `${top.toFixed(3)}%`];
}

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
  const [x, y] = percent(box, point.x, point.y);
  return { x, y, alignX: `${String(-alignX * 100)}%`, alignY: `${String(-alignY * 100)}%` };
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
