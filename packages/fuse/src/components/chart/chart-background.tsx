"use client";

// Chart.Background repeats one small tile over the plot and fades it out toward the plot's edges.
// A pattern clips each tile at its edges, so a shape that crosses an edge is drawn whole by every
// tile it reaches. A straight line runs edge to edge, the wave runs past both edges, and a ring on
// a corner sits on all four corners, so neighbouring tiles join with no seam.

import type { ReactElement } from "react";

import { useSvgIdPrefix } from "./chart-dom";
import type { ChartBackgroundPattern, ChartLayerProps } from "./chart-types";

/**
 * Props for `Chart.Background`, a closed part.
 *
 * @beta
 */
export type ChartBackgroundProps = ChartLayerProps & {
  /** The pattern drawn behind the marks. "dots" by default. */
  variant?: ChartBackgroundPattern;
};

/** The ring centres of the overlapping circles: the tile's middle and its four corners. */
const RINGS = [
  [8, 8],
  [0, 0],
  [16, 0],
  [0, 16],
  [16, 16],
] as const;

/** The bubbles' centres and radii, each wholly inside the 40 px tile. */
const BUBBLES = [
  [9, 10, 3.5],
  [28, 6, 1.5],
  [33, 25, 2.5],
  [15, 31, 2.5],
  [23, 17, 1],
  [4, 24, 1.25],
  [37, 37, 1],
] as const;

/**
 * Each pattern's tile, in user-space pixels. Every tile paints `currentColor`, the border role, in
 * strokes under a pixel wide or faint fills, so the pattern stays a texture under the marks.
 */
function PatternTile({
  id,
  variant,
}: {
  readonly id: string;
  readonly variant: ChartBackgroundPattern;
}): ReactElement {
  switch (variant) {
    case "dots":
      return (
        <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="8" r="0.9" fill="currentColor" />
        </pattern>
      );
    case "grid":
      // Each line covers the half pixel from 12 to 12.5, whole device pixels at 1x and 2x alike.
      return (
        <pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse">
          <path
            d="M12.25 0V24M0 12.25H24"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.6"
            strokeWidth="0.5"
          />
        </pattern>
      );
    case "cross-hatch":
      // A finer grid turned 45 degrees, so its lines cross on the diagonals.
      return (
        <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M6 0V12M0 6H12" fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="0.5" />
        </pattern>
      );
    case "diagonal-lines":
      return (
        <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M2.5 0V5" stroke="currentColor" strokeOpacity="0.5" strokeWidth="0.5" />
        </pattern>
      );
    case "plus":
      return (
        <pattern id={id} width="15" height="15" patternUnits="userSpaceOnUse">
          <path
            d="M7.5 5V10M5 7.5H10"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.8"
            strokeWidth="0.6"
            strokeLinecap="round"
          />
        </pattern>
      );
    case "falling-triangles":
      // Two downward triangles half a tile apart on the diagonal, so every other column sits half a
      // tile lower.
      return (
        <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M2 3H7L4.5 7ZM10 11H15L12.5 15Z" fill="currentColor" fillOpacity="0.35" />
        </pattern>
      );
    case "4-pointed-star":
      return (
        <pattern id={id} width="18" height="18" patternUnits="userSpaceOnUse">
          <polygon
            points="9 5.5 9.9 8.1 12.5 9 9.9 9.9 9 12.5 8.1 9.9 5.5 9 8.1 8.1"
            fill="currentColor"
            fillOpacity="0.45"
          />
        </pattern>
      );
    case "tiny-checkers":
      return (
        <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 0H3V3H0ZM3 3H6V6H3Z" fill="currentColor" fillOpacity="0.15" />
        </pattern>
      );
    case "overlapping-circles":
      // Rings on a square lattice 11.3 px apart, each 15 px across, so neighbours cross in lenses.
      // A corner ring is a quarter in each of the four tiles that share the corner.
      return (
        <pattern id={id} width="16" height="16" patternUnits="userSpaceOnUse">
          {RINGS.map(([cx, cy]) => (
            <circle
              key={`${String(cx)} ${String(cy)}`}
              cx={cx}
              cy={cy}
              r="7.5"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.5"
              strokeWidth="0.5"
            />
          ))}
        </pattern>
      );
    case "wiggle-lines":
      // A wave 4 px high with a 16 px period, drawn from half a period before the tile to half a
      // period after it.
      return (
        <pattern id={id} width="16" height="12" patternUnits="userSpaceOnUse">
          <path
            d="M-8 6Q-4 10 0 6T8 6T16 6T24 6"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.7"
            strokeWidth="0.6"
          />
        </pattern>
      );
    case "bubbles":
      return (
        <pattern id={id} width="40" height="40" patternUnits="userSpaceOnUse">
          {BUBBLES.map(([cx, cy, r]) => (
            <circle
              key={`${String(cx)} ${String(cy)}`}
              cx={cx}
              cy={cy}
              r={r}
              fill="currentColor"
              fillOpacity="0.4"
            />
          ))}
        </pattern>
      );
  }
}

/**
 * A decorative pattern behind the marks, in the border role. A blurred alpha mask fades it out
 * toward the plot's edges, so the pattern shows most in the plot's middle. It is plot output that
 * readers skip, and it draws behind every mark wherever it sits among Root's children.
 *
 * @beta
 */
export function ChartBackground({ variant = "dots", className, style }: ChartBackgroundProps): ReactElement {
  const id = useSvgIdPrefix("chart-bg");
  const pattern = `${id}-pattern`;
  const mask = `${id}-fade`;
  const soften = `${id}-soften`;
  return (
    <svg
      data-slot="chart-background"
      data-variant={variant}
      aria-hidden="true"
      className={className}
      style={style}>
      <defs>
        <PatternTile id={pattern} variant={variant} />
        <filter id={soften}>
          <feGaussianBlur stdDeviation="25" />
        </filter>
        <mask id={mask} maskUnits="userSpaceOnUse" mask-type="alpha">
          <rect x="8%" y="20%" width="85%" height="60%" fill="currentColor" filter={`url(#${soften})`} />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${pattern})`} mask={`url(#${mask})`} />
    </svg>
  );
}

Object.assign(ChartBackground, { displayName: "Chart.Background" });
