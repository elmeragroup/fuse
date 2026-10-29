"use client";

import { use } from "react";
import type { ReactElement, ReactNode } from "react";

import { ChartDatumContext } from "./chart-active-value";
import { useChartRoot } from "./chart-context";
import { readingAt, useActivePoint } from "./chart-readout";
import type { ChartDatum, ChartLayerProps, ValueFormat } from "./chart-types";
import { formatValue } from "./format/value-format";

/**
 * Props for `Chart.Dots`, a closed part.
 *
 * @beta
 */
export type ChartDotsProps = ChartLayerProps & {
  /** The series whose readings get a dot. */
  dataKey: string;
  /** The dot's look. "default" by default. */
  variant?: "default" | "ring" | "halo";
};

/**
 * Props for `Chart.ActiveDot`, a closed part.
 *
 * @beta
 */
export type ChartActiveDotProps = ChartLayerProps & {
  /** The series the dot follows. */
  dataKey: string;
  /** The dot's look. "default" by default. */
  variant?: "default" | "ring" | "halo" | "ping";
};

/**
 * Props for `Chart.Marker`, a closed part.
 *
 * @beta
 */
export type ChartMarkerProps = ChartLayerProps & {
  /** The series the marker sits on. */
  dataKey: string;
  /** The slots to mark. An x string on a time axis throws `x-type-mismatch`. */
  at: ChartDatum;
  /** The dot's look. "default" by default. */
  variant?: "default" | "ring" | "halo" | "ping";
  /** A `ValueLabel` adds the value as a pill beside the dot. */
  children?: ReactNode;
};

/**
 * Props for `Chart.ValueLabel`, a closed part.
 *
 * @beta
 */
export type ChartValueLabelProps = ChartLayerProps & {
  /** The value format. The series' config `format` is the default. */
  format?: ValueFormat;
};

/**
 * A dot on every reading of one series.
 *
 * @beta
 */
export function ChartDots(_props: ChartDotsProps): ReactElement {
  return <></>;
}

/**
 * The dot on one series at the active slot. Write one per series that needs one.
 *
 * @beta
 */
export function ChartActiveDot(_props: ChartActiveDotProps): ReactElement {
  return <></>;
}

/**
 * A resting dot on one series at the slots `at` selects, such as the current slot, the latest
 * reading or the minimum, as the Figma price chart's Now indicator draws. It is plot output that
 * readers skip, and the option and description carry its meaning.
 *
 * @beta
 */
export function ChartMarker(_props: ChartMarkerProps): ReactElement {
  return <></>;
}

/**
 * The value of the enclosing Marker's or ActiveValueLine's datum, as a pill. It is plot output that
 * readers skip, because the option carries the value.
 *
 * @beta
 */
export function ChartValueLabel({ format, className, style }: ChartValueLabelProps): ReactElement {
  const context = useChartRoot("Chart.ValueLabel");
  const datum = use(ChartDatumContext);
  const point = useActivePoint(context, datum?.slot === null);
  const slot = datum?.slot ?? point.slot;
  const reading = datum === null || slot === null ? undefined : readingAt(context, datum.key, slot);
  const text =
    datum !== null && reading?.kind === "reading"
      ? formatValue(context.locale, reading.value, format ?? context.config[datum.key]?.format ?? {}, "tick")
          .text
      : null;
  return (
    <span data-slot="chart-value-label" aria-hidden="true" className={className} style={style}>
      {text}
    </span>
  );
}

Object.assign(ChartDots, { displayName: "Chart.Dots" });
Object.assign(ChartActiveDot, { displayName: "Chart.ActiveDot" });
Object.assign(ChartMarker, { displayName: "Chart.Marker" });
Object.assign(ChartValueLabel, { displayName: "Chart.ValueLabel" });
