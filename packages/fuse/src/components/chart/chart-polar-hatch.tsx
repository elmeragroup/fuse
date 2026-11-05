"use client";

/**
 * The hatch an estimated slice or ring paints with (CONTRACT section 8.7, T172): the cartesian
 * hatched look's 45° stripes of a solid line and a tint of the item's own paint, which the
 * stylesheet mixes, in the dial's
 * units, at its 5 px stride on a dial of the nominal size. A polar chart draws in a viewBox, so the
 * stripes scale with the dial and step evenly at any size.
 */
import type { ReactElement } from "react";

/** The stripes' stride: 5 px on a dial of the nominal size, 92 px per unit of the outer radius. */
const STRIDE = 5 / 92;

/** The solid line's share of each stride, the cartesian hatch's 1.5 of 5 px. */
const LINE = 0.3;

/**
 * An estimated item's hatch, a paint server its slice's fill or its ring's stroke names.
 *
 * @param props - The server's id and the item's paint.
 * @returns The paint server.
 */
export function PolarHatch({ id, paint }: { readonly id: string; readonly paint: string }): ReactElement {
  const reach = STRIDE / Math.SQRT2;
  return (
    <linearGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      spreadMethod="repeat"
      x1="0"
      y1="0"
      x2={reach}
      y2={-reach}
      data-hatch=""
      style={{ "--_hatch": paint }}>
      <stop offset="0" />
      <stop offset={LINE} />
      <stop offset={LINE} data-part="tint" />
      <stop offset="1" data-part="tint" />
    </linearGradient>
  );
}

Object.assign(PolarHatch, { displayName: "PolarChart.Hatch" });
