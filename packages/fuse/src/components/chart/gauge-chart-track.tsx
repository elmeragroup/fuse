"use client";

/**
 * A gauge's track, its fill and its glow. Each is a layer of the dial in `gauge-chart-dial`: the
 * track draws every notch or the whole band in the muted role, the fill lights them up to the
 * reading, and the glow casts the lit part's own paint behind it.
 */
import type { ReactElement } from "react";

import type {
  ChartCategoricalRole,
  ChartLayerProps,
  ChartSentimentRole,
  ChartSequentialRole,
} from "./chart-types";
import { GaugeDialLayer } from "./gauge-chart-dial";

/**
 * The colour roles a gauge's fill and its zones take: a categorical role, a step of the sequential
 * ramp, or a sentiment role for a reading that is good or bad.
 *
 * @beta
 */
export type ChartGaugeRole = ChartCategoricalRole | ChartSequentialRole | ChartSentimentRole;

/**
 * Props for `GaugeChart.Track`, a closed part.
 *
 * @beta
 */
export type GaugeChartTrackProps = ChartLayerProps & {
  /**
   * The track's look, which `Fill` and `Glow` follow. "notches" draws 40 notches over the sweep,
   * every notch and every gap alike; "solid" draws one band with softly rounded ends. "notches" by
   * default.
   */
  variant?: "notches" | "solid";
};

/**
 * Props for `GaugeChart.Fill`, a closed part.
 *
 * @beta
 */
export type GaugeChartFillProps = ChartLayerProps & {
  /** The fill's colour role. "chart-1" by default. */
  color?: ChartGaugeRole;
};

/**
 * Props for `GaugeChart.Glow`, a closed part.
 *
 * @beta
 */
export type GaugeChartGlowProps = ChartLayerProps & {
  /** The glow's colour role, the Fill's own. "chart-1" by default. */
  color?: ChartGaugeRole;
};

/**
 * The unfilled sweep, in the muted role: 40 notches, every notch and every gap alike, each gap a
 * whole number of device pixels, or with `variant="solid"` one band with softly rounded ends. It draws at
 * once, before the entrance, and scales out from the centre as the chart comes into view. It sits
 * inside a `ProgressRing`, a `Zone` band and an outside `Ruler`, which the dial makes room for at
 * the rim. A gauge may leave it out and let a `Sector`, a `ProgressRing` or `Dots` carry the
 * reading. Render it
 * as a direct child of Root, as every part is, so `Fill` and `Glow` follow its variant.
 *
 * @beta
 */
export function GaugeChartTrack({
  variant = "notches",
  className,
  style,
}: GaugeChartTrackProps): ReactElement {
  return (
    <GaugeDialLayer
      slot="gauge-chart-track"
      reach="track"
      attributes={{ "data-variant": variant }}
      className={className}
      style={style}
    />
  );
}

/**
 * The reading on the track: the notches it passes, lit, at least one for any value above `min`,
 * or the band up to it. It sweeps in from `min` on first view, lighting each notch as it passes,
 * and sweeps on from where it shows to each new value.
 *
 * @beta
 */
export function GaugeChartFill({ color = "chart-1", className, style }: GaugeChartFillProps): ReactElement {
  return (
    <GaugeDialLayer
      slot="gauge-chart-fill"
      reach="reading"
      className={className}
      style={{ "--_paint": `var(--${color})`, ...style }}
    />
  );
}

/**
 * A glow behind the fill: the lit notches or the band, cast in their own paint at half alpha and
 * blurred, as `Chart.Glow` casts a bar's halo. It moves with the fill in every frame.
 *
 * @beta
 */
export function GaugeChartGlow({ color = "chart-1", className, style }: GaugeChartGlowProps): ReactElement {
  return (
    <GaugeDialLayer
      slot="gauge-chart-glow"
      reach="reading"
      className={className}
      style={{ "--_paint": `var(--${color})`, ...style }}
    />
  );
}

Object.assign(GaugeChartTrack, { displayName: "GaugeChart.Track" });
Object.assign(GaugeChartFill, { displayName: "GaugeChart.Fill" });
Object.assign(GaugeChartGlow, { displayName: "GaugeChart.Glow" });
