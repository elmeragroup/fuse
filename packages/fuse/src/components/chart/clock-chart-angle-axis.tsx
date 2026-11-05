"use client";

/**
 * The clock's AngleAxis: the cycle's hours, weekdays or months past the rim, thinned by stride to
 * the dial's width. The first paint draws it at rest (D18).
 */
import type { ReactElement } from "react";

import { clockDrawingIn, usePolarContext } from "./chart-polar-context";
import type { ChartLayerProps, XFormat } from "./chart-types";
import { LABEL_REACH, labelPlace, minOf } from "./clock-chart-dial";
import { PlacedLabel } from "./clock-chart-placed-label";
import { formatSlot } from "./format/time-format";

/**
 * Props for `ClockChart.AngleAxis`, a closed part.
 *
 * @beta
 */
export type ClockChartAngleAxisProps = ChartLayerProps & {
  /** The label format. The cycle's own, hours, weekdays or months, is the default. */
  format?: XFormat;
};

/**
 * The cycle's labels past the rim: hours on their slot's start round a day, weekdays and months
 * centred on their span. They never rotate, they thin by stride as the dial narrows, keeping the
 * cycle's first, and they take the frame's gutter beside the dial.
 *
 * @beta
 */
export function ClockChartAngleAxis({ format, className, style }: ClockChartAngleAxisProps): ReactElement {
  const { model, box, kernel } = usePolarContext("ClockChart.AngleAxis", ["clock"]);
  const clock = clockDrawingIn(model, "ClockChart.AngleAxis");
  const timeZone = clock.text.model.domain.kind === "time" ? clock.text.model.domain.timeZone : "UTC";
  return (
    <div
      data-slot="clock-chart-angle-axis"
      data-polar-layer=""
      data-outside=""
      aria-hidden="true"
      className={className}
      style={style}>
      {clock.labels.map((label) => (
        <PlacedLabel
          key={label.start}
          dataSlot="clock-chart-angle-label"
          min={minOf(label.visibility)}
          hidden={label.visibility === "none"}
          place={labelPlace(box, label.angle, LABEL_REACH)}>
          {format === undefined
            ? label.text.text
            : formatSlot(kernel.locale, timeZone, label.start, label.unit, format, "tick").text}
        </PlacedLabel>
      ))}
    </div>
  );
}

Object.assign(ClockChartAngleAxis, { displayName: "ClockChart.AngleAxis" });
