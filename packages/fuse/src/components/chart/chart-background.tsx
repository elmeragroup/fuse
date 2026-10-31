"use client";

// The pattern tiles in this file port SVG paths from evilcharts by Gurbinder, which ships under the
// MIT license. The published package carries that notice in LICENSE-evilcharts at its root.

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

/**
 * Each pattern's tile, ported from evilcharts' `recharts-background.tsx` at commit ecbd6a5 with its
 * sizes, paths and opacities unchanged. Every tile paints `currentColor`, the border role.
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
        <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="currentColor" />
        </pattern>
      );
    case "grid":
      return (
        <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" />
        </pattern>
      );
    case "cross-hatch":
      return (
        <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <path
            d="M 0 0 L 20 20 M 20 0 L 0 20"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.6"
            strokeWidth="0.5"
          />
        </pattern>
      );
    case "diagonal-lines":
      return (
        <pattern
          id={id}
          x="0"
          y="0"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="0.5" />
        </pattern>
      );
    case "plus":
      return (
        <pattern id={id} x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
          <path
            d="M 8 4 L 8 12 M 4 8 L 12 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            strokeLinecap="round"
          />
        </pattern>
      );
    case "falling-triangles":
      return (
        <pattern id={id} x="0" y="0" width="18" height="36" patternUnits="userSpaceOnUse">
          <path
            d="M2 6h12L8 18 2 6zm18 36h12l-6 12-6-12z"
            transform="scale(0.5)"
            fill="currentColor"
            fillOpacity="0.4"
          />
        </pattern>
      );
    case "4-pointed-star":
      return (
        <pattern id={id} x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
          <polygon
            fillRule="evenodd"
            points="5 3 8 4 5 5 4 8 3 5 0 4 3 3 4 0 5 3"
            fill="currentColor"
            fillOpacity="0.4"
          />
        </pattern>
      );
    case "tiny-checkers":
      return (
        <pattern id={id} x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
          <path fillRule="evenodd" d="M0 0h4v4H0V0zm4 4h4v4H4V4z" fill="currentColor" fillOpacity="0.2" />
        </pattern>
      );
    case "overlapping-circles":
      return (
        <pattern id={id} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            fillRule="evenodd"
            d="M25 25c0-2.762 2.238-5 5-5s5 2.238 5 5-2.238 5-5 5c0 2.762-2.238 5-5 5s-5-2.238-5-5 2.238-5 5-5zM5 5c0-2.762 2.238-5 5-5s5 2.238 5 5-2.238 5-5 5c0 2.762-2.238 5-5 5S0 12.762 0 10s2.238-5 5-5zm5 4c2.209 0 4-1.791 4-4s-1.791-4-4-4-4 1.791-4 4 1.791 4 4 4zm20 20c2.209 0 4-1.791 4-4s-1.791-4-4-4-4 1.791-4 4 1.791 4 4 4z"
            fill="currentColor"
            fillOpacity="0.4"
          />
        </pattern>
      );
    case "wiggle-lines":
      return (
        <pattern
          id={id}
          x="0"
          y="0"
          width="52"
          height="26"
          patternUnits="userSpaceOnUse"
          patternTransform="scale(0.6)">
          <path
            d="M10 10c0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6h2c0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4v2c-3.314 0-6-2.686-6-6 0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6zm25.464-1.95l8.486 8.486-1.414 1.414-8.486-8.486 1.414-1.414z"
            fill="currentColor"
            fillOpacity="0.4"
          />
        </pattern>
      );
    case "bubbles":
      return (
        <pattern
          id={id}
          x="0"
          y="0"
          width="100"
          height="100"
          patternUnits="userSpaceOnUse"
          patternTransform="scale(0.6667)">
          <path
            d="M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z"
            fill="currentColor"
            fillOpacity="0.4"
            fillRule="evenodd"
          />
        </pattern>
      );
  }
}

/**
 * A decorative pattern behind the marks, in the border role, fading out toward the plot's edges as
 * evilcharts' background does. It is plot output that readers skip, and it draws behind every
 * mark wherever it sits among Root's children.
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
