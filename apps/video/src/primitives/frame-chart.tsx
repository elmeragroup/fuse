import type { ReactElement } from "react";

import { useCurrentFrame } from "remotion";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig, ChartRootProps, ChartRowOf, ChartXKey } from "@elmeragroup/fuse/chart";

/**
 * Fills the box the caller gives the chart: the figure takes the box's height, its frame takes the
 * figure's, and the plot row takes what the axis and the legend leave. Fuse sets a fixed plot
 * height in its components layer, which a utility outranks.
 */
const FILL_BOX = "h-full min-h-0 grid-rows-[minmax(0,1fr)] [--chart-plot-height:minmax(0,1fr)]";

/**
 * Props for {@link FrameChart}: `Chart.Root`'s, without `data-intro`, which the frame owns.
 *
 * @template TRow - The row type, inferred from `data`.
 * @template TConfig - The config, inferred with its literal keys.
 * @template TXKey - The x column, inferred from `xKey`.
 */
export type FrameChartProps<
  TRow extends ChartRowOf<TRow>,
  TConfig extends ChartConfig,
  TXKey extends ChartXKey<TRow>,
> = ChartRootProps<TRow, TConfig, TXKey> & {
  /** The frame draws every chart at rest, so a caller sets no entrance. */
  readonly "data-intro"?: never;
};

/**
 * A Fuse chart as one frame of the video draws it: `Chart.Root` with its marks at rest, filling the
 * height of the box its caller sizes, and measured again on every frame of its scene.
 *
 * - `data-intro="none"` draws the marks at rest at once. A Fuse entrance plays on a
 *   `requestAnimationFrame` loop after an IntersectionObserver reports, and no seek reaches either.
 * - Root measures its plot in a layout effect and draws the marks in the render React runs right
 *   after, inside the commit, so every hold the frame has is still held while they draw, and a
 *   frame is never captured with the plot's loader in their place.
 * - Root snaps the marks to device pixels from where the plot sits on the page, which a scale or a
 *   translate on an ancestor moves. It measures again in each of its commits, so the chart calls
 *   `useCurrentFrame`, which Remotion answers through context, and commits on every frame, below a
 *   parent that keeps its element too, as the collage keeps its plates. Each frame then snaps from
 *   where that frame puts the plot, whatever rendered before it.
 *
 * Pass data, config and every other prop that is the same on every frame, such as module
 * constants: a data change plays a tween on Fuse's loop, which no seek reaches either. A chart
 * whose data must change, as the site's prices do with the brand's market, takes a `key` that
 * changes with it, so it mounts anew and draws at rest. Reveal a chart by animating a wrapper.
 *
 * @returns The chart.
 */
export function FrameChart<
  TRow extends ChartRowOf<TRow>,
  TConfig extends ChartConfig,
  TXKey extends ChartXKey<TRow>,
>(props: FrameChartProps<TRow, TConfig, TXKey>): ReactElement {
  // The frame's value is unused: the call alone makes Remotion render the chart on every frame.
  useCurrentFrame();
  const { className } = props;
  return (
    <Chart.Root<TRow, TConfig, TXKey>
      {...props}
      className={className === undefined ? FILL_BOX : `${FILL_BOX} ${className}`}
      data-intro="none"
    />
  );
}
