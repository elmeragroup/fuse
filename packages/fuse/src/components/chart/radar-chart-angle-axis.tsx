"use client";

/**
 * The radar's AngleAxis: a label per spoke past the rim, centred on its spoke 6 px out, thinned by a
 * stride that divides the spoke count. The first paint draws it at rest (D18), and only a chart
 * nothing painted before fades its labels in as the entrance starts.
 */
import type { ReactElement } from "react";

import { useLabelWidths } from "./chart-label-widths";
import { radarDrawingIn, usePolarContext } from "./chart-polar-context";
import type { ChartLayerProps } from "./chart-types";
import { labelWidth } from "./layout/label-width";
import { polarPoint } from "./layout/polar-angle";
import { rayLabelOffset } from "./layout/polar-labels";
import { spokeAngle } from "./layout/radar";
import { percent, spokeLabelFit } from "./radar-chart-dial";

/**
 * Props for `RadarChart.AngleAxis`, a closed part.
 *
 * @beta
 */
export type RadarChartAngleAxisProps = ChartLayerProps;

/**
 * The spoke labels, one per row, each centred on its spoke past the rim, its nearest edge 6 px out.
 * They never rotate, and they take the frame's gutter beside the dial.
 *
 * @beta
 */
export function RadarChartAngleAxis({ className, style }: RadarChartAngleAxisProps): ReactElement {
  const { model, box } = usePolarContext("RadarChart.AngleAxis", ["radar"]);
  const radar = radarDrawingIn(model, "RadarChart.AngleAxis");
  const shown = spokeLabelFit(radar);
  const measured = useLabelWidths();
  return (
    <div
      ref={measured}
      data-slot="radar-chart-angle-axis"
      data-polar-layer=""
      data-outside=""
      aria-hidden="true"
      className={className}
      style={style}>
      {radar.labels.map((label, index) => {
        const angle = spokeAngle(index, radar.count);
        const rim = polarPoint(angle, 1);
        const [left, top] = percent(box, rim.x, rim.y);
        const offset = rayLabelOffset(angle, labelWidth(label.text), "outside");
        const min = shown[index] ?? "none";
        return (
          <span
            key={index}
            data-slot="radar-chart-angle-label"
            data-min={min === "always" || min === "none" ? undefined : min}
            data-hidden={min === "none" ? "" : undefined}
            style={{
              "--_x": `calc(${left} + ${offset.x})`,
              "--_y": `calc(${top} + ${offset.y})`,
              "--_align-x": "-50%",
              "--_align-y": "-50%",
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
