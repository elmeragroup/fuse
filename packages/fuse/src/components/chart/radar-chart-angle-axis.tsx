"use client";

/**
 * The radar's AngleAxis: a label per spoke past the rim, reading away from the centre, thinned by a
 * stride that divides the spoke count. The first paint draws it at rest (D18), and only a chart
 * nothing painted before fades its labels in as the entrance starts.
 */
import type { ReactElement } from "react";

import { radarDrawingIn, usePolarContext } from "./chart-polar-context";
import type { ChartLayerProps } from "./chart-types";
import { angleLabel } from "./layout/polar-labels";
import { spokeAngle } from "./layout/radar";
import { LABEL_REACH, percent, spokeLabelFit } from "./radar-chart-dial";

/**
 * Props for `RadarChart.AngleAxis`, a closed part.
 *
 * @beta
 */
export type RadarChartAngleAxisProps = ChartLayerProps;

/**
 * The spoke labels, one per row, each past the rim on its spoke and reading away from the centre.
 * They never rotate, and they take the frame's gutter beside the dial.
 *
 * @beta
 */
export function RadarChartAngleAxis({ className, style }: RadarChartAngleAxisProps): ReactElement {
  const { model, box } = usePolarContext("RadarChart.AngleAxis", ["radar"]);
  const radar = radarDrawingIn(model, "RadarChart.AngleAxis");
  const shown = spokeLabelFit(radar);
  return (
    <div
      data-slot="radar-chart-angle-axis"
      data-polar-layer=""
      data-outside=""
      aria-hidden="true"
      className={className}
      style={style}>
      {radar.labels.map((label, index) => {
        const { point, alignX, alignY } = angleLabel(spokeAngle(index, radar.count), LABEL_REACH);
        const [left, top] = percent(box, point.x, point.y);
        const min = shown[index] ?? "none";
        return (
          <span
            key={index}
            data-slot="radar-chart-angle-label"
            data-min={min === "always" || min === "none" ? undefined : min}
            data-hidden={min === "none" ? "" : undefined}
            style={{
              "--_x": left,
              "--_y": top,
              "--_align-x": `${String(-alignX * 100)}%`,
              "--_align-y": `${String(-alignY * 100)}%`,
              "--chart-slot": index,
            }}>
            {label.text}
          </span>
        );
      })}
    </div>
  );
}

Object.assign(RadarChartAngleAxis, { displayName: "RadarChart.AngleAxis" });
