"use client";

/**
 * The clock's AngleAxis: the cycle's hours, weekdays or months past the rim, each centred on its
 * ray 6 px out, thinned by stride to the dial's width. The first paint draws it at rest.
 */
import type { ReactElement } from "react";

import { useLabelWidths } from "./chart-label-widths";
import { clockDrawingIn, usePolarContext } from "./chart-polar-context";
import type { ChartLayerProps, XFormat } from "./chart-types";
import { minOf, rayPlace } from "./clock-chart-dial";
import { PlacedLabel } from "./clock-chart-placed-label";
import { formatSlot } from "./format/time-format";
import { labelWidth } from "./layout/label-width";

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
 * cycle's first, by the widths of the text they print, a `format`'s included, and they take the
 * frame's gutter beside the dial.
 *
 * @beta
 */
export function ClockChartAngleAxis({ format, className, style }: ClockChartAngleAxisProps): ReactElement {
  const { model, box, kernel } = usePolarContext("ClockChart.AngleAxis", ["clock"]);
  const clock = clockDrawingIn(model, "ClockChart.AngleAxis");
  const timeZone = clock.text.model.domain.kind === "time" ? clock.text.model.domain.timeZone : "UTC";
  const text = (label: (typeof clock.labels)[number]): string =>
    format === undefined
      ? label.text.text
      : formatSlot(kernel.locale, timeZone, label.start, label.unit, format, "tick").text;
  // A format of its own thins its labels by the widths it prints, as the cycle's labels thin by theirs.
  const visibility =
    format === undefined
      ? clock.labels.map((label) => label.visibility)
      : clock.fitLabels(clock.labels.map(text));
  const measured = useLabelWidths();
  return (
    <div
      ref={measured}
      data-slot="clock-chart-angle-axis"
      data-polar-layer=""
      data-outside=""
      aria-hidden="true"
      className={className}
      style={style}>
      {clock.labels.map((label, index) => (
        <PlacedLabel
          key={label.start}
          dataSlot="clock-chart-angle-label"
          min={minOf(visibility[index] ?? "none")}
          hidden={(visibility[index] ?? "none") === "none"}
          place={rayPlace(box, label.angle, labelWidth(text(label)), "outside")}>
          {text(label)}
        </PlacedLabel>
      ))}
    </div>
  );
}

Object.assign(ClockChartAngleAxis, { displayName: "ClockChart.AngleAxis" });
