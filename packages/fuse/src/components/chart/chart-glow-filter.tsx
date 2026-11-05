"use client";

/**
 * The glow of a series that a scale or a threshold paints by value. `Chart.Glow`'s CSS drop-shadow
 * casts one colour per series, so a series of several colours glows through this filter instead:
 * it blurs the marks' own pixels, so each halo takes the colour of the mark it surrounds. For a
 * mark of one colour it draws what `drop-shadow(0 0 <deviation> <colour at alpha>)` draws, the
 * function's length being the Gaussian's standard deviation.
 */
import type { ReactElement } from "react";

import type { SeriesPaint } from "./chart-paint";

/** A halo: the blur's standard deviation in CSS pixels and the halo's alpha. */
type Halo = { readonly deviation: number; readonly alpha: number };

/**
 * The user space a series' marks draw in: the box they cover, and how many CSS pixels one unit of
 * it spans, 1 for a plot drawn in pixels and the dial's scale for a dial drawn in its own units.
 */
export type GlowRegion = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly unit: number;
};

/**
 * The halo of a Line or an Area. It matches the 9.5 px full-alpha shadow that `chart.css` gives
 * `chart-line-series` and `chart-area-series` inside `Chart.Glow`, so change both together.
 */
export const PATH_GLOW: Halo = { deviation: 9.5, alpha: 1 };

/**
 * The halo of a Bar. It matches the 8 px half-alpha shadow that `chart.css` gives
 * `chart-bar-series` inside `Chart.Glow`, so change both together.
 */
export const BAR_GLOW: Halo = { deviation: 8, alpha: 0.5 };

/** How far a halo reaches, in standard deviations, before it fades below a 1 % alpha. */
const REACH = 3;

/** The filter a value-painted series' marks glow through. */
function ValueGlowFilter({
  id,
  region,
  halo,
}: {
  readonly id: string;
  readonly region: GlowRegion;
  readonly halo: Halo;
}): ReactElement {
  const { alpha } = halo;
  const deviation = halo.deviation / region.unit;
  const margin = deviation * REACH;
  // The region sits in the marks' user space, so a flat line, whose box has no height, still glows.
  return (
    <filter
      id={id}
      filterUnits="userSpaceOnUse"
      x={region.x - margin}
      y={region.y - margin}
      width={region.width + 2 * margin}
      height={region.height + 2 * margin}
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

/** What a series painted by value writes so that `Chart.Glow` blurs it through its own filter. */
export type ValueGlow = {
  /** The series element's `data-paint`, on which `chart.css` swaps the series' shadow for the filter. */
  readonly paint: "value";
  /** The series element's `--_glow`, which `chart.css` applies only inside `Chart.Glow`. */
  readonly url: string;
  /** The filter, for the series' `<defs>`, over the region its marks draw in. */
  readonly filter: (region: GlowRegion) => ReactElement;
};

/**
 * The glow wiring of one series.
 *
 * @param paint - The series paint.
 * @param prefix - The series' SVG id prefix.
 * @param halo - `PATH_GLOW` or `BAR_GLOW`.
 * @returns The wiring for a scale or a threshold, or null for a role or a role list, which glow
 *   through the CSS shadow.
 */
export function valueGlow(paint: SeriesPaint, prefix: string, halo: Halo): ValueGlow | null {
  if (paint.bins === undefined) return null;
  const id = `${prefix}-glow`;
  return {
    paint: "value",
    url: `url(#${id})`,
    filter: (region) => <ValueGlowFilter id={id} region={region} halo={halo} />,
  };
}

/**
 * A plot's glow region: its box, drawn in CSS pixels.
 *
 * @param box - The plot's width and height.
 * @returns The region.
 */
export function plotGlowRegion(box: { readonly width: number; readonly height: number }): GlowRegion {
  return { x: 0, y: 0, width: box.width, height: box.height, unit: 1 };
}
