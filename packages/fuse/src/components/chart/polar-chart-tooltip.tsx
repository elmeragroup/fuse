"use client";

/**
 * The polar families' Tooltip parts. Each is the shared tooltip body over the polar anchor, which
 * rests the popup's centre on the active ray just outside the rim and orbits it round the dial, and
 * shows the active slice's, ring's or spoke's label and rows by default.
 */
import type { ReactElement } from "react";

import { usePolarTooltipAnchor } from "./chart-polar-anchor";
import type { TooltipPlacer } from "./chart-readout-port";
import { ChartSeriesLabel, ChartSwatch } from "./chart-series";
import type { ChartTooltipProps } from "./chart-tooltip";
import { ChartTooltipBody } from "./chart-tooltip-body";
import { ChartTooltipItems, ChartTooltipLabel, ChartTooltipValue } from "./chart-tooltip-parts";

/** The polar anchor, which rests the popup on the active ray. */
const POLAR_PLACER: TooltipPlacer = { useAnchor: usePolarTooltipAnchor };

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

/** The polar tooltip, its `anchor` prop left out because the ray decides where it rests. */
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
 * The popup over the active slice. Its centre sits on the slice's bisector just outside the rim, at
 * any angle, and a step glides it round the dial the short way, so it never crosses the centre. A
 * pointer that moves toward it from the slice keeps the slice. Escape closes it and keeps the
 * reader's place. It is hidden from screen readers, which read the same values from the option.
 * `anchor` does nothing here, since the ray decides where the popup rests.
 *
 * @beta
 */
export function PieChartTooltip(props: ChartTooltipProps): ReactElement {
  return <PolarTooltip {...props} />;
}

/**
 * The popup over the active ring, centred on the ray through the ring's value end just outside
 * the rim. It glides round the dial the short way. Escape closes it and keeps the reader's place.
 * `anchor` does nothing here, since the ray decides where the popup rests.
 *
 * @beta
 */
export function RadialChartTooltip(props: ChartTooltipProps): ReactElement {
  return <PolarTooltip {...props} />;
}

/**
 * The popup over the active spoke, centred on the spoke just outside the outer ring, with one row
 * per series. It glides round the dial the short way. Escape closes it and keeps the reader's place.
 * `anchor` does nothing here, since the ray decides where the popup rests.
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
