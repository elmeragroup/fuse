"use client";

/**
 * A label the clock's axes, references and Now place past the rim, its place written as the
 * stylesheet's custom properties.
 */
import type { ReactElement, ReactNode } from "react";

import { chartPart } from "./chart-part-marker";
import type { LabelPlace } from "./clock-chart-dial";

/**
 * A label placed past the rim, its place written as the stylesheet's custom properties. It is
 * drawing, hidden from readers, so a part that speaks says so in text of its own.
 */
export function PlacedLabel({
  place,
  part,
  min,
  hidden,
  children,
}: {
  readonly place: LabelPlace;
  /** The part an angle label marks. A reference's or Now's label leaves it out and marks none. */
  readonly part?: "clock-angle-label";
  readonly min?: number | undefined;
  readonly hidden?: boolean;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <span
      {...(part === undefined ? { "data-part": "label" } : chartPart(part))}
      aria-hidden="true"
      data-min={min}
      data-hidden={hidden === true ? "" : undefined}
      style={{ "--_x": place.x, "--_y": place.y, "--_align-x": place.alignX, "--_align-y": place.alignY }}>
      {children}
    </span>
  );
}

Object.assign(PlacedLabel, { displayName: "ClockChart.PlacedLabel" });
