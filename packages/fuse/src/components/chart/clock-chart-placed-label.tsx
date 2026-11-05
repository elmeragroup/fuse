"use client";

/**
 * A label the clock's axes, references and Now place past the rim, its place written as the
 * stylesheet's custom properties.
 */
import type { ReactElement, ReactNode } from "react";

import type { LabelPlace } from "./clock-chart-dial";

/** A label placed past the rim, its place written as the stylesheet's custom properties. */
export function PlacedLabel({
  place,
  dataSlot,
  min,
  hidden,
  children,
}: {
  readonly place: LabelPlace;
  readonly dataSlot?: string;
  readonly min?: number | undefined;
  readonly hidden?: boolean;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <span
      data-slot={dataSlot}
      data-part={dataSlot === undefined ? "label" : undefined}
      data-min={min}
      data-hidden={hidden === true ? "" : undefined}
      style={{ "--_x": place.x, "--_y": place.y, "--_align-x": place.alignX, "--_align-y": place.alignY }}>
      {children}
    </span>
  );
}

Object.assign(PlacedLabel, { displayName: "ClockChart.PlacedLabel" });
