"use client";

/**
 * The glow of a series that a scale or a threshold paints by value. `Chart.Glow`'s CSS drop-shadow
 * casts one colour per series, so a series of several colours glows through this filter instead:
 * it blurs the marks' own pixels, so each halo takes the colour of the mark it surrounds. For a
 * mark of one colour it draws what `drop-shadow(0 0 <deviation> <colour at alpha>)` draws, the
 * function's length being the Gaussian's standard deviation.
 */
import type { ReactElement } from "react";

import type { PlotFrame } from "./layout/plot-frame";

/** How far a halo reaches, in standard deviations, before it fades below a 1 % alpha. */
const REACH = 3;

/**
 * The filter a value-painted series' marks glow through, which `chart.css` applies only inside
 * `Chart.Glow`.
 *
 * @param props - The filter's id, the frame its marks draw in, the blur's standard deviation in
 *   CSS pixels and the halo's alpha.
 * @returns The filter element.
 */
export function ValueGlowFilter({
  id,
  frame,
  deviation,
  alpha,
}: {
  readonly id: string;
  readonly frame: PlotFrame;
  readonly deviation: number;
  readonly alpha: number;
}): ReactElement {
  const margin = deviation * REACH;
  // The region sits in the marks' user space, so a flat line, whose box has no height, still glows.
  return (
    <filter
      id={id}
      filterUnits="userSpaceOnUse"
      x={-margin}
      y={-margin}
      width={frame.box.width + 2 * margin}
      height={frame.box.height + 2 * margin}
      colorInterpolationFilters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation={deviation} result="blur" />
      <feComponentTransfer in="blur" result="halo">
        <feFuncA type="linear" slope={alpha} />
      </feComponentTransfer>
      <feMerge>
        <feMergeNode in="halo" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

Object.assign(ValueGlowFilter, { displayName: "Chart.ValueGlowFilter" });
