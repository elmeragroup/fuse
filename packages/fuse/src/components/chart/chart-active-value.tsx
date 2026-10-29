"use client";

import { createContext, use } from "react";
import type { ReactElement, ReactNode } from "react";

import { assertKnownKey, useChartLayout, useChartRoot } from "./chart-context";
import { ChartHeadlineContext } from "./chart-headline";
import { fallbackSlot, readingAt, useActivePoint } from "./chart-readout";
import type { ChartFallback, ChartLayerProps, ValueFormat } from "./chart-types";
import { formatValue } from "./format/value-format";
import { followerGeometry } from "./layout/followers";
import { slotCentre } from "./layout/plot-geometry";

/**
 * Props for `Chart.ActiveValue`, a closed part.
 *
 * @beta
 */
export type ChartActiveValueProps = ChartLayerProps & {
  /** The series to print. */
  dataKey: string;
  /** The datum to print when nothing is active. "last" by default. */
  fallback?: ChartFallback;
  /** The value format. The series' config `format` is the default. */
  format?: ValueFormat;
};

/**
 * Props for `Chart.ActiveValueLine`, a closed part.
 *
 * @beta
 */
export type ChartActiveValueLineProps = ChartLayerProps & {
  /** The series whose active value the line marks. */
  dataKey: string;
  /** A `ValueLabel` adds the value as a pill at the value axis. */
  children?: ReactNode;
};

/**
 * The datum a ValueLabel prints, which the enclosing ActiveValueLine or Marker provides: a key and
 * a slot, or the active slot when `slot` is null.
 */
export const ChartDatumContext = createContext<{ readonly key: string; readonly slot: number | null } | null>(
  null
);

/**
 * The value at the active slot, or the `fallback` value when nothing is active, "last" by default.
 * Inside a Headline it is exposed text, with a visually hidden spoken twin wherever the spoken form
 * differs, such as a negative price. Anywhere else it is plot output that readers skip.
 *
 * @beta
 */
export function ChartActiveValue({
  dataKey,
  fallback = "last",
  format,
  className,
  style,
}: ChartActiveValueProps): ReactElement {
  const context = useChartRoot("Chart.ActiveValue");
  const layout = useChartLayout("Chart.ActiveValue");
  assertKnownKey("Chart.ActiveValue", context.config, dataKey);
  const exposed = use(ChartHeadlineContext);
  const point = useActivePoint(context, true);
  const slot = point.slot ?? fallbackSlot(context, dataKey, fallback);
  const reading = slot === null ? undefined : readingAt(context, dataKey, slot);
  const label =
    reading?.kind === "reading"
      ? formatValue(context.locale, reading.value, format ?? context.config[dataKey]?.format ?? {}, "full")
      : null;
  if (!exposed) {
    // Plot output. Placed directly in Root it sits above the active bar, or above the fallback
    // datum while nothing is active, and it moves with the bars on a data update.
    const series = context.model.series.find(({ key }) => key === dataKey);
    const window = context.model.window;
    const at = window === null || slot === null ? 0 : slotCentre(window, slot, context.xScale);
    // The value's own end through the nearest layout, below zero for a negative bar.
    const geometry =
      series === undefined || slot === null
        ? null
        : followerGeometry(context.model, series, slot, layout.y.domain);
    const top = geometry?.endpoint ?? 0;
    const n = String(series?.seriesIndex ?? 0);
    return (
      <span
        data-slot="chart-active-value"
        data-follow=""
        aria-hidden="true"
        className={className}
        style={{
          "--chart-value-at": `var(--chart-active-at, ${String(at)})`,
          "--chart-value-top": `calc(var(--chart-e-${n}, ${String(top)}) * 1%)`,
          ...style,
        }}>
        {label?.text}
      </span>
    );
  }
  return (
    <span data-slot="chart-active-value" className={className} style={style}>
      {label === null || label.text === label.spoken ? (
        label?.text
      ) : (
        <>
          <span aria-hidden="true">{label.text}</span>
          <span data-spoken="">{label.spoken}</span>
        </>
      )}
    </span>
  );
}

/**
 * A line across the plot at the active value. A `ValueLabel` child adds the value as a pill at the
 * value axis. It follows the pointer through Root's custom properties.
 *
 * @beta
 */
export function ChartActiveValueLine({
  dataKey,
  className,
  style,
  children,
}: ChartActiveValueLineProps): ReactElement {
  const context = useChartRoot("Chart.ActiveValueLine");
  assertKnownKey("Chart.ActiveValueLine", context.config, dataKey);
  const seriesIndex = String(context.model.series.find((series) => series.key === dataKey)?.seriesIndex ?? 0);
  return (
    <div
      data-slot="chart-active-value-line"
      data-follow=""
      aria-hidden="true"
      className={className}
      style={{
        "--chart-line-top": `calc(var(--chart-e-${seriesIndex}, 0) * 1%)`,
        "--chart-has-value": `var(--chart-v-${seriesIndex}, 0)`,
        ...style,
      }}>
      <ChartDatumContext value={{ key: dataKey, slot: null }}>{children}</ChartDatumContext>
    </div>
  );
}

Object.assign(ChartActiveValue, { displayName: "Chart.ActiveValue" });
Object.assign(ChartActiveValueLine, { displayName: "Chart.ActiveValueLine" });
