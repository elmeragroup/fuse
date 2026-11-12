"use client";

/**
 * The text in a gauge's middle: the reading, whose digits roll, and lines of text beside it. The
 * centre is plot output, hidden from readers, who read the same value from the meter.
 */
import type { ReactElement, ReactNode } from "react";

import { useCentreFit } from "./chart-centre-fit";
import { ChartDigitRoll } from "./chart-digit-roll";
import { useGaugeContext } from "./chart-gauge-context";
import type { ChartLayerProps, ValueFormat } from "./chart-types";
import { ChartValueRun } from "./chart-value-run";
import { formatValueRun } from "./format/value-format";

/**
 * Props for `GaugeChart.Center`, a closed part.
 *
 * @beta
 */
export type GaugeChartCenterProps = ChartLayerProps & {
  /** The centre's content, such as `CenterValue` over a `CenterLabel`. */
  children?: ReactNode;
};

/**
 * Props for `GaugeChart.CenterValue`, a closed part.
 *
 * @beta
 */
export type GaugeChartCenterValueProps = ChartLayerProps & {
  /** The value format. Root's `valueFormat` by default. */
  format?: ValueFormat;
};

/**
 * Props for `GaugeChart.CenterLabel`, a closed part.
 *
 * @beta
 */
export type GaugeChartCenterLabelProps = ChartLayerProps & {
  /** The label text, such as "kWh this hour". */
  children?: ReactNode;
};

/**
 * The text in the dial's middle. Its parts sit in a box inside the needle's reach, kept to the
 * sweep's box, which scales in with the track. The value's unit reads small beside its number. Its
 * text never shrinks below 12 px: when the lines overflow the box it drops every line but the
 * value, and then the value.
 *
 * @beta
 */
export function GaugeChartCenter({ children, className, style }: GaugeChartCenterProps): ReactElement {
  const { model } = useGaugeContext("GaugeChart.Center");
  const fitted = useCentreFit();
  const { box } = model;
  return (
    <div
      data-slot="gauge-chart-center"
      data-polar-layer=""
      aria-hidden="true"
      className={className}
      style={{
        "--_box-l": box.left,
        "--_box-t": box.top,
        "--_box-r": box.right,
        "--_box-b": box.bottom,
        ...style,
      }}>
      <div ref={fitted} data-part="hole">
        {children}
      </div>
    </div>
  );
}

/**
 * The reading in Root's value format, its true number even past either end of the dial. Its digits
 * count up with the entrance's sweep and roll to each new value. It prints nothing while the chart
 * has no reading.
 *
 * @beta
 */
export function GaugeChartCenterValue({
  format,
  className,
  style,
}: GaugeChartCenterValueProps): ReactElement {
  const { model } = useGaugeContext("GaugeChart.CenterValue");
  const { reading, locale } = model;
  const run =
    reading.kind === "value" ? formatValueRun(locale, reading.value, format ?? model.format, "full") : null;
  return (
    <span data-slot="gauge-chart-center-value" className={className} style={style}>
      {run === null ? null : <ChartValueRun run={run} number={<ChartDigitRoll text={run.number} />} />}
    </span>
  );
}

/**
 * A text line in the centre, such as what the reading measures. It is left out of a centre narrower
 * than 4rem, and when the lines overflow the centre.
 *
 * @beta
 */
export function GaugeChartCenterLabel({
  children,
  className,
  style,
}: GaugeChartCenterLabelProps): ReactElement {
  useGaugeContext("GaugeChart.CenterLabel");
  return (
    <span data-slot="gauge-chart-center-label" className={className} style={style}>
      {children}
    </span>
  );
}

Object.assign(GaugeChartCenter, { displayName: "GaugeChart.Center" });
Object.assign(GaugeChartCenterValue, { displayName: "GaugeChart.CenterValue" });
Object.assign(GaugeChartCenterLabel, { displayName: "GaugeChart.CenterLabel" });
