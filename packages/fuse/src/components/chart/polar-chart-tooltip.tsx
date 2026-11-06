"use client";

/**
 * The polar families' Tooltip parts. Each is the shared tooltip body over the polar anchor, which
 * rests the popup in a lane beside or below the dial, and shows the active slice's, ring's or
 * spoke's label and rows by default. Where a popup may go is one rule for every family (R2.3, as
 * amended): like `Chart.Tooltip`'s, it may reach past its chart's box, below the figure, and it stays
 * inside the viewport, but it never covers its own dial, its labels or its title.
 */
import type { ReactElement } from "react";

import { usePolarTooltipAnchor } from "./chart-polar-anchor";
import type { TooltipPlacer } from "./chart-readout-port";
import { ChartSeriesLabel, ChartSwatch } from "./chart-series";
import type { ChartTooltipProps } from "./chart-tooltip";
import { ChartTooltipBody } from "./chart-tooltip-body";
import { ChartTooltipItems, ChartTooltipLabel, ChartTooltipValue } from "./chart-tooltip-parts";

/** The polar anchor, which rests the popup in a side lane beside the dial. */
const POLAR_PLACER: TooltipPlacer = { useAnchor: usePolarTooltipAnchor, keeps: "lane" };

/** The default content: the active item's label, then its rows, each a swatch, a label and a value. */
export function DefaultPolarTooltip(): ReactElement {
  return (
    <>
      <ChartTooltipLabel />
      <ChartTooltipItems>
        <ChartSwatch />
        <ChartSeriesLabel />
        <ChartTooltipValue />
      </ChartTooltipItems>
    </>
  );
}

/** The polar tooltip, its `anchor` prop left out because the lane decides where it rests. */
export function PolarTooltip({
  variant = "default",
  anchor: _anchor,
  children,
  ...props
}: ChartTooltipProps): ReactElement {
  return (
    <ChartTooltipBody variant={variant} placement="point" placer={POLAR_PLACER} {...props}>
      {children ?? <DefaultPolarTooltip />}
    </ChartTooltipBody>
  );
}

/**
 * The popup over the active slice. It rests at the dial's height in a side lane beside the dial,
 * outside the labels, and only its content changes from slice to slice. A side lane takes it only
 * when the lane's room holds its content; otherwise it rests below the dial and its labels. Like
 * `Chart.Tooltip`'s, it may reach past the chart's box, below it, and stays inside the viewport, but
 * it never covers its dial, its labels or its title. A change of lane fades it in. A pointer that
 * moves toward it past the rim keeps the slice. Escape closes it and keeps the reader's place. It is
 * hidden from screen readers, which read the same values from the option. `anchor` does nothing
 * here, since the lane decides where the popup rests.
 *
 * @beta
 */
export function PieChartTooltip(props: ChartTooltipProps): ReactElement {
  return <PolarTooltip {...props} />;
}

/**
 * The popup over the active ring. It rests at the dial's height in the side lane it opened in, beside
 * the dial and outside the labels, and only its content changes from ring to ring. A side lane takes
 * it only when the lane's room holds its content; otherwise it rests below the dial and its labels.
 * Like `Chart.Tooltip`'s, it may reach past the chart's box, below it, and stays inside the viewport,
 * but it never covers its dial, its labels or its title. Escape closes it and keeps the reader's
 * place. `anchor` does nothing here, since the lane decides where the popup rests.
 *
 * @beta
 */
export function RadialChartTooltip(props: ChartTooltipProps): ReactElement {
  return <PolarTooltip {...props} />;
}

/**
 * The popup over the active spoke, with one row per series, in a side lane beside the dial at the
 * height where the hand meets the outer ring, moving with the hand. A step that leaps across the dial
 * fades it in where the step lands, as a change of lane does. A side lane takes it only when the
 * lane's room holds its content; otherwise it rests below the dial and its labels. Like
 * `Chart.Tooltip`'s, it may reach past the chart's box, below it, and stays inside the viewport, but
 * it never covers its dial, its labels or its title. Escape closes it and keeps the reader's place.
 * `anchor` does nothing here, since the lane decides where the popup rests.
 *
 * @beta
 */
export function RadarChartTooltip(props: ChartTooltipProps): ReactElement {
  return <PolarTooltip {...props} />;
}

Object.assign(PolarTooltip, { displayName: "PolarChart.Tooltip" });
Object.assign(PieChartTooltip, { displayName: "PieChart.Tooltip" });
Object.assign(RadialChartTooltip, { displayName: "RadialChart.Tooltip" });
Object.assign(RadarChartTooltip, { displayName: "RadarChart.Tooltip" });
