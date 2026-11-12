"use client";

/**
 * The text in the clock's hole and its value readouts. The Center lays its children in the square
 * inscribed in the hole, and by default prints the first series' active value, or the value at
 * `now` with nothing active, over the slot's label. ActiveValue prints one series' value at the
 * active slot, or at its `fallback` slot, and inside a Headline it is exposed text. They read the
 * series model, never plot geometry.
 */
import { use } from "react";
import type { ReactElement, ReactNode } from "react";

import { useActiveIndex } from "./chart-active-point";
import { useCentreFit } from "./chart-centre-fit";
import { clockDrawingIn, usePolarContext } from "./chart-polar-context";
import type { ClockDrawing } from "./chart-polar-context";
import { ChartHeadlineContext } from "./chart-scope-contexts";
import { fallbackSlot, readingAt } from "./chart-series-readout";
import { slotLabel } from "./chart-text";
import type { ChartFallback, ChartLayerProps, ValueFormat } from "./chart-types";
import { ChartValueRun } from "./chart-value-run";
import { formatValueRun } from "./format/value-format";
import { assertKnownKey } from "./layout/errors";

/**
 * Props for `ClockChart.Center`, a closed part.
 *
 * @beta
 */
export type ClockChartCenterProps = ChartLayerProps & {
  /**
   * The hole's content, such as an `ActiveValue` over a label. The first series' value at the active
   * slot, or at `now`, over the slot's label is the default.
   */
  children?: ReactNode;
};

/**
 * Props for `ClockChart.ActiveValue`, a closed part.
 *
 * @beta
 */
export type ClockChartActiveValueProps = ChartLayerProps & {
  /** The series to print. */
  dataKey: string;
  /** The datum to print when nothing is active. "now" by default. */
  fallback?: ChartFallback;
  /** The value format. The series' config `format` is the default. */
  format?: ValueFormat;
};

/** The slot a value part prints: the active slot, or the fallback's. */
function useShownSlot(clock: ClockDrawing, dataKey: string, fallback: ChartFallback): number | null {
  const { kernel } = usePolarContext("ClockChart.ActiveValue", ["clock"]);
  const active = useActiveIndex({ store: kernel.store, window: clock.text.model.window }, true);
  return active ?? fallbackSlot(clock.text, dataKey, fallback);
}

/**
 * One series' value at the active slot, or at the `fallback` slot with nothing active, "now" by
 * default. Inside a Headline it is exposed text with a visually hidden spoken twin wherever the
 * spoken form differs, and anywhere else it is plot output that readers skip.
 *
 * @beta
 */
export function ClockChartActiveValue({
  dataKey,
  fallback = "now",
  format,
  className,
  style,
}: ClockChartActiveValueProps): ReactElement {
  const { model } = usePolarContext("ClockChart.ActiveValue", ["clock"]);
  const clock = clockDrawingIn(model, "ClockChart.ActiveValue");
  assertKnownKey("ClockChart.ActiveValue", clock.text.config, dataKey);
  const exposed = use(ChartHeadlineContext);
  const slot = useShownSlot(clock, dataKey, fallback);
  const reading = slot === null ? undefined : readingAt(clock.text, dataKey, slot);
  const shownFormat = format ?? clock.text.config[dataKey]?.format ?? {};
  const label =
    reading?.kind === "reading"
      ? formatValueRun(clock.text.locale, reading.value, shownFormat, "full")
      : null;
  return (
    <span
      data-slot="clock-chart-active-value"
      aria-hidden={exposed ? undefined : "true"}
      className={className}
      style={style}>
      {label === null ? null : !exposed ? (
        <ChartValueRun run={label} number={label.number} />
      ) : label.text === label.spoken ? (
        label.text
      ) : (
        <>
          <span aria-hidden="true">{label.text}</span>
          <span data-spoken="">{label.spoken}</span>
        </>
      )}
    </span>
  );
}

/** The Center's default content: the first series' value over the shown slot's label. */
function DefaultCentre({ clock }: { readonly clock: ClockDrawing }): ReactElement | null {
  const key = clock.series[0]?.key;
  const slot = useShownSlot(clock, key ?? "", "now");
  if (key === undefined) return null;
  return (
    <>
      <ClockChartActiveValue dataKey={key} />
      <span data-slot="clock-chart-center-label">
        {slot === null ? null : slotLabel(clock.text, slot).text}
      </span>
    </>
  );
}

/**
 * The text in the dial's hole: its children sit in the square inscribed in the hole. The first
 * series' value at the active slot, or at `now`, over the slot's label is the default. Its text never
 * shrinks below 12 px: when the lines overflow the square it drops every line but the value, and
 * then the value.
 *
 * @beta
 */
export function ClockChartCenter({ children, className, style }: ClockChartCenterProps): ReactElement {
  const { model, box } = usePolarContext("ClockChart.Center", ["clock"]);
  const clock = clockDrawingIn(model, "ClockChart.Center");
  const fitted = useCentreFit();
  const half = (Math.SQRT2 * clock.inner) / 2;
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const percent = (value: number, of: number): string => `${((value / of) * 100).toFixed(3)}%`;
  return (
    <div
      data-slot="clock-chart-center"
      data-polar-layer=""
      aria-hidden="true"
      className={className}
      style={style}>
      <div
        ref={fitted}
        data-part="hole"
        style={{
          "--_left": percent(-half - box.left, width),
          "--_top": percent(-half - box.top, height),
          "--_width": percent(2 * half, width),
          "--_height": percent(2 * half, height),
        }}>
        {children ?? <DefaultCentre clock={clock} />}
      </div>
    </div>
  );
}

Object.assign(ClockChartActiveValue, { displayName: "ClockChart.ActiveValue" });
Object.assign(ClockChartCenter, { displayName: "ClockChart.Center" });
