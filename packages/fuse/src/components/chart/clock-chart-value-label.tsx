"use client";

/**
 * The clock's ValueLabel: the value of each slot its Marker marks, as a pill past the dot.
 */
import { use } from "react";
import type { ReactElement } from "react";

import { useLocale } from "../../intl/locale-context";
import { writeAttribute } from "./chart-dom";
import { ClockMarkerContext } from "./chart-marker-context";
import { clockDrawingIn, usePolarContext } from "./chart-polar-context";
import type { ChartLayerProps, ValueFormat } from "./chart-types";
import { formatValue } from "./format/value-format";
import { slotVertex } from "./layout/clock-path";
import { ChartCompositionError } from "./layout/errors";
import { angleLabel } from "./layout/polar-labels";

/**
 * Props for `ClockChart.ValueLabel`, a closed part.
 *
 * @beta
 */
export type ClockChartValueLabelProps = ChartLayerProps & {
  /** The value format. The series' config `format` is the default. */
  format?: ValueFormat;
};

/**
 * The value of each slot its Marker marks, as a pill past the dot at rest, reading away from the
 * centre. The pills hide while their Marker's dots enter or tween to new data, and show once the
 * dots rest. Outside a Marker it throws `part-outside-root`.
 *
 * @beta
 */
export function ClockChartValueLabel({ format, className, style }: ClockChartValueLabelProps): ReactElement {
  const marker = use(ClockMarkerContext);
  const polar = usePolarContext("ClockChart.ValueLabel", ["clock"]);
  const { locale } = useLocale();
  if (marker === null) {
    throw new ChartCompositionError(
      "ClockChart.ValueLabel",
      "part-outside-root",
      "must be used within ClockChart.Marker. Put it inside the Marker whose values it prints."
    );
  }
  const clock = clockDrawingIn(polar.model, "ClockChart.ValueLabel");
  const { box } = polar;
  const { series, slots, labels } = marker;
  const valueFormat = format ?? clock.text.config[series.key]?.format ?? {};
  return (
    <div
      ref={(node) => {
        if (node === null) return undefined;
        labels.nodes.add(node);
        writeAttribute(node, "data-moving", labels.moving ? "" : null);
        return () => {
          labels.nodes.delete(node);
          // Suspense keeps a hidden label's node, so it returns clean and takes the flag anew.
          node.removeAttribute("data-moving");
        };
      }}
      data-slot="clock-chart-value-labels"
      data-polar-layer=""
      aria-hidden="true"
      className={className}
      style={style}>
      {slots.flatMap((slot) => {
        const value = series.values[slot];
        if (value === null || value === undefined) return [];
        const vertex = slotVertex(series.rest, slot);
        const { point, alignX, alignY } = angleLabel(vertex.angle, vertex.radius + 0.08);
        const left = ((point.x - box.left) / (box.right - box.left)) * 100;
        const top = ((point.y - box.top) / (box.bottom - box.top)) * 100;
        return [
          <span
            key={slot}
            data-slot="clock-chart-value-label"
            style={{
              "--_x": `${left.toFixed(3)}%`,
              "--_y": `${top.toFixed(3)}%`,
              "--_align-x": `${String(-alignX * 100)}%`,
              "--_align-y": `${String(-alignY * 100)}%`,
            }}>
            {formatValue(locale, value, valueFormat, "full").text}
          </span>,
        ];
      })}
    </div>
  );
}

Object.assign(ClockChartValueLabel, { displayName: "ClockChart.ValueLabel" });
